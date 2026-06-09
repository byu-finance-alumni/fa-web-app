import { Topbar } from "@/components/shell/Topbar";
import { ListSkeleton, ToolbarSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the Activity feed — the filter toolbar then the feed list. */
export default function Loading() {
  return (
    <>
      <Topbar title="Activity" />
      <main className="flex-1 overflow-auto p-6">
        <ToolbarSkeleton />
        <ListSkeleton rows={8} />
      </main>
    </>
  );
}
