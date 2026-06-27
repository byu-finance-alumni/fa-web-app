import { redirect } from "next/navigation";

// Vocabulary moved into the Engineer Console (#162). Keep this path as a
// permanent redirect so old links/bookmarks still land in the right place.
export default function MovedVocabularyPage() {
  redirect("/engineer/vocabulary");
}
