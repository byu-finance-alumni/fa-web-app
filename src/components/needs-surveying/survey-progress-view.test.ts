import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The student view of Needs Surveying: `surveys.progress` without
 * `surveys.manage` gets the Progress table and nothing else.
 *
 * The backend 403s every campaign-control route for a student, so the failure
 * this guards against is a control (or a mount-time fetch) leaking into the
 * read-only view and erroring on arrival. Two halves: the rendered markup, and
 * source invariants over the page and the components it uses — the second
 * catches a manage-only call added later that a render in this DOM-less
 * environment would never fire.
 */

vi.mock("@/lib/api-client", () => ({ clientGet: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/app/(app)/needs-surveying/actions", () => ({
  exportSurveyList: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

const { SurveyProgressView } = await import("./SurveyProgressView");

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

/** Source with comments removed, so a comment that NAMES a route or a
 *  component it deliberately avoids does not count as using it. */
function code(relPath: string): string {
  return read(relPath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/** Routes the backend keeps on `surveys.manage` — none may appear below. */
const MANAGE_ONLY = [
  "/survey/usage",
  "/survey/send-config",
  "/survey/graduation-years",
  "/survey/campaigns/",
  "/survey/alumni/",
  "/survey/message",
  "/send",
  "/cancel",
  "/reset",
  "clientPost",
];

describe("the read-only Progress view", () => {
  it("renders the progress table with no campaign controls", () => {
    const html = renderToStaticMarkup(createElement(SurveyProgressView, {}));
    expect(html).toContain("Loading campaign progress");
    for (const word of ["Send", "Schedule", "Cancel", "Pause", "Resume", "Reset"]) {
      expect(html).not.toContain(`>${word}`);
    }
  });

  it("reads only the schedules list", () => {
    const src = code("src/components/needs-surveying/SurveyProgressView.tsx");
    expect(src).toContain('clientGet<SurveyScheduleItem[]>("/survey/schedules")');
    expect(src).not.toContain("SurveyCampaignConsole");
    expect(src).not.toContain("PendingSubmissions");
    for (const route of MANAGE_ONLY) expect(src).not.toContain(route);
  });

  it("the progress table and its hovers make no manage-only call", () => {
    for (const file of [
      "src/components/needs-surveying/CampaignProgressTable.tsx",
      "src/components/needs-surveying/ResponderCount.tsx",
      "src/components/needs-surveying/MedianFillTimeCount.tsx",
      "src/components/needs-surveying/SurveyExportButton.tsx",
    ]) {
      const src = code(file);
      for (const route of MANAGE_ONLY) expect(src).not.toContain(route);
    }
  });
});

describe("the Needs Surveying page picks its tier from capabilities", () => {
  const src = code("src/app/(app)/needs-surveying/page.tsx");

  it("reads both survey capabilities, never a role, to choose", () => {
    expect(src).toContain("canManageSurveys(auth.ctx.capabilities)");
    expect(src).toContain("canViewSurveyProgress(auth.ctx.capabilities)");
    expect(src).toContain('if (!canManage && !canProgress) redirect("/alumni")');
  });

  it("the progress-only branch renders nothing from the console", () => {
    const start = src.indexOf("if (!canManage) {");
    expect(start).toBeGreaterThan(-1);
    const branch = src.slice(start, src.indexOf("\n  }\n", start));
    expect(branch).toContain("<SurveyProgressView");
    for (const name of [
      "SurveyCampaignConsole",
      "SurveyMessageEditor",
      "SurveyBulkScheduler",
      "SurveyPreview",
      "resetAudience",
    ]) {
      expect(branch).not.toContain(name);
    }
  });

  it("an unreadable context is an error screen, not the console", () => {
    expect(src).toContain('auth.status === "unavailable"');
    expect(src).toContain("<AccessCheckError");
  });
});
