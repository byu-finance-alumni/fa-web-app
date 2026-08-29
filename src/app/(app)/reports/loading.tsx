import { Topbar } from "@/components/shell/Topbar";
import { ListSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for Reports — the two report sections, then the related surfaces. */
export default function Loading() {
  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-5">
          <ListSkeleton rows={3} />
          <ListSkeleton rows={2} />
          <ListSkeleton rows={3} />
        </div>
      </main>
    </>
  );
}
