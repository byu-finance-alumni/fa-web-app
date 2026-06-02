import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
        {/* Navy header band — the logo .jpg has a baked navy background, so it
            only belongs on a navy surface (see UX-UI.md → Brand assets). */}
        <div className="flex items-center justify-center bg-navy-800 px-8 py-6">
          <Image
            src="/branding/finance-logo.jpg"
            alt="BYU Finance — Marriott School of Business"
            width={200}
            height={64}
            priority
            className="h-12 w-auto"
          />
        </div>

        <div className="p-8">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-navy-800">Sign in</h1>
            <p className="mt-2 text-sm text-gray-500">
              Use your BYU Finance account to access the alumni database.
            </p>
          </div>

          <Suspense fallback={<div className="mt-6 h-48" />}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/" className="text-brand-blue-600 hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
