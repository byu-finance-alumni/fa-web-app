import { Topbar } from "@/components/shell/Topbar";

export default function AdminPage() {
  return (
    <>
      <Topbar title="User administration" />
      <main className="flex-1 p-6">
        <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          User administration (create users, assign roles, issue temporary
          passwords) — Super Admin only. Coming soon.
        </div>
      </main>
    </>
  );
}
