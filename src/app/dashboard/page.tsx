import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";

// Minimal authenticated landing page. Middleware already blocks unauthenticated
// access; we re-verify here (defense in depth) and read the user for display.
// The full app shell (sidebar + top bar) and role-aware UI land in a follow-up
// once the backend resolves roles from the database.
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between border-b border-gray-300 bg-navy-800 px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-300">
            BYU Finance
          </p>
          <h1 className="text-lg font-semibold text-white">Alumni Database</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-blue-300 sm:inline">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-gray-300 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-navy-800">
            You&apos;re signed in
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Authentication is working. The dashboard, alumni search, and profile
            screens are coming next — once the database schema is finalized and
            the backend exposes data.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        </div>
      </section>
    </main>
  );
}
