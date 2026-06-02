import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
      <div className="w-full max-w-sm rounded-lg border border-gray-300 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-blue-600">
            BYU Finance
          </p>
          <h1 className="mt-1 text-xl font-semibold text-navy-800">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Authentication is not wired up yet — this is a placeholder.
          </p>
        </div>

        {/* Placeholder form — no submit logic yet. Supabase Auth wiring comes later. */}
        <form className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium uppercase tracking-wide text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@byu.edu"
              disabled
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wide text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500 disabled:bg-gray-50"
            />
          </div>
          <button
            type="submit"
            disabled
            className="w-full rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-brand-blue-600 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
