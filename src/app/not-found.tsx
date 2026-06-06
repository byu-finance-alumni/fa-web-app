import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

/** 404 — shown for unmatched routes and `notFound()` calls. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
          <FileQuestion className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          Error 404
        </p>
        <h1 className="text-xl font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          The page you’re looking for doesn’t exist or may have been moved.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          If you reached this from a link inside the app, please contact the{" "}
          <span className="font-medium text-gray-700">BYU Finance Department</span>.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Go home
        </Link>
      </div>
    </div>
  );
}
