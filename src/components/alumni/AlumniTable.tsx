"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import type { Alumni } from "@/types/alumni";

function fullName(a: Alumni): string {
  const last = a.last_name ?? "";
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return last && first ? `${last}, ${first}` : last || first || "—";
}

function avatarName(a: Alumni): string {
  return (
    [a.preferred_first_name ?? a.first_name, a.last_name]
      .filter(Boolean)
      .join(" ") || "?"
  );
}

/** Desktop alumni table. The entire row is clickable (navigates to the
 *  profile); the name stays a real link for keyboard/focus, and the LinkedIn
 *  link stops propagation so it opens externally instead of the profile. */
export function AlumniTable({ items }: { items: Alumni[] }) {
  const router = useRouter();
  return (
    <div className="hidden overflow-hidden rounded-xl border border-gray-300 bg-white md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Name</th>
            <th className="w-24 px-4 py-3">Grad</th>
            <th className="px-4 py-3">Current company</th>
            <th className="px-4 py-3">Current industry</th>
            <th className="w-24 px-4 py-3">LinkedIn</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr
              key={a.alumni_id}
              onClick={() => router.push(`/alumni/${a.alumni_id}`)}
              className="group cursor-pointer border-b border-gray-300 last:border-0 hover:bg-brand-blue-50/40"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={avatarName(a)} size="sm" />
                  <Link
                    href={`/alumni/${a.alumni_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-gray-900 group-hover:text-brand-blue-600"
                  >
                    {fullName(a)}
                  </Link>
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums text-gray-700">
                {a.graduation_year ?? "—"}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {a.current_employer ?? (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {a.current_industry ?? (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {a.linkedin_url ? (
                  <a
                    href={a.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 font-medium text-brand-blue-600 hover:underline"
                  >
                    View <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
