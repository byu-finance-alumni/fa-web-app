import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loginCampaignConfirm,
  loginCampaignSummary,
  type LoginCampaignDeleted,
} from "./campaign-delete";

const IP = "134.82.68.139";

function result(over: Partial<LoginCampaignDeleted> = {}): LoginCampaignDeleted {
  return {
    ip_address: IP,
    failures_deleted: 0,
    incidents_deleted: 0,
    blocks_deleted: 0,
    active_blocks_deleted: 0,
    ...over,
  };
}

/**
 * The confirm. This is the last thing a person reads before an irreversible
 * delete of a security log, so what it must say is pinned here rather than left
 * to survive whatever happens to the JSX.
 */
describe("loginCampaignConfirm", () => {
  it("names the address, in the title and in the body", () => {
    // A per-row button on a table of attempts is easy to fire at the wrong line.
    // The address is the only thing that identifies what is about to go.
    const confirm = loginCampaignConfirm({
      ipAddress: IP,
      attemptsOnPage: 12,
    });

    expect(confirm.title).toContain(IP);
    expect(confirm.paragraphs.map((p) => p.text).join(" ")).toContain(IP);
  });

  it("says the scope is the whole source, not the row it was clicked on", () => {
    // The table shows one row per ATTEMPT, so "delete" reads as "remove this
    // line". It removes every attempt from that address, on every page.
    const text = loginCampaignConfirm({
      ipAddress: IP,
      attemptsOnPage: 12,
    })
      .paragraphs.map((p) => p.text)
      .join(" ");

    expect(text).toMatch(/every failed sign-in/i);
    expect(text).toMatch(/12 of them are on this page/);
    expect(text).toMatch(/more on other pages/i);
  });

  it("counts the rows on this page in readable English", () => {
    expect(
      loginCampaignConfirm({ ipAddress: IP, attemptsOnPage: 1 })
        .paragraphs.map((p) => p.text)
        .join(" "),
    ).toMatch(/1 of them is on this page/);
  });

  it("names the incident as going too", () => {
    // The attempted addresses used to get their own clause. They are the failed
    // sign-in rows, so "every failed sign-in ever recorded" already covers them
    // — and the owner asked for one sentence per spot, which makes a redundant
    // clause the first thing to go.
    const text = loginCampaignConfirm({ ipAddress: IP, attemptsOnPage: 3 })
      .paragraphs.map((p) => p.text)
      .join(" ");

    expect(text).toMatch(/incident/i);
      });

  it("says plainly that the source can sign in again", () => {
    // The consequence nobody can guess from the words "delete campaign", and
    // the reason the endpoint reports the block count at all: deleting the block
    // row un-blocks whoever is behind that address.
    const confirm = loginCampaignConfirm({ ipAddress: IP, attemptsOnPage: 3 });
    const emphasised = confirm.paragraphs.filter((p) => p.emphasis);

    expect(emphasised).toHaveLength(1);
    expect(emphasised[0].text).toMatch(/can sign in again/i);
    expect(emphasised[0].text).toContain(IP);
  });

  it("says it cannot be undone and points a false positive at Lift instead", () => {
    // Someone reaching for this to clear a block they think is wrong has picked
    // the wrong control: Lift keeps the record AND stops the address being
    // re-blocked automatically for 24 hours. Deleting throws that grace away, so
    // the source can be blocked again by the very next failed sign-in.
    const text = loginCampaignConfirm({ ipAddress: IP, attemptsOnPage: 3 })
      .paragraphs.map((p) => p.text)
      .join(" ");

    expect(text).toMatch(/cannot be undone/i);
    expect(text).toMatch(/lift/i);
    expect(text).toMatch(/24 hours/);
  });

  it("commits with a label that names the act, not 'OK'", () => {
    expect(
      loginCampaignConfirm({ ipAddress: IP, attemptsOnPage: 3 }).confirmLabel,
    ).toBe("Delete campaign");
  });

  it("stays short enough to be read with a finger on the button", () => {
    // Three paragraphs. Longer gets skimmed, which is how the fact that matters
    // goes unread — the same reason the survey campaign confirms are capped.
    expect(
      loginCampaignConfirm({ ipAddress: IP, attemptsOnPage: 3 }).paragraphs,
    ).toHaveLength(3);
  });
});

