import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton, ToolbarSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the Alumni list — the filter toolbar then a dense table of
 *  records (Name, Grad, Current company, Current industry, LinkedIn). */
export default function Loading() {
  return (
    <>
      <Topbar title="All Alumni" />
      <main className="flex-1 overflow-auto p-6">
        <ToolbarSkeleton />
        <TableSkeleton rows={10} cols={5} />
      </main>
    </>
  );
}
