import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_SECTION,
  INFO_SECTIONS,
} from "@/components/survey/survey-screens";
import {
  BYU_ID_FORMAT_MESSAGE,
  NEW_BYU_DEGREE_KEY,
  NEW_BYU_ID_KEY,
  effectiveRequiredGroups,
  isStateRequiredCountry,
  normalizeByuId,
  validateByuId,
  NEW_GRADUATION_YEAR_KEY,
  NEW_PEOPLE_INTRO_PARAGRAPHS,
  NEW_PEOPLE_INTRO_SIGNOFF,
  buildSubmitBody,
  fieldKeysFor,
  missingKeysFromError,
  newPeopleSurveyUrl,
  pageIndexOfKey,
  pageSequence,
  requiredGroupsFor,
  submitErrorMessage,
  validateGraduationYear,
  validatePage,
  withRequiredMarkers,
} from "./newPeopleSurvey";
import type { NewPeopleRequiredFields } from "@/types/new-people-survey";

// The contract's example response.
const FRIEND_GROUPS = [
  ["profile.first_name"],
  ["profile.last_name"],
  ["contact.personal_email", "contact.work_email"],
  ["employment.current_employer"],
  ["employment.current_industry"],
  ["employment.current_city"],
  ["employment.current_country"],
  ["profile.linkedin_url"],
];
const REQUIRED: NewPeopleRequiredFields = {
  alum: [...FRIEND_GROUPS, [NEW_GRADUATION_YEAR_KEY], [NEW_BYU_DEGREE_KEY]],
  friend: FRIEND_GROUPS,
};

const page = (kind: "alum" | "friend", id: string) =>
  pageSequence(kind).find((p) => p.id === id)!;

describe("page sequence", () => {
  it("gives alumni the BYU education page and friends none", () => {
    expect(pageSequence("alum").map((p) => p.id)).toEqual([
      "contact",
      "education",
      "employment",
      "engagement",
      "comments",
    ]);
    expect(pageSequence("friend").map((p) => p.id)).toEqual([
      "contact",
      "employment",
      "engagement",
      "comments",
    ]);
  });

  it("only alumni can send the two new.* keys", () => {
    expect(fieldKeysFor("alum")).toContain(NEW_GRADUATION_YEAR_KEY);
    expect(fieldKeysFor("alum")).toContain(NEW_BYU_DEGREE_KEY);
    expect(fieldKeysFor("friend").some((k) => k.startsWith("new."))).toBe(false);
  });

  it("reuses the live survey's fields: every non-new key exists there", () => {
    const live = new Set(
      [...INFO_SECTIONS, ENGAGEMENT_SECTION].flatMap((s) => s.fields.map((f) => f.key)),
    );
    const outside = fieldKeysFor("alum").filter((k) => !k.startsWith("new.") && !live.has(k));
    expect(outside).toEqual([]);
  });

  it("asks every engagement question, so respondents reach the Outreach lists", () => {
    expect(page("friend", "engagement").fields.map((f) => f.key)).toEqual(
      ENGAGEMENT_SECTION.fields.map((f) => f.key),
    );
  });

  it("does not carry the live survey's own required markers", () => {
    const all = pageSequence("alum").flatMap((p) => p.fields);
    expect(all.some((f) => f.required)).toBe(false);
  });

  it("finds the page holding a key", () => {
    expect(pageIndexOfKey("alum", "employment.current_employer")).toBe(2);
    expect(pageIndexOfKey("friend", "employment.current_employer")).toBe(1);
    expect(pageIndexOfKey("friend", NEW_GRADUATION_YEAR_KEY)).toBe(-1);
  });
});

