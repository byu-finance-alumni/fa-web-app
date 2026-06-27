import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { VocabularyManager } from "@/components/admin/VocabularyManager";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

const VOCAB_CAPABILITY = "vocab_admin";

/**
 * Vocabulary editor (#82). Manage the editable controlled-vocabulary dropdowns.
 * Gated by the `vocab_admin` CAPABILITY — held by the engineer and by any role an
 * engineer grants it in the permission editor (e.g. super_admin). This is what
 * makes a permission-editor grant actually take effect in the UI; the backend's
 * /admin/vocabulary endpoints re-enforce the same capability on every request.
 *
 * Fail SAFE on a transient /auth/context failure: a network blip / 5xx must NOT
 * be misread as "no access" and bounce a real vocab admin. We only redirect when
 * the backend DEFINITIVELY says this user lacks the capability (we read their
 * capabilities and it's absent, or it returned 401/403). On any other error we
 * render — the vocab endpoints below still 403 a caller without the capability.
 */
export default async function VocabularyAdminPage() {
  let denied = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    denied = !(ctx.capabilities ?? []).includes(VOCAB_CAPABILITY);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      denied = true;
    }
  }
  if (denied) redirect("/dashboard");

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
      {/* min-h-0 lets this flex-1 scroll container cap its height and scroll. */}
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
          <div className="mx-auto max-w-3xl space-y-4">
            <p className="text-sm text-gray-500">
              Add, rename, or hide the options that appear in the app’s
              dropdowns. Hiding a value keeps it valid on existing records — it
              just won’t be offered for new entries.
            </p>
            {/* One tab per category instead of a long stacked list. */}
            <Tabs defaultValue={groups![0].key} className="w-full">
              <TabsList className="w-full">
                {groups!.map((g) => (
                  <TabsTrigger key={g.key} value={g.key}>
                    {g.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {groups!.map((g) => (
                <TabsContent key={g.key} value={g.key}>
                  <Card className="p-5">
                    <p className="mb-3 text-xs text-gray-500">{g.help}</p>
                    <VocabularyManager category={g.key} terms={g.terms} />
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </main>
    </>
  );
}
