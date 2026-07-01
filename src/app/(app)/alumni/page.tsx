import { AlumniRoster } from "@/components/alumni/AlumniRoster";

type SP = Record<string, string | string[] | undefined>;

export default async function AlumniListPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  return (
    <AlumniRoster sp={await searchParams} kind="alumni" basePath="/alumni" />
  );
}
