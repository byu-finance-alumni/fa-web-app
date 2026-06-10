"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/app/login/actions";

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
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-sm text-danger-600"
        >
          {formError}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Username
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your BYU email"
          aria-invalid={errors.email ? "true" : "false"}
          className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
          Password
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your Password"
            aria-invalid={errors.password ? "true" : "false"}
            className="w-full flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
            className="flex w-11 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue-500"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-danger-600">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>

      <div className="space-y-2 text-center">
        <p className="text-sm text-gray-500">
          {showResetHelp
            ? "Please contact Tanya Harmon and she will be able to reset your password."
            : "Please contact the Finance Department to get your login."}
        </p>
        <button
          type="button"
          onClick={() => setShowResetHelp((v) => !v)}
          className="text-sm font-semibold text-navy-800 hover:text-navy-700"
        >
          Forgot your password?
        </button>
      </div>
    </form>
  );
}
