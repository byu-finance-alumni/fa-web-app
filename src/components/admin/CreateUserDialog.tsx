"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ShieldAlert, UserPlus } from "lucide-react";
import { createUser } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CREATABLE_ROLES, type CreatableRoleId } from "@/constants/roles";

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

// Creatable roles only: view_only ("Professor", default), student, or
// full_access. The top roles (engineer, super_admin) are intentionally NOT
// creatable here (the backend 422s them) — they can only be granted to an
// existing user via the role manager, so a new account can never be
// bootstrapped into a privileged role. See @/constants/roles.
const ROLES = CREATABLE_ROLES;

type RoleValue = CreatableRoleId;

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
      <Button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Create user
      </Button>

      {open && tempPassword === null ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-t-lg border border-gray-200 bg-white p-5 shadow-card sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create user"
          >
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Create user
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="mb-1" htmlFor="create-user-email">
                  Email <span className="text-danger-600">*</span>
                </Label>
                <Input
                  id="create-user-email"
                  type="email"
                  autoComplete="off"
                  placeholder="e.g. jane.doe@byu.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1" htmlFor="create-user-first">
                    First name
                  </Label>
                  <Input
                    id="create-user-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1" htmlFor="create-user-last">
                    Last name
                  </Label>
                  <Input
                    id="create-user-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1" htmlFor="create-user-role">
                  Role
                </Label>
                <Select
                  id="create-user-role"
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
                </Select>
              </div>
              {error ? (
                <p className="text-sm text-danger-600">{error}</p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? "Creating…" : "Create user"}
              </Button>
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
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-card">
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

            <div className="mt-4 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-sm text-gray-900">
                {tempPassword}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void copy()}
                title="Copy to clipboard"
                aria-label="Copy temporary password"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy
              </Button>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" autoFocus onClick={close}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
