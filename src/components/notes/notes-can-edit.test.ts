import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProfileNotes } from "@/components/alumni/ProfileNotes";
import { EntityNotes } from "@/components/notes/EntityNotes";
import { canAddProfileNotes, canWriteNotes } from "@/constants/capabilities";
import type { Note } from "@/types/notes";

/**
 * Students add profile notes (fa-web-api `notes.create`, 2026-11-03).
 *
 * Jake's rule: a student may ADD a note on any alumni profile and may EDIT or
 * DELETE only the notes they wrote; `notes.manage` holders keep edit/delete-any.
 * The backend decides "is this yours" and says so on every note as `can_edit`,
 * so the UI:
 *   * shows the add field to `notes.create` OR `notes.manage`;
 *   * shows a note's edit / delete only when that note's `can_edit` is true —
 *     never from a role or a blanket capability.
 * Interaction and event note threads still take `notes.manage` to add.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));
vi.mock("@/app/(app)/alumni/actions", () => ({
  addNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  addProfileNote: vi.fn(),
  updateProfileNote: vi.fn(),
  deleteProfileNote: vi.fn(),
}));

function note(note_id: number, can_edit: boolean): Note {
  return {
    note_id,
    entity_type: "alumni",
    entity_id: 1,
    body: `Note ${note_id}`,
    author: "Sam Lee",
    can_edit,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };
}

const MIXED = [note(3, true), note(2, false), note(1, false)];

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("the profile-note capability", () => {
  it("is held with notes.create or notes.manage, never with view alone", () => {
    expect(canAddProfileNotes(["view", "notes.create"])).toBe(true);
    expect(canAddProfileNotes(["view", "notes.manage"])).toBe(true);
    expect(canAddProfileNotes(["view", "interactions.create"])).toBe(false);
    expect(canAddProfileNotes(null)).toBe(false);
  });

  it("notes.create does not unlock the interaction / event note threads", () => {
    expect(canWriteNotes(["view", "notes.create"])).toBe(false);
  });
});

describe("ProfileNotes", () => {
  it("a student sees the add field and edit/delete only on their own note", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileNotes, { alumniId: 1, notes: MIXED, canWrite: true }),
    );
    expect(html).toContain('aria-label="New note"');
    expect(count(html, 'aria-label="Edit note"')).toBe(1);
    expect(count(html, 'aria-label="Delete note"')).toBe(1);
  });

  it("a notes.manage holder sees edit/delete wherever the server says so", () => {
    const all = MIXED.map((n) => ({ ...n, can_edit: true }));
    const html = renderToStaticMarkup(
      createElement(ProfileNotes, { alumniId: 1, notes: all, canWrite: true }),
    );
    expect(count(html, 'aria-label="Edit note"')).toBe(3);
    expect(count(html, 'aria-label="Delete note"')).toBe(3);
  });

  it("a read-only viewer sees no add field and no edit/delete", () => {
    const none = MIXED.map((n) => ({ ...n, can_edit: false }));
    const html = renderToStaticMarkup(
      createElement(ProfileNotes, { alumniId: 1, notes: none, canWrite: false }),
    );
    expect(html).not.toContain('aria-label="New note"');
    expect(html).not.toContain('aria-label="Edit note"');
    expect(html).not.toContain('aria-label="Delete note"');
    expect(html).toContain("Note 2");
  });
});

describe("EntityNotes", () => {
  it("gates edit/delete on each note's can_edit, independent of the add field", () => {
    const html = renderToStaticMarkup(
      createElement(EntityNotes, {
        entityType: "interaction",
        entityId: 5,
        notes: MIXED,
        canWrite: false,
      }),
    );
    expect(html).not.toContain('aria-label="New note"');
    expect(count(html, 'aria-label="Edit note"')).toBe(1);
  });
});

describe("the screens read the right capability", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

  it("the profile Notes tab, its FAB and the ?log=note deep-link use canAddProfileNotes", () => {
    const src = read("src/app/(app)/alumni/[id]/page.tsx");
    expect(src).toContain("canAddProfileNotesCap(ctx.capabilities)");
    expect(src).toContain("canWrite={canAddProfileNotes}");
    expect(src).toContain("canAddProfileNotes ? <AddNoteButton />");
    expect(src).toContain("canWriteNotes={canAddProfileNotes}");
    // Interaction-level notes stay on notes.manage.
    expect(src).toContain("canWriteNotes={canWriteNotes}");
  });

  it("the Home quick-add Add note uses canAddProfileNotes", () => {
    const src = read("src/app/(app)/dashboard/page.tsx");
    expect(src).toContain("canAddProfileNotes(dashCaps)");
  });

  it("no notes component gates edit/delete on the add flag any more", () => {
    for (const p of [
      "src/components/alumni/ProfileNotes.tsx",
      "src/components/notes/EntityNotes.tsx",
    ]) {
      const src = read(p);
      expect(src).toContain("{n.can_edit ? (");
      expect(count(src, "{canWrite ? (")).toBe(1);
    }
  });
});
