import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the NetTreks landing list — one row per area. */
export default function Loading() {
  return (
    <>
      <Topbar title="NetTreks" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
          <TableSkeleton rows={8} cols={3} />
        </div>
      </main>
    </>
  );
}
