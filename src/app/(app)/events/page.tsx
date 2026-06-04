import { Topbar } from "@/components/shell/Topbar";

export default function EventsPage() {
  return (
    <>
      <Topbar title="Events" />
      <main className="flex-1 p-6">
        <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Events &amp; attendance — coming soon. Backend endpoints not built yet.
        </div>
      </main>
    </>
  );
}
