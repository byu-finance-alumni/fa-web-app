import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AlumniForm } from "@/components/alumni/AlumniForm";
import { apiGet, ApiError } from "@/lib/api";
import type { Alumni } from "@/types/alumni";
import { updateAlumni } from "../../actions";

export default async function EditAlumniPage({
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

  const action = updateAlumni.bind(null, a.alumni_id);

  return (
    <>
      <Topbar title="Edit alumni" />
      <main className="flex-1 overflow-auto p-6">
        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
          Edit alumni
        </h2>
        <AlumniForm
          action={action}
          defaults={a}
          submitLabel="Save changes"
          cancelHref={`/alumni/${a.alumni_id}`}
        />
      </main>
    </>
  );
}
