import { Topbar } from "@/components/shell/Topbar";
import {
  TableSkeleton,
  ToolbarSkeleton,
  PageSpinner,
} from "@/components/shared/Skeletons";

/** Loading state for the Alumni list. Mobile shows a simple spinner; desktop
 *  shows the filter toolbar + dense table skeleton (Name, Grad, Current company,
 *  Current industry, LinkedIn). */
export default function Loading() {
  return (
    <>
      <Topbar title="All Alumni" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <PageSpinner className="md:hidden" />
        <div className="hidden md:block">
          <ToolbarSkeleton />
          <TableSkeleton rows={10} cols={5} />
        </div>
      </main>
    </>
  );
}
