/**
 * The rules and words behind the job-link digest card (#567).
 *
 * Same split as ./alert-delivery-mode: everything here is pure and takes plain
 * data, so the assertions that matter are cheap to write in this node-only
 * suite.
 *
 * The backend is the authority on the list (it validates, lowercases, dedupes
 * and caps it again, and a bad list is a 422). These checks exist so the card
 * can say what is wrong with an address before anyone presses Save, and they
 * mirror the backend's rules rather than inventing stricter ones.
 */

/** The most recipients the backend accepts. Each one is one e-mail a day out of
 *  the survey's send budget, which is why the cap is small. */
export const MAX_DIGEST_RECIPIENTS = 10;

/** The same light shape check the API uses: one mailbox per entry, so commas,
 *  semicolons and angle brackets are refused rather than split. */
const EMAIL_RE = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/;

/** The one plain line the card shows about when the e-mail goes out. */
export const DIGEST_SCHEDULE_NOTE =
  "Goes out once a day around 6pm Mountain time, and only on days alumni submitted job or internship links.";

export type AddResult =
  | { ok: true; recipients: string[] }
  | { ok: false; error: string };

/**
 * Add one typed address to the list. Trims and lowercases it, and refuses an
 * empty box, a malformed address, a duplicate, or an eleventh entry — each with
 * a sentence saying which.
 */
export function addRecipient(current: readonly string[], raw: string): AddResult {
  const address = raw.trim().toLowerCase();
  if (!address) return { ok: false, error: "Type an email address first." };
  if (address.length > 254 || !EMAIL_RE.test(address)) {
    return { ok: false, error: "That doesn't look like a single email address." };
  }
  if (current.includes(address)) {
    return { ok: false, error: "That address is already on the list." };
  }
  if (current.length >= MAX_DIGEST_RECIPIENTS) {
    return {
      ok: false,
      error: `The list is full (${MAX_DIGEST_RECIPIENTS} addresses at most).`,
    };
  }
  return { ok: true, recipients: [...current, address] };
}

/** Remove one address from the list. */
export function removeRecipient(current: readonly string[], address: string): string[] {
  return current.filter((a) => a !== address);
}

/** Whether the edited list differs from what the server holds. Order counts,
 *  because the server keeps the order it was given. */
export function listChanged(saved: readonly string[], edited: readonly string[]): boolean {
  return saved.length !== edited.length || saved.some((a, i) => a !== edited[i]);
}

/**
 * What the engineer is told once a save lands. Says what will happen from now
 * on, not "Saved".
 */
export function digestConfirmation(recipients: readonly string[]): string {
  if (recipients.length === 0) {
    return "No digest. Each new job link will alert the engineer channels instead.";
  }
  return recipients.length === 1
    ? "The daily job-link digest will go to 1 address."
    : `The daily job-link digest will go to ${recipients.length} addresses.`;
}
