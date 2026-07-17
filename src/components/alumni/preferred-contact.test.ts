import { describe, it, expect } from "vitest";
import {
  PREFERRED_CONTACT_NONE,
  preferredContactOptions,
  resolvePreferredContact,
} from "./preferred-contact";

/** Every field filled — nothing blocked. */
const FULL = {
  personal_email: "jane@gmail.com",
  work_email: "jane@goldman.com",
  phone: "555-1234",
};

const labels = (o: { value: string }[]) => o.map((x) => x.value);
const disabled = (o: { value: string; disabled: boolean }[]) =>
  o.filter((x) => x.disabled).map((x) => x.value);

describe("preferredContactOptions", () => {
  it("offers exactly personal email, work email and phone — not linkedin", () => {
    expect(labels(preferredContactOptions(FULL))).toEqual([
      "personal_email",
      "work_email",
      "phone",
    ]);
  });

  it("enables every method when all three fields have values", () => {
    expect(disabled(preferredContactOptions(FULL))).toEqual([]);
  });

  it("blocks a method whose field is empty, missing, or whitespace", () => {
    const options = preferredContactOptions({
      personal_email: "jane@gmail.com",
      work_email: "",
      phone: "   ",
    });
    expect(disabled(options)).toEqual(["work_email", "phone"]);
  });

  it("blocks everything when no contact fields are filled in", () => {
    expect(disabled(preferredContactOptions({}))).toEqual([
      "personal_email",
      "work_email",
      "phone",
    ]);
  });

  // withValue() parity: a stored value this control doesn't offer must survive a
  // save of this section rather than being silently downgraded to "none".
  it("preserves a stored linkedin preference as a labelled extra option", () => {
    const options = preferredContactOptions(FULL, "linkedin");
    expect(labels(options)).toEqual([
      "personal_email",
      "work_email",
      "phone",
      "linkedin",
    ]);
    const preserved = options[3];
    expect(preserved).toMatchObject({
      value: "linkedin",
      label: "LinkedIn",
      disabled: false,
      preserved: true,
    });
  });

  it("preserves an unknown stored value under its raw name", () => {
    const options = preferredContactOptions(FULL, "carrier_pigeon");
    expect(options.at(-1)).toMatchObject({
      value: "carrier_pigeon",
      label: "carrier_pigeon",
      preserved: true,
    });
  });

  it("does not duplicate a stored value the picker already offers", () => {
    expect(labels(preferredContactOptions(FULL, "work_email"))).toEqual([
      "personal_email",
      "work_email",
      "phone",
    ]);
  });

  it("adds no extra option for 'no preference'", () => {
    expect(labels(preferredContactOptions(FULL, PREFERRED_CONTACT_NONE))).toEqual(
      ["personal_email", "work_email", "phone"],
    );
  });
});

describe("resolvePreferredContact", () => {
  it("keeps a selection whose field has a value", () => {
    const options = preferredContactOptions(FULL);
    expect(resolvePreferredContact(options, "work_email")).toBe("work_email");
  });

  // The header would silently fall back to personal email, making the setting
  // look broken — so an unhonorable selection collapses to "no preference".
  it("drops a selection once its field is emptied", () => {
    const options = preferredContactOptions({ ...FULL, work_email: "" });
    expect(resolvePreferredContact(options, "work_email")).toBe(
      PREFERRED_CONTACT_NONE,
    );
  });

  it("keeps a preserved out-of-list selection", () => {
    const options = preferredContactOptions(FULL, "linkedin");
    expect(resolvePreferredContact(options, "linkedin")).toBe("linkedin");
  });

  it("collapses a value that isn't an option at all", () => {
    const options = preferredContactOptions(FULL);
    expect(resolvePreferredContact(options, "linkedin")).toBe(
      PREFERRED_CONTACT_NONE,
    );
  });

  it("passes 'no preference' through unchanged", () => {
    const options = preferredContactOptions(FULL);
    expect(resolvePreferredContact(options, PREFERRED_CONTACT_NONE)).toBe(
      PREFERRED_CONTACT_NONE,
    );
  });
});
