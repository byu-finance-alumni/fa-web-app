import { describe, expect, it } from "vitest";
import type { AlertTemplate, AlertTemplatePlaceholder } from "./actions";
import {
  TEMPLATE_MAX_LENGTH,
  dirtyKinds,
  exampleValue,
  exampleValues,
  extractPlaceholders,
  insertPlaceholder,
  isDefault,
  isDirty,
  previewTemplate,
  renderPreview,
  templateProblem,
  unknownPlaceholders,
  unsavedSummary,
} from "./alert-templates";

/**
 * The Slack-message editor's rules.
 *
 * The assertions that matter are the ones where a wrong answer would put broken
 * text into a real alert channel: a mistyped placeholder that passes the check,
 * a preview that quietly fills a gap the live message would leave, and an edit
 * that the card decides is not an edit and lets the engineer walk away from.
 */

const PLACEHOLDERS: AlertTemplatePlaceholder[] = [
  { name: "environment", description: "Which deployment alerted.", example: "production" },
  { name: "ip_address", description: "The source that was blocked.", example: "203.0.113.9" },
  { name: "attempt_count", description: "How many attempts it made.", example: "8" },
];

function template(over: Partial<AlertTemplate> = {}): AlertTemplate {
  return {
    kind: "login_block",
    label: "Login source blocked",
    description: "Fires when the automatic block refuses a source.",
    value: "Blocked {ip_address} on {environment} after {attempt_count} tries.",
    default_value:
      "Blocked {ip_address} on {environment} after {attempt_count} tries.",
    placeholders: PLACEHOLDERS,
    maxChars: 500,
    customized: false,
    ...over,
  };
}

describe("extractPlaceholders", () => {
  it("finds each placeholder once, in the order it first appears", () => {
    expect(
      extractPlaceholders("{ip_address} hit {environment}; {ip_address} again"),
    ).toEqual(["ip_address", "environment"]);
  });

  it("leaves Slack's own syntax alone", () => {
    // `<!here>` and `*bold*` are message text, not placeholders — treating them
    // as tokens would flag a perfectly good message as broken.
    expect(extractPlaceholders("<!here> *Outage* on {environment}")).toEqual([
      "environment",
    ]);
  });

  it("does not treat a stray brace as a placeholder", () => {
    expect(extractPlaceholders("a { b } c {} d")).toEqual([]);
  });

  it("finds nothing in a message that uses nothing", () => {
    expect(extractPlaceholders("The site is back up.")).toEqual([]);
  });
});

describe("unknownPlaceholders", () => {
  it("catches a mistyped placeholder", () => {
    // The whole reason this check exists: `{ip_adress}` looks right and would
    // arrive in Slack as literal braces.
    expect(
      unknownPlaceholders("Blocked {ip_adress}", PLACEHOLDERS),
    ).toEqual(["ip_adress"]);
  });

  it("is case-sensitive, because the two look identical at a glance", () => {
    expect(unknownPlaceholders("{Ip_Address}", PLACEHOLDERS)).toEqual([
      "Ip_Address",
    ]);
  });

  it("passes a message that only uses what the kind offers", () => {
    expect(
      unknownPlaceholders("{environment}: {attempt_count}", PLACEHOLDERS),
    ).toEqual([]);
  });
});

describe("templateProblem", () => {
  it("refuses an empty message and points at the reset", () => {
    expect(templateProblem("   \n ", PLACEHOLDERS)).toContain("can’t be empty");
    expect(templateProblem("", PLACEHOLDERS)).toContain("Reset to default");
  });

  it("names the unknown placeholder AND what is available", () => {
    // A message that only says "invalid" makes the engineer go hunting for the
    // spelling they just got wrong.
    const problem = templateProblem("Blocked {ip_adress}", PLACEHOLDERS);
    expect(problem).toContain("{ip_adress}");
    expect(problem).toContain("{ip_address}");
  });

  it("gets the plural right with more than one unknown", () => {
    const problem = templateProblem("{foo} and {bar}", PLACEHOLDERS);
    expect(problem).toContain("are not placeholders");
  });

  it("says so when the kind takes no placeholders at all", () => {
    expect(templateProblem("Hello {foo}", [])).toContain(
      "takes no placeholders",
    );
  });

  it("stops a pasted stack trace before the round trip", () => {
    const problem = templateProblem("x".repeat(TEMPLATE_MAX_LENGTH + 1), []);
    expect(problem).toContain(`${TEMPLATE_MAX_LENGTH}`);
  });

  it("passes a good message", () => {
    expect(templateProblem(template().value, PLACEHOLDERS)).toBeNull();
  });
});

