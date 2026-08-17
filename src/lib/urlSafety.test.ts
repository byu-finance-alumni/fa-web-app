import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  APP_HOME,
  LINKEDIN_URL_MAX_LEN,
  isReturnablePath,
  isSafeHref,
  loginPathWithNext,
  safeExternalHref,
  safeNextPath,
  validateLinkedinUrl,
} from "@/lib/urlSafety";
import {
  EDIT_SECTIONS,
  SURVEY_CHOICE_OPTIONS,
  validateSurveyField,
  type EditField,
} from "@/components/survey/survey-screens";

/**
 * Guards for the stored-URL render path (api #418).
 *
 * The public survey let an alum submit ANY string for `profile.linkedin_url`,
 * and staff then clicked that value as a live link from an authenticated
 * session. The backend owns the write-side fix; this suite covers the frontend
 * half — the scheme allowlist, the one shared linkedin.com rule the three forms
 * now call, and structural guards that the render sites still route the stored
 * value through the helper.
 *
 * The render-site checks read source text rather than mounting components: the
 * suite runs in Node with no DOM (see vitest.config.ts), and "this href is
 * never handed a raw stored value" is a structural invariant anyway — the same
 * altitude as `session-invariants.test.ts`.
 */
function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("safeExternalHref — scheme allowlist", () => {
  it("passes http and https through", () => {
    expect(safeExternalHref("https://www.linkedin.com/in/jordan")).toBe(
      "https://www.linkedin.com/in/jordan",
    );
    expect(safeExternalHref("http://example.com/x")).toBe(
      "http://example.com/x",
    );
  });

  it("accepts a non-LinkedIn https host — wrong data is not an attack", () => {
    // Deliberate: the render guard is about SCHEME. Host rules belong on the
    // input forms, and the database already holds whatever it holds.
    expect(safeExternalHref("https://not-really-linkedin.example")).toBe(
      "https://not-really-linkedin.example/",
    );
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["javascript: with mixed case", "JaVaScRiPt:alert(1)"],
    ["javascript: split by a newline", "java\nscript:alert(1)"],
    ["javascript: split by a tab", "java\tscript:alert(1)"],
    ["javascript: with leading whitespace", "   javascript:alert(1)"],
    ["data:", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["vbscript:", "vbscript:msgbox(1)"],
    ["file:", "file:///etc/passwd"],
    ["blob:", "blob:https://example.com/abc"],
  ])("rejects %s", (_label, raw) => {
    expect(safeExternalHref(raw)).toBeNull();
  });

  it.each([
    ["protocol-relative", "//evil.example/path"],
    ["scheme-relative backslashes", "\\\\evil.example\\path"],
    ["a bare hostname", "linkedin.com/in/jordan"],
    ["a relative path", "/alumni/1"],
    ["free text", "ask me on LinkedIn"],
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("rejects %s as unparseable or relative", (_label, raw) => {
    expect(safeExternalHref(raw)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(safeExternalHref(null)).toBeNull();
    expect(safeExternalHref(undefined)).toBeNull();
  });

  it("isSafeHref is the boolean form of the same check", () => {
    expect(isSafeHref("https://linkedin.com")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref(null)).toBe(false);
  });
});

describe("validateLinkedinUrl — the one shared input rule", () => {
  it("accepts an empty value (the field is optional everywhere)", () => {
    expect(validateLinkedinUrl("")).toBeNull();
    expect(validateLinkedinUrl("   ")).toBeNull();
  });

  it("accepts linkedin.com and its subdomains", () => {
    expect(validateLinkedinUrl("https://linkedin.com/in/jordan")).toBeNull();
    expect(validateLinkedinUrl("https://www.linkedin.com/in/jordan")).toBeNull();
    expect(validateLinkedinUrl("https://uk.linkedin.com/in/jordan")).toBeNull();
    expect(validateLinkedinUrl("http://LinkedIn.com/in/jordan")).toBeNull();
  });

  it("rejects a lookalike host that merely ENDS in the name", () => {
    expect(validateLinkedinUrl("https://notlinkedin.com/in/jordan")).toBe(
      "Must be a linkedin.com URL.",
    );
    expect(validateLinkedinUrl("https://linkedin.com.evil.example/in/x")).toBe(
      "Must be a linkedin.com URL.",
    );
  });

  it("rejects a value with no usable scheme", () => {
    expect(validateLinkedinUrl("linkedin.com/in/jordan")).toBe(
      "Enter a full URL, e.g. https://www.linkedin.com/in/you.",
    );
  });

  it("rejects a dangerous scheme before the host is ever considered", () => {
    expect(validateLinkedinUrl("javascript:alert(1)//linkedin.com")).toBe(
      "Enter a full URL, e.g. https://www.linkedin.com/in/you.",
    );
  });

  it("enforces the stored-column length cap", () => {
    const long = `https://www.linkedin.com/in/${"a".repeat(LINKEDIN_URL_MAX_LEN)}`;
    expect(validateLinkedinUrl(long)).toBe(
      `Must be ${LINKEDIN_URL_MAX_LEN} characters or fewer.`,
    );
  });
});

describe("the LinkedIn rule is shared, not copied", () => {
  it.each([
    ["Add alumni", "src/components/alumni/AlumniForm.tsx"],
    [
      "profile Edit → Employment",
      "src/components/alumni/edit-sections/EmploymentSectionForm.tsx",
    ],
    ["the public survey", "src/components/survey/survey-screens.tsx"],
  ])("%s calls validateLinkedinUrl from the shared helper", (_label, path) => {
    const src = read(path);
    expect(src).toContain('from "@/lib/urlSafety"');
    expect(src).toContain("validateLinkedinUrl");
  });

  it("no form keeps its own copy of the hostname check", () => {
    for (const path of [
      "src/components/alumni/AlumniForm.tsx",
      "src/components/alumni/edit-sections/EmploymentSectionForm.tsx",
      "src/components/survey/survey-screens.tsx",
    ]) {
      expect(read(path)).not.toContain('.endsWith(".linkedin.com")');
    }
  });
});

describe("the survey's LinkedIn field carries a rule", () => {
  const fields: EditField[] = EDIT_SECTIONS.flatMap((s) => s.fields);
  const linkedin = fields.find((f) => f.key === "profile.linkedin_url");

  it("is no longer a plain text field", () => {
    expect(linkedin?.kind).toBe("linkedin");
  });

  it("complains about a dangerous value", () => {
    expect(validateSurveyField(linkedin!, "javascript:alert(1)")).toBe(
      "Enter a full URL, e.g. https://www.linkedin.com/in/you.",
    );
  });

  it("accepts a real profile URL", () => {
    expect(
      validateSurveyField(linkedin!, "https://www.linkedin.com/in/jordan"),
    ).toBeNull();
  });

  it("leaves every field without a rule of its own unvalidated", () => {
    // The controlled vocabularies grew their own rule in #426 (see
    // `survey-industry-validation.test.ts`) and are asserted separately below.
    // Everything else on the survey is genuinely free text and must stay that
    // way — a survey that argues with a job title nobody can spell "correctly"
    // is worse than one that takes it.
    const others = fields.filter(
      (f) =>
        f.key !== "profile.linkedin_url" && !(f.kind in SURVEY_CHOICE_OPTIONS),
    );
    for (const f of others) {
      expect(validateSurveyField(f, "javascript:alert(1)")).toBeNull();
    }
  });

  it("refuses the same payload in a controlled-vocabulary field", () => {
    // Not a URL rule and not the point of #426 — but a nice consequence of it.
    // The industry box was the survey's other free-text-from-anyone field, and
    // nothing that isn't a real industry can be typed into it any more.
    const choiceFields = fields.filter((f) => f.kind in SURVEY_CHOICE_OPTIONS);
    expect(choiceFields.length).toBeGreaterThan(0);
    for (const f of choiceFields) {
      expect(validateSurveyField(f, "javascript:alert(1)")).not.toBeNull();
      // ...and not with the LinkedIn wording, which would send an alum looking
      // for a URL box that isn't there.
      expect(validateSurveyField(f, "javascript:alert(1)")).not.toContain(
        "linkedin.com",
      );
    }
  });
});

describe("render sites never hand a stored URL straight to an href", () => {
  it("the alumni list guards the LinkedIn cell", () => {
    const src = read("src/components/alumni/AlumniTable.tsx");
    expect(src).toContain('from "@/lib/urlSafety"');
    expect(src).toContain("safeExternalHref(a.linkedin_url)");
    // The pre-fix form. Its absence is the whole assertion.
    expect(src).not.toContain("href={a.linkedin_url}");
  });

  it("the profile page guards both of its LinkedIn links", () => {
    const src = read("src/app/(app)/alumni/[id]/page.tsx");
    expect(src).toContain('from "@/lib/urlSafety"');
    // Header strip: the raw prop is narrowed to a checked href once, and every
    // use below reads the checked one.
    expect(src).toContain("const linkedinHref = safeExternalHref(linkedinUrl)");
    expect(src).not.toContain("href={linkedinUrl}");
    // Contact panel row.
    expect(src).toContain("safeExternalHref(a.linkedin_url) ?? undefined");
    expect(src).not.toContain("href={a.linkedin_url ?? undefined}");
  });

  it("an unsafe value falls back to plain text rather than a link", () => {
    // What the guarded call sites evaluate to for a hostile value: the alumni
    // list renders its em-dash placeholder, and `ContactField` drops to its
    // non-link <p> branch because `href` is undefined. Both hinge on this being
    // null, which is the part worth pinning.
    expect(safeExternalHref("javascript:alert(document.cookie)")).toBeNull();
    expect(safeExternalHref("javascript:alert(1)") ?? undefined).toBeUndefined();
  });
});

/* ==================================================================== *
 * Post-login return path (#682)
 * ==================================================================== */

/**
 * Guards for the post-login redirect (#682).
 *
 * Issue #682 as WRITTEN asked to discard return-to-page and always land on the
 * dashboard, which would have removed attacker influence over the destination
 * entirely. That was reversed: return-to-page is KEPT, which promotes
 * `safeNextPath` from a formality to the security control — `?next=` rides on a
 * URL an attacker can hand a victim, and nothing downstream re-checks it.
 *
 * THE BUG THIS SUITE PINS. The check that shipped before was
 * `next.startsWith("/") && !next.startsWith("//")`. It reads like an origin
 * check and is not one: per the WHATWG URL spec a browser treats `\` as `/` in
 * the authority position of a special scheme, and strips tab/CR/LF from input
 * before parsing. `/\evil.com` cleared that test and resolved to
 * https://evil.com/. The suite below is written as "resolving the result
 * against our origin must never leave our origin", because that is the property
 * that actually matters — asserting a particular return value would let the
 * next clever input slip past a green test.
 */
const APP_ORIGIN = "https://finance.alumni.byu.edu";

/** The origin the browser would ACTUALLY end up on for a given `?next=`. */
function landsOn(next: string | null | undefined): string {
  return new URL(safeNextPath(next), APP_ORIGIN).origin;
}

describe("safeNextPath — hostile destinations cannot move the user off-origin", () => {
  it.each([
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with a path", "//evil.com/alumni/1"],
    ["triple slash", "///evil.com"],
    ["a single BACKSLASH authority", "/\\evil.com"],
    ["backslash then slash", "/\\/evil.com"],
    ["double backslash", "/\\\\evil.com"],
    ["slash-slash-backslash", "//\\evil.com"],
    ["a leading backslash", "\\\\evil.com"],
    ["an absolute https URL", "https://evil.com"],
    ["an absolute http URL", "http://evil.com/alumni"],
    ["a scheme-only absolute URL", "https://evil.com/#/dashboard"],
    ["javascript:", "javascript:alert(1)"],
    ["javascript: mixed case", "JaVaScRiPt:alert(1)"],
    ["javascript: split by a newline", "java\nscript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["an embedded TAB in the authority", "/\t/evil.com"],
    ["an embedded NEWLINE in the authority", "/\n/evil.com"],
    ["an embedded CRLF in the authority", "/\r\n//evil.com"],
    ["userinfo smuggling", "https://finance.alumni.byu.edu@evil.com/"],
    ["a percent-encoded protocol-relative value", "%2f%2fevil.com"],
    ["a percent-encoded backslash", "%5Cevil.com"],
    ["a percent-encoded absolute URL", "https%3A%2F%2Fevil.com"],
    ["an encoded scheme-relative value", "/%2F%2Fevil.com".toLowerCase()],
  ])("keeps the user on-origin for %s", (_label, next) => {
    expect(landsOn(next)).toBe(APP_ORIGIN);
  });

  it("keeps the user on-origin for EVERY hostile shape, in one sweep", () => {
    // Belt and braces over the table above: the property is what matters, so
    // assert it over a generated cross-product of the tricks that historically
    // defeat string-prefix checks.
    const hosts = ["evil.com", "finance.alumni.byu.edu.evil.com"];
    const authorities = ["//", "/\\", "\\/", "\\\\", "/\t/", "/\n/", "///"];
    for (const host of hosts) {
      for (const authority of authorities) {
        for (const suffix of ["", "/", "/x?y=1#z"]) {
          const next = `${authority}${host}${suffix}`;
          expect(landsOn(next), JSON.stringify(next)).toBe(APP_ORIGIN);
        }
      }
    }
  });

  it("falls back to the dashboard rather than somewhere arbitrary", () => {
    for (const next of ["//evil.com", "/\\evil.com", "https://evil.com"]) {
      expect(safeNextPath(next)).toBe(APP_HOME);
    }
  });

  it("pins the exact bypass in the string-prefix check this replaced", () => {
    // The old implementation, verbatim. Kept here as executable evidence of WHY
    // the parser-based check exists — delete this and the reason evaporates.
    const oldCheck = (next: string) =>
      next.startsWith("/") && !next.startsWith("//") ? next : APP_HOME;

    // It passed the value straight through...
    expect(oldCheck("/\\evil.com")).toBe("/\\evil.com");
    // ...and the browser's own parser resolved that OFF-ORIGIN.
    expect(new URL(oldCheck("/\\evil.com"), APP_ORIGIN).origin).toBe(
      "https://evil.com",
    );
    // The replacement does not.
    expect(landsOn("/\\evil.com")).toBe(APP_ORIGIN);
    expect(safeNextPath("/\\evil.com")).toBe(APP_HOME);
  });
});

describe("safeNextPath — real destinations still work", () => {
  it.each([
    "/dashboard",
    "/alumni",
    "/alumni/42",
    "/admin/import",
    "/engineer/campaigns",
  ])("returns %s unchanged", (next) => {
    expect(safeNextPath(next)).toBe(next);
    expect(landsOn(next)).toBe(APP_ORIGIN);
  });

  it("keeps a query string and hash on a same-origin path", () => {
    expect(safeNextPath("/alumni?grad_year=2020#top")).toBe(
      "/alumni?grad_year=2020#top",
    );
  });

  it("leaves a percent-encoded path encoded (it stays a PATH, not an authority)", () => {
    // `%2f` is not decoded into a slash by the parser, so this can never become
    // an authority — it is a weird path on our own origin, which is harmless.
    expect(landsOn("/%2f%2fevil.com")).toBe(APP_ORIGIN);
    expect(safeNextPath("/%2f%2fevil.com")).toBe("/%2f%2fevil.com");
  });

  it("falls back to the dashboard for an absent or empty value", () => {
    expect(safeNextPath(null)).toBe(APP_HOME);
    expect(safeNextPath(undefined)).toBe(APP_HOME);
    expect(safeNextPath("")).toBe(APP_HOME);
  });

  it("refuses a bare relative segment that would only resolve by accident", () => {
    expect(safeNextPath("dashboard")).toBe(APP_HOME);
    expect(safeNextPath("../dashboard")).toBe(APP_HOME);
  });

  it("refuses /login, which would only bounce off itself", () => {
    // The middleware sends a signed-in user sitting on /login to APP_HOME, so
    // honouring it costs a visible flash of the login page and gains nothing.
    expect(safeNextPath("/login")).toBe(APP_HOME);
  });

  it("isReturnablePath is the boolean form of 'honoured as-is'", () => {
    expect(isReturnablePath("/alumni/42")).toBe(true);
    expect(isReturnablePath("/\\evil.com")).toBe(false);
    expect(isReturnablePath("//evil.com")).toBe(false);
    expect(isReturnablePath("/login")).toBe(false);
    expect(isReturnablePath(null)).toBe(false);
    expect(isReturnablePath("")).toBe(false);
  });
});

describe("loginPathWithNext — every expiry path carries the same URL shape", () => {
  it("keeps the idle-timeout notice AND the return path", () => {
    const url = loginPathWithNext("/alumni/42", { reason: "timeout" });
    const params = new URL(url, APP_ORIGIN).searchParams;
    expect(params.get("reason")).toBe("timeout");
    expect(params.get("next")).toBe("/alumni/42");
  });

  it("keeps the other-device notice AND the return path", () => {
    const url = loginPathWithNext("/events/7", {
      signedout: "other-device",
    });
    const params = new URL(url, APP_ORIGIN).searchParams;
    expect(params.get("signedout")).toBe("other-device");
    expect(params.get("next")).toBe("/events/7");
  });

  it("still points at /login", () => {
    expect(
      new URL(loginPathWithNext("/alumni/42", { reason: "timeout" }), APP_ORIGIN)
        .pathname,
    ).toBe("/login");
  });

  it("omits next entirely when there is nothing safe to return to", () => {
    for (const path of [null, undefined, "", "/login", "//evil.com", "/\\evil.com"]) {
      const url = loginPathWithNext(path, { reason: "timeout" });
      expect(new URL(url, APP_ORIGIN).searchParams.get("next"), url).toBeNull();
      // The notice must survive even when the path does not.
      expect(new URL(url, APP_ORIGIN).searchParams.get("reason")).toBe(
        "timeout",
      );
    }
  });

  it("produces a bare /login when there is no notice and no path", () => {
    expect(loginPathWithNext(null)).toBe("/login");
  });

  it("round-trips through URL parsing the way the login form reads it", () => {
    // LoginForm reads `searchParams.get("next")` and hands it to the action, so
    // what matters is that the value SURVIVES that round trip and is then
    // honoured. The two halves agreeing is the whole feature — a `next` that is
    // emitted but then rejected is the silent failure this replaces.
    for (const path of ["/alumni/42", "/admin/import", "/engineer/campaigns"]) {
      const url = loginPathWithNext(path, { reason: "timeout" });
      const carried = new URL(url, APP_ORIGIN).searchParams.get("next");
      expect(carried, url).toBe(path);
      expect(safeNextPath(carried)).toBe(path);
    }
  });

  it("a path with reserved characters survives the round trip intact", () => {
    // URLSearchParams percent-encodes the slashes on the way out; getting the
    // SAME string back on the way in is what makes the two halves agree.
    const path = "/alumni/42";
    const url = loginPathWithNext(path, { signedout: "other-device" });
    expect(url).toContain("next=%2Falumni%2F42");
    expect(new URL(url, APP_ORIGIN).searchParams.get("next")).toBe(path);
  });
});

describe("all four sign-out paths share ONE redirect rule (#682)", () => {
  it("the login action validates with safeNextPath, not its own string test", () => {
    const src = read("src/app/login/actions.ts");
    expect(src).toContain('from "@/lib/urlSafety"');
    expect(src).toContain("safeNextPath(next)");
    // The pre-fix form. Its absence is the whole assertion.
    expect(src).not.toContain('next.startsWith("//")');
  });

  it("the middleware shares APP_HOME and the returnable-path gate", () => {
    const src = read("src/utils/supabase/middleware.ts");
    expect(src).toContain('from "@/lib/urlSafety"');
    expect(src).toContain("isReturnablePath(pathname)");
    // A second copy of the destination is exactly the drift this prevents.
    expect(src).not.toContain('const APP_HOME = "/dashboard"');
  });

  it("the idle timeout carries the path instead of a bare /login", () => {
    const src = read("src/components/auth/SessionTimeout.tsx");
    expect(src).toContain('from "@/lib/urlSafety"');
    expect(src).toContain("loginPathWithNext");
    expect(src).not.toContain('"/login?reason=timeout"');
  });

  it("the other-device eviction carries the path instead of a bare /login", () => {
    const src = read("src/components/auth/SessionGuard.tsx");
    expect(src).toContain('from "@/lib/urlSafety"');
    expect(src).toContain("loginPathWithNext");
    expect(src).not.toContain('"/login?signedout=other-device"');
  });

  it("no sign-out path keeps a hand-rolled redirect check of its own", () => {
    for (const path of [
      "src/app/login/actions.ts",
      "src/utils/supabase/middleware.ts",
      "src/components/auth/SessionTimeout.tsx",
      "src/components/auth/SessionGuard.tsx",
    ]) {
      expect(read(path), path).not.toContain('startsWith("//")');
    }
  });
});
