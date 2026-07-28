#!/usr/bin/env node
/**
 * Prod dependency audit with a documented, temporary allowlist.
 *
 * Fails on any HIGH/CRITICAL advisory in runtime deps (`npm audit --omit=dev`)
 * EXCEPT the ones listed below. Those are accepted because:
 *   - there is NO stable fix yet — the Next.js patch lands only in a
 *     16.3.0-preview; the latest stable release is still inside the advisory
 *     range, and `npm audit fix` cannot resolve them, and
 *   - prod already runs these exact versions, so they are a tracked, accepted
 *     risk — not a regression introduced by a promotion.
 *
 * postcss/sharp are pinned transitively by Next, so they move when Next moves.
 *
 * REVISIT: once Next ships a stable release that clears these, delete the
 * corresponding entries. When the map is empty this is just `npm audit` again.
 */
import { execSync } from "node:child_process";

// GHSA id -> why it's accepted. HIGH/CRITICAL only (moderates never gate, so
// listing them would just add noise). Keep the justification honest and current.
const ALLOW = new Map([
  // Next.js — fixed only in a 16.3.0-preview; no stable release yet.
  ["GHSA-m99w-x7hq-7vfj", "next: DoS via Server Actions"],
  ["GHSA-89xv-2m56-2m9x", "next: SSRF in Server Actions on custom servers"],
  ["GHSA-p9j2-gv94-2wf4", "next: SSRF in rewrites via destination hostname"],
  // postcss / sharp — pinned transitively by next; clear when next moves.
  ["GHSA-6g55-p6wh-862q", "postcss (transitive via next)"],
  ["GHSA-r28c-9q8g-f849", "postcss (transitive via next)"],
  ["GHSA-f88m-g3jw-g9cj", "sharp (transitive via next)"],
]);

let report;
try {
  report = JSON.parse(execSync("npm audit --omit=dev --json", { encoding: "utf8" }));
} catch (err) {
  // `npm audit` exits non-zero when advisories exist; the JSON is still on stdout.
  if (!err.stdout) throw err;
  report = JSON.parse(err.stdout.toString());
}

const blocking = new Set();
const used = new Set();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object" || !via.url) continue;
    const severity = via.severity || vuln.severity;
    if (severity !== "high" && severity !== "critical") continue;
    const ghsa = via.url.split("/").pop();
    if (ALLOW.has(ghsa)) used.add(ghsa);
    else blocking.add(`${ghsa}  (${via.name}, ${severity})`);
  }
}

if (blocking.size) {
  console.error("New high/critical advisories not in the allowlist:\n");
  for (const b of [...blocking].sort()) console.error("  " + b);
  console.error(
    "\nUpgrade to fix them. Only if there is genuinely no fix, add the GHSA to " +
      "the allowlist in scripts/audit-prod.mjs with a justification.",
  );
  process.exit(1);
}

// Flag stale allowlist entries so it shrinks back to empty as fixes land.
const stale = [...ALLOW.keys()].filter((id) => !used.has(id));
if (stale.length) {
  console.log(`Note: ${stale.length} allowlisted advisory(ies) no longer present — remove: ${stale.join(", ")}`);
}
console.log(`No blocking high/critical advisories (${used.size} accepted/allowlisted; revisit when Next ships a stable fix).`);
