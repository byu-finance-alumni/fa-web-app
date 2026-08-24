/**
 * Project-specific security tripwires for fa-web-app.
 *
 * The generic scanners (gitleaks, npm audit, Semgrep, CodeQL) cover the generic
 * ground. This covers ours: the few invariants that decide whether a stranger
 * can reach alumni PII, and whether a server secret can end up in a bundle the
 * browser downloads.
 *
 * Every check is a TRIPWIRE — it states what is true today and reports
 * DIVERGENCE — rather than a heuristic that scores code. A weekly report only
 * gets read if it is silent when nothing changed.
 *
 *   node scripts/security-scan.mjs                 # human-readable
 *   node scripts/security-scan.mjs --json out.json
 *   node scripts/security-scan.mjs --fail-on high  # non-zero exit for CI
 *
 * ⚠️ WHEN ONE FIRES, THE FIX IS USUALLY THE CODE, NOT THE EXPECTATION BELOW.
 * Editing an expected value here is a security decision — do it in a commit that
 * says why, never as a reflex to turn a build green.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

const CRITICAL = "critical";
const HIGH = "high";
const MEDIUM = "medium";
const INFO = "info";
const ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * The two — and only two — ways a request can reach a page without a session.
 *
 * They are NOT the same thing and the difference matters:
 *   PUBLIC_PATHS  still RUN auth; they just aren't redirected away from when
 *                 signed out.
 *   isNoAuthPath  SKIPS auth entirely. Today that is the survey, which renders
 *                 alumni PII, accepts edits and takes a photo upload from a
 *                 stranger holding a link.
 *
 * ⚠️ The repo's own debugging recipe is "add a throwaway page to PUBLIC_PATHS,
 * drive it with Playwright, then revert the middleware line". This tripwire is
 * what catches the day somebody forgets the revert.
 */
const EXPECTED_PUBLIC_PATHS = ["/", "/login", "/maintenance"];
const EXPECTED_NO_AUTH_RULE = `pathname === "/survey" || pathname.startsWith("/survey/")`;

/** Public env names that are fine to ship to the browser, by design. */
const ALLOWED_PUBLIC_ENV = new Set([
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);

/** Substrings that have no business in a NEXT_PUBLIC_ name. */
const SECRETY = ["SECRET", "SERVICE_ROLE", "PRIVATE", "PASSWORD", "TOKEN"];

const findings = [];
const add = (check, severity, where, detail) =>
  findings.push({ check, severity, where, detail });

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(p)) out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join("/");
const FILES = walk(SRC);
const isTest = (p) => /\.(test|spec)\.[jt]sx?$/.test(p);

// --- 1. The public surface has not widened --------------------------------

function checkPublicSurface() {
  const mw = readFileSync(join(SRC, "utils/supabase/middleware.ts"), "utf8");
  const m = mw.match(/const PUBLIC_PATHS\s*=\s*\[([^\]]*)\]/);
  if (!m) {
    add(
      "public-paths-unreadable",
      HIGH,
      "src/utils/supabase/middleware.ts",
      "Could not find PUBLIC_PATHS — the tripwire that watches the unauthenticated surface is not working. Fix the check, do not delete it.",
    );
  } else {
    const actual = [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
    const added = actual.filter((p) => !EXPECTED_PUBLIC_PATHS.includes(p));
    const removed = EXPECTED_PUBLIC_PATHS.filter((p) => !actual.includes(p));
    if (added.length)
      add(
        "public-path-added",
        CRITICAL,
        "src/utils/supabase/middleware.ts",
        `PUBLIC_PATHS gained ${JSON.stringify(added)} — a page reachable while signed out. If deliberate, update EXPECTED_PUBLIC_PATHS with a reason; if it is a leftover debugging entry, remove it.`,
      );
    if (removed.length)
      add(
        "public-path-removed",
        INFO,
        "src/utils/supabase/middleware.ts",
        `PUBLIC_PATHS no longer contains ${JSON.stringify(removed)} — update EXPECTED_PUBLIC_PATHS.`,
      );
  }

  const root = readFileSync(join(SRC, "middleware.ts"), "utf8");
  const rule = root.match(/function isNoAuthPath[^)]*\)[^{]*\{\s*return ([^;]+);/s);
  if (!rule) {
    add(
      "no-auth-rule-unreadable",
      HIGH,
      "src/middleware.ts",
      "Could not read isNoAuthPath — the check on the auth-skipping surface is not working.",
    );
  } else if (rule[1].replace(/\s+/g, " ").trim() !== EXPECTED_NO_AUTH_RULE) {
    add(
      "no-auth-rule-changed",
      CRITICAL,
      "src/middleware.ts",
      `isNoAuthPath now reads \`${rule[1].replace(/\s+/g, " ").trim()}\` — this is the set of routes that skip authentication ENTIRELY. Confirm the new rule cannot match more than the survey.`,
    );
  }
}

