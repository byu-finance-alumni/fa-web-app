"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { completePasswordChange } from "@/app/set-password/actions";

const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be 72 characters or fewer"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((vals) => vals.password === vals.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export function SetPasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: SetPasswordValues) {
    setFormError(null);

    // 1) Update the password on the user's OWN authenticated session via the
    //    browser Supabase client (mirrors how the app builds its client).
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      // Supabase rejects e.g. a password equal to the current one, or one that
      // fails its policy. Surface a clear, non-technical message.
      setFormError(
        error.message ||
          "Could not update your password. Please try a different one.",
      );
      return;
    }

    // 2) Clear the must-change flag on the backend (authenticated; acts on the
    //    caller's own account). Only after this succeeds do we let them in.
    const result = await completePasswordChange();
    if (result?.error) {
      setFormError(result.error);
      return;
    }

    // 3) Into the app. refresh() drops the cached logged-out/forced-redirect
    //    render so the dashboard renders fresh with the cleared flag.
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
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
          htmlFor="new-password"
          className="block text-sm font-medium text-gray-700"
        >
          New password
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter a new password"
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
        {errors.password ? (
          <p className="mt-1 text-xs text-danger-600">
            {errors.password.message}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            Use at least 8 characters.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-gray-700"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          aria-invalid={errors.confirm ? "true" : "false"}
          className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
          {...register("confirm")}
        />
        {errors.confirm && (
          <p className="mt-1 text-xs text-danger-600">
            {errors.confirm.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {isSubmitting ? "Saving…" : "Set password and continue"}
      </button>
    </form>
  );
}
