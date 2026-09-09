import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SURVEY_MESSAGE_PATH,
  SURVEY_MESSAGE_RESET_PATH,
  formatSurveyMessageTime,
  surveyMessageByline,
  surveyMessageDirty,
  surveyMessageError,
  surveyMessageProblem,
  surveyMessageStatus,
  toSurveyMessageUpdate,
  type SurveyMessageRead,
} from "./surveyMessage";

const STORED: SurveyMessageRead = {
  subject: "Confirm your info",
  intro: "Our BYU Finance alumni are one of the greatest strengths…",
  closing: "Warmest regards,\nTanya Harmon & Amy Densley",
  on_file_fields: ["profile.headshot", "employment.current_employer"],
  is_customized: true,
  updated_at: "2026-09-08T15:04:05Z",
  updated_by_email: "tharmon@byu.edu",
};

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("toSurveyMessageUpdate", () => {
  it("carries exactly the four editable fields", () => {
    expect(Object.keys(toSurveyMessageUpdate(STORED)).sort()).toEqual([
      "closing",
      "intro",
      "on_file_fields",
      "subject",
    ]);
  });

  it("copies the field list rather than aliasing the stored one", () => {
    const draft = toSurveyMessageUpdate(STORED);
    draft.on_file_fields.push("contact.city");
    // Aliasing would make every edit instantly "not dirty", and the Save button
    // would sit disabled over real changes.
    expect(STORED.on_file_fields).toHaveLength(2);
  });
});

describe("surveyMessageDirty", () => {
  it("is false for an untouched draft", () => {
    expect(surveyMessageDirty(toSurveyMessageUpdate(STORED), STORED)).toBe(
      false,
    );
  });

  it("notices each edited text field", () => {
    for (const key of ["subject", "intro", "closing"] as const) {
      const draft = { ...toSurveyMessageUpdate(STORED), [key]: "changed" };
      expect(surveyMessageDirty(draft, STORED), key).toBe(true);
    }
  });

  it("notices an added, a removed and a REORDERED field", () => {
    const base = toSurveyMessageUpdate(STORED);
    expect(
      surveyMessageDirty(
        { ...base, on_file_fields: [...base.on_file_fields, "contact.city"] },
        STORED,
      ),
    ).toBe(true);
    expect(surveyMessageDirty({ ...base, on_file_fields: [] }, STORED)).toBe(
      true,
    );
    // Order is the order the rows appear in the email, so it is a real edit.
    expect(
      surveyMessageDirty(
        { ...base, on_file_fields: [...base.on_file_fields].reverse() },
        STORED,
      ),
    ).toBe(true);
  });

  it("is false before anything has loaded", () => {
    expect(surveyMessageDirty(null, STORED)).toBe(false);
    expect(surveyMessageDirty(toSurveyMessageUpdate(STORED), null)).toBe(false);
  });
});

describe("surveyMessageProblem", () => {
  it("passes a complete draft", () => {
    expect(surveyMessageProblem(toSurveyMessageUpdate(STORED))).toBeNull();
  });

  it("names the empty field, treating whitespace as empty", () => {
    const base = toSurveyMessageUpdate(STORED);
    expect(surveyMessageProblem({ ...base, subject: "   " })).toMatch(
      /subject/i,
    );
    expect(surveyMessageProblem({ ...base, intro: "" })).toMatch(/message/i);
    expect(surveyMessageProblem({ ...base, closing: "\n" })).toMatch(
      /closing/i,
    );
  });

  it("accepts an empty field selection — no preview block is a real choice", () => {
    expect(
      surveyMessageProblem({
        ...toSurveyMessageUpdate(STORED),
        on_file_fields: [],
      }),
    ).toBeNull();
  });
});

describe("surveyMessageByline", () => {
  it("names who saved it and when", () => {
    const line = surveyMessageByline(STORED);
    expect(line).toContain("tharmon@byu.edu");
    expect(line).toContain("2026");
  });

  it("says so plainly when nobody has edited it", () => {
    expect(
      surveyMessageByline({
        ...STORED,
        is_customized: false,
        updated_at: null,
        updated_by_email: null,
      }),
    ).toMatch(/standard wording/i);
  });

  it("still reports an author when the timestamp is missing", () => {
    expect(
      surveyMessageByline({ ...STORED, updated_at: null }),
    ).toBe("Last saved by tharmon@byu.edu.");
  });

  it("is empty before anything has loaded", () => {
    expect(surveyMessageByline(null)).toBe("");
  });
});