// --- 2. No server secret can reach the browser -----------------------------

function checkClientSecrets() {
  for (const f of FILES) {
    if (isTest(f)) continue;
    const src = readFileSync(f, "utf8");
    const isClient = /^\s*["']use client["']/m.test(src);
    for (const [, name] of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (name.startsWith("NEXT_PUBLIC_")) {
        if (!ALLOWED_PUBLIC_ENV.has(name))
          add(
            "unreviewed-public-env",
            SECRETY.some((s) => name.includes(s)) ? CRITICAL : MEDIUM,
            rel(f),
            `${name} is inlined into the browser bundle. Anything NEXT_PUBLIC_ is world-readable — confirm it is meant to be, then add it to ALLOWED_PUBLIC_ENV.`,
          );
      } else if (isClient) {
        add(
          "server-env-in-client",
          CRITICAL,
          rel(f),
          `${name} is read in a "use client" module. Non-public env is undefined in the browser at best, and bundled at worst — move this to a server component or a server action.`,
        );
      }
    }
  }
}

// --- 3. No raw HTML injection ---------------------------------------------

function checkDangerousHtml() {
  for (const f of FILES) {
    if (isTest(f)) continue;
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) return;
      if (line.includes("dangerouslySetInnerHTML"))
        add(
          "dangerous-html",
          HIGH,
          `${rel(f)}:${i + 1}`,
          "dangerouslySetInnerHTML — this app renders alumni-supplied and public-submitted text; there is no safe use of it here without an explicit sanitiser.",
        );
      if (/\beval\(|new Function\(/.test(line))
        add("dangerous-eval", HIGH, `${rel(f)}:${i + 1}`, "eval / new Function in client code.");
    });
  }
}

// --- 4. The external-URL sanitiser is still in place -----------------------

function checkUrlSanitiser() {
  const lib = join(SRC, "lib/opportunityLinks.ts");
  let src;
  try {
    src = readFileSync(lib, "utf8");
  } catch {
    add(
      "url-sanitiser-missing",
      CRITICAL,
      "src/lib/opportunityLinks.ts",
      "The module holding safeExternalHref is gone. Public-submitted URLs become hrefs; without a scheme check, `javascript:` is a click away from running.",
    );
    return;
  }
  if (!/safeExternalHref/.test(src) || !/http:|https:/.test(src))
    add(
      "url-sanitiser-weakened",
      CRITICAL,
      "src/lib/opportunityLinks.ts",
      "safeExternalHref or its http(s)-only scheme check is missing.",
    );
}

/*
 * ⚠️ DELIBERATELY NOT CHECKED: "every href={expr} goes through the sanitiser."
 * It was written, and it reported 73 mediums on a clean tree — almost all of
 * them internal pagination links like href={pageHref(offset + LIMIT)}. A
 * weekly report with 73 false positives is a report nobody opens, which costs
 * more security than the check could ever buy. The invariant that actually
 * matters — the sanitiser exists and is http(s)-only — is asserted above, and
 * the one component rendering public-submitted URLs (LinksTable) carries its
 * own test asserting it never uses dangerouslySetInnerHTML.
 */

// --- run -------------------------------------------------------------------

checkPublicSurface();
checkClientSecrets();
checkDangerousHtml();
checkUrlSanitiser();

findings.sort(
  (a, b) =>
    ORDER[a.severity] - ORDER[b.severity] ||
    a.check.localeCompare(b.check) ||
    a.where.localeCompare(b.where),
);

const counts = Object.fromEntries(
  Object.keys(ORDER).map((s) => [s, findings.filter((f) => f.severity === s).length]),
);
const summary =
  Object.entries(counts)
    .filter(([, n]) => n)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ") || "no findings";

const lines = [
  "# fa-web-app — project security tripwires",
  "",
  `${FILES.length} source files inspected. ${summary}.`,
  "",
];
for (const f of findings) {
  lines.push(`- **${f.severity.toUpperCase()}** \`${f.check}\` — ${f.where}`);
  lines.push(`  - ${f.detail}`);
}
console.log(lines.join("\n"));

const argv = process.argv.slice(2);
const jsonAt = argv.indexOf("--json");
if (jsonAt !== -1 && argv[jsonAt + 1])
  writeFileSync(
    argv[jsonAt + 1],
    JSON.stringify({ tool: "fa-web-app tripwires", files: FILES.length, findings }, null, 2),
  );

const failAt = argv.indexOf("--fail-on");
if (failAt !== -1 && argv[failAt + 1]) {
  const limit = ORDER[argv[failAt + 1]];
  if (findings.some((f) => ORDER[f.severity] <= limit)) process.exit(1);
}
