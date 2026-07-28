import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    // Desktop (md+) is the unchanged prod design: navy hero + gray-50 panel with
    // a white "Sign In" card. Mobile (< md) is a deliberately minimal centered
    // column on solid white — no hero, no card — with the brand as a small text
    // mark up top (mobile-login best practice). A single LoginForm instance is
    // shared across both so there are no duplicate DOM ids.
    // min-h-dvh tracks the mobile browser's collapsing URL bar (identical to
    // 100vh on desktop, so prod is unaffected).
    <main className="flex min-h-dvh">
      {/* Navy hero — desktop only (unchanged from prod). */}
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

      {/* Form panel — plain white & centered on mobile; the prod gray-50 carded
          panel on desktop. Base padding honors the phone safe-area insets; the
          md overrides restore the exact prod px-6 py-12. */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] md:bg-gray-50 md:py-12">
        {/* Mobile-only brand lockup (desktop uses the hero + the card header). */}
        <div className="mb-10 text-center md:hidden">
          <p className="text-sm font-semibold tracking-[0.2em] text-navy-800">
            BYU FINANCE
          </p>
          <p className="mt-1 text-sm text-gray-500">Alumni Database</p>
        </div>

        {/* Card chrome (border/shadow/bg) applies only at md+ — matches the prod
            Card. On mobile this is a bare column on the white background. */}
        <div className="w-full max-w-sm border-0 bg-transparent shadow-none md:max-w-md md:rounded-lg md:border md:border-gray-200 md:bg-white md:shadow-card">
          {/* "Sign In" card header — desktop only (mobile uses the lockup
              above). Mirrors the prod CardHeader with its bottom border. */}
          <div className="hidden items-center justify-between gap-2 border-b border-gray-200 px-5 pb-4 pt-5 md:flex">
            <h1 className="text-lg font-semibold text-gray-900">Sign In</h1>
          </div>

          {/* Mirrors the prod CardContent padding at md+. */}
          <div className="md:px-5 md:pb-5 md:pt-5">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>

            {/* Privacy notice at the point of collection: staff should know their
                sign-in is logged with approximate location (see Admin → Logins).
                Gets the prod divider treatment only at md+. */}
            <p className="mt-8 text-center text-xs text-gray-400 md:mt-5 md:border-t md:border-gray-200 md:pt-4">
              For security, sign-ins are recorded with your approximate location.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
