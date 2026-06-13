"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

/**
 * Branded error/empty screen shared by the route error boundaries and the 404
 * page. Calm, on-brand, and always actionable — the user can retry, go home,
 * and knows who to contact. Never a raw stack trace or white screen.
 */
export function ErrorScreen({
  code,
  title,
  message,
  reset,
}: {
  code?: string;
  title: string;
  message: string;
  reset?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] w-full flex-1 items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        {code ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            {code}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
        <p className="mt-4 text-sm text-gray-500">
          If this keeps happening, please contact the{" "}
          <span className="font-medium text-gray-700">
            BYU Finance Department
          </span>
          .
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          ) : null}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