describe("required ANY-OF validation per page", () => {
  const groups = requiredGroupsFor(REQUIRED, "alum");

  it("blocks Next on an empty contact page with one message per group", () => {
    const errors = validatePage(page("alum", "contact"), "alum", groups, {});
    expect(Object.keys(errors).sort()).toEqual([
      "contact.personal_email",
      "profile.first_name",
      "profile.last_name",
    ]);
    expect(errors["contact.personal_email"]).toMatch(/Permanent email or Work email/);
  });

  it("is satisfied by EITHER email", () => {
    const errors = validatePage(page("alum", "contact"), "alum", groups, {
      "profile.first_name": "Ada",
      "profile.last_name": "Lovelace",
      "contact.work_email": "ada@example.org",
    });
    expect(errors).toEqual({});
  });

  it("treats whitespace as blank", () => {
    const errors = validatePage(page("alum", "contact"), "alum", groups, {
      "profile.first_name": "   ",
      "profile.last_name": "L",
      "contact.personal_email": "a@b.co",
    });
    expect(Object.keys(errors)).toEqual(["profile.first_name"]);
  });

  it("checks a page only for the groups that live on it", () => {
    const errors = validatePage(page("alum", "employment"), "alum", groups, {});
    expect(Object.keys(errors).sort()).toEqual([
      "employment.current_city",
      "employment.current_country",
      "employment.current_employer",
      "employment.current_industry",
      "profile.linkedin_url",
    ]);
    expect(validatePage(page("alum", "engagement"), "alum", groups, {})).toEqual({});
  });

  it("requires graduation year and degree for alumni only", () => {
    const edu = validatePage(page("alum", "education"), "alum", groups, {});
    expect(Object.keys(edu).sort()).toEqual([NEW_BYU_DEGREE_KEY, NEW_GRADUATION_YEAR_KEY]);
  });

  it("takes requiredness from the server, never a hard-coded list", () => {
    const errors = validatePage(page("friend", "contact"), "friend", [["contact.phone"]], {});
    expect(Object.keys(errors)).toEqual(["contact.phone"]);
  });

  it("ignores groups no page can show (left to the server)", () => {
    expect(
      validatePage(page("friend", "contact"), "friend", [["profile.byu_id"]], {}),
    ).toEqual({});
  });

  it("still runs the live survey's format rules on answered fields", () => {
    const errors = validatePage(page("friend", "employment"), "friend", [], {
      "profile.linkedin_url": "javascript:alert(1)",
      "employment.current_industry": "Underwater Basket Weaving",
    });
    expect(errors["profile.linkedin_url"]).toBeTruthy();
    expect(errors["employment.current_industry"]).toBeTruthy();
  });

  it("wants a four-digit graduation year", () => {
    expect(validateGraduationYear("2008")).toBeNull();
    expect(validateGraduationYear("08")).toMatch(/four-digit/);
    expect(validateGraduationYear("")).toBeNull();
  });

  it("marks required fields and explains an either-or group", () => {
    const marked = withRequiredMarkers(page("alum", "contact").fields, groups);
    const byKey = Object.fromEntries(marked.map((f) => [f.key, f]));
    expect(byKey["profile.first_name"].required).toBe(true);
    expect(byKey["profile.middle_name"].required).toBeUndefined();
    expect(byKey["contact.work_email"].required).toBe(true);
    expect(byKey["contact.work_email"].helpText).toMatch(/at least one of/);
  });

  it("drops empty groups and copes with a missing payload", () => {
    expect(requiredGroupsFor({ alum: [[], ["a"]], friend: [] }, "alum")).toEqual([["a"]]);
    expect(requiredGroupsFor(null, "friend")).toEqual([]);
  });
});

