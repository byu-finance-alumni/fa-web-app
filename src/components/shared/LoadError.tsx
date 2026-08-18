import Link from "next/link";
import { RetryButton } from "@/components/shared/RetryButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { describeLoadFailure } from "@/lib/loadError";
import { cn } from "@/lib/utils";

/**
 * The one error state for a data read that failed (#688).
 *
 * WHY IT LOOKS DIFFERENT FROM AN EMPTY LIST. Every list on this app already has
 * an empty state: a plain white card with one muted grey line ("No links yet",
 * "No audit events match your filters"). Before this component, a *failure*
 * rendered as the same white card, or as no card at all — so an outage was
 * indistinguishable from an empty result to the user AND to whoever they called
 * about it. This card is tinted `danger-50` with a `danger-600` border, which is
 * the failure signal nothing else on a data screen uses. Read at a glance, red
 * card = broken, plain card = genuinely nothing here.
 *
 * Text-only by house rule — no alert icon. The colour is not carrying the
 * meaning on its own either: the heading and body both say outright that
 * nothing loaded (see `describeLoadFailure`), which is what the colour-blind
 * reader and the screenshot-in-a-support-thread both need.
 *
 * The retry is offered only where a retry could work — a 403 is an answer, not
 * a hiccup, and a button that re-asks a settled question just wastes a click.
 */
export function LoadError({
  status,
  noun,
  title,
  message,
  className,
}: {
  /** `ApiError.status`; 0 for a transport failure, null if the throw had none. */
  status: number | null;
  /** Lowercase noun phrase for what failed — "links", "the audit log". */
  noun: string;
  /** Override the heading where a page has more specific words for a 403. */
  title?: string;
  /** Override the body copy alongside `title`. */
  message?: string;
  className?: string;
}) {
  const failure = describeLoadFailure(status, noun);

  return (
    <Card
      className={cn(
        "border-danger-600/20 bg-danger-50 p-10 text-center",
        className,
      )}
      // Announced to screen readers on arrival: this replaced content the user
      // asked for, so it is not something to discover by tabbing into it.
      role="alert"
    >
      <p className="text-sm font-semibold text-gray-900">
        {title ?? failure.title}
      </p>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-gray-600">
        {message ?? failure.message}
      </p>

      {failure.retryable || failure.kind === "signed-out" ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          {failure.retryable ? <RetryButton /> : null}
          {failure.kind === "signed-out" ? (
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* The status code and nothing else. It is what turns "it didn't work"
          into a triageable report, and unlike the backend's own error text it
          cannot carry a table name, a record id, or an internal URL. */}
      {failure.reference !== null ? (
        <p className="mt-4 text-xs text-gray-500">
          Reference: HTTP {failure.reference}
        </p>
      ) : null}
    </Card>
  );
}
