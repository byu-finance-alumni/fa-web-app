/**
 * The contract and the wording behind "Delete campaign" on the Login-failures
 * page — everything recorded for one source IP, removed.
 *
 * Same split as ../maintenance/attack-sources and ../maintenance/blocks:
 * everything here is pure and takes plain data, so the sentences a person reads
 * with their finger on an irreversible button are pinned by tests instead of
 * living only inside JSX. The component is then just the dialog.
 *
 * WHY THE CONTROL EXISTS. Proving the automatic login block actually refuses
 * people on production meant driving real failed sign-ins at the real API, which
 * left synthetic rows in the login telemetry. Clearing them meant a psql session
 * pointed at production — the exact thing every other control on these screens
 * exists to avoid.
 */

/**
 * ⚠️ LOCAL PLACEHOLDER TYPE — SWAP IT FOR THE GENERATED ONE.
 *
 * `src/types/api.gen.ts` is generated from the API's OpenAPI schema and must
 * never be hand-edited (CI has a drift guard), and DELETE
 * /admin/login-campaigns/{ip_address} does not exist in the deployed schema
 * yet. Once fa-web-api's `feat/delete-campaign` is merged to dev and the types
 * are regenerated, delete this declaration and replace it with:
 *
 *     import type { components } from "@/types/api.gen";
 *     export type LoginCampaignDeleted =
 *       components["schemas"]["LoginCampaignDeleted"];
 *
 * Same convention `engineer/sessions/actions.ts` used for `SessionRevokeResult`
 * before the sessions backend landed.
 *
 * ⚠️ NOTE WHAT IS DELIBERATELY ABSENT, exactly as on the attack table and the
 * block list: the attempted email addresses. The endpoint returns COUNTS of what
 * it deleted and never the addresses themselves — they are unverified strings a
 * stranger typed, some of them belong to real people, and a list of them is an
 * enumeration oracle. If a regenerated `LoginCampaignDeleted` ever grows an
 * address field, that is a backend bug, not a type to widen here.
 */
export type LoginCampaignDeleted = {
  /** The address the delete was aimed at, echoed back. */
  ip_address: string;
  /** `login_failures` rows removed — the per-attempt rows on this page. */
  failures_deleted: number;
  /** `login_abuse_incidents` rows removed — the detector's record. */
  incidents_deleted: number;
  /** `login_ip_blocks` rows removed, including lifted and lapsed history. */
  blocks_deleted: number;
  /**
   * How many of those blocks were still IN FORCE when they were deleted, i.e.
   * whether anyone's access actually changed. This is the number a human needs:
   * "3 blocks removed" does not say whether that source can sign in again.
   */
  active_blocks_deleted: number;
};

/** One paragraph of confirm copy; `emphasis` is the line not to skim past. */
export type ConfirmParagraph = { text: string; emphasis?: boolean };

export type LoginCampaignConfirm = {
  title: string;
  paragraphs: ConfirmParagraph[];
  /** The button that commits it, phrased as the act rather than "OK". */
  confirmLabel: string;
};

/**
 * What the confirm says before an engineer deletes one source's whole trail.
 *
 * THREE THINGS IT HAS TO GET ACROSS, and none of them is guessable from the
 * words "delete campaign":
 *
 *  1. IT IS NOT JUST THIS ROW. The table shows one row per ATTEMPT, so the
 *     obvious reading of a per-row Delete is "remove this line". It removes
 *     every failed sign-in ever recorded from that address, plus the incident
 *     and the block. `attemptsOnPage` anchors that in something the reader can
 *     see — the rows in front of them — while the sentence stays honest that the
 *     real scope is everything, including whatever is on the other pages.
 *
 *  2. IT CAN UN-BLOCK SOMEONE. Deleting the block row is what makes the source
 *     able to sign in again, and that is a live consequence for whoever is
 *     behind that address — including, if the address was ever forged into an
 *     `x-forwarded-for`, someone entirely innocent. It gets its own paragraph.
 *
 *  3. IT IS NOT "LIFT". The Maintenance page's Lift control is the reversible,
 *     recorded way to say a block was wrong, and it stops that source being
 *     automatically re-blocked for 24 hours. Deleting the row throws that grace
 *     away with it, so a source that is still misbehaving can be blocked again
 *     by the very next failed sign-in. Someone reaching for this button to fix a
 *     false positive has picked the wrong control, and this is where they find
 *     out.
 *
 * Kept short. This is a decision someone is making with a finger on the button,
 * not documentation — anything longer gets skipped, which is how the fact that
 * matters stays unread.
 */
export function loginCampaignConfirm({
  ipAddress,
  attemptsOnPage,
}: {
  ipAddress: string;
  /** How many rows on the page in front of the reader share this address. */
  attemptsOnPage: number;
}): LoginCampaignConfirm {
  const onPage =
    attemptsOnPage === 1
      ? "1 of them is on this page"
      : `${attemptsOnPage} of them are on this page`;

  return {
    title: `Delete everything recorded for ${ipAddress}?`,
    confirmLabel: "Delete campaign",
    paragraphs: [
      {
        text:
          `This removes every failed sign-in ever recorded from ${ipAddress} ` +
          `— ${onPage}, and there may be more on the others — together with ` +
          "the abuse incident opened for it. The attempted email addresses go " +
          "with them.",
      },
      {
        text:
          "Any block still in force on that address is removed too, which " +
          `means ${ipAddress} can sign in again.`,
        emphasis: true,
      },
      {
        text:
          "This cannot be undone. If you only want to clear a block you think " +
          "is wrong, use Lift on the Maintenance page instead — that keeps the " +
          "record and stops the address being blocked again automatically for " +
          "24 hours, which deleting does not.",
      },
    ],
  };
}

/** English "N thing" / "N things", so the summary below reads like a sentence. */
function count(n: number, noun: string, plural = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : plural}`;
}

/**
 * What the toast says AFTERWARDS — built from the counts the backend actually
 * deleted, never from an assumed success.
 *
 * The two cases it has to tell apart:
 *
 *  * NOTHING MATCHED. The endpoint is idempotent, so a second click, or an
 *    address that is already clear, comes back as zeros with a 200. Reporting
 *    that as "deleted" would be a lie the engineer acts on; it is the only way
 *    they learn the address they aimed at is already gone.
 *  * SOMETHING WAS UN-BLOCKED. `blocks_deleted` counts history; only
 *    `active_blocks_deleted` means a real source's access changed, so that is
 *    the clause that gets said in plain words rather than left to be inferred
 *    from a number.
 */
export function loginCampaignSummary(result: LoginCampaignDeleted): string {
  const {
    ip_address: ip,
    failures_deleted: failures,
    incidents_deleted: incidents,
    blocks_deleted: blocks,
    active_blocks_deleted: activeBlocks,
  } = result;

  if (failures === 0 && incidents === 0 && blocks === 0) {
    return `Nothing was recorded for ${ip} — there was nothing to delete.`;
  }

  const parts = [count(failures, "failed sign-in")];
  if (incidents > 0) parts.push(count(incidents, "incident"));
  if (blocks > 0) parts.push(count(blocks, "block"));

  const removed = `Deleted ${parts.join(", ")} for ${ip}.`;
  return activeBlocks > 0
    ? `${removed} That source can sign in again.`
    : removed;
}
