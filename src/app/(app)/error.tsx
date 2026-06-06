"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/shared/ErrorScreen";

/** Error boundary for the authenticated app shell. Renders inside the sidebar
 * layout, so a single failing page (e.g. the backend API is unreachable) shows
 * a recoverable error in the content area instead of taking down the whole UI. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <ErrorScreen
      title="This page didn’t load"
      message="We couldn’t load this data right now — the service may be temporarily unavailable. Try again in a moment."
      reset={reset}
    />
  );
}
