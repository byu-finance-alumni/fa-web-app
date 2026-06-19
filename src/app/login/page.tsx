import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Navy hero — desktop only. */}
      <div className="hidden flex-1 flex-col justify-end bg-navy-800 p-16 md:flex">
        <p className="text-sm font-semibold tracking-[0.2em] text-white">
          BYU FINANCE
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-white">
          Alumni Database
        </h1>
        <p className="mt-3 max-w-md text-base text-brand-blue-300">
          Centralized relationship management for the BYU Finance department.
        </p>
      </div>

      {/* Sign-in form — carded on a gray-50 panel (07B treatment) */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-white p-8 shadow-sm">
          {/* Sign In tab (single tab — no account creation; users are
              provisioned by an administrator). */}
          <div className="border-b border-gray-300">
            <span className="-mb-px inline-block border-b-2 border-navy-800 pb-3 text-base font-semibold text-navy-800">
              Sign In
            </span>
          </div>

          <Suspense fallback={<div className="h-48" />}>
            <LoginForm />
          </Suspense>

          {/* Privacy notice at the point of collection: staff should know their
              sign-in is logged with approximate location (see Admin → Logins). */}
          <p className="mt-5 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
            For security, sign-ins are recorded with your approximate location.
          </p>
        </div>
      </div>
    </main>
  );
}
