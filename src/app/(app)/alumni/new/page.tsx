import { Topbar } from "@/components/shell/Topbar";
import { AlumniForm } from "@/components/alumni/AlumniForm";
import { createAlumni } from "../actions";

export default function NewAlumniPage() {
  return (
    <>
      <Topbar title="Add alumni" />
      <main className="flex-1 overflow-auto p-6">
        <h2 className="mb-4 text-2xl font-semibold text-gray-900">Add alumni</h2>
        <AlumniForm
          action={createAlumni}
          submitLabel="Create alumni"
          cancelHref="/alumni"
        />
      </main>
    </>
  );
}
