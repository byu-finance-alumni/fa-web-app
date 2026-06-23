import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { VocabularyManager } from "@/components/admin/VocabularyManager";
import { isEngineer } from "@/constants/roles";
import type { UserContext } from "@/types/alumni";

export interface VocabTerm {
  term_id: number;
  category: string;
  value: string;
  sort_order: number;
  active: boolean;
}

// The editable categories (mirror the backend VocabularyCategory enum). tags /
// status labels are managed elsewhere and intentionally not listed here.
const CATEGORIES: { key: string; label: string; help: string }[] = [
  {
    key: "event_type",
    label: "Event types",
    help: "Options in the event “Type” dropdown.",
  },
  {
    key: "industry",
    label: "Industries",
    help: "Industry options used across alumni and employment.",
  },
  {
    key: "interaction_type",
    label: "Interaction types",
    help: "Options when logging an interaction on a profile.",
  },
  {
    key: "attendance_status",
    label: "Attendance statuses",
    help: "Options when marking event attendance.",
  },
];

/**
 * Admin → Vocabulary. Manage the editable controlled-vocabulary dropdowns
 * (#82). Vocab-admin (engineer / super_admin) only — the backend's
 * /admin/vocabulary endpoints enforce it, and a 403 renders the access notice
 * (same pattern as the user-admin page).
 */
export default async function VocabularyAdminPage() {
  // Editing the controlled vocabulary is engineer-only tooling. A non-engineer
  // (incl. super_admin) navigating directly to this route is bounced to the
  // dashboard rather than shown an editor. Resolve the flag inside the try/catch,
  // then redirect OUTSIDE it — redirect() works by throwing a control-flow signal
  // a catch would otherwise swallow (same pattern as /alumni/[id]/edit). The
  // backend stays the source of truth; this is UX only.
  let canManage = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canManage = isEngineer(ctx.roles);
  } catch {
    /* not provisioned / context error → treat as no access */
  }
  if (!canManage) redirect("/dashboard");

  let groups: { key: string; label: string; help: string; terms: VocabTerm[] }[] | null =
    null;
  let error: ApiError | null = null;
  try {
    const results = await Promise.all(
      CATEGORIES.map((c) => apiGet<VocabTerm[]>(`/admin/vocabulary/${c.key}`)),
    );
    groups = CATEGORIES.map((c, i) => ({ ...c, terms: results[i] }));
  } catch (e) {
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load vocabulary.");
  }

  return (
    <>
      <Topbar title="Vocabulary" />
      <main className="flex-1 overflow-auto p-6">
        {error ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
              {error.status === 403
                ? "Vocabulary admin access required"
                : "Couldn’t load vocabulary"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <p className="text-sm text-gray-500">
              Add, rename, or hide the options that appear in the app’s
              dropdowns. Hiding a value keeps it valid on existing records — it
              just won’t be offered for new entries.
            </p>
            {groups!.map((g) => (
              <section
                key={g.key}
                className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm"
              >
                <h2 className="text-sm font-semibold text-gray-900">
                  {g.label}
                </h2>
                <p className="mb-3 text-xs text-gray-500">{g.help}</p>
                <VocabularyManager category={g.key} terms={g.terms} />
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
