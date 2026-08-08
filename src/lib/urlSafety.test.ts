import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LINKEDIN_URL_MAX_LEN,
  isSafeHref,
  safeExternalHref,
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
