import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { isUserAdmin } from "@/constants/roles";
import { humanize } from "@/lib/format";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shared/LoadError";
import {
  AuditToolbar,
  type AuditFilterState,
} from "@/components/audit/AuditToolbar";

interface AuditRow {
  audit_log_id: number;
  created_at: string | null;
  user: string | null;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
}

interface AuditOptions {
  action_types: string[];
  entity_types: string[];
}

// Entity types that have a detail page to link to. Anything not listed renders
// as plain text.
function entityHref(entityType: string, entityId: number | null): string | null {
  if (entityId == null) return null;
  if (entityType === "alumni") return `/alumni/${entityId}`;
  return null;
}

/**
 * Classify an audit action by impact so high-impact writes (delete/edit/create)
 * read as danger/warning with a distinct icon, while reads/searches stay
 * neutral. Matching is substring-based on the action type so verb variants
 * (e.g. "soft_delete", "bulk_update", "search_export") are covered. Presentation
 * only — every audit row is still rendered; this just colors and icons it.
 */
function classifyAction(action: string): {
  variant: BadgeProps["variant"];
  Icon: LucideIcon;
} {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("remove") || a.includes("archive"))
    return { variant: "danger", Icon: Trash2 };
  if (a.includes("update") || a.includes("edit") || a.includes("rename"))
    return { variant: "warning", Icon: Pencil };
  if (a.includes("create") || a.includes("add") || a.includes("import"))
    return { variant: "success", Icon: Plus };
  if (a.includes("search") || a.includes("export"))
    return { variant: "neutral", Icon: Search };
  return { variant: "neutral", Icon: Eye };
}

function ActionBadge({ action }: { action: string }) {
  const { variant, Icon } = classifyAction(action);
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {humanize(action)}
    </Badge>
  );
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

type SP = {
  action_type?: string;
  entity_type?: string;
  user?: string;
  date_from?: string;
  date_to?: string;
  offset?: string;
};

interface AuditPage {
  items: AuditRow[];
  total: number;
  limit: number;
  offset: number;
}

const LIMIT = 50;

function hasChange(r: AuditRow): boolean {
  return Boolean(r.field_name || r.old_value != null || r.new_value != null);
}

function EntityRef({ r }: { r: AuditRow }) {
  const label = `${r.entity_type}${r.entity_id ? ` · #${r.entity_id}` : ""}`;
  const href = entityHref(r.entity_type, r.entity_id);
  return href ? (
    <Link href={href} className="font-medium text-brand-blue-600 hover:underline">
      {label}
    </Link>
  ) : (
    <span className="text-gray-700">{label}</span>
  );
}

