import { AlumniRoster } from "@/components/alumni/AlumniRoster";

type SP = Record<string, string | string[] | undefined>;

// #218 Friends of the finance program — its own /friends route. The roster is
// the same list UI as /alumni but scoped to non-alumni contacts (is_alumni=false
// via the backend `kind=friend` param), so the two rosters never share records.
export default async function FriendsListPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  return (
    <AlumniRoster sp={await searchParams} kind="friend" basePath="/friends" />
  );
}
