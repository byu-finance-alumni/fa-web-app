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

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/**
 * Semgrep rules that are KNOWN, REVIEWED, and deliberately kept out of the
 * verdict. They still appear in the report under their own heading — this hides
 * nothing, it only stops a standing condition being re-reported as news weekly.
 *
 * ⚠️ THE VERDICT IS ONLY WORTH READING IF IT IS TRUE. The API's first real
 * Slack message was ":rotating_light: 1 high, 22 medium" and all 23 were already
 * understood. A siren that fires every week for something nobody intends to act
 * on trains you to ignore the week it matters.
 */
const ACCEPTED_SEMGREP_RULES = {
  "github-actions-mutable-action-tag":
    "Known and accepted 2026-08-24: our workflows use actions/checkout@v4 rather than a pinned commit SHA. Real supply-chain hardening we have chosen not to do yet, not a false positive. Delete this entry the day we decide to pin.",
};

/**
 * The GHSA ids already accepted for PRODUCTION dependencies, read straight out
 * of scripts/audit-prod.mjs.
 *
 * ⚠️ PARSED, NOT IMPORTED, AND NOT COPIED. Importing that module would execute
 * it — it runs `npm audit` at load time. Copying the list would let the merge
 * gate and the weekly report drift into disagreeing about which advisories are
 * accepted, which is exactly the confusion this report exists to remove.
 * If the parse finds nothing, we count every shipping advisory as needing
 * attention: failing loud beats quietly reporting all-clear.
 */
function acceptedAdvisories() {
  try {
    const src = readFileSync(join(ROOT, "scripts/audit-prod.mjs"), "utf8");
    const allow = src.slice(src.indexOf("const ALLOW"), src.indexOf("]);"));
    return new Set([...allow.matchAll(/GHSA-[0-9a-z-]+/g)].map((m) => m[0]));
  } catch {
    return new Set();
  }
}

const arg = (name, fallback = "") => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

function load(name) {
  // Read first and ask questions later, rather than exists() → stat() → read().
  // That sequence is a TOCTOU race (CodeQL js/file-system-race) and it would
  // have shown up as a `high` in this very report every week — a scanner that
  // starts life flagging its own reporter is one nobody keeps reading.
  let raw;
  try {
    raw = readFileSync(join(ROOT, name), "utf8");
  } catch {
    return null; // absent = this tool did not run; the caller reports UNKNOWN
  }
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
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
  if (!all)
    return {
      state: "UNKNOWN",
      lines: ["Dependency audit did not report."],
      acceptedLines: [],
      n: 0,
      prod: 0,
      unaccepted: 0,
    };
  // ⚠️ "Does it ship to a browser?" comes from a SEPARATE `npm audit --omit=dev`
  // run, not from reading `dev`/`effects` off the full tree. That is the same
  // definition scripts/audit-prod.mjs uses to decide what blocks a merge, so
  // the weekly report and the merge gate can never disagree about which
  // advisories actually matter.
  const prodReport = load("npm-audit-prod.json");
  const prodNames = new Set(Object.keys(prodReport?.vulnerabilities ?? {}));
  const accepted = acceptedAdvisories();
  const vulns = all.vulnerabilities ?? {};
  const lines = [];
  const acceptedLines = [];
  let n = 0;
  let unaccepted = 0;
  for (const [name, v] of Object.entries(vulns)) {
    n += 1;
    const ships = prodNames.has(name);
    // Every GHSA id behind this package, from the advisory objects in `via`.
    const ids = (v.via ?? [])
      .map((x) => (typeof x === "object" ? String(x.url ?? "").split("/").pop() : null))
      .filter((x) => x && x.startsWith("GHSA-"));
    const isAccepted = ships && ids.length > 0 && ids.every((id) => accepted.has(id));
    const line = `- **${(v.severity ?? "?").toUpperCase()}** \`${name}\`${ships ? "" : " _(dev only — never reaches a browser)_"} — fix available: ${Boolean(v.fixAvailable)}`;
    if (isAccepted) {
      acceptedLines.push(`${line} — already allowlisted in scripts/audit-prod.mjs`);
    } else {
      lines.push(line);
      if (ships) unaccepted += 1;
    }
  }
  if (!prodReport)
    lines.unshift("_(!) The production-scope audit did not run; dev/prod split below is unknown._");
  // ⚠️ THE AUTHORITY ON "does a shipping advisory need attention?" is
  // scripts/audit-prod.mjs, whose exit code the workflow records here. It knows
  // that `next` and `postcss` are flagged only through transitively accepted
  // advisories; re-deriving that from GHSA ids reported two false problems.
  // Absent gate file = we do not know, so fall back to the conservative count.
  const gate = load("audit-prod-gate.json");
  if (gate && gate.ok === true) unaccepted = 0;

  return {
    // Dev-only advisories are reported but never gate the verdict: they cannot
    // reach a browser, and treating them as urgent is what got the merge gate
    // scoped to --omit=dev in the first place.
    state: unaccepted ? "FINDINGS" : "OK",
    lines: lines.length ? lines : ["No advisories."],
    acceptedLines,
    n,
    prod: prodReport ? prodNames.size : n,
    unaccepted,
  };
}

