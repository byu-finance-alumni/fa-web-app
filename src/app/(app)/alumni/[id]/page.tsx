import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import type { Alumni } from "@/types/alumni";
import { Topbar } from "@/components/shell/Topbar";

const TABS = [
  "Overview",
  "Contact",
  "Career",
  "Employment",
  "Engagement",
  "Interactions",
  "Tasks",
  "Attachments",
  "Audit",
];

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className={`text-sm ${value ? "text-gray-900" : "text-gray-300"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

export default async function AlumniProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let a: Alumni;
  try {
    a = await apiGet<Alumni>(`/alumni/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const name =
    [a.preferred_first_name ?? a.first_name, a.last_name]
      .filter(Boolean)
      .join(" ") || "Alumni";

  return (
    <>
      <Topbar title="Alumni" />
      <main className="flex-1 overflow-auto p-6">
        <nav className="mb-4 flex items-center gap-2 text-sm">
          <Link href="/alumni" className="text-gray-500 hover:text-brand-blue-600">
            Alumni
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-900">{name}</span>
        </nav>

        <div className="mb-4 flex items-center gap-4 rounded-xl border border-gray-300 bg-white p-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-blue-300 bg-brand-blue-50 text-lg font-semibold text-brand-blue-600">
            {(name[0] ?? "?").toUpperCase()}
          </span>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">
              {a.graduation_year ? `Class of ${a.graduation_year} · ` : ""}
              {a.byu_id ? `BYU ID ${a.byu_id}` : ""}
              {a.net_id ? ` · Net ID ${a.net_id}` : ""}
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-6 border-b border-gray-300 text-sm">
          {TABS.map((t, i) => (
            <span
              key={t}
              className={`pb-2.5 ${
                i === 0
                  ? "border-b-2 border-brand-blue-600 font-semibold text-brand-blue-600"
                  : "font-medium text-gray-500"
              }`}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-xl border border-gray-300 bg-white p-5">
              <h3 className="mb-3 text-[15px] font-semibold text-gray-900">
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Fact label="Preferred name" value={a.preferred_first_name} />
                <Fact label="Gender" value={a.gender} />
                <Fact
                  label="Graduation year"
                  value={a.graduation_year?.toString() ?? null}
                />
                <Fact
                  label="Finance program year"
                  value={a.finance_program_year?.toString() ?? null}
                />
                <Fact label="Graduate degree" value={a.graduate_degree} />
                <Fact
                  label="Record status"
                  value={a.archived ? "Archived" : a.deceased ? "Deceased" : "Active"}
                />
              </div>
            </section>
            {a.notes ? (
              <section className="rounded-xl border border-gray-300 bg-white p-5">
                <h3 className="mb-2 text-[15px] font-semibold text-gray-900">
                  Notes
                </h3>
                <p className="text-sm leading-relaxed text-gray-700">{a.notes}</p>
              </section>
            ) : null}
          </div>

          <div className="space-y-4">
            <section className="rounded-xl border border-gray-300 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-gray-900">Contact</h3>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                  Awaiting data
                </span>
              </div>
              <div className="space-y-3">
                <Fact label="Personal email" value={null} />
                <Fact label="Phone" value={null} />
                <Fact label="Location" value={null} />
                <Fact label="LinkedIn" value={a.linkedin_url} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
