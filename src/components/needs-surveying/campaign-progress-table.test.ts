import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { components } from "@/types/api.gen";

/**
 * The Progress table's #836 additions, rendered for real (react-dom/server, no
 * DOM — see vitest.config.ts). The hover itself needs pointer and focus events
 * this environment does not have, so what is pinned here is what the markup
 * promises: the "Looks good" column, which counts are hoverable (focusable
 * buttons) and which are plain, and where "Export" appears. The fetches are
 * stubbed; nothing here may reach the network.
 */

vi.mock("@/lib/api-client", () => ({ clientGet: vi.fn() }));
vi.mock("@/app/(app)/needs-surveying/actions", () => ({
  exportNoReply: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

const { CampaignProgressTable } = await import("./CampaignProgressTable");

type Item = components["schemas"]["SurveyScheduleItem"];

function item(over: Partial<Item>): Item {
  return {
    survey_schedule_id: 1,
    graduation_year: 2018,
    start_date: "2026-08-05",
    status: "active",
    recipients: 0,
    replied: 0,
    awaiting_review: 0,
    applied: 0,
    rejected: 0,
    confirmed: 0,
    non_responders: 0,
    ...over,
  } as Item;
}

function render(items: Item[], canExport = true): string {
  return renderToStaticMarkup(
    createElement(CampaignProgressTable, { schedules: items, canExport }),
  );
}

/** The header cells, in order, as plain text. */
function headers(html: string): string[] {
  return [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
}

describe("Progress table (#836)", () => {
  it("puts Looks good right after Replied", () => {
    const cols = headers(render([item({})]));
    expect(cols.indexOf("Looks good")).toBe(cols.indexOf("Replied") + 1);
  });

  it("makes non-zero Replied and Looks good counts hoverable and focusable", () => {
    const html = render([
      item({ graduation_year: 2019, recipients: 30, replied: 9, confirmed: 8 }),
    ]);
    expect(html).toContain('aria-label="9 Replied in 2019, show names"');
    expect(html).toContain('aria-label="8 Looks good in 2019, show names"');
    // Nothing is fetched until someone opens one.
    expect(html).not.toContain("Loading names");
  });

  it("leaves a zero count as plain text with nothing to hover", () => {
    const html = render([item({ recipients: 5 })]);
    expect(html).not.toContain("show names");
  });

  it("offers Export only where someone has not replied", () => {
    const html = render([
      item({ graduation_year: 2019, recipients: 10, replied: 4 }),
      item({ graduation_year: 2018, recipients: 3, replied: 3 }),
    ]);
    expect(html).toContain("Export the 2019 alumni with no reply yet as CSV");
    expect(html).not.toContain("Export the 2018 alumni");
    // ...and one for all years in the totals row.
    expect(html).toContain("Export everyone with no reply yet, all years, as CSV");
  });

  it("has no all-years Export when everyone has replied", () => {
    const html = render([item({ recipients: 3, replied: 3, confirmed: 1 })]);
    expect(html).not.toContain("Export everyone");
  });

  it("offers no Export without alumni.export", () => {
    const html = render(
      [item({ graduation_year: 2019, recipients: 10, replied: 4 })],
      false,
    );
    expect(html).not.toContain("Export the 2019 alumni");
    expect(html).not.toContain("Export everyone");
  });

  it("says the export leaves out archived alumni, to those who can export", () => {
    const items = [item({ recipients: 10, replied: 4 })];
    expect(render(items)).toContain("The export leaves out archived alumni");
    expect(render(items, false)).not.toContain("leaves out archived alumni");
  });

  it("uses no icons", () => {
    expect(render([item({ recipients: 10, replied: 4, confirmed: 2 })])).not.toContain(
      "<svg",
    );
  });
});
