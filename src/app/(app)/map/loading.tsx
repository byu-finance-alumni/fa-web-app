import { Topbar } from "@/components/shell/Topbar";

/** Skeleton shown while the Map loads — mirrors the live full-bleed layout: one
 *  edge-to-edge map area (the controls float over it, so there's no toolbar row
 *  above the map). */
export default function Loading() {
  return (
    <>
      <Topbar title="Alumni Map" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 animate-pulse bg-gray-100" />
      </main>
    </>
  );
}
