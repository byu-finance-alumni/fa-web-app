import { Topbar } from "@/components/shell/Topbar";

/** Skeleton shown while the Map loads — mirrors the new layout (mode toggle row
 * above one big full-width map card). */
export default function Loading() {
  return (
    <>
      <Topbar title="Alumni Map" />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <div className="h-9 w-44 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-7 w-28 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="min-h-0 flex-1 animate-pulse rounded-lg border border-gray-200 bg-white shadow-card" />
      </main>
    </>
  );
}
