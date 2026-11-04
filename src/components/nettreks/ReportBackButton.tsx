import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The way out of an Outreach list (#922): one visible button naming where it
 * goes, "Back to All Event Speakers lists". A plain link to the parent page, not
 * `history.back()`: it works from a direct link, and does not step through each
 * sort or filter change. Text only.
 */
export function ReportBackButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={href}>Back to {label}</Link>
    </Button>
  );
}
