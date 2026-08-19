"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/app/login/actions";
import { getActivityStorage, writeLastActivity } from "@/lib/idleSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    // Stamp the persisted idle clock BEFORE handing off (#684). On success the
    // server action redirects and control never comes back here, so this is the
    // last client-side moment we have. Without it, a browser still holding a
    // stale timestamp from a session that ended without a clean sign-out (the
    // laptop was just closed) would mount SessionTimeout on the destination
    // page, read a timestamp older than the idle window, and bounce the user
    // straight back to /login. Writing it on a login that then FAILS is
    // harmless: no session exists, and the next successful login overwrites it.
    writeLastActivity(getActivityStorage(), Date.now());
    // Sign in via a Server Action so the auth cookie is set on the response and
    // the destination renders with a session on the first load (no empty-page-
    // until-refresh race). On success the action redirects and control never
    // returns here; only the error path resolves with a value.
    const result = await signIn(
      values.email,
      values.password,
      searchParams.get("next") ?? undefined,
    );
    if (result?.error) setFormError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
      {searchParams.get("reason") === "timeout" && !formError && (
        <div
          role="status"
          className="rounded-md border border-warning-600/30 bg-warning-50 px-3 py-2 text-sm text-warning-600"
        >
          You were signed out due to inactivity. Please sign in again.
        </div>
      )}
      {searchParams.get("signedout") === "other-device" && !formError && (
        <div
          role="status"
          className="rounded-md border border-warning-600/30 bg-warning-50 px-3 py-2 text-sm text-warning-600"
        >
          You were signed out because this account signed in on another device.
        </div>
      )}
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-sm text-danger-600"
        >
          {formError}
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your BYU email"
          aria-invalid={errors.email ? "true" : "false"}
          className="mt-1.5"
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your Password"
            aria-invalid={errors.password ? "true" : "false"}
            className="flex-1"
            {...register("password")}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
            className="text-gray-500 hover:text-gray-700"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-danger-600">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="navy"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting && (
          <Loader2 className="animate-spin" aria-hidden="true" />
        )}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <div className="space-y-2 text-center">
        <p className="text-sm text-gray-500">
          {showResetHelp
            ? "Please contact Tanya Harmon and she will be able to reset your password."
            : "Please contact the Finance Department to get your login."}
        </p>
        <Button
          type="button"
          variant="link"
          onClick={() => setShowResetHelp((v) => !v)}
          className="text-navy-800 hover:text-navy-700 hover:no-underline"
        >
          Forgot your password?
        </Button>
      </div>
    </form>
  );
}
