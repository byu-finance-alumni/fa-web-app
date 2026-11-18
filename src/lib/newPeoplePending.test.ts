import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  NEW_PEOPLE_PENDING_PATH,
  newPeoplePendingLabel,
  pendingFromBody,
} from "./newPeoplePending";
import { tabCountLabel } from "@/components/needs-surveying/pending-review";

describe("the top bar's new-people count (#958)", () => {
  it("asks the bare count endpoint", () => {
    expect(NEW_PEOPLE_PENDING_PATH).toBe("/survey/new-people/submissions/count");
  });

  it("reads only a real, non-negative number", () => {
    expect(pendingFromBody({ pending: 3 })).toBe(3);
    expect(pendingFromBody({ pending: 0 })).toBe(0);
    expect(pendingFromBody({ pending: -1 })).toBeNull();
    expect(pendingFromBody({ pending: "3" })).toBeNull();
    expect(pendingFromBody(null)).toBeNull();
  });

  it("announces the count in words, and nothing at zero", () => {
    expect(newPeoplePendingLabel(1)).toBe("1 new person waiting for review");
    expect(newPeoplePendingLabel(4)).toBe("4 new people waiting for review");
    expect(newPeoplePendingLabel(0)).toBe("");
    expect(newPeoplePendingLabel(null)).toBe("");
  });

  it("is only asked for by people who can review (surveys.manage)", () => {
    const src = readFileSync("src/components/shell/TopNav.tsx", "utf8");
    expect(src).toContain("useNewPeoplePendingCount(\n    canManageSurveys(capabilities),\n  )");
    expect(src).not.toMatch(/lucide-react";\n.*NavCount/);
  });

  it("re-reads after the review queue changes", () => {
    const src = readFileSync(
      "src/components/needs-surveying/NewPeoplePanel.tsx",
      "utf8",
    );
    expect(src).toContain("if (items !== null) notifyNewPeoplePendingChanged();");
  });
});

describe("tabCountLabel", () => {
  it("names the tab and its count", () => {
    expect(tabCountLabel("Friends", 2)).toBe("Friends, 2 waiting for review");
    expect(tabCountLabel("Friends", 0)).toBe("Friends");
    expect(tabCountLabel("Friends", null)).toBe("Friends");
  });
});
