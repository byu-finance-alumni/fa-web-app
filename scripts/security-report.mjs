/**
 * Fold every scanner's output into one report and one Slack line.
 *
 * The weekly audit runs four tools that disagree about everything — severity
 * names, JSON shape, what counts as a finding. This normalises them so the
 * Slack message can be a single sentence and the artifact can be read top to
 * bottom.
 *
 * ⚠️ A MISSING FILE IS NOT ZERO FINDINGS. Every scanner step is
 * `continue-on-error` so one flaky download cannot cost us the other three
 * reports — which means "no JSON on disk" means "this tool did not run", not
 * "this tool found nothing". Those report as UNKNOWN and degrade the verdict,
 * because a scan that quietly checked less than you think is the failure mode
 * that makes a weekly audit worthless.
 */

import { existsSync, readFileSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const arg = (name, fallback = "") => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

function load(name) {
  const p = join(ROOT, name);
  if (!existsSync(p) || !statSync(p).size) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function tripwires() {
  const data = load("tripwires.json");
  if (!data) return { state: "UNKNOWN", lines: ["Project tripwires did not report."], counts: {} };
  const counts = {};
  const lines = [`${data.files ?? "?"} source files inspected.`];
  for (const f of data.findings ?? []) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    lines.push(`- **${f.severity.toUpperCase()}** \`${f.check}\` — ${f.where}\n  - ${f.detail}`);
  }
  const actionable = Object.entries(counts)
    .filter(([s]) => s !== "info")
    .reduce((a, [, n]) => a + n, 0);
  return { state: actionable ? "FINDINGS" : "OK", lines, counts };
}

function npmAudit() {
  const all = load("npm-audit.json");
  if (!all) return { state: "UNKNOWN", lines: ["Dependency audit did not report."], n: 0, prod: 0 };
  // ⚠️ "Does it ship to a browser?" comes from a SEPARATE `npm audit --omit=dev`
  // run, not from reading `dev`/`effects` off the full tree. That is the same
  // definition scripts/audit-prod.mjs uses to decide what blocks a merge, so
  // the weekly report and the merge gate can never disagree about which
  // advisories actually matter.
  const prodReport = load("npm-audit-prod.json");
  const prodNames = new Set(Object.keys(prodReport?.vulnerabilities ?? {}));
  const vulns = all.vulnerabilities ?? {};
  const lines = [];
  let n = 0;
  for (const [name, v] of Object.entries(vulns)) {
    n += 1;
    const ships = prodNames.has(name);
    lines.push(
      `- **${(v.severity ?? "?").toUpperCase()}** \`${name}\`${ships ? "" : " _(dev only — never reaches a browser)_"} — fix available: ${Boolean(v.fixAvailable)}`,
    );
  }
  if (!prodReport)
    lines.unshift("_(!) The production-scope audit did not run; dev/prod split below is unknown._");
  return {
    state: n ? "FINDINGS" : "OK",
    lines: lines.length ? lines : ["No advisories."],
    n,
    prod: prodReport ? prodNames.size : n,
  };
}

function semgrep() {
  const data = load("semgrep.json");
  if (!data) return { state: "UNKNOWN", lines: ["Semgrep did not report."], counts: {} };
  const map = { ERROR: "high", WARNING: "medium", INFO: "low" };
  const counts = {};
  const lines = [];
  for (const r of data.results ?? []) {
    const sev = map[r.extra?.severity] ?? "low";
    counts[sev] = (counts[sev] ?? 0) + 1;
    const msg = (r.extra?.message ?? "").trim().split("\n")[0].slice(0, 200);
    lines.push(
      `- **${sev.toUpperCase()}** \`${String(r.check_id ?? "").split(".").pop()}\` — ${r.path}:${r.start?.line}\n  - ${msg}`,
    );
  }
  const actionable = Object.entries(counts)
    .filter(([s]) => s !== "low")
    .reduce((a, [, n]) => a + n, 0);
  return {
    state: actionable ? "FINDINGS" : "OK",
    lines: lines.length ? lines : ["No findings."],
    counts,
  };
}

function gitleaks() {
  const data = load("gitleaks.json");
  if (!data)
    return {
      state: "UNKNOWN",
      lines: ["Secret scan produced no report (clean, or it did not run)."],
      n: 0,
    };
  const lines = data.map(
    (d) => `- \`${d.RuleID}\` in ${d.File} @ ${String(d.Commit ?? "").slice(0, 8)}`,
  );
  return { state: data.length ? "FINDINGS" : "OK", lines: lines.length ? lines : ["None."], n: data.length };
}

const tw = tripwires();
const deps = npmAudit();
const sg = semgrep();
const gl = gitleaks();

const critical = (tw.counts.critical ?? 0) + (sg.counts.critical ?? 0) + gl.n;
const high = (tw.counts.high ?? 0) + (sg.counts.high ?? 0);
const medium = (tw.counts.medium ?? 0) + (sg.counts.medium ?? 0);
const unknown = [
  ["tripwires", tw.state],
  ["dependencies", deps.state],
  ["semgrep", sg.state],
  ["secrets", gl.state],
]
  .filter(([, s]) => s === "UNKNOWN")
  .map(([n]) => n);

const bits = [];
if (critical) bits.push(`${critical} critical`);
if (high) bits.push(`${high} high`);
if (medium) bits.push(`${medium} medium`);
if (deps.prod) bits.push(`${deps.prod} shipping dependencies with advisories`);
let summary = bits.length ? bits.join(", ") : "nothing new";
if (deps.n - deps.prod > 0) summary += ` (+${deps.n - deps.prod} dev-only)`;
// ASCII only: this string is printed to a console whose encoding we do not
// control and is passed through a shell into a JSON body.
if (unknown.length) summary += ` (!) ${unknown.join(", ")} did not report`;

let verdict = ":white_check_mark:";
if (unknown.length) verdict = ":warning:";
if (medium || deps.prod) verdict = ":large_yellow_circle:";
if (critical || high) verdict = ":rotating_light:";

const runUrl = arg("--run-url");
const report = [
  `# ${arg("--repo", "fa-web-app")} — weekly security audit`,
  "",
  `**${summary}**`,
  "",
  runUrl ? `[Workflow run](${runUrl})` : "",
  "",
  `## Project tripwires (${tw.state})`,
  "",
  "The checks that know what this app is: the two — and only two — ways to reach",
  "a page without a session, and the rule that no server secret is readable from",
  "a client component.",
  "",
  ...tw.lines,
  "",
  `## Dependencies (${deps.state}) — full tree, not just what ships`,
  "",
  "CI audits production packages only, on purpose. These are all of them.",
  "",
  ...deps.lines,
  "",
  `## Semgrep (${sg.state})`,
  "",
  ...sg.lines.slice(0, 100),
  sg.lines.length > 100 ? "\n_…truncated; see semgrep.json._" : "",
  "",
  `## Secrets in git history (${gl.state})`,
  "",
  ...gl.lines,
  "",
  "## CodeQL",
  "",
  "Results are published to the repository's Security tab rather than duplicated here.",
].join("\n");

writeFileSync(join(ROOT, "security-report.md"), report);

if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\nverdict=${verdict}\n`);

console.log(summary);
