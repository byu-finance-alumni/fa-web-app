import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton, ToolbarSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for Needs Surveying — same shape as the alumni list (filter toolbar
 *  then a dense table), pre-scoped to the biennial re-survey due set. */
export default function Loading() {
  return (
    <>
      <Topbar title="Needs Surveying" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4 h-4 max-w-3xl animate-pulse rounded bg-gray-100" />
        <ToolbarSkeleton />
        <TableSkeleton rows={10} cols={5} />
      </main>
    </>
  );
}
