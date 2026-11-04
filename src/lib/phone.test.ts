import { describe, expect, it } from "vitest";

import { formatPhone } from "./phone";

/**
 * The CSVs format phones on the server with `format_phone`, so the download
 * matches the Outreach tables (#924).
 *
 * ⚠️ The same table is pinned in fa-web-api `tests/test_phone_format.py`. Change
 * both.
 */
const SHARED_VECTORS: [string | null, string][] = [
  [null, ""],
  ["", ""],
  ["8015551234", "(801) 555-1234"],
  ["801-555-1234", "(801) 555-1234"],
  ["801.555.1234", "(801) 555-1234"],
  ["(801) 555-1234", "(801) 555-1234"],
  ["+1 801 555 1234", "(801) 555-1234"],
  ["+1 (801) 555-1234", "(801) 555-1234"],
  ["1-801-555-1234", "(801) 555-1234"],
  ["18015551234", "(801) 555-1234"],
  ["555-0100", "555-0100"],
  ["+44 20 7946 0958", "+44 20 7946 0958"],
  ["28015551234", "28015551234"],
  ["801555123", "801555123"],
  ["80155512345", "80155512345"],
  ["n/a", "n/a"],
  ["801-555-1234 x12", "801-555-1234 x12"],
  ["٨٠١٥٥٥١٢٣٤", "٨٠١٥٥٥١٢٣٤"],
];

describe("formatPhone", () => {
  it.each(SHARED_VECTORS)("formats %j", (raw, shown) => {
    expect(formatPhone(raw)).toBe(shown);
  });
});
