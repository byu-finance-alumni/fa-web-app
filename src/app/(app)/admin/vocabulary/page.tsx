import { redirect } from "next/navigation";

// Vocabulary is now capability-gated at /vocabulary (reachable by the engineer
// and any role granted the vocab capability). Keep this old path as a redirect
// so existing links/bookmarks still land in the right place.
export default function MovedVocabularyPage() {
  redirect("/vocabulary");
}
