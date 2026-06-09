import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for a Map breakdown — a centered header (title + count) above the
 *  ranked table of states / cities / employers / industries. */
export default function Loading() {
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Map", href: "/map" }, { label: "…" }]}
      />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 space-y-2">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
          </div>
          <TableSkeleton rows={10} cols={4} />
        </div>
      </main>
    </>
  );
}