function semgrep() {
  const data = load("semgrep.json");
  if (!data)
    return { state: "UNKNOWN", lines: ["Semgrep did not report."], counts: {}, acceptedLines: [] };
  const map = { ERROR: "high", WARNING: "medium", INFO: "low" };
  const counts = {};
  const lines = [];
  const acceptedCounts = {};
  for (const r of data.results ?? []) {
    const rule = String(r.check_id ?? "").split(".").pop();
    if (rule in ACCEPTED_SEMGREP_RULES) {
      acceptedCounts[rule] = (acceptedCounts[rule] ?? 0) + 1;
      continue;
    }
    const sev = map[r.extra?.severity] ?? "low";
    counts[sev] = (counts[sev] ?? 0) + 1;
    const msg = (r.extra?.message ?? "").trim().split("\n")[0].slice(0, 200);
    lines.push(`- **${sev.toUpperCase()}** \`${rule}\` — ${r.path}:${r.start?.line}\n  - ${msg}`);
  }
  const acceptedLines = Object.entries(acceptedCounts)
    .sort()
    .map(([rule, n]) => `- \`${rule}\` × ${n} — ${ACCEPTED_SEMGREP_RULES[rule]}`);
  const actionable = Object.entries(counts)
    .filter(([s]) => s !== "low")
    .reduce((a, [, n]) => a + n, 0);
  return {
    state: actionable ? "FINDINGS" : "OK",
    lines: lines.length ? lines : ["No findings."],
    counts,
    acceptedLines,
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

// THE VERDICT COMES FIRST AND IN PLAIN ENGLISH. The question being answered on
// a Sunday night is "do I need to do something?", not "how many rules matched?".
// Counts come after the answer, and only when the answer is yes.
// ASCII only: this string is printed to a console whose encoding we do not
// control and is passed through a shell into a JSON body.
const bits = [];
if (critical) bits.push(`${critical} critical`);
if (high) bits.push(`${high} high`);
if (medium) bits.push(`${medium} medium`);
if (deps.unaccepted) bits.push(`${deps.unaccepted} shipping dependencies with new advisories`);

const needsAttention = critical + high + medium + deps.unaccepted;
let verdict;
let summary;
if (unknown.length) {
  // Not "all clear": part of the sweep did not happen, and saying so is the
  // whole reason a missing report is tracked separately from a clean one.
  verdict = "INCOMPLETE";
  summary = `INCOMPLETE - ${unknown.join(", ")} did not run, so this week is only a partial check`;
  if (bits.length) summary += ` (and ${bits.join(", ")} in what did run)`;
} else if (!needsAttention) {
  verdict = "ALL CLEAR";
  summary = "all clear, nothing needs you";
} else {
  verdict = "NEEDS A LOOK";
  summary = `${needsAttention} ${needsAttention === 1 ? "thing needs" : "things need"} a look - ${bits.join(", ")}`;
}

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
  ...(deps.acceptedLines.length || sg.acceptedLines.length
    ? [
        "## Known and accepted — deliberately not in the verdict",
        "",
        "Reviewed, understood, and kept out of the count above so a standing",
        "condition is not re-reported as news every week. The dependency entries",
        "are read live from scripts/audit-prod.mjs, so this list and the merge",
        "gate cannot disagree.",
        "",
        ...deps.acceptedLines,
        ...sg.acceptedLines,
        "",
      ]
    : []),
  "## CodeQL",
  "",
  "Results are published to the repository's Security tab rather than duplicated here.",
].join("\n");

writeFileSync(join(ROOT, "security-report.md"), report);

if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\nverdict=${verdict}\n`);

console.log(summary);
