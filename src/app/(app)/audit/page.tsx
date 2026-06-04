import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";

interface AuditRow {
  audit_log_id: number;
  created_at: string | null;
  user: string | null;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditPage() {
  let rows: AuditRow[] | null = null;
  let error: ApiError | null = null;
  try {
    rows = await apiGet<AuditRow[]>("/audit");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load audit.");
  }

  return (
    <>
      <Topbar title="Audit log" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            Activity &amp; audit
          </h2>
          <p className="text-sm text-gray-500">
            User, role, login and record events
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned yet"
                : "Couldn't load the audit log"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </div>
        ) : rows && rows.length === 0 ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No audit events recorded yet. Record edits, imports, role changes,
            and logins will appear here once audit writes are wired in.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="w-48 px-4 py-3">Date / time</th>
                  <th className="w-44 px-4 py-3">User</th>
                  <th className="w-40 px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                </tr>
              </thead>
              <tbody>
                {rows!.map((r) => (
                  <tr
                    key={r.audit_log_id}
                    className="border-b border-gray-300 last:border-0"
                  >
                    <td className="px-4 py-3 text-gray-700">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.user ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {r.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.entity_type}
                      {r.entity_id ? ` · #${r.entity_id}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
