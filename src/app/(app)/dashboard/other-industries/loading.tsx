import { Topbar } from "@/components/shell/Topbar";
import { ListSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the dashboard Other table. */
export default function Loading() {
  return (
    <>
      <Topbar title="Other industries" />
      <main className="flex-1 overflow-auto p-6">
        <ListSkeleton rows={8} />
      </main>
    </>
  );
}
