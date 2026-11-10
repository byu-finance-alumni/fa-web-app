import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_SECTION,
  INFO_SECTIONS,
} from "@/components/survey/survey-screens";
import {
  NEW_BYU_DEGREE_KEY,
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