describe("formatSurveyMessageTime", () => {
  it("reads a naive datetime as UTC, not as the reader's zone", () => {
    // FastAPI serializes a naive datetime with no suffix. Left to `new Date()`
    // that is the READER's timezone, which would misreport by hours the one
    // fact this line exists to state.
    expect(formatSurveyMessageTime("2026-09-08T15:04:05")).toBe(
      formatSurveyMessageTime("2026-09-08T15:04:05Z"),
    );
  });

  it("keeps an explicit offset", () => {
    expect(formatSurveyMessageTime("2026-09-08T15:04:05+00:00")).toBe(
      formatSurveyMessageTime("2026-09-08T15:04:05Z"),
    );
  });

  it("returns null for nothing and for nonsense", () => {
    expect(formatSurveyMessageTime(null)).toBeNull();
    expect(formatSurveyMessageTime("not a date")).toBeNull();
  });
});

describe("surveyMessageStatus", () => {
  const base = {
    error: null,
    problem: null,
    dirty: false,
    justSaved: null,
    editable: true,
  } as const;

  it("always says something to someone who can edit", () => {
    // The reported bug was "updating the survey message is not saving". A state
    // that renders no words is how a dropped edit looks identical to a stored
    // one, so every combination has to resolve to a sentence.
    for (const error of [null, "Couldn't save."]) {
      for (const problem of [null, "The subject line can't be empty."]) {
        for (const dirty of [true, false]) {
          for (const justSaved of [null, "save", "reset"] as const) {
            const status = surveyMessageStatus({
              ...base,
              error,
              problem,
              dirty,
              justSaved,
            });
            expect(status.text.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("puts a failure above everything else", () => {
    const status = surveyMessageStatus({
      ...base,
      error: "Couldn't save the email message (500).",
      dirty: true,
      justSaved: "save",
    });
    expect(status).toEqual({
      tone: "error",
      text: "Couldn't save the email message (500).",
    });
  });

  it("explains why Save is refusing before reporting unsaved work", () => {
    const status = surveyMessageStatus({
      ...base,
      problem: "The subject line can't be empty.",
      dirty: true,
    });
    expect(status.tone).toBe("error");
    expect(status.text).toMatch(/subject/i);
  });

  it("warns that unsaved copy is not what alumni get", () => {
    const status = surveyMessageStatus({ ...base, dirty: true });
    expect(status.tone).toBe("warning");
    expect(status.text).toMatch(/not saved/i);
  });

  it("confirms a save and a reset in different words", () => {
    expect(surveyMessageStatus({ ...base, justSaved: "save" })).toEqual({
      tone: "success",
      text: "Saved. Everyone sees this wording now.",
    });
    expect(surveyMessageStatus({ ...base, justSaved: "reset" }).text).toMatch(
      /standard wording/i,
    );
  });

  it("says nothing to a read-only viewer, who has no draft to lose", () => {
    expect(surveyMessageStatus({ ...base, editable: false })).toEqual({
      tone: "muted",
      text: "",
    });
  });
});

describe("surveyMessageError", () => {
  it("phrases a 403 as a permission answer, so the editor can go read-only", () => {
    expect(surveyMessageError(403, "save")).toMatch(/not change it/i);
  });

  it("says outright that a failed save did NOT store anything", () => {
    expect(surveyMessageError(500, "save")).toMatch(/NOT saved/);
    expect(surveyMessageError(null, "save")).toMatch(/NOT saved/);
  });

  it("distinguishes an unreachable API from an API that answered", () => {
    expect(surveyMessageError(null, "load")).toMatch(/reach the API/i);
    expect(surveyMessageError(503, "load")).toContain("503");
  });

  it("never echoes backend error text — it takes a status, not a message", () => {
    // Upstream messages can carry table names and internal URLs; this app holds
    // alumni records. Same rule as lib/loadError.ts.
    expect(surveyMessageError.length).toBe(2);
  });
});

/**
 * THE LOCALSTORAGE PATH IS GONE, AND MUST STAY GONE.
 *
 * `src/lib/surveyStore.ts` persisted this copy per-browser. Leaving it beside
 * the server calls would be worse than either alone: a stale local value
 * shadowing the stored one reproduces the original bug — an editor that looks
 * saved while alumni get something else — and it is invisible, because both
 * paths "work".
 */
describe("the survey email copy has exactly one home: the server", () => {
  const editor = read("../components/needs-surveying/SurveyMessageEditor.tsx");
  const preview = read("../components/needs-surveying/SurveyPreview.tsx");

  it("has no surveyStore module left to import", () => {
    expect(
      existsSync(fileURLToPath(new URL("./surveyStore.ts", import.meta.url))),
    ).toBe(false);
  });

  it("stores nothing about the message in the browser", () => {
    // Matched against CODE, not prose: both files still narrate the localStorage
    // era in their doc comments, and that history is why the rule exists.
    for (const [name, source] of [
      ["SurveyMessageEditor", editor],
      ["SurveyPreview", preview],
    ] as const) {
      expect(source, name).not.toContain("window.localStorage");
      expect(source, name).not.toContain("setItem");
      expect(source, name).not.toContain("getItem");
      expect(source, name).not.toContain('from "@/lib/surveyStore"');
    }
  });

  it("reads both surfaces from the same server hook", () => {
    for (const source of [editor, preview]) {
      expect(source).toContain('from "@/lib/useSurveyMessage"');
    }
  });

  it("keeps no frontend copy of the wording to fall back to", () => {
    // A local default IS a second source of truth. "Restore the standard
    // wording" is a request to the backend, whose defaults the send path uses.
    for (const source of [editor, preview, read("./surveyMessage.ts")]) {
      expect(source).not.toContain("DEFAULT_SURVEY_MESSAGE");
      expect(source).not.toContain("DEFAULT_SURVEY_CLOSING");
    }
  });

  it("leaves the preview read-only — it previews, it does not author", () => {
    expect(preview).not.toContain("<Textarea");
  });
});

/**
 * The route + field names are a contract frozen with the backend agent. Both
 * sides typecheck against their own copy, so a silent rename on either side is
 * caught by nothing until a 422 or an undefined lands in an alum's inbox.
 */
describe("the /survey/message contract", () => {
  it("uses the agreed paths", () => {
    expect(SURVEY_MESSAGE_PATH).toBe("/survey/message");
    expect(SURVEY_MESSAGE_RESET_PATH).toBe("/survey/message/reset");
  });

  it("uses the agreed field names", () => {
    // Now enforced by the compiler too: the types below are re-exported from
    // the generated schema, so a backend rename fails `tsc`. This keeps the
    // agreed names readable in one place regardless.
    const probe: SurveyMessageRead = {
      subject: "s",
      intro: "i",
      closing: "c",
      on_file_fields: [],
      is_customized: false,
      updated_at: null,
      updated_by_email: null,
    };
    expect(Object.keys(probe).sort()).toEqual(
      [
        "closing",
        "intro",
        "is_customized",
        "on_file_fields",
        "subject",
        "updated_at",
        "updated_by_email",
      ].sort(),
    );
  });

  it("takes its types from the generated schema, not hand-written mirrors", () => {
    // The hand-written interfaces existed only while the backend was being
    // built in parallel. They are now re-exports of `api.gen.ts`, which is what
    // makes a silent backend rename a `tsc` failure instead of an undefined in
    // an alum's inbox. Reintroducing a local interface would remove that.
    const source = read("./surveyMessage.ts");
    expect(source).toContain('components["schemas"]["SurveyMessageRead"]');
    expect(source).toContain('components["schemas"]["SurveyMessageUpdate"]');
    expect(source).not.toContain("export interface SurveyMessageRead");
    expect(source).not.toContain("export interface SurveyMessageUpdate");
  });
});
