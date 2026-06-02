"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

// Only allow same-origin relative paths as the post-login redirect, so a
// crafted `?next=` can't bounce the user to an external site.
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      // Supabase returns "Invalid login credentials" for both bad email and
      // bad password — keep it generic so we don't leak which accounts exist.
      setFormError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message,
      );
      return;
    }

    // Refresh so the server (middleware) sees the new session cookie before we
    // navigate to the protected destination.
    router.replace(safeNext(searchParams.get("next")));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
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
          className="block text-xs font-medium uppercase tracking-wide text-gray-700"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@byu.edu"
          aria-invalid={errors.email ? "true" : "false"}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium uppercase tracking-wide text-gray-700"
        >
          Password
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? "true" : "false"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:text-brand-blue-600"
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
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
