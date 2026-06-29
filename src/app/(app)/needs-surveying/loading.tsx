import { Topbar } from "@/components/shell/Topbar";
import { CardSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for Needs Surveying — the tab is under construction, so just a
 *  single centered placeholder card. */
export default function Loading() {
  return (
    <>
      <Topbar title="Needs Surveying" />
      <main className="flex-1 overflow-auto p-6">
        <CardSkeleton className="mx-auto h-48 max-w-md" />
      </main>
    </>
  );
}
