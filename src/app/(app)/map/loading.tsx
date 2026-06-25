import { Topbar } from "@/components/shell/Topbar";

/** Skeleton shown while the Map dashboard loads — mirrors the live layout
 * (map card on the left, four ranking boxes filling the rail on the right). */
export default function Loading() {
  return (
    <>
      <Topbar title="Alumni by State" />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-1">
          <div className="h-96 animate-pulse rounded-lg border border-gray-200 bg-white shadow-card lg:col-span-3 lg:h-auto" />
          <div className="flex min-h-0 flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-gray-200 bg-white shadow-card lg:h-auto lg:flex-1"
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
