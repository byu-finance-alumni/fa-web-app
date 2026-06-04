import { Topbar } from "@/components/shell/Topbar";

export default function MapPage() {
  return (
    <>
      <Topbar title="Map view" />
      <main className="flex-1 p-6">
        <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Geographic map (cluster bubbles, employer overlays, filters) — coming
          soon. Needs a map library + geocoded coordinates.
        </div>
      </main>
    </>
  );
}