/**
 * The toast. Built from the counts the backend actually deleted, never from an
 * assumed success — that is the whole reason the endpoint returns per-table
 * counts instead of `{ok: true}`.
 */
describe("loginCampaignSummary", () => {
  it("reports the real counts", () => {
    const text = loginCampaignSummary(
      result({
        failures_deleted: 190,
        incidents_deleted: 1,
        blocks_deleted: 1,
        active_blocks_deleted: 1,
      }),
    );

    expect(text).toContain("190 failed sign-ins");
    expect(text).toContain("1 incident");
    expect(text).toContain("1 block");
    expect(text).toContain(IP);
  });

  it("says nothing was there rather than claiming a deletion", () => {
    // The endpoint is idempotent: a second click, or an address already clear,
    // is a 200 of zeros. Reporting that as "deleted" is a lie the engineer then
    // acts on — it is the only way they learn they aimed at the wrong address.
    expect(loginCampaignSummary(result())).toBe(
      `Nothing was recorded for ${IP} — there was nothing to delete.`,
    );
  });

  it("says the source can sign in again only when a live block went", () => {
    // `blocks_deleted` counts history; only `active_blocks_deleted` means
    // somebody's access actually changed.
    const lapsed = loginCampaignSummary(
      result({ failures_deleted: 4, blocks_deleted: 2 }),
    );
    const live = loginCampaignSummary(
      result({ failures_deleted: 4, blocks_deleted: 2, active_blocks_deleted: 1 }),
    );

    expect(lapsed).not.toMatch(/sign in again/i);
    expect(live).toMatch(/can sign in again/i);
  });

  it("leaves out the tables that had nothing in them", () => {
    const text = loginCampaignSummary(result({ failures_deleted: 3 }));

    expect(text).toBe("Deleted 3 failed sign-ins for 134.82.68.139.");
  });

  it("singularises a single failure", () => {
    expect(loginCampaignSummary(result({ failures_deleted: 1 }))).toContain(
      "1 failed sign-in ",
    );
  });
});

/**
 * The rule that outranks every other one on these screens: a response about
 * failed sign-ins must never carry the attempted email addresses. They are
 * unverified strings a stranger typed, some belong to real people, and a list of
 * them is an enumeration oracle. Asserted against the SOURCE because the
 * placeholder type here is what the UI will read once the backend lands, and a
 * field added to it is the way an address would first reach a screen.
 */
describe("no attempted address can reach the UI", () => {
  const source = readFileSync(
    resolve(__dirname, "campaign-delete.ts"),
    "utf-8",
  );

  it("declares counts only — no email field on the GENERATED response type", () => {
    // Asserted against api.gen.ts, not against a local copy of the shape. While
    // this type was a placeholder the test could only prove that WE had not
    // added an address field; now it proves the BACKEND has not, which is the
    // thing that actually matters. The attempted addresses are unverified
    // strings a stranger typed, some belong to real people, and a list of them
    // is an enumeration oracle.
    const generated = readFileSync(
      resolve(__dirname, "../../../../types/api.gen.ts"),
      "utf-8",
    );
    const start = generated.indexOf("LoginCampaignDeleted: {");
    const type = generated.slice(start, generated.indexOf("};", start));

    expect(start).toBeGreaterThan(-1);
    expect(type).toContain("failures_deleted");
    expect(type).not.toMatch(/^\s+email/m);
    expect(type).not.toMatch(/emails\??:/);
  });

  it("takes the type from the generated schema, not a local copy", () => {
    // It was a local placeholder while the backend was being written. Now that
    // the route is on dev the shape comes from `api.gen.ts`, which is what puts
    // this contract under the CI drift guard: a backend rename fails the
    // typecheck instead of surfacing as an undefined count in the toast.
    expect(source).toContain(
      'components["schemas"]["LoginCampaignDeleted"]',
    );
    expect(source).not.toMatch(/LOCAL PLACEHOLDER TYPE/);
  });
});
