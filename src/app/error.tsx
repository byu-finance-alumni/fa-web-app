"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/shared/ErrorScreen";

/** Root route-error boundary — catches render/data errors outside the app shell
 * (e.g. on `/`, `/login`) so the user never sees a raw 500 / white screen. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced server-side in the logs; the user only sees the friendly screen.
    console.error("Route error:", error);
  }, [error]);

  return (
    <ErrorScreen
      code="Error 500"
      title="Something went wrong"
      message="We hit an unexpected problem loading this page. You can try again, or head back to the dashboard."
      reset={reset}
    />
  );
}
