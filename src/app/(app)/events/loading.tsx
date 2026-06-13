import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton, ToolbarSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the Events list — the filter toolbar then the events table. */
export default function Loading() {
  return (
    <>
      <Topbar title="Events" />
      <main className="flex-1 overflow-auto p-6">
        <ToolbarSkeleton />
        <TableSkeleton rows={8} cols={5} />
      </main>
    </>
  );
}
