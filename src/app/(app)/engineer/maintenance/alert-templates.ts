/**
 * Presentation and editing logic for the Maintenance page's "Slack messages"
 * card.
 *
 * Same split as ./blocks and ./attack-sources: everything here is pure and takes
 * plain strings, so the assertions that matter — a typo'd placeholder is caught
 * before a round trip, a preview shows exactly what Slack would show, an edit
 * that only changed whitespace still counts as an edit — are cheap to write here
 * and impossible to write against a rendered component in this suite.
 *
 * The one rule this module exists to enforce: what the engineer sees in the
 * preview is what lands in the channel. Every other function is in service of
 * that, and none of it is the security control — the backend re-validates the
 * template it is handed, because a client that can be edited cannot be the thing
 * that decides what is safe to store.
 */

import type { AlertTemplate, AlertTemplatePlaceholder } from "./actions";

/**
 * A placeholder is `{snake_case}`, matching the backend's Python-side
 * formatting. Deliberately NOT narrow: `{Ip_Address}` matches too (letters,
 * digits, underscore), so an engineer who mistypes a real placeholder gets told
 * about it rather than watching the typo render literally into Slack. Anything
 * else — a stray brace, an emoji, Slack's own `<@U123>` mention syntax — is
 * ordinary text and is left completely alone.
 *
 * Used only via `matchAll` and `replace`, both of which operate on a clone, so
 * the shared `lastIndex` of this literal is never advanced between calls.
 */
const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

/**
 * How long a message may be. Slack truncates a text block well before this, but
 * the number is not really about Slack: it is a sanity bound so a pasted stack
 * trace cannot become the outage alert. The backend enforces its own limit —
 * this one only saves a round trip.
 */
export const TEMPLATE_MAX_LENGTH = 2000;

/**
 * Every placeholder a template uses, in the order it first appears and without
 * repeats.
 */
export function extractPlaceholders(template: string): string[] {
  const seen: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    if (!seen.includes(match[1])) seen.push(match[1]);
  }
  return seen;
}

/**
 * The placeholders a template uses that the backend does not offer for that
 * kind — i.e. the ones that would arrive in the channel as literal braces.
 *
 * Case-sensitive on purpose: `{Ip_Address}` is not `{ip_address}`, and the whole
 * point of catching it here is that the two look identical at a glance.
 */
export function unknownPlaceholders(
  template: string,
  allowed: readonly AlertTemplatePlaceholder[],
): string[] {
  const names = new Set(allowed.map((p) => p.name));
  return extractPlaceholders(template).filter((name) => !names.has(name));
}

/**
 * Why this draft cannot be saved, or `null` if there is no obvious reason.
 *
 * THIS IS NOT THE VALIDATION. The backend validates whatever it is handed and is
 * the only thing standing between a bad template and the alert channel. This
 * check exists so the two mistakes an engineer actually makes — emptying the box
 * and mistyping a placeholder — are named in place instead of coming back as a
 * 422 several seconds later. Anything subtler is the backend's answer to give.
 */
export function templateProblem(
  template: string,
  allowed: readonly AlertTemplatePlaceholder[],
): string | null {
  if (!template.trim()) {
    return 'A message can’t be empty. Use "Reset to default" if you want the standard wording back.';
  }
  if (template.length > TEMPLATE_MAX_LENGTH) {
    return `That’s ${template.length} characters — the limit is ${TEMPLATE_MAX_LENGTH}.`;
  }
  const unknown = unknownPlaceholders(template, allowed);
  if (unknown.length > 0) {
    const one = unknown.length === 1;
    const offered = allowed.map((p) => `{${p.name}}`).join(", ");
    return (
      `${unknown.map((n) => `{${n}}`).join(", ")} ` +
      `${one ? "is not a placeholder" : "are not placeholders"} this message ` +
      `can use, so ${one ? "it" : "they"} would go to Slack as written. ` +
      (offered
        ? `Available: ${offered}.`
        : "This message takes no placeholders.")
    );
  }
  return null;
}

/**
 * A believable stand-in for one placeholder, for the preview.
 *
 * The backend sends each placeholder's name and description but no sample, so
 * the examples are derived here. Exact names first, then the shape of the name,
 * then a readable last resort — an unrecognised `{queue_depth}` still previews
 * as "example queue depth" rather than as an empty gap, which would make the
 * message look shorter than it really is.
 *
 * When the backend starts sending an `example` per placeholder, delete the
 * heuristics and read that instead; the preview is the only caller.
 */
