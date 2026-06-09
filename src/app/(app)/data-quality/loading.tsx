import { Topbar } from "@/components/shell/Topbar";
import { MetricGridSkeleton, ListSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for Data quality — KPI tiles then the open-alerts list. */
export default function Loading() {
  return (
    <>
      <Topbar title="Data quality" />
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          <MetricGridSkeleton count={4} />
          <ListSkeleton rows={3} />
        </div>
      </main>
    </>
  );
}
