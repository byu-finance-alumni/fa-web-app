import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { Topbar } from "@/components/shell/Topbar";
import { VocabularyManager } from "@/components/admin/VocabularyManager";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadError } from "@/components/shared/LoadError";

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
 * Three outcomes, not two (#688). A network blip / 5xx must NOT be misread as
 * "no access" and bounce a real vocab admin — but the old code's other half was
 * to RENDER the editor on such a blip, on the reasoning that the vocab
 * endpoints 403 a caller without the capability anyway. That is fail-open: the
 * endpoints hold, but this screen renames and retires the controlled values
 * every dropdown in the app is built from, and opening it for an account whose
 * capabilities we could not read is a guess in the permissive direction. So:
 * redirect only when the backend DEFINITIVELY says no (we read the capability
 * list and it's absent, or it answered 401/403); render the editor only on a
 * verified-success read; and on an unreadable context say so, in place, on
 * this URL.
 */
export default async function VocabularyAdminPage() {
  const auth = await readAuthContext();
  if (auth.status === "unavailable") {
    return <AccessCheckError status={auth.httpStatus} title="Vocabulary" />;
  }
  // Starts denied and is only cleared inside the verified-success branch.
  let denied = true;
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    denied = !(ctx.capabilities ?? []).includes(VOCAB_CAPABILITY);
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
          <LoadError
            status={error.status}
            noun="the vocabulary"
            title={
              error.status === 403
                ? "Vocabulary admin access required"
                : undefined
            }
          />
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
