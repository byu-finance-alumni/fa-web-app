import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AlumniForm } from "@/components/alumni/AlumniForm";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { canCreateAlumni } from "@/constants/capabilities";
import { createAlumni, createFriend, previewAlumni } from "../actions";

export default async function NewAlumniPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  // Create is gated on the `alumni.create` capability (fa-web-api #379), seeded
  // to engineer / super_admin / full_access — NOT students, who may only edit
  // existing records. Read from the capability list rather than the role so an
  // engineer's grant takes effect here too. The backend enforces the same guard
  // (POST /alumni -> RequireAlumniCreate); this just keeps roles without it out
  // of the create UI.
  let canCreate = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canCreate = canCreateAlumni(ctx.capabilities);
  } catch {
    canCreate = false;
  }
  if (!canCreate) redirect("/alumni");

  // #218: /alumni/new?kind=friend creates a non-alumni "friend" record via
  // createFriend (is_alumni=false), so the Friends roster stays separate from
  // Alumni. Everything else (form, preview) is identical.
  const isFriend = (await searchParams).kind === "friend";

  return (
    <>
      <Topbar
        breadcrumb={[
          isFriend
            ? { label: "Friends", href: "/friends" }
            : { label: "Alumni", href: "/alumni" },
          { label: isFriend ? "Add friend" : "Add alumni" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <AlumniForm
          action={isFriend ? createFriend : createAlumni}
          previewAction={previewAlumni}
          submitLabel={isFriend ? "Create friend" : "Create alumni"}
          cancelHref={isFriend ? "/friends" : "/alumni"}
          extended
        />
      </main>
    </>
  );
}
