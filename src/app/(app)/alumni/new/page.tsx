import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AlumniForm } from "@/components/alumni/AlumniForm";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { createAlumni } from "../actions";

export default async function NewAlumniPage() {
  // Create is full_access / super_admin only. The backend enforces this too
  // (POST /alumni → RequireFullAccess); this keeps view-only users out of the UI.
  let canCreate = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canCreate =
      ctx.roles?.some((r) => r === "full_access" || r === "super_admin") ??
      false;
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
          submitLabel="Create alumni"
          cancelHref="/alumni"
          extended
        />
      </main>
    </>
  );
}
