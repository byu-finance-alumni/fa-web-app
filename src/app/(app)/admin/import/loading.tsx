import { Topbar } from "@/components/shell/Topbar";
import { CardSkeleton } from "@/components/shared/Skeletons";

/**
 * Skeleton for the CSV import wizard. Without this, /admin/import fell back to
 * the parent admin route's "User administration" table skeleton — the wrong
 * shape and label during the wait (#254). An upload-card placeholder matches the
 * wizard's first step.
 */
export default function Loading() {
  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Import CSV" }]} />
      <main className="flex-1 overflow-auto p-6">
        <CardSkeleton className="h-64" />
      </main>
    </>
  );
}