export function exampleValue(name: string): string {
  const exact: Record<string, string> = {
    environment: "production",
    ip_address: "203.0.113.42",
    status_code: "500",
    error: "the database connection timed out",
    detail: "the database connection timed out",
    reason: "three failed health checks in a row",
    pattern: "enumeration: 202 addresses",
    duration: "4 minutes",
    minutes: "4",
    attempts: "222",
  };
  if (name in exact) return exact[name];

  const lower = name.toLowerCase();
  if (lower === "count" || lower.endsWith("_count")) return "3";
  if (lower.includes("email")) return "engineer@byu.edu";
  if (/(^|_)ips?(_|$)/.test(lower)) return "203.0.113.42";
  if (lower.includes("url") || lower.includes("link")) {
    return "https://finance.alumni.byu.edu";
  }
  if (
    lower.includes("time") ||
    lower.endsWith("_at") ||
    lower.includes("date")
  ) {
    return "Aug 19, 2026, 3:25 PM MDT";
  }
  if (lower.includes("status")) return "500";
  if (
    lower.includes("path") ||
    lower.includes("route") ||
    lower.includes("endpoint")
  ) {
    return "/alumni/search";
  }
  if (lower.includes("env")) return "production";
  if (lower.includes("name")) return "Jane Doe";
  return `example ${name.replace(/_/g, " ")}`;
}

/** Example values for one kind's whole placeholder list, keyed by name. */
export function exampleValues(
  allowed: readonly AlertTemplatePlaceholder[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const p of allowed) values[p.name] = exampleValue(p.name);
  return values;
}

/**
 * The message as Slack would show it.
 *
 * A placeholder with no value is left EXACTLY as written rather than blanked
 * out. Blanking it would hide the one mistake the preview is here to expose: a
 * template that reads perfectly in the editor and arrives in the channel with a
 * hole in it. Everything else in the string — Slack's `*bold*`, `<!here>`,
 * newlines — passes through untouched, because the preview's job is fidelity,
 * not prettiness.
 */
export function renderPreview(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    name in values ? values[name] : whole,
  );
}

/** The preview for one kind's current draft, using that kind's examples. */
export function previewTemplate(template: AlertTemplate, draft: string): string {
  return renderPreview(draft, exampleValues(template.placeholders));
}

/**
 * Has this draft moved away from what is stored?
 *
 * Compared byte for byte, with no trimming. A trailing space or a blank line is
 * a real difference in a Slack message, and a dirty check that quietly ignored
 * one would leave the engineer looking at a Save button that appears to do
 * nothing.
 */
export function isDirty(draft: string, saved: string): boolean {
  return draft !== saved;
}

/** Already the shipped wording? Then there is nothing for "reset" to undo. */
export function isDefault(saved: string, defaultValue: string): boolean {
  return saved === defaultValue;
}

/**
 * Which kinds hold edits that have not been saved.
 *
 * Drafts are kept for every kind, including collapsed ones — closing a message
 * must never be what throws an edit away — so this is what the card counts
 * before it warns on leaving the page.
 */
export function dirtyKinds(
  templates: readonly AlertTemplate[],
  drafts: Readonly<Record<string, string>>,
): string[] {
  return templates
    .filter((t) => t.kind in drafts && isDirty(drafts[t.kind], t.value))
    .map((t) => t.kind);
}

/** "2 messages have unsaved changes", or null when everything is saved. */
export function unsavedSummary(dirtyCount: number): string | null {
  if (dirtyCount <= 0) return null;
  return dirtyCount === 1
    ? "1 message has unsaved changes."
    : `${dirtyCount} messages have unsaved changes.`;
}

/**
 * Drop `{name}` in at the caret, replacing whatever was selected, and say where
 * the caret should end up.
 *
 * Insertion beats copy-and-paste here for a specific reason: the placeholder
 * list is the only record of what a kind actually accepts, and retyping one by
 * hand is exactly how `{ip_address}` becomes `{ip_adress}` — a mistake that is
 * invisible in the editor and only shows up as literal braces in the channel.
 * The caret lands after the inserted token so typing can carry on.
 */
export function insertPlaceholder(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  name: string,
): { text: string; cursor: number } {
  const token = `{${name}}`;
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  return {
    text: text.slice(0, start) + token + text.slice(end),
    cursor: start + token.length,
  };
}