function ChangeDetail({ r }: { r: AuditRow }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {r.field_name ? (
        <>
          <dt className="text-gray-500">Field</dt>
          <dd className="font-medium text-gray-900">{r.field_name}</dd>
        </>
      ) : null}
      <dt className="text-gray-500">Previous</dt>
      <dd className="text-gray-700">{r.old_value ?? "∅"}</dd>
      <dt className="text-gray-500">New</dt>
      <dd className="text-gray-700">{r.new_value ?? "∅"}</dd>
    </dl>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // Role gate (defense-in-depth): the audit trail is USER_ADMIN-only (engineer /
  // super_admin). Redirect anyone else — and any authed-but-unprovisioned user
  // (a real 401/403) — to the dashboard rather than rendering a
  // dead-end "access required" shell. The backend still 403s /audit for others.
  // Split the two failures apart (#688). A 401/403 — or a successful read that
  // simply lacks the role — is the backend's answer, and the redirect below is
  // correct. An unreadable context (5xx, timeout, unreachable) is not an answer
  // at all: bouncing then strands a legitimate user on a dashboard that is
  // failing for the same reason, under a URL they never asked for, and the
  // report comes back as "the console vanished" instead of "the API is down".
  // `gate` stays null on anything but a verified-success read, so the page can
  // only render for someone we positively confirmed.
  const auth = await readAuthContext();
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Audit" },
        ]}
      />
    );
  }
  const gate = auth.status === "ok" ? auth.ctx : null;
  if (!gate || !isUserAdmin(gate.roles)) redirect("/dashboard");

  const sp = await searchParams;

  const filters: AuditFilterState = {
    user: sp.user ?? "",
    action_type: sp.action_type ?? "",
    entity_type: sp.entity_type ?? "",
    date_from: sp.date_from ?? "",
    date_to: sp.date_to ?? "",
  };

  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  const params = new URLSearchParams();
  if (filters.action_type) params.set("action_type", filters.action_type);
  if (filters.entity_type) params.set("entity_type", filters.entity_type);
  if (filters.user) params.set("user", filters.user);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const qs = params.toString();
  params.set("limit", String(LIMIT));
  params.set("offset", String(offset));

  let data: AuditPage | null = null;
  let error: ApiError | null = null;
  let actionTypes: string[] = [];
  let entityTypes: string[] = [];
  // Fetch the audit page and the filter-menu options (distinct action/entity
  // types) concurrently; the options are non-critical, so a failure there just
  // leaves the dropdowns minimal (only the "Any" defaults plus any deep-linked
  // value).
  const [listResult, optionsResult] = await Promise.allSettled([
    apiGet<AuditPage>(`/audit?${params.toString()}`),
    apiGet<AuditOptions>("/audit/options", {
      revalidate: 300,
      tags: ["audit"],
    }),
  ]);
  if (listResult.status === "fulfilled") {
    data = listResult.value;
  } else {
    const e = listResult.reason;
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load audit.");
  }
  if (optionsResult.status === "fulfilled") {
    actionTypes = optionsResult.value.action_types;
    entityTypes = optionsResult.value.entity_types;
  }

  const rows = data?.items ?? null;
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  const pageHref = (newOffset: number) => {
    const p = new URLSearchParams(qs);
    if (newOffset > 0) p.set("offset", String(newOffset));
    const s = p.toString();
    return s ? `/audit?${s}` : "/audit";
  };

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Audit" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="sr-only">Audit log</h1>
        <AuditToolbar
          initial={filters}
          actionTypes={actionTypes}
          entityTypes={entityTypes}
        />

        {error ? (
          <LoadError
            status={error.status}
            noun="the audit log"
            title={error.status === 403 ? "Super admin access required" : undefined}
            message={
              error.status === 403
                ? "The audit trail can contain sensitive record history, so it’s restricted to super admins."
                : undefined
            }
          />
        ) : rows && rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            {qs
              ? "No audit events match your filters."
              : "No audit events recorded yet. Record edits, imports, and role changes will appear here. (Sign-in and auth events are kept in the security logs, not the audit trail.)"}
          </Card>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {rows!.map((r) => (
                <Card key={r.audit_log_id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <ActionBadge action={r.action_type} />
                    <span className="text-xs">
                      <EntityRef r={r} />
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {formatDateTime(r.created_at)}
                    {r.user ? ` · ${r.user}` : ""}
                  </p>
                  {hasChange(r) ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer rounded text-xs font-medium text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500">
                        Details
                      </summary>
                      <div className="mt-2 rounded-md bg-gray-50 p-2">
                        <ChangeDetail r={r} />
                      </div>
                    </details>
                  ) : null}
                </Card>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden overflow-hidden p-0 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <th className="w-48 px-4 py-3">Date / time</th>
                    <th className="w-44 px-4 py-3">User</th>
                    <th className="w-40 px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="w-28 px-4 py-3">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((r) => (
                    <tr
                      key={r.audit_log_id}
                      className="border-b border-gray-200 align-top last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.user ?? "—"}</td>
                      <td className="px-4 py-3">
                        <ActionBadge action={r.action_type} />
                      </td>
                      <td className="px-4 py-3">
                        <EntityRef r={r} />
                      </td>
                      <td className="px-4 py-3">
                        {hasChange(r) ? (
                          <details>
                            <summary className="cursor-pointer rounded text-xs font-medium text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500">
                              View
                            </summary>
                            <div className="mt-2 rounded-md bg-gray-50 p-2">
                              <ChangeDetail r={r} />
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span className="tabular-nums">
                Showing {from}–{to} of {data!.total}
              </span>
              <div className="flex gap-2">
                <PageLink
                  href={pageHref(offset - LIMIT)}
                  enabled={hasPrev}
                  label="‹ Prev"
                />
                <PageLink
                  href={pageHref(offset + LIMIT)}
                  enabled={hasNext}
                  label="Next ›"
                />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function PageLink({
  href,
  enabled,
  label,
}: {
  href: string;
  enabled: boolean;
  label: string;
}) {
  return enabled ? (
    <Button asChild variant="secondary">
      <Link href={href}>{label}</Link>
    </Button>
  ) : (
    <Button variant="secondary" disabled>
      {label}
    </Button>
  );
}
