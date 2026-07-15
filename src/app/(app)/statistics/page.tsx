import { Topbar } from "@/components/shell/Topbar";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Statistics",
};

/**
 * Statistics (#400) — placeholder route.
 *
 * Reachable from the sidebar nav for EVERY role (no gate). For now it renders
 * only an "Under Construction" notice; the real analytics/reporting surface
 * lands later. Styled per UX-UI.md: a single centred Card on the page
 * background, page-title weight for the heading and muted gray-500 body copy.
 * Text-only (no icons), matching the project's UI convention.
 */
export default function StatisticsPage() {
  return (
    <>
      <Topbar title="Statistics" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex min-h-full items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center px-8 py-12 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-blue-600">
                Coming soon
              </p>
              <h2 className="mt-3 text-xl font-semibold text-gray-900">
                Under construction
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
                The Statistics workspace is being built. Program-wide analytics
                and reporting will live here soon. Check back later.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
