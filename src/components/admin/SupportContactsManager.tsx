"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  createSupportContact,
  updateSupportContact,
  deleteSupportContact,
} from "@/app/(app)/admin/support-contacts/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupportContact } from "@/types/support";

// Same shape used by CreateUserDialog — a pragmatic "looks like an email" check.
// Client-side only; the backend remains the source of truth on save.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());

/**
 * Engineer-only editor for the support contacts shown to logged-in users on the
 * in-app error screen. Add, edit (role label / name / email), and remove rows.
 * The whole page is engineer-gated and the backend re-enforces it; this just
 * drives the requests and surfaces results via the toast. Styling values come
 * from the design system (UX-UI.md).
 */
export function SupportContactsManager({
  contacts,
}: {
  contacts: SupportContact[];
}) {
  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <Card className="p-6 text-center text-sm text-gray-500">
          No support contacts yet. Add one below — it’ll show to signed-in users
          on the error screen.
        </Card>
      ) : (
        contacts.map((c) => <ContactRow key={c.support_contact_id} contact={c} />)
      )}
      <AddContactRow />
    </div>
  );
}

function ContactRow({ contact }: { contact: SupportContact }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(contact.role_label);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);

  const dirty =
    role !== contact.role_label ||
    name !== contact.name ||
    email !== contact.email;
  // Only flag a bad email once the field is non-empty (so an in-progress edit
  // isn't nagged immediately).
  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);

  function save() {
    if (!dirty || emailInvalid) return;
    startTransition(async () => {
      const res = await updateSupportContact(contact.support_contact_id, {
        role_label: role,
        name,
        email,
      });
      if (res?.error) toast.error(res.error);
      else toast.success("Contact updated.");
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteSupportContact(contact.support_contact_id);
      if (res?.error) toast.error(res.error);
      else toast.success(`Removed ${contact.role_label} contact.`);
    });
  }

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <Label className="mb-1">Role label</Label>
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className="block">
          <Label className="mb-1">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <Label className="mb-1">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailInvalid || undefined}
            className={
              emailInvalid
                ? "border-danger-600 focus-visible:ring-danger-500"
                : undefined
            }
          />
          {emailInvalid ? (
            <p className="mt-1 text-xs text-danger-600">
              Enter a valid email address.
            </p>
          ) : null}
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={remove}
          disabled={pending}
          className="border-danger-600/40 text-danger-600 hover:bg-danger-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!dirty || emailInvalid || pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          Save
        </Button>
      </div>
    </Card>
  );
}

function AddContactRow() {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);
  const ready = role.trim() && name.trim() && isValidEmail(email);

  function add() {
    if (!ready) return;
    startTransition(async () => {
      const res = await createSupportContact({
        role_label: role.trim(),
        name: name.trim(),
        email: email.trim(),
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Contact added.");
        setRole("");
        setName("");
        setEmail("");
      }
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Add a contact
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="Role (e.g. Super Admin)" value={role} onChange={(e) => setRole(e.target.value)} />
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <Input
            type="email"
            placeholder="name@byu.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailInvalid || undefined}
            className={
              emailInvalid
                ? "border-danger-600 focus-visible:ring-danger-500"
                : undefined
            }
          />
          {emailInvalid ? (
            <p className="mt-1 text-xs text-danger-600">
              Enter a valid email address.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="navy"
          size="sm"
          onClick={add}
          disabled={!ready || pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          Add contact
        </Button>
      </div>
    </div>
  );
}
