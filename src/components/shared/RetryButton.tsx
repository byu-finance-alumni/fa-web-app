"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Try again" for a failed data read inside a Server Component page (#688).
 *
 * The pages this sits on load their data on the server, so there is no client
 * fetch to re-run and nothing to pass down: `router.refresh()` re-renders the
 * route on the server and swaps the new payload in, keeping scroll position and
 * client state. `useTransition` gives us the pending flag, so the button says
 * what it's doing instead of looking inert while the request is in flight —
 * which on a slow-failing API is the difference between "it's working on it"
 * and "the button is broken too".
 */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Retrying…" : label}
    </Button>
  );
}
