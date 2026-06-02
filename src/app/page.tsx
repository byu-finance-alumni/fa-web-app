import Link from "next/link";
import { ApiStatus } from "@/components/shared/ApiStatus";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl">
        <div className="mb-4 flex justify-center">
          <ApiStatus />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-blue-600">
          BYU Marriott School of Business
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-navy-800">
          Finance Alumni Database
        </h1>
        <p className="mt-4 text-sm text-gray-700">
          Internal CRM and relationship management for the BYU Finance program.
          This is a placeholder home page — dashboard, search, and alumni
          profiles are coming next.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue-500"
          >
            Go to login
          </Link>
        </div>
      </div>
    </main>
  );
}
