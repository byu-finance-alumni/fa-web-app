import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { VocabularyManager } from "@/components/admin/VocabularyManager";
import { Card } from "@/components/ui/card";
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
  //
  // Fail SAFE on a transient /auth/context failure (E7): a network blip / API
  // 5xx must NOT be misread as "not an engineer" and bounce a valid engineer to
  // /dashboard. Only redirect when the backend DEFINITIVELY says this user isn't
  // an engineer (we successfully read their roles, or it returned 401/403). On
  // any other error we let the page render — the engineer-only vocabulary
  // endpoints below still 403 a non-engineer, so access can't actually leak.
  let deniedByBackend = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    deniedByBackend = !isEngineer(ctx.roles); // roles read OK and lack engineer
  } catch (e) {
    // 401/403 = authenticated-but-not-engineer (a definitive deny). Anything
    // else (network/timeout/5xx) is transient → don't bounce; render the page.
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      deniedByBackend = true;
    }
  }
  if (deniedByBackend) redirect("/dashboard");

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
      {/* min-h-0 lets this flex-1 scroll container cap its height and actually
          scroll tall content (E8). The (app) layout column also sets min-h-0 so
          every page inherits the fix; kept here too as a direct guarantee for
          this editor, which is the first page tall enough to overflow. */}
      <main className="min-h-0 flex-1 overflow-auto p-6">
        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Vocabulary admin access required"
                : "Couldn’t load vocabulary"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </Card>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <p className="text-sm text-gray-500">
              Add, rename, or hide the options that appear in the app’s
              dropdowns. Hiding a value keeps it valid on existing records — it
              just won’t be offered for new entries.
            </p>
            {groups!.map((g) => (
              <Card key={g.key} className="p-5">
                <h2 className="text-sm font-semibold text-gray-900">
                  {g.label}
                </h2>
                <p className="mb-3 text-xs text-gray-500">{g.help}</p>
                <VocabularyManager category={g.key} terms={g.terms} />
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
