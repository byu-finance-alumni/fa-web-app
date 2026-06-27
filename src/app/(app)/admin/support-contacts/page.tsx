import { redirect } from "next/navigation";

// Support contacts moved into the Engineer Console (#162). Permanent redirect
// so old links/bookmarks still resolve.
export default function MovedSupportContactsPage() {
  redirect("/engineer/support-contacts");
}
