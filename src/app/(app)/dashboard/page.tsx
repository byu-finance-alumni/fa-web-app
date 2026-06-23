import { Construction } from "lucide-react";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";

// The dashboard is being redesigned. The previous "find-alumni-fast" hub
// implementation (DashboardHub + stat panels) is kept in the repo — see
// src/components/dashboard/DashboardHub.tsx and this file's git history — so the
// full dashboard can be restored once the new design is ready. For now we render
// an under-construction placeholder.

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Dashboard">
        <TopbarSearch />
      </Topbar>
      <main className="flex-1 overflow-auto p-6">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex max-w-md flex-col items-center rounded-xl border border-gray-300 bg-white p-10 text-center">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
              <Construction className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold text-gray-900">
              Dashboard under construction
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              We&rsquo;re redesigning this page. In the meantime, use the search
              above or the Alumni tab to find alumni.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
