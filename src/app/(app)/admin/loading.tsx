import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the User administration table. */
export default function Loading() {
  return (
    <>
      <Topbar title="User administration" />
      <main className="flex-1 overflow-auto p-6">
        <TableSkeleton rows={6} cols={4} />
      </main>
    </>
  );
}
