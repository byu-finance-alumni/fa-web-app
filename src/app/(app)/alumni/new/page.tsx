import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AlumniForm } from "@/components/alumni/AlumniForm";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { hasFullAccess } from "@/constants/roles";
import { createAlumni, previewAlumni } from "../actions";

export default async function NewAlumniPage() {
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

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: "Add alumni" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <AlumniForm
          action={createAlumni}
          previewAction={previewAlumni}
          submitLabel="Create alumni"
          cancelHref="/alumni"
          extended
        />
      </main>
    </>
  );
}
