import type { SupportContact } from "@/types/support";

/**
 * Renders the engineer-managed support contacts as a small list with
 * click-to-email links. Shown to logged-in users on the in-app error screen so
 * a stuck user knows who to reach. Data is passed in (fetched from the
 * authenticated `/support-contacts` endpoint) — these names/emails are never
 * shown on the public login page.
 *
 * Renders nothing when the list is empty, so callers can fall back to generic
 * copy. `align` fits both left- and center-aligned containers.
 */
export function SupportContacts({
  contacts,
  align = "left",
}: {
  contacts: SupportContact[];
  align?: "left" | "center";
}) {
  if (contacts.length === 0) return null;
  return (
    <ul
      className={`space-y-1 text-sm text-gray-500 ${
        align === "center" ? "text-center" : "text-left"
      }`}
    >
      {contacts.map((c) => (
        <li key={c.support_contact_id}>
          <span className="font-medium text-gray-700">{c.role_label}:</span>{" "}
          {c.name}{" "}
          <a
            href={`mailto:${c.email}`}
            className="font-medium text-brand-blue-600 hover:text-brand-blue-500 hover:underline"
          >
            {c.email}
          </a>
        </li>
      ))}
    </ul>
  );
}
