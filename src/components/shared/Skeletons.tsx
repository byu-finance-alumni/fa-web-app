/**
 * Reusable skeleton blocks for route-level `loading.tsx` files. Every screen
 * needs a loading state (UX-UI.md §Layout "Required states"). These mirror the
 * live surfaces — white cards on gray-100 with gray-300 borders — and pulse on
 * a gray-100 fill so they read as the real layout settling in, not spinners.
 */

export function MetricGridSkeleton({
  count = 4,
  className = "grid grid-cols-2 gap-4 lg:grid-cols-4",
}: {
  count?: number;
  /** Override the grid so the tile layout matches the live page exactly
   *  (e.g. the dashboard's 6-across `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`). */
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl border border-gray-300 bg-white"
        />
      ))}
    </div>
  );
}

/** The shared toolbar bar that sits above the alumni / events / activity /
 *  audit tables — a bordered white card (`mb-4 … p-3`) holding a wide search
 *  field and a Filters button, so the table doesn't jump down when it loads. */
export function ToolbarSkeleton() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-3">
      <div className="h-10 min-w-[220px] flex-1 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
      <div className="h-11 border-b border-gray-300 bg-gray-50" />
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-gray-300 px-4 py-3.5 last:border-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={`h-4 animate-pulse rounded bg-gray-100 ${
                c === 0 ? "flex-1" : "w-24"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-5">
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-gray-50"
          />
        ))}
      </div>
    </div>
  );
}

/** A bordered card block of arbitrary height. */
export function CardSkeleton({ className = "h-72" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-gray-300 bg-white ${className}`}
    />
  );
}
