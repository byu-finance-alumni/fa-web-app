import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Navy hero — desktop only */}
      <div className="hidden flex-1 flex-col justify-end bg-navy-800 p-16 md:flex">
        <p className="text-sm font-semibold tracking-[0.2em] text-white">
          BYU FINANCE
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-white">
          Alumni Database
        </h1>
        <p className="mt-3 max-w-md text-base text-brand-blue-300">
          Centralized relationship management for the BYU Finance program.
        </p>
      </div>

      {/* Sign-in form — carded on a gray-50 panel (07B treatment) */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">Sign in</h2>
          <p className="mt-1 text-sm text-gray-500">
            Use your BYU Finance account to continue.
          </p>
          <div className="mt-6">
            <Suspense fallback={<div className="h-48" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
