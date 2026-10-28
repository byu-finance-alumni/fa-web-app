import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { noChangesText, submissionComment } from "./pending-review";
import type { SurveyResponseItem } from "./use-pending-submissions";

/**
 * The alum's "Anything else?" comment in the staff review queue (#890),
 * rendered for real (react-dom/server, no DOM). Pinned: a card with a comment
 * is MARKED and shows it as plain text with its line breaks; a card without one
 * — including every submission from before the box existed, which has no
 * `comments` key at all — shows neither. Nothing here reaches the network.
 */

vi.mock("@/lib/api-client", () => ({
  clientPost: vi.fn(),
  ApiClientError: class extends Error {},
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  }),
}));

const { PendingSubmissions } = await import("./PendingSubmissions");

function item(over: Partial<SurveyResponseItem>): SurveyResponseItem {
  return {
    survey_response_id: 1,
    alumni_id: 5,
    name: "Jane Doe",
    submitted_at: "2026-10-22T18:30:00Z",
    changes: [],
    photo_preview_url: null,
    comments: null,
    ...over,
  };
}

function render(items: SurveyResponseItem[]) {
  return renderToStaticMarkup(
    createElement(PendingSubmissions, {
      queue: {
        items,
        removeItem: () => {},
      } as unknown as Parameters<typeof PendingSubmissions>[0]["queue"],
    }),
  );
}

describe("submissionComment", () => {
  it("reads a missing, null or blank comment as none", () => {
    const legacy = item({});
    delete (legacy as Partial<SurveyResponseItem>).comments;
    expect(submissionComment(legacy)).toBeNull();
    expect(submissionComment(item({ comments: null }))).toBeNull();
    expect(submissionComment(item({ comments: "  \n " }))).toBeNull();
    expect(submissionComment(item({ comments: " Hi " }))).toBe("Hi");
  });

  it("does not call a comment-only submission a confirmation", () => {
    expect(noChangesText(false)).toBe("Confirmed, nothing changed.");
    expect(noChangesText(true)).not.toContain("Confirmed");
  });
});

describe("the review card", () => {
  it("marks and shows a comment as plain text", () => {
    const html = render([
      item({ comments: "Line one\n<b>not bold</b>" }),
    ]);
    expect(html).toContain("Has comment");
    expect(html).toContain("Their comment");
    expect(html).toContain("&lt;b&gt;not bold&lt;/b&gt;");
    expect(html).not.toContain("<b>");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("Applying saves this as a note on their profile.");
    expect(html).toContain("No changes to their details.");
  });

  it("shows neither the marker nor the box without a comment, old rows included", () => {
    const legacy = item({ survey_response_id: 2 });
    delete (legacy as Partial<SurveyResponseItem>).comments;
    const html = render([item({}), legacy]);
    expect(html).not.toContain("Has comment");
    expect(html).not.toContain("Their comment");
    expect(html).toContain("Confirmed, nothing changed.");
  });

  it("keeps the field diff alongside the comment", () => {
    const html = render([
      item({
        comments: "Moved for a new job.",
        changes: [
          { field_key: "contact.city", label: "City", before: "Provo", after: "Austin" },
        ],
      }),
    ]);
    expect(html).toContain("Austin");
    expect(html).toContain("Moved for a new job.");
    expect(html).not.toContain("No changes to their details.");
  });
});
