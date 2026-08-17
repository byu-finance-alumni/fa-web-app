import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton, ToolbarSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the Links list — the filter toolbar, then the links table. */
export default function Loading() {
  return (
    <>
      <Topbar title="Links" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <ToolbarSkeleton />
        <TableSkeleton rows={10} cols={6} />
      </main>
    </>
  );
}
