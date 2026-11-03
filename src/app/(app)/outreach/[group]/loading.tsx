import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for an Outreach landing page and its lists. */
export default function Loading() {
  return (
    <>
      <Topbar title="Outreach" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div>
          <TableSkeleton rows={4} cols={1} />
        </div>
      </main>
    </>
  );
}
