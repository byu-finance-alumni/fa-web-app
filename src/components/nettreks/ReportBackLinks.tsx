import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The way out of an Outreach list (#922): a visible Back button beside the
 * "All ... lists" link. Both are plain links to the parent page, not
 * `history.back()`: they work from a direct link, and Back does not step through
 * each sort or filter change. Text only.
 */
export function ReportBackLinks({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Button asChild variant="secondary" size="sm">
        <Link href={href}>Back</Link>
      </Button>
      <Link
        href={href}
        className="text-sm text-brand-blue-600 underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    </div>
  );
}
