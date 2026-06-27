import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";

/**
 * "Needs Surveying" — temporarily DISABLED while the biennial re-survey campaign
 * console is reworked. The tab stays visible (nav unchanged) but renders an
 * under-construction state instead of the (incomplete) console. Restore the
 * previous implementation from git history when the rebuild is ready.
 */
export default function NeedsSurveyingPage() {
  return (
    <>
      <Topbar title="Needs Surveying" />
      <main className="flex-1 overflow-auto p-6">
        <Card className="mx-auto max-w-md p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            Under construction
          </p>
          <h1 className="mt-2 text-lg font-semibold text-gray-900">
            Needs Surveying is being rebuilt
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            The biennial re-survey campaign console is temporarily disabled while
            we rework it. Check back soon.
          </p>
        </Card>
      </main>
    </>
  );
}