describe("renderPreview", () => {
  it("substitutes what it knows", () => {
    expect(
      renderPreview("Blocked {ip_address} on {environment}", {
        ip_address: "203.0.113.42",
        environment: "production",
      }),
    ).toBe("Blocked 203.0.113.42 on production");
  });

  it("leaves an unknown placeholder EXACTLY as written", () => {
    // Blanking it would hide the one mistake the preview exists to expose: a
    // message that reads fine in the editor and lands in Slack with a hole.
    expect(renderPreview("Blocked {ip_adress}", { ip_address: "1.2.3.4" })).toBe(
      "Blocked {ip_adress}",
    );
  });

  it("passes Slack formatting and newlines through untouched", () => {
    const text = "<!here> *Outage*\n> {environment} is down";
    expect(renderPreview(text, { environment: "production" })).toBe(
      "<!here> *Outage*\n> production is down",
    );
  });

  it("substitutes every occurrence, not just the first", () => {
    expect(renderPreview("{environment}/{environment}", { environment: "dev" })).toBe(
      "dev/dev",
    );
  });

  it("does not re-scan a substituted value for placeholders", () => {
    // A value that happens to contain braces must be inserted as data, never
    // re-expanded — otherwise the preview and the real message disagree.
    expect(renderPreview("{environment}", { environment: "{ip_address}" })).toBe(
      "{ip_address}",
    );
  });
});

describe("exampleValue", () => {
  it("uses a real-looking value for the names the alerts actually use", () => {
    expect(exampleValue("ip_address")).toBe("203.0.113.42");
    expect(exampleValue("environment")).toBe("production");
  });

  it("reads the shape of a name it has not seen", () => {
    expect(exampleValue("attempt_count")).toBe("3");
    expect(exampleValue("actor_email")).toContain("@");
    expect(exampleValue("blocked_at")).toContain("2026");
  });

  it("never previews as an empty gap", () => {
    // An empty stand-in makes the message look shorter than it really is.
    expect(exampleValue("queue_depth")).toBe("example queue depth");
    expect(exampleValue("queue_depth").length).toBeGreaterThan(0);
  });

  it("keys the whole list by placeholder name", () => {
    expect(Object.keys(exampleValues(PLACEHOLDERS))).toEqual([
      "environment",
      "ip_address",
      "attempt_count",
    ]);
  });
});

describe("previewTemplate", () => {
  it("renders a kind's draft with the BACKEND's examples, not invented ones", () => {
    // The example now comes from the placeholder the API sent, so the preview
    // is what the message will actually look like. The name-shape heuristics
    // remain only as the fallback for a placeholder that arrives without one —
    // which is why this asserts the fixture's values and not theirs.
    expect(previewTemplate(template(), template().value)).toBe(
      "Blocked 203.0.113.9 on production after 8 tries.",
    );
  });

  it("previews the DRAFT, not the stored value", () => {
    // The point of the card: see the edit before it is saved.
    expect(previewTemplate(template(), "Now on {environment}")).toBe(
      "Now on production",
    );
  });
});

describe("isDirty / isDefault", () => {
  it("counts a whitespace-only edit as an edit", () => {
    // A trailing space is a real difference in a Slack message; ignoring it
    // would leave a Save button that appears to do nothing.
    expect(isDirty("Hello ", "Hello")).toBe(true);
    expect(isDirty("a\nb", "a\nb")).toBe(false);
  });

  it("knows when there is nothing to reset", () => {
    expect(isDefault(template().value, template().default_value)).toBe(true);
    expect(isDefault("custom", template().default_value)).toBe(false);
  });
});

describe("dirtyKinds / unsavedSummary", () => {
  const one = template();
  const two = template({
    kind: "outage",
    value: "The site is down.",
    default_value: "The site is down.",
  });

  it("finds only the kinds whose draft differs from what is stored", () => {
    expect(
      dirtyKinds([one, two], {
        [one.kind]: one.value,
        [two.kind]: "The site is down!!!",
      }),
    ).toEqual(["outage"]);
  });

  it("ignores a kind with no draft held at all", () => {
    expect(dirtyKinds([one, two], {})).toEqual([]);
  });

  it("says nothing when everything is saved", () => {
    expect(unsavedSummary(0)).toBeNull();
  });

  it("counts in words an engineer reads at a glance", () => {
    expect(unsavedSummary(1)).toBe("1 message has unsaved changes.");
    expect(unsavedSummary(2)).toBe("2 messages have unsaved changes.");
  });
});

describe("insertPlaceholder", () => {
  it("drops the token in at the caret and moves the caret past it", () => {
    const { text, cursor } = insertPlaceholder("Blocked  now", 8, 8, "ip_address");
    expect(text).toBe("Blocked {ip_address} now");
    expect(cursor).toBe(20);
    expect(text.slice(0, cursor)).toBe("Blocked {ip_address}");
  });

  it("replaces the selection rather than pushing it aside", () => {
    const { text } = insertPlaceholder("Blocked HERE now", 8, 12, "ip_address");
    expect(text).toBe("Blocked {ip_address} now");
  });

  it("appends when the caret is unknown, instead of corrupting the text", () => {
    // A textarea that was never focused reports a caret past the end in some
    // browsers; the edit must still be additive.
    const { text } = insertPlaceholder("Blocked", 999, 999, "ip_address");
    expect(text).toBe("Blocked{ip_address}");
  });

  it("produces a token the validator then accepts", () => {
    const { text } = insertPlaceholder("", 0, 0, "ip_address");
    expect(templateProblem(text, PLACEHOLDERS)).toBeNull();
  });
});
