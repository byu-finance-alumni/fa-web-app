import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALERT_DELIVERY_OPTIONS,
  deliveryConfirmation,
  deliveryGaps,
} from "./alert-delivery-mode";

/**
 * The alert-delivery card's copy and its warnings.
 *
 * ⚠️ THE ASSERTIONS THAT MATTER HERE ARE THE ONES WHERE A WRONG ANSWER WOULD
 * MISLEAD. "Slack only" is exactly the phrase somebody reads as "and if Slack
 * breaks we hear nothing" — the opposite of what the backend does, where the
 * e-mail becomes the BACKSTOP and still fires whenever the Slack post fails.
 * A card that lets that misreading stand is the failure this suite is looking
 * for, so most of what follows is about the words rather than the wiring.
 */

const CARD = readFileSync(
  resolve(__dirname, "AlertDeliveryControl.tsx"),
  "utf8",
);
const ACTIONS = readFileSync(
  resolve(__dirname, "../../app/(app)/engineer/maintenance/actions.ts"),
  "utf8",
);

describe("ALERT_DELIVERY_OPTIONS", () => {
  it("offers exactly the two modes the backend accepts", () => {
    // A third option here would be a mode the API answers 422 for.
    expect(ALERT_DELIVERY_OPTIONS.map((o) => o.value)).toEqual([
      "slack_only",
      "slack_and_email",
    ]);
  });

  it("puts the current default first", () => {
    // The list is read top-down, and the top one is what the service does now.
    expect(ALERT_DELIVERY_OPTIONS[0].value).toBe("slack_only");
  });

  it("gives every option a sentence, not just a name", () => {
    // "Slack only" alone is the ambiguous label. The sentence is what stops it
    // being read as "and nothing if Slack breaks".
    for (const option of ALERT_DELIVERY_OPTIONS) {
      expect(option.detail.length).toBeGreaterThan(30);
      expect(option.detail.trim().endsWith(".")).toBe(true);
    }
  });

  it("describes only the healthy case in each option", () => {
    // What happens when Slack FAILS is identical for both modes and is stated
    // once, below the options. Repeating it inside each one would bury the
    // single difference between them.
    for (const option of ALERT_DELIVERY_OPTIONS) {
      expect(option.detail.toLowerCase()).not.toContain("fail");
    }
  });
});

describe("deliveryConfirmation", () => {
  it("says what will happen from now on, not that something was saved", () => {
    // "Saved" leaves the engineer re-reading the options to work out what they
    // just did.
    expect(deliveryConfirmation("slack_and_email")).toBe(
      "Alerts will go to Slack and e-mail.",
    );
    expect(deliveryConfirmation("slack_only")).toContain("backstop");
  });
});

describe("deliveryGaps", () => {
  it("says nothing when both channels are set up", () => {
    expect(
      deliveryGaps({ slack_configured: true, email_configured: true }),
    ).toEqual([]);
  });

  it("warns that there is NO backstop when no mailbox is configured", () => {
    // The one case in which the card's central promise stops being true. Left
    // unsaid, a reader would believe a failed Slack post is covered when it is
    // not — a wrong belief in the dangerous direction.
    expect(
      deliveryGaps({ slack_configured: true, email_configured: false }),
    ).toContain("no-backstop");
  });

  it("explains a quiet Slack channel rather than leaving it a mystery", () => {
    expect(
      deliveryGaps({ slack_configured: false, email_configured: true }),
    ).toEqual(["no-slack"]);
  });

  it("reports both gaps at once, because they have different fixes", () => {
    expect(
      deliveryGaps({ slack_configured: false, email_configured: false }),
    ).toEqual(["no-backstop", "no-slack"]);
  });

  it("does not depend on which mode is selected", () => {
    // Neither mode can create or fix a missing channel; only an env var on the
    // API can. A warning that came and went with the radio button would read as
    // a consequence of the choice.
    const channels = { slack_configured: true, email_configured: false };
    expect(deliveryGaps(channels)).toEqual(deliveryGaps({ ...channels }));
  });
});

describe("the card itself", () => {
  it("states in words that e-mail still fires when Slack fails", () => {
    // The sentence this card exists for. If it ever disappears, "Slack only"
    // becomes an ambiguous label again.
    expect(CARD).toContain("Either way, an alert still reaches the mailbox");
    expect(CARD).toContain("backstop");
  });

  it("is text-only, with no icons", () => {
    // Project convention: no icons in engineer console controls.
    expect(CARD).not.toContain("lucide-react");
    expect(CARD).not.toMatch(/<svg/);
  });
});

describe("the server action", () => {
  it("returns { ok: false, error } instead of throwing", () => {
    // A throw here blanks the console. Every other control on this page hands
    // back the message so it lands in a toast.
    const body = ACTIONS.slice(ACTIONS.indexOf("export async function setAlertDeliveryMode"));
    expect(body).toContain("ok: false");
    expect(body).not.toContain("throw");
  });

  it("takes the response type from the GENERATED schema, not a local copy", () => {
    // It was a local placeholder while the backend was being written. Now that
    // the route is on dev the type comes from `api.gen.ts`, which is what puts
    // this contract under the CI drift guard: a backend rename fails the
    // typecheck here instead of 422-ing in front of an engineer.
    expect(ACTIONS).toContain(
      'export type AlertDeliveryState = components["schemas"]["AlertDeliveryState"]',
    );
    expect(ACTIONS).not.toContain("LOCAL TYPES");
  });
});
