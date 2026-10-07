"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { changePassword } from "@/app/set-password/actions";
import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SetPasswordValues = { password: string; confirm: string };

/** Schema factory: the "password can't be your email" rule needs the caller's
 *  email, so build the schema per-user. Comparison is case-insensitive and
 *  trims surrounding whitespace. */
const makeSetPasswordSchema = (email: string) =>
  z
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
    })
    .refine(
      (vals) =>
        !email ||
        vals.password.trim().toLowerCase() !== email.trim().toLowerCase(),
      {
        message: "Your password can't be the same as your email address.",
        path: ["password"],
      },
    );

export function SetPasswordForm({ email = "" }: { email?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const setPasswordSchema = useMemo(
    () => makeSetPasswordSchema(email),
    [email],
  );

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

    // 1) The backend sets the password AND clears the must-change flag in one
    //    call (fa-web-api#592), acting on the caller's own account. It re-checks
    //    the rules above and refuses the temporary password, so a rejection here
    //    carries a message worth showing as-is. Only after it succeeds do we let
    //    them in.
    const result = await changePassword(values.password);
    if (result?.error) {
      setFormError(result.error);
      return;
    }

    // 2) Sign straight back in. Setting the password through the Supabase
    //    Admin API ends EVERY session the user has — including this one — so
    //    without this they land on /login. `signIn` is the normal login path
    //    (lockout precheck, single-session claim, login record) and redirects
    //    into the app on success.
    if (email) {
      const signInResult = await signIn(email, values.password, "/dashboard");
      if (signInResult?.error) setFormError(signInResult.error);
      return;
    }

    // No email to sign back in with (shouldn't happen): send them to log in.
    router.replace("/login");
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
        <Label htmlFor="new-password">New password</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter a new password"
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
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          aria-invalid={errors.confirm ? "true" : "false"}
          className="mt-1.5"
          {...register("confirm")}
        />
        {errors.confirm && (
          <p className="mt-1 text-xs text-danger-600">
            {errors.confirm.message}
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
        {isSubmitting ? "Saving…" : "Set password and continue"}
      </Button>
    </form>
  );
}
