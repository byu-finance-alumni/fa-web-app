"use client";

import { useEffect } from "react";

/** Last-resort boundary: catches errors in the root layout itself. It replaces
 * the entire document, so it ships its own <html>/<body> and uses inline styles
 * (the normal CSS pipeline may be exactly what failed). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F3F4F6",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            background: "#FFFFFF",
            border: "1px solid #D1D5DB",
            borderRadius: "1rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#9CA3AF",
            }}
          >
            Error 500
          </p>
          <h1
            style={{
              margin: "0.25rem 0 0",
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "#111827",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#6B7280",
            }}
          >
            The application ran into an unexpected error. If this keeps
            happening, please contact the BYU Finance Department.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#2E4A86",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
