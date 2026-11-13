import { LEAF_HREFS, NAV, type NavItem } from "@/components/shell/nav";
import { OUTREACH_GROUPS } from "@/lib/outreach";

/**
 * The profile's "Back to <place>" button (#937).
 *
 * Every link INTO a profile carries the page it was clicked on as `?from=`,
 * query string and all, so Back lands on the same list with the same filters,
 * search, sort and page. A profile opened any other way — a bookmark, a pasted
 * link, a `from` this file refuses — falls back to the plain list.
 *
 * ⚠️ `from` IS USER INPUT. Anybody can hand someone a profile link with any
 * `from` on it, and it becomes the href of a button on our page. So it is only
 * ever honoured as an internal path into a screen the app's own nav knows about
 * (see `safeReturnPath`) — never another site, never a scheme, never a form.
 */
export const RETURN_PARAM = "from";

/** The hidden form field that carries `from` through a profile edit form to the
 *  save action, which re-validates it before putting it on the redirect. */
export const RETURN_FIELD = "__return_to";

/** Longer than any real list URL; a nested or padded one is refused, not cut. */
const MAX_RETURN_LENGTH = 2000;

/** Throwaway origin used only to let `URL` parse a path and prove it stays on it. */
const BASE = "http://return-to.invalid";

/** `/alumni/123`, `/friends/9/…` — a profile or one of its edit screens. */
const PROFILE_PATH = /^\/(alumni|friends)\/\d+(\/|$)/;

/**
 * Whether `pathname` is a profile (or a profile's edit screens). Links clicked
 * ON a profile forward that profile's own `from` rather than pointing back at
 * it, so the Back button always names a list, never "another profile".
 */
export function isProfilePath(pathname: string): boolean {
  return PROFILE_PATH.test(pathname);
}

/** Screens you go to in order to enter something and leave (BackLink's rule):
 *  coming "back" to a half-filled import wizard would only show it empty. */
function isFormPath(pathname: string): boolean {
  return pathname
    .split("/")
    .some((s) => s === "edit" || s === "new" || s === "import");
}

/** The nav leaf whose href is the longest match for `pathname`, if any. */
function navLeafFor(pathname: string): string | null {
  return LEAF_HREFS.reduce<string | null>((best, href) => {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) return best;
    return best === null || href.length > best.length ? href : best;
  }, null);
}

/**
 * `raw` as a safe internal return path (pathname + query, no hash), or null.
 *
 * Refused: anything not a string; anything not starting with exactly one "/"
 * ("//evil.com" is protocol-relative); any backslash (browsers read "/\" as
 * "//"); any control character or whitespace (the URL parser silently strips
 * tabs and newlines, so "/\t/evil.com" would become "//evil.com"); anything that
 * parses to a different origin; a profile or form screen; and any path that is
 * not under a screen in the app's nav — so even a same-site link can only point
 * at a list someone could have navigated to, not at an API or auth route.
 */
export function safeReturnPath(
  raw: string | string[] | null | undefined,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_RETURN_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (/[\u0000- \u007f-\u009f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;

  const { pathname, search } = url;
  if (isProfilePath(pathname) || isFormPath(pathname)) return null;
  if (navLeafFor(pathname) === null) return null;
  return `${pathname}${search}`;
}

/** Every nav leaf's label, by href. */
const LEAF_LABELS: ReadonlyMap<string, string> = (() => {
  const out = new Map<string, string>();
  const walk = (item: NavItem) => {
    if (item.children) item.children.forEach(walk);
    else if (!out.has(item.href)) out.set(item.href, item.label);
  };
  NAV.forEach(walk);
  return out;
})();

/**
 * What the Back button calls `path`: "Back to <this>". Names the list itself
 * where the menu label would be too vague ("NetTrek Hosts", not "NetTreks"),
 * and otherwise the nav entry the path lives under.
 */
export function returnLabel(path: string): string {
  const pathname = path.split("?")[0];
  const nettrek = /^\/nettreks\/[^/]+\/([^/]+)$/.exec(pathname);
  if (nettrek) {
    if (nettrek[1] === "hosts") return "NetTrek Hosts";
    if (nettrek[1] === "area_alumni") return "Area Alumni";
  }
  const outreach = /^\/outreach\/([^/]+)/.exec(pathname);
  if (outreach) {
    const group = OUTREACH_GROUPS.find((g) => g.key === outreach[1]);
    if (group) return group.label;
  }
  if (pathname.startsWith("/events/")) return "Event";
  const leaf = navLeafFor(pathname);
  return (leaf && LEAF_LABELS.get(leaf)) || "Alumni";
}

/**
 * Where the profile's Back button goes and what it says. `from` when it is
 * safe; otherwise the profile's own list (Alumni, or Friends on a friend's
 * profile), with no filters.
 */
export function profileBack(
  rawFrom: string | string[] | null | undefined,
  fallback: { href: string; label: string } = { href: "/alumni", label: "Alumni" },
): { href: string; label: string; from: string | null } {
  const from = safeReturnPath(rawFrom);
  if (from === null) return { ...fallback, from: null };
  return { href: from, label: returnLabel(from), from };
}

/**
 * `href` with `?from=<from>` added — kept alongside any query `href` already
 * has (`?log=call`) and before any hash. A null or unsafe `from` leaves `href`
 * exactly as it was, so a caller never has to check first.
 */
export function withReturnTo(href: string, from: string | null | undefined): string {
  const safe = safeReturnPath(from);
  if (safe === null) return href;
  const hashAt = href.indexOf("#");
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const qAt = beforeHash.indexOf("?");
  const path = qAt === -1 ? beforeHash : beforeHash.slice(0, qAt);
  const query = qAt === -1 ? "" : beforeHash.slice(qAt + 1);
  const params = new URLSearchParams(query);
  params.set(RETURN_PARAM, safe);
  return `${path}?${params.toString()}${hash}`;
}

/**
 * A page's own URL rebuilt from its route `searchParams`, for server components
 * that link into profiles. Repeated keys stay repeated; `from` itself is
 * dropped, since a list never needs one.
 */
export function pathWithSearch(
  pathname: string,
  sp: Record<string, string | string[] | undefined> | URLSearchParams | null | undefined,
): string {
  const params = new URLSearchParams();
  if (sp instanceof URLSearchParams) {
    sp.forEach((v, k) => params.append(k, v));
  } else if (sp) {
    for (const [k, v] of Object.entries(sp)) {
      if (v === undefined) continue;
      for (const one of Array.isArray(v) ? v : [v]) params.append(k, one);
    }
  }
  params.delete(RETURN_PARAM);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * What a link clicked on `pathname?search` should carry as `from`: the page
 * itself, or — when the page is a profile — that profile's own `from`, so a
 * hop from one profile to another still comes back to the original list.
 * Null when there is nothing safe to carry.
 */
export function returnToFor(
  pathname: string,
  search: URLSearchParams | null | undefined,
): string | null {
  if (isProfilePath(pathname)) {
    return safeReturnPath(search?.get(RETURN_PARAM) ?? null);
  }
  return safeReturnPath(pathWithSearch(pathname, search));
}
