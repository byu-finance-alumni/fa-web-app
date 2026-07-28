import { AlumniProfileView } from "../../alumni/[id]/page";

/**
 * `/friends/[id]` — a friend-of-the-program's profile (#494).
 *
 * Friends live in the same `alumni` table (is_alumni=false), so this renders the
 * SAME `AlumniProfileView` as `/alumni/[id]`. The two profiles therefore share
 * one layout and can never drift — any change to the alumni profile applies here
 * automatically. Only the breadcrumb differs (Friends vs Alumni).
 */
export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AlumniProfileView id={id} basePath="/friends" backLabel="Friends" />;
}
