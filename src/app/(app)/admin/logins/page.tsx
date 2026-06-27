import { redirect } from "next/navigation";

// Login history moved into the Engineer Console (#162). Permanent redirect so
// old links/bookmarks still resolve.
export default function MovedLoginsPage() {
  redirect("/engineer/logins");
}
