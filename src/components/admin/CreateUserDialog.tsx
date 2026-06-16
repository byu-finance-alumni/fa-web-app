"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ShieldAlert, UserPlus } from "lucide-react";
import { createUser } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * Super-admin "Create user" flow. Opens a dialog to provision a new account
 * (email + optional name + role), then swaps to a one-time temporary-password
 * reveal exactly once — the password is never persisted client-side and won't be
 * shown again, matching `UnlockResetPassword`. Closing the reveal refreshes the
 * route so the new row appears. The whole Admin screen is super_admin-gated and
 * the backend re-enforces it; a duplicate email (409) surfaces as a toast.
 *
 * Role labels mirror `RoleManager`; styling values come from the design system
 * (UX-UI.md): primary = `brand-blue-600`, secondary = white + `gray-300` border,
 * errors = `danger-600`, monospace credential = `font-mono`.
 */

// Same labels + order as RoleManager, with view_only as the default role.
const ROLES = [
  { value: "view_only", label: "View only" },
  { value: "full_access", label: "Full access" },
  { value: "super_admin", label: "Super admin" },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

const labelCls = "mb-1 block text-[11px] font-medium text-gray-500";
const fieldCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-blue-600 focus:outline-none focus:ring-1 focus:ring-brand-blue-600";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateUserDialog() {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleName, setRoleName] = useState<RoleValue>("view_only");
  const [error, setError] = useState<string | null>(null);

  // Set once the user is created — drives the one-time reveal.
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string>("");

  // Esc closes the open dialog (form or reveal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setEmail("");
    setFirstName("");
    setLastName("");
    setRoleName("view_only");
    setError(null);
    setTempPassword(null);
    setCreatedEmail("");
  }

  function close() {
    setOpen(false);
    // If we just created a user, refresh so the new row renders.
    if (tempPassword !== null) router.refresh();
    reset();
  }

  function submit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (firstName.trim().length > 100 || lastName.trim().length > 100) {
      setError("Names must be 100 characters or fewer.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createUser({
        email: trimmedEmail,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        role_name: roleName,
      });
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setCreatedEmail(res.email);
        setTempPassword(res.temp_password);
        toast.success("User created.");
      }
    });
  }

  async function copy() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Temporary password copied.");
    } catch {
      toast.error("Couldn't copy — select and copy it manually.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-500"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Create user
      </button>

      {open && tempPassword === null ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-gray-300 bg-white p-5 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create user"
          >
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Create user
            </h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls} htmlFor="create-user-email">
                  Email <span className="text-danger-600">*</span>
                </label>
                <input
                  id="create-user-email"
                  type="email"
                  autoComplete="off"
                  className={fieldCls}
                  placeholder="e.g. jane.doe@byu.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="create-user-first">
                    First name
                  </label>
                  <input
                    id="create-user-first"
                    className={fieldCls}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="create-user-last">
                    Last name
                  </label>
                  <input
                    id="create-user-last"
                    className={fieldCls}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="create-user-role">
                  Role
                </label>
                <select
                  id="create-user-role"
                  className={`${fieldCls} bg-white`}
                  style={{ colorScheme: "light" }}
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value as RoleValue)}
                >
                  {ROLES.map((r) => (
                    <option
                      key={r.value}
                      value={r.value}
                      className="bg-white text-gray-900"
                    >
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {error ? (
                <p className="text-sm text-danger-600">{error}</p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create user"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {open && tempPassword !== null ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="create-user-pw-title"
          aria-describedby="create-user-pw-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-300 bg-white p-6 shadow-lg">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2
                id="create-user-pw-title"
                className="text-lg font-semibold text-gray-900"
              >
                Temporary password for {createdEmail}
              </h2>
            </div>
            <p id="create-user-pw-desc" className="text-sm text-gray-600">
              Give this to the user and have them change it. It won&apos;t be
              shown again.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-sm text-gray-900">
                {tempPassword}
              </code>
              <button
                type="button"
                onClick={() => void copy()}
                title="Copy to clipboard"
                aria-label="Copy temporary password"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={close}
                className="inline-flex items-center justify-center rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
