import { Topbar } from "@/components/shell/Topbar";
import { TableSkeleton, ToolbarSkeleton } from "@/components/shared/Skeletons";

/** Skeleton for the Audit log — the filter toolbar then the audit table. */
export default function Loading() {
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Audit" }]}
      />
      <main className="flex-1 overflow-auto p-6">
        <ToolbarSkeleton />
        <TableSkeleton rows={10} cols={5} />
      </main>
    </>
  );
}
