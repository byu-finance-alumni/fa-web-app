import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AlumniForm } from "@/components/alumni/AlumniForm";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { hasFullAccess } from "@/constants/roles";
import { createAlumni, createFriend, previewAlumni } from "../actions";

export default async function NewAlumniPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  // Create is full_access and up (engineer / super_admin / full_access) — NOT
  // students, who may only edit existing records. The backend enforces this too
  // (POST /alumni → RequireFullAccess); this keeps view-only/student users out
  // of the create UI.
  let canCreate = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canCreate = hasFullAccess(ctx.roles);
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
      {/* Identical chrome to /events/new (#611) — the two "Add" screens are
          meant to be indistinguishable. `p-4` on a phone, the standard `p-6`
          from `md` up. */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
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
