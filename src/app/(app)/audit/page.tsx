import { Topbar } from "@/components/shell/Topbar";

export default function AuditPage() {
  return (
    <>
      <Topbar title="Audit log" />
      <main className="flex-1 p-6">
        <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Audit log (record / user / role / login events) — coming soon.
        </div>
      </main>
    </>
  );
}