describe("submit payload", () => {
  it("sends only shown, non-blank, trimmed fields plus the honeypot", () => {
    const body = buildSubmitBody({
      kind: "friend",
      values: {
        "profile.first_name": "  Ada ",
        "profile.last_name": "",
        [NEW_GRADUATION_YEAR_KEY]: "1999",
        "program.mentor_willing": "Yes",
        "made.up": "x",
      },
      comments: "  hello  ",
      fillSeconds: 41.6,
      website: "",
    });
    expect(body).toEqual({
      kind: "friend",
      fields: { "profile.first_name": "Ada", "program.mentor_willing": "Yes" },
      comments: "hello",
      fill_seconds: 42,
      website: "",
    });
  });

  it("keeps the alum's education answers", () => {
    const body = buildSubmitBody({
      kind: "alum",
      values: { [NEW_GRADUATION_YEAR_KEY]: "2008", [NEW_BYU_DEGREE_KEY]: "MBA" },
      comments: "",
      fillSeconds: null,
      website: "",
    });
    expect(body.fields).toEqual({
      [NEW_GRADUATION_YEAR_KEY]: "2008",
      [NEW_BYU_DEGREE_KEY]: "MBA",
    });
    expect(body.comments).toBeNull();
    expect(body.fill_seconds).toBeNull();
  });

  it("passes a filled honeypot through untouched (the server drops it)", () => {
    const body = buildSubmitBody({
      kind: "alum",
      values: {},
      comments: "",
      fillSeconds: 3,
      website: "http://spam.example",
    });
    expect(body.website).toBe("http://spam.example");
    expect("website" in body).toBe(true);
  });

  it("drops a nonsense timer", () => {
    for (const t of [-1, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      expect(
        buildSubmitBody({ kind: "alum", values: {}, comments: "", fillSeconds: t, website: "" })
          .fill_seconds,
      ).toBeNull();
    }
  });
});

describe("errors from the server", () => {
  it("finds missing keys anywhere in a 422 body, as whole tokens", () => {
    const body = {
      error: {
        code: "validation_error",
        message: "Missing required: employment.current_industry",
        details: { missing: [["contact.personal_email", "contact.work_email"]] },
      },
    };
    expect(missingKeysFromError(body, "friend")).toEqual([
      "contact.personal_email",
      "contact.work_email",
      "employment.current_industry",
    ]);
    expect(
      missingKeysFromError({ m: "employment.current_industry_secondary" }, "friend"),
    ).toEqual(["employment.current_industry_secondary"]);
  });

  it("explains 422, 413 and 429 in plain words", () => {
    expect(
      submitErrorMessage(422, { error: { message: "profile.first_name" } }, "alum"),
    ).toMatch(/First name/);
    expect(submitErrorMessage(422, { error: { message: "Bad thing" } }, "alum")).toMatch(
      /Bad thing/,
    );
    expect(submitErrorMessage(413, null, "alum")).toMatch(/too long/);
    expect(submitErrorMessage(429, null, "alum")).toMatch(/too many/);
    expect(submitErrorMessage(null, null, "alum")).toMatch(/Submit again/);
  });
});

describe("link URL and intro", () => {
  it("builds origin + /survey/new/{key}", () => {
    expect(newPeopleSurveyUrl("https://x.example", "abc_DEF-123")).toBe(
      "https://x.example/survey/new/abc_DEF-123",
    );
    expect(newPeopleSurveyUrl("https://x.example/", "a b")).toBe(
      "https://x.example/survey/new/a%20b",
    );
  });

  it("keeps the career directors' message and sign-off", () => {
    expect(NEW_PEOPLE_INTRO_PARAGRAPHS).toHaveLength(3);
    expect(NEW_PEOPLE_INTRO_PARAGRAPHS[0]).toMatch(/^Whether you're a BYU Finance alum/);
    expect(NEW_PEOPLE_INTRO_SIGNOFF).toEqual([
      "Warmest regards,",
      "Tanya Harmon & Amy Densley",
      "BYU Finance Career Directors",
    ]);
  });
});

describe("rendered screens", () => {
  it("renders the honeypot hidden, untabbable and unfilled by autofill", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { NewPeopleHoneypot } = await import("@/components/survey/new-people-screens");
    const html = renderToStaticMarkup(
      createElement(NewPeopleHoneypot, { value: "", onChange: () => {} }),
    );
    expect(html).toContain('name="website"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('autoComplete="off"');
  });

  it("renders a wizard page with required markers and an inline error", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { NewPeopleWizardPage } = await import("@/components/survey/new-people-screens");
    const p = page("friend", "contact");
    const groups = requiredGroupsFor(REQUIRED, "friend");
    const html = renderToStaticMarkup(
      createElement(NewPeopleWizardPage, {
        page: p,
        stepNumber: 1,
        stepCount: 4,
        fields: withRequiredMarkers(p.fields, groups),
        valueOf: () => "",
        setValue: () => {},
        errors: validatePage(p, "friend", groups, {}),
        onBlurField: () => {},
        comments: "",
        setComments: () => {},
        isLast: false,
        onBack: () => {},
        onNext: () => {},
        submitting: false,
        submitError: null,
      }),
    );
    expect(html).toContain("Step 1 of 4");
    expect(html).toContain("Please fill in First name.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toContain("<svg");
  });
});

const US_LIST = ["united states", "united states of america", "usa", "us", "u.s.", "u.s.a."];

describe("State required for a US employment country", () => {
  it("matches the server's list trimmed and case-insensitive", () => {
    for (const c of ["United States", "  USA ", "u.s.a.", "US", "United States of America"]) {
      expect(isStateRequiredCountry(c, US_LIST), c).toBe(true);
    }
    for (const c of ["Canada", "", "  ", "Russia", "United Kingdom"]) {
      expect(isStateRequiredCountry(c, US_LIST), c).toBe(false);
    }
  });

  it("uses only the server's list, never a hard-coded one", () => {
    expect(isStateRequiredCountry("United States", [])).toBe(false);
    expect(isStateRequiredCountry("United States", undefined)).toBe(false);
    expect(isStateRequiredCountry("Canada", ["canada"])).toBe(true);
  });

  it("adds the State group only when the country is the US", () => {
    const base = [["employment.current_country"]];
    expect(effectiveRequiredGroups(base, { "employment.current_country": "Canada" }, US_LIST)).toBe(base);
    expect(
      effectiveRequiredGroups(base, { "employment.current_country": "United States" }, US_LIST),
    ).toEqual([...base, ["employment.current_state"]]);
  });

  it("blocks Next on the employment page and marks State, for BOTH kinds", () => {
    for (const kind of ["alum", "friend"] as const) {
      const values = {
        "employment.current_employer": "Acme",
        "employment.current_industry": "Banking",
        "employment.current_city": "Provo",
        "employment.current_country": "United States",
        "profile.linkedin_url": "https://www.linkedin.com/in/ada",
      };
      const groups = effectiveRequiredGroups(requiredGroupsFor(REQUIRED, kind), values, US_LIST);
      const emp = page(kind, "employment");
      const errors = validatePage(emp, kind, groups, values);
      expect(Object.keys(errors)).toContain("employment.current_state");
      const marked = withRequiredMarkers(emp.fields, groups);
      expect(marked.find((f) => f.key === "employment.current_state")?.required).toBe(true);

      const noState = validatePage(emp, kind, groups, {
        ...values,
        "employment.current_state": "Utah",
      });
      expect(noState["employment.current_state"]).toBeUndefined();
    }
  });

  it("leaves State optional outside the US", () => {
    const values = { "employment.current_country": "Canada" };
    const groups = effectiveRequiredGroups(requiredGroupsFor(REQUIRED, "friend"), values, US_LIST);
    const marked = withRequiredMarkers(page("friend", "employment").fields, groups);
    expect(marked.find((f) => f.key === "employment.current_state")?.required).toBeUndefined();
  });
});

describe("optional BYU ID", () => {
  it("is on the alum education page only, optional, with its helper text", () => {
    const edu = page("alum", "education");
    const f = edu.fields.find((x) => x.key === NEW_BYU_ID_KEY)!;
    expect(f.label).toBe("BYU ID (optional)");
    expect(f.helpText).toBe("9 digits, if you know it.");
    expect(f.required).toBeUndefined();
    expect(fieldKeysFor("friend")).not.toContain(NEW_BYU_ID_KEY);
  });

  it("strips spaces and dashes and wants exactly 9 digits", () => {
    expect(normalizeByuId(" 12-345 6789 ")).toBe("123456789");
    expect(validateByuId("")).toBeNull();
    expect(validateByuId("   ")).toBeNull();
    expect(validateByuId("12-345-6789")).toBeNull();
    expect(validateByuId("12345678")).toBe(BYU_ID_FORMAT_MESSAGE);
    expect(validateByuId("1234567890")).toBe(BYU_ID_FORMAT_MESSAGE);
    expect(validateByuId("12345678a")).toBe(BYU_ID_FORMAT_MESSAGE);
  });

  it("blocks Next on a bad one and lets a blank one through", () => {
    const edu = page("alum", "education");
    const filled = { [NEW_GRADUATION_YEAR_KEY]: "2008", [NEW_BYU_DEGREE_KEY]: "MBA" };
    const groups = requiredGroupsFor(REQUIRED, "alum");
    expect(validatePage(edu, "alum", groups, filled)).toEqual({});
    expect(
      validatePage(edu, "alum", groups, { ...filled, [NEW_BYU_ID_KEY]: "1234" })[NEW_BYU_ID_KEY],
    ).toBe(BYU_ID_FORMAT_MESSAGE);
  });

  it("is sent digits-only, and never by a friend", () => {
    const common = { comments: "", fillSeconds: null, website: "" };
    expect(
      buildSubmitBody({ kind: "alum", values: { [NEW_BYU_ID_KEY]: " 123-45 6789" }, ...common })
        .fields,
    ).toEqual({ [NEW_BYU_ID_KEY]: "123456789" });
    expect(
      buildSubmitBody({ kind: "friend", values: { [NEW_BYU_ID_KEY]: "123456789" }, ...common })
        .fields,
    ).toEqual({});
  });

  it("explains a server 422 on the BYU ID as a format problem, not 'fill in'", () => {
    const body = { error: { message: "new.byu_id: BYU ID must be 9 digits." } };
    expect(submitErrorMessage(422, body, "alum")).toContain(BYU_ID_FORMAT_MESSAGE);
    expect(submitErrorMessage(422, body, "alum")).not.toContain("Please fill in");
  });
});
