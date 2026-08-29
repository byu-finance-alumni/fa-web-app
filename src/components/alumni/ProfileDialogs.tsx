"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import {
  addEducation,
  addEmploymentRole,
  addEventAttendance,
  addInteraction,
  updateInteraction,
  deleteInteraction,
  addLeadership,
  addStatusLabel,
  addTag,
  addTask,
  archiveAlumni,
  deleteEducation,
  deleteEmploymentRole,
  deleteLeadership,
  removeStatusLabel,
  removeTag,
  restoreAlumni,
  setTaskComplete,
  updateEducation,
  updateEmploymentRole,
  updateLeadership,
} from "@/app/(app)/alumni/actions";
import type {
  Education,
  EmploymentHistory,
  Interaction,
  Leadership,
} from "@/types/profile";
import {
  ATTENDANCE_STATUS_OPTIONS,
  INDUSTRY_OPTIONS,
  STATUS_OPTIONS,
  TAG_OPTIONS,
} from "@/constants/dropdowns";
import { chipTone } from "@/components/alumni/tag-tone";
import {
  DO_NOT_CONTACT,
  DO_NOT_CONTACT_BANNER_TITLE,
  doNotContactBannerBody,
  doNotContactCopy,
  isDoNotContact,
  type DoNotContactCopy,
} from "@/components/alumni/do-not-contact";
import { clientGet } from "@/lib/api-client";
import { useVocabOptions, withValue } from "@/hooks/useVocabOptions";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const INTERACTION_TYPES = [
  "Phone Call",
  "Meeting",
  "Networking",
  "Event Follow-Up",
  "Recruiting Discussion",
  "General Outreach",
] as const;

/* --------------------------------------------------------------- modal ----- */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-lg border border-gray-200 bg-white p-5 shadow-lg sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="mb-4 text-base font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function FormButtons({
  pending,
  onCancel,
  submitLabel,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

/**
 * Run a side effect once a submit transitions from pending to resolved.
 *
 * On success we also `router.refresh()` so the server-rendered profile (the
 * interaction timeline, employment/education/leadership lists, etc.) re-fetches
 * and reflects the mutation. The server actions call `revalidatePath`, but a
 * `useActionState` form submit does NOT re-render the current route on its own —
 * without this refresh the just-added/edited row keeps its stale data and a
 * deleted/re-edited row 404s on the next action (QA B1/B2).
 */
function useOnSubmitSettled(
  pending: boolean,
  error: string | undefined,
  onSuccess: () => void,
  onError: () => void,
) {
  const router = useRouter();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      if (error) onError();
      else {
        onSuccess();
        router.refresh();
      }
    }
    wasPending.current = pending;
  }, [pending, error, onSuccess, onError, router]);
}

/* -------------------------------------------------- add interaction -------- */

/**
 * Convert a stored ISO `interaction_date_time` to the `YYYY-MM-DDTHH:mm` value
 * a `datetime-local` input expects, expressed in the viewer's local clock.
 * Returns "" for null/unparseable so the field stays empty.
 */
function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Shift by the timezone offset so toISOString() yields the local wall-clock.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Current local wall-clock as a `YYYY-MM-DDTHH:mm` value for the `max` attr. */
function nowDateTimeLocalValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Field-level errors for the interaction form, keyed by input name. Mirrors the
 * `fieldErrors` shape the event form uses — `undefined` for a valid field.
 */
type InteractionFieldErrors = {
  interaction_type?: string;
  interaction_date_time?: string;
};

/**
 * Client-side validation for an add/edit interaction submit. The backend now
 * 422s on an empty/partial interaction (interaction_type + interaction_date_time
 * are both REQUIRED, H1) and rejects a future date (H2) — we re-check here so an
 * invalid submit is blocked with inline messages and no request is sent.
 *
 * `allowEmptyDate` keeps editing-to-clear working where the action supports it:
 * on edit, an empty date is allowed (sent as null); on add it is required.
 */
function validateInteraction(
  type: string,
  when: string,
  { allowEmptyDate }: { allowEmptyDate: boolean },
): InteractionFieldErrors {
  const errors: InteractionFieldErrors = {};
  if (!type.trim()) errors.interaction_type = "Choose an interaction type.";
  if (!when) {
    if (!allowEmptyDate) errors.interaction_date_time = "Pick a date and time.";
  } else {
    const picked = new Date(when);
    if (Number.isNaN(picked.getTime())) {
      errors.interaction_date_time = "Enter a valid date and time.";
    } else if (picked.getTime() > Date.now()) {
      errors.interaction_date_time = "The date can't be in the future.";
    }
  }
  return errors;
}

/** Shared field set for the add/edit interaction forms. */
function InteractionFields({
  row,
  fieldErrors,
  when,
  setWhen,
  type,
  setType,
}: {
  row?: Interaction;
  fieldErrors: InteractionFieldErrors;
  when: string;
  setWhen: (v: string) => void;
  type: string;
  setType: (v: string) => void;
}) {
  // Options come from the editable vocabulary (Admin → Vocabulary) so admin
  // edits show up here; INTERACTION_TYPES is the fallback until it loads / on
  // error. Preserve a stored type that isn't in the active list (e.g. an
  // older/imported or since-hidden value) so editing an unrelated field doesn't
  // silently overwrite it with the first option.
  const current = row?.interaction_type ?? null;
  const vocabTypes = useVocabOptions("interaction_type", INTERACTION_TYPES);
  const typeOptions = withValue(vocabTypes, current);
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1" htmlFor="interaction_type">
          Type <span className="text-danger-600">*</span>
        </Label>
        <Select
          id="interaction_type"
          name="interaction_type"
          style={{ colorScheme: "light" }}
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-invalid={fieldErrors.interaction_type ? true : undefined}
          className={cn(
            fieldErrors.interaction_type &&
              "border-danger-600 focus-visible:border-danger-600 focus-visible:ring-danger-600",
          )}
        >
          <option value="">— Select —</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        {fieldErrors.interaction_type ? (
          <p className="mt-1 text-xs text-danger-600">
            {fieldErrors.interaction_type}
          </p>
        ) : null}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label htmlFor="interaction_date_time">
            Date &amp; time <span className="text-danger-600">*</span>
          </Label>
          <div className="flex items-center gap-3">
            {/* "Today" fills BOTH the date and the current time (#277) — a
                one-click way to stamp "now" without fighting the native picker.
                nowDateTimeLocalValue() already includes HH:mm, so the time is
                set, not just the date. */}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => setWhen(nowDateTimeLocalValue())}
            >
              Today
            </Button>
            {when ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0"
                onClick={() => setWhen("")}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {/* Controlled date so an explicit "Clear" reliably empties the field (the
            browser-native datetime-local clear is inconsistent — FA-6). `max` =
            now blocks future dates at the picker level (H2); the empty value
            submits as "", which updateInteraction sends as null on edit. */}
        <Input
          id="interaction_date_time"
          name="interaction_date_time"
          type="datetime-local"
          style={{ colorScheme: "light" }}
          value={when}
          max={nowDateTimeLocalValue()}
          onChange={(e) => setWhen(e.target.value)}
          aria-invalid={fieldErrors.interaction_date_time ? true : undefined}
          className={cn(
            fieldErrors.interaction_date_time &&
              "border-danger-600 focus-visible:border-danger-600 focus-visible:ring-danger-600",
          )}
        />
        {fieldErrors.interaction_date_time ? (
          <p className="mt-1 text-xs text-danger-600">
            {fieldErrors.interaction_date_time}
          </p>
        ) : null}
      </div>
      <div>
        <Label className="mb-1" htmlFor="interaction_notes">
          Notes
        </Label>
        <Textarea
          id="interaction_notes"
          name="interaction_notes"
          rows={4}
          placeholder="What was discussed?"
          defaultValue={row?.interaction_notes ?? ""}
        />
      </div>
    </div>
  );
}

export function AddInteractionButton({
  alumniId,
  label = "Add interaction",
  primary = false,
  open: openProp,
  onOpenChange,
}: {
  alumniId: number;
  label?: string;
  primary?: boolean;
  /** Controlled-open mode. When provided, the default trigger button is hidden
   *  and the modal's visibility follows this prop — lets a parent (e.g. the
   *  alumni-list row action menu) drive the same logging dialog without
   *  duplicating the form or its server action. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = (next: boolean) => {
    if (!controlled) setOpenState(next);
    onOpenChange?.(next);
  };
  const [state, formAction, pending] = useActionState(
    addInteraction.bind(null, alumniId),
    null,
  );
  // Required type + date are validated client-side before the request is sent
  // (H1/H2): an empty/partial or future-dated submit is blocked with inline
  // messages and never reaches the backend.
  const [type, setType] = useState("");
  const [when, setWhen] = useState("");
  const [fieldErrors, setFieldErrors] = useState<InteractionFieldErrors>({});
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      setType("");
      setWhen("");
      setFieldErrors({});
      toast.success("Interaction logged.");
    },
    () => toast.error(state?.error ?? "Failed to add interaction."),
  );

  return (
    <>
      {controlled ? null : (
        <Button
          type="button"
          variant={primary ? "primary" : "secondary"}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      )}
      {open ? (
        <Modal title="Log interaction" onClose={() => setOpen(false)}>
          <form
            action={formAction}
            onSubmit={(e) => {
              const errs = validateInteraction(type, when, {
                allowEmptyDate: false,
              });
              setFieldErrors(errs);
              if (Object.keys(errs).length > 0) e.preventDefault();
            }}
          >
            <InteractionFields
              fieldErrors={fieldErrors}
              type={type}
              setType={setType}
              when={when}
              setWhen={setWhen}
            />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Log interaction"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- edit interaction --- */

/** Inline "Edit" control + dialog for one interaction row. */
export function EditInteractionButton({
  alumniId,
  row,
}: {
  alumniId: number;
  row: Interaction;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateInteraction.bind(null, alumniId, row.interaction_id),
    null,
  );
  // Seed from the existing row. Editing to clear the date stays allowed (sent as
  // null); type stays required and a future date is rejected (H1/H2).
  const [type, setType] = useState(row.interaction_type ?? "");
  const [when, setWhen] = useState(() =>
    toDateTimeLocalValue(row.interaction_date_time),
  );
  const [fieldErrors, setFieldErrors] = useState<InteractionFieldErrors>({});
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      setFieldErrors({});
      toast.success("Interaction updated.");
    },
    () => toast.error(state?.error ?? "Failed to save interaction."),
  );

  return (
    <>
      <RowIconButton
        label="Edit interaction"
        icon={Pencil}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <Modal title="Edit interaction" onClose={() => setOpen(false)}>
          <form
            action={formAction}
            onSubmit={(e) => {
              const errs = validateInteraction(type, when, {
                allowEmptyDate: true,
              });
              setFieldErrors(errs);
              if (Object.keys(errs).length > 0) e.preventDefault();
            }}
          >
            <InteractionFields
              row={row}
              fieldErrors={fieldErrors}
              type={type}
              setType={setType}
              when={when}
              setWhen={setWhen}
            />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Save interaction"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/** Per-row edit + delete controls for one interaction row. */
export function InteractionRowActions({
  alumniId,
  row,
}: {
  alumniId: number;
  row: Interaction;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <EditInteractionButton alumniId={alumniId} row={row} />
      <DeleteRowButton
        label="Delete interaction"
        confirmTitle="Delete interaction"
        confirmBody="Delete this interaction? This can't be undone."
        successMessage="Interaction deleted."
        onDelete={() => deleteInteraction(alumniId, row.interaction_id)}
      />
    </div>
  );
}

/* -------------------------------------------------------- add task --------- */

export function AddTaskButton({
  alumniId,
  label = "Add task",
}: {
  alumniId: number;
  label?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addTask.bind(null, alumniId),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Task created.");
    },
    () => toast.error(state?.error ?? "Failed to add task."),
  );

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <Modal title="New follow-up task" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <div className="space-y-3">
              <div>
                <Label className="mb-1" htmlFor="task_title">
                  Title
                </Label>
                <Input
                  id="task_title"
                  name="task_title"
                  placeholder="e.g. Schedule mentorship call"
                />
              </div>
              <div>
                <Label className="mb-1" htmlFor="due_date">
                  Due date
                </Label>
                <Input
                  id="due_date"
                  name="due_date"
                  type="date"
                  style={{ colorScheme: "light" }}
                />
              </div>
              <div>
                <Label className="mb-1" htmlFor="task_notes">
                  Notes
                </Label>
                <Textarea id="task_notes" name="task_notes" rows={3} />
              </div>
              {state?.error ? (
                <p className="text-sm text-danger-600">{state.error}</p>
              ) : null}
            </div>
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Create task"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/* --------------------------------------------------- archive / unarchive -- */

export function ArchiveControls({
  alumniId,
  archived,
  name,
}: {
  alumniId: number;
  archived: boolean;
  name: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (archived) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreAlumni(alumniId);
              setError(res?.error ?? null);
              if (res?.error) toast.error(res.error);
              else {
                toast.success("Record unarchived.");
                router.refresh();
              }
            })
          }
          className={cn(
            "border-success-600 text-success-600 hover:bg-success-50",
          )}
        >
          {pending ? "Restoring…" : "Unarchive"}
        </Button>
        {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className={cn("text-danger-600 hover:bg-danger-50")}
      >
        Archive
      </Button>
      {confirming ? (
        <Modal title="Archive record" onClose={() => setConfirming(false)}>
          <p className="text-sm leading-relaxed text-gray-600">
            Are you sure you want to archive{" "}
            <span className="font-semibold text-gray-900">{name}</span>? The
            record will be hidden from the active alumni list. You can unarchive
            it again at any time. Nothing is deleted.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-danger-600">{error}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await archiveAlumni(alumniId);
                  if (res?.error) {
                    setError(res.error);
                    toast.error(res.error);
                  } else {
                    setConfirming(false);
                    toast.success("Record archived.");
                    router.refresh();
                  }
                })
              }
            >
              {pending ? "Archiving…" : "Archive record"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/* --------------------------------------------------- do not contact (#772) -- */

/**
 * The confirm step shared by every place the `Do Not Contact` label can be
 * flipped — the header control, the mobile FAB, and the chip manager's own
 * add/remove buttons. One dialog so no route to the label is the unguarded one:
 * turning it off anywhere re-opens contact to someone who asked not to be
 * contacted, and that must never be a single stray click.
 */
function DoNotContactConfirm({
  copy,
  name,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  copy: DoNotContactCopy;
  name: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={copy.confirmTitle} onClose={onCancel}>
      <p className="text-sm leading-relaxed text-gray-600">
        {copy.confirmBody(name)}
      </p>
      {error ? <p className="mt-3 text-sm text-danger-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={copy.confirmVariant}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? copy.pendingLabel : copy.confirmCta}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * The record's "Do not contact" switch (#772).
 *
 * Sets and clears the EXISTING `Do Not Contact` status label through the same
 * `addStatusLabel` / `removeStatusLabel` actions the chip manager uses — no new
 * field, no second suppression path. The survey already honours that label
 * (`_suppressed_from_send()` in fa-web-api), so this is an affordance, not new
 * behaviour: today the only way to set it is to hunt through the status field.
 *
 * Both directions confirm and both are audited server-side with the acting user
 * (`add_status_label` / `remove_status_label` rows). Gate the caller on the same
 * `canEdit` that mirrors the backend's `RequireAlumniEdit` — the frontend never
 * enforces this, but it must not offer a button the API will reject.
 */
export function DoNotContactControl({
  alumniId,
  name,
  statusLabels,
}: {
  alumniId: number;
  name: string;
  statusLabels: string[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = isDoNotContact(statusLabels);
  const copy = doNotContactCopy(active);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        aria-pressed={active}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        // Red only in the direction that TURNS IT ON; once it is on, the banner
        // above carries the red and a second red control beside it would read as
        // "this button is the warning" rather than "this button undoes it".
        className={cn(!active && "text-danger-600 hover:bg-danger-50")}
      >
        {copy.buttonLabel}
      </Button>
      {confirming ? (
        <DoNotContactConfirm
          copy={copy}
          name={name}
          pending={pending}
          error={error}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            startTransition(async () => {
              const res = active
                ? await removeStatusLabel(alumniId, DO_NOT_CONTACT)
                : await addStatusLabel(alumniId, DO_NOT_CONTACT);
              if (res?.error) {
                setError(res.error);
                toast.error(res.error);
              } else {
                setConfirming(false);
                toast.success(copy.successToast(name));
                router.refresh();
              }
            })
          }
        />
      ) : null}
    </>
  );
}

/**
 * The full-width "do not contact" banner (#772).
 *
 * The red chip in the tag row already existed and is easy to skim past in a row
 * of blue ones. This states the exclusion in words, at the top of the record,
 * for EVERY role — a view-only professor about to email someone needs to see it
 * as much as an editor does. Renders nothing when the label is absent.
 */
export function DoNotContactBanner({
  name,
  statusLabels,
}: {
  name: string;
  statusLabels: string[];
}) {
  if (!isDoNotContact(statusLabels)) return null;
  return (
    <div
      role="status"
      className="rounded-lg border border-danger-600 bg-danger-50 p-4 text-sm text-danger-600"
    >
      <p className="font-semibold">{DO_NOT_CONTACT_BANNER_TITLE}</p>
      <p className="mt-1 leading-relaxed">{doNotContactBannerBody(name)}</p>
    </div>
  );
}

/** Square checkbox for the Open-tasks panel (CRM redesign). */
export function TaskCheckbox({
  alumniId,
  taskId,
  completed,
  disabled = false,
}: {
  alumniId: number;
  taskId: number;
  completed: boolean;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setTaskComplete(alumniId, taskId, !completed);
          if (res?.error) toast.error(res.error);
          else {
            toast.success(completed ? "Task reopened." : "Task completed.");
            router.refresh();
          }
        })
      }
      aria-pressed={completed}
      title={completed ? "Mark open" : "Mark completed"}
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
        completed
          ? "border-success-600 bg-success-600 text-white"
          : "border-gray-300 bg-white hover:border-brand-blue-600",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {completed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  );
}

/* ------------------------------------------------------- add employment ----- */

export function AddRoleButton({
  alumniId,
  label = "+ Add role",
}: {
  alumniId: number;
  label?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addEmploymentRole.bind(null, alumniId),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Role added.");
    },
    () => toast.error(state?.error ?? "Failed to add role."),
  );

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? (
        <Modal title="Add role" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <EmploymentFields />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Add role"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------- employment fields -------- */

/** The shared field set for the add/edit employment forms. */
function EmploymentFields({ row }: { row?: EmploymentHistory }) {
  // Industry options from the editable vocabulary (Admin → Vocabulary), keeping
  // any stored value that's no longer active so an edit never drops it.
  const industryOptions = withValue(
    useVocabOptions("industry", INDUSTRY_OPTIONS),
    row?.employment_industry,
  );
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1" htmlFor="employer_name">
          Employer
        </Label>
        <Input
          id="employer_name"
          name="employer_name"
          placeholder="e.g. Goldman Sachs"
          defaultValue={row?.employer_name ?? ""}
        />
      </div>
      <div>
        <Label className="mb-1" htmlFor="employment_title">
          Title
        </Label>
        <Input
          id="employment_title"
          name="employment_title"
          placeholder="e.g. Analyst"
          defaultValue={row?.employment_title ?? ""}
        />
      </div>
      <div>
        <Label className="mb-1" htmlFor="employment_industry">
          Industry
        </Label>
        <Select
          id="employment_industry"
          name="employment_industry"
          style={{ colorScheme: "light" }}
          defaultValue={row?.employment_industry ?? ""}
        >
          <option value="">—</option>
          {industryOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1" htmlFor="city">
            City
          </Label>
          <Input id="city" name="city" defaultValue={row?.city ?? ""} />
        </div>
        <div>
          <Label className="mb-1" htmlFor="state">
            State
          </Label>
          <Input id="state" name="state" defaultValue={row?.state ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1" htmlFor="start_year">
            Start year
          </Label>
          <Input
            id="start_year"
            name="start_year"
            type="number"
            min={1900}
            max={2100}
            defaultValue={row?.start_year ?? ""}
          />
        </div>
        <div>
          <Label className="mb-1" htmlFor="end_year">
            End year
          </Label>
          <Input
            id="end_year"
            name="end_year"
            type="number"
            min={1900}
            max={2100}
            defaultValue={row?.end_year ?? ""}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="is_current"
          defaultChecked={row?.is_current ?? false}
          className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-600"
        />
        Current role
      </label>
    </div>
  );
}

/* ------------------------------------------------------- edit employment ---- */

/** Small inline "Edit" control + dialog for one employment-history row. */
export function EditRoleButton({
  alumniId,
  row,
}: {
  alumniId: number;
  row: EmploymentHistory;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateEmploymentRole.bind(null, alumniId, row.employment_history_id),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Role updated.");
    },
    () => toast.error(state?.error ?? "Failed to save role."),
  );

  return (
    <>
      <RowIconButton
        label="Edit role"
        icon={Pencil}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <Modal title="Edit role" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <EmploymentFields row={row} />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Save role"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------- delete (reusable) ----- */

/** A small trash-icon button that confirms before running a delete action. */
export function DeleteRowButton({
  label,
  confirmTitle,
  confirmBody,
  onDelete,
  successMessage,
}: {
  label: string;
  confirmTitle: string;
  confirmBody: string;
  onDelete: () => Promise<{ error?: string } | null>;
  successMessage: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <RowIconButton
        label={label}
        icon={Trash2}
        onClick={() => setConfirming(true)}
        tone="danger"
      />
      {confirming ? (
        <Modal title={confirmTitle} onClose={() => setConfirming(false)}>
          <p className="text-sm leading-relaxed text-gray-600">{confirmBody}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await onDelete();
                  if (res?.error) {
                    toast.error(res.error);
                  } else {
                    setConfirming(false);
                    toast.success(successMessage);
                    // Re-render the server-rendered list so the deleted row
                    // disappears; otherwise a second click on the stale row
                    // hits the now-gone id and 404s (QA B1/B2).
                    router.refresh();
                  }
                })
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/** Small square icon button used for per-row edit/delete affordances. */
function RowIconButton({
  label,
  icon: Icon,
  onClick,
  tone = "neutral",
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "h-7 w-7",
        tone === "danger"
          ? "text-danger-600 hover:border-danger-600"
          : "text-gray-500 hover:border-brand-blue-600 hover:text-brand-blue-600",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );
}

/** Per-row edit + delete controls for one employment-history row. */
export function EmploymentRowActions({
  alumniId,
  row,
}: {
  alumniId: number;
  row: EmploymentHistory;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <EditRoleButton alumniId={alumniId} row={row} />
      <DeleteRowButton
        label="Delete role"
        confirmTitle="Delete role"
        confirmBody={`Delete the ${row.employer_name ?? "this"} role from the employment history? This can't be undone.`}
        successMessage="Role deleted."
        onDelete={() =>
          deleteEmploymentRole(alumniId, row.employment_history_id)
        }
      />
    </div>
  );
}

/* ----------------------------------------------------- education fields ----- */

function EducationFields({ row }: { row?: Education }) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1" htmlFor="university">
          University
        </Label>
        <Input
          id="university"
          name="university"
          placeholder="e.g. Brigham Young University"
          defaultValue={row?.university ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1" htmlFor="college">
            College
          </Label>
          <Input
            id="college"
            name="college"
            defaultValue={row?.college ?? ""}
          />
        </div>
        <div>
          <Label className="mb-1" htmlFor="department">
            Department
          </Label>
          <Input
            id="department"
            name="department"
            defaultValue={row?.department ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1" htmlFor="degree">
            Degree
          </Label>
          <Input
            id="degree"
            name="degree"
            placeholder="e.g. BS"
            defaultValue={row?.degree ?? ""}
          />
        </div>
        <div>
          <Label className="mb-1" htmlFor="major">
            Major
          </Label>
          <Input
            id="major"
            name="major"
            placeholder="e.g. Finance"
            defaultValue={row?.major ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1" htmlFor="degree_status">
            Degree status
          </Label>
          <Input
            id="degree_status"
            name="degree_status"
            placeholder="e.g. Completed"
            defaultValue={row?.degree_status ?? ""}
          />
        </div>
        <div>
          <Label className="mb-1" htmlFor="degree_year">
            Degree year
          </Label>
          <Input
            id="degree_year"
            name="degree_year"
            type="number"
            min={1900}
            max={2100}
            defaultValue={row?.degree_year ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- add education ------ */

export function AddEducationButton({
  alumniId,
  label = "+ Add education",
}: {
  alumniId: number;
  label?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addEducation.bind(null, alumniId),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Education added.");
    },
    () => toast.error(state?.error ?? "Failed to add education."),
  );

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? (
        <Modal title="Add education" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <EducationFields />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Add education"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- edit education ----- */

export function EditEducationButton({
  alumniId,
  row,
}: {
  alumniId: number;
  row: Education;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateEducation.bind(null, alumniId, row.education_id),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Education updated.");
    },
    () => toast.error(state?.error ?? "Failed to save education."),
  );

  return (
    <>
      <RowIconButton
        label="Edit education"
        icon={Pencil}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <Modal title="Edit education" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <EducationFields row={row} />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Save education"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/** Per-row edit + delete controls for one education entry. */
export function EducationRowActions({
  alumniId,
  row,
}: {
  alumniId: number;
  row: Education;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <EditEducationButton alumniId={alumniId} row={row} />
      <DeleteRowButton
        label="Delete education"
        confirmTitle="Delete education"
        confirmBody="Delete this education entry? This can't be undone."
        successMessage="Education deleted."
        onDelete={() => deleteEducation(alumniId, row.education_id)}
      />
    </div>
  );
}

/* ----------------------------------------------------- leadership fields ---- */

function LeadershipFields({ row }: { row?: Leadership }) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1" htmlFor="leadership_role">
          Role
        </Label>
        <Input
          id="leadership_role"
          name="leadership_role"
          placeholder="e.g. President"
          defaultValue={row?.leadership_role ?? ""}
        />
      </div>
      <div>
        <Label className="mb-1" htmlFor="role_year">
          Year
        </Label>
        <Input
          id="role_year"
          name="role_year"
          type="number"
          min={1900}
          max={2100}
          defaultValue={row?.role_year ?? ""}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------- add leadership ----- */

export function AddLeadershipButton({
  alumniId,
  label = "+ Add leadership",
}: {
  alumniId: number;
  label?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addLeadership.bind(null, alumniId),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Leadership entry added.");
    },
    () => toast.error(state?.error ?? "Failed to add leadership entry."),
  );

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? (
        <Modal title="Add leadership" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <LeadershipFields />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Add leadership"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- edit leadership ---- */

export function EditLeadershipButton({
  alumniId,
  row,
}: {
  alumniId: number;
  row: Leadership;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateLeadership.bind(null, alumniId, row.finance_society_leadership_id),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Leadership entry updated.");
    },
    () => toast.error(state?.error ?? "Failed to save leadership entry."),
  );

  return (
    <>
      <RowIconButton
        label="Edit leadership"
        icon={Pencil}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <Modal title="Edit leadership" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <LeadershipFields row={row} />
            {state?.error ? (
              <p className="mt-3 text-sm text-danger-600">{state.error}</p>
            ) : null}
            <FormButtons
              pending={pending}
              onCancel={() => setOpen(false)}
              submitLabel="Save leadership"
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/** Per-row edit + delete controls for one leadership entry. */
export function LeadershipRowActions({
  alumniId,
  row,
}: {
  alumniId: number;
  row: Leadership;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <EditLeadershipButton alumniId={alumniId} row={row} />
      <DeleteRowButton
        label="Delete leadership"
        confirmTitle="Delete leadership"
        confirmBody="Delete this leadership entry? This can't be undone."
        successMessage="Leadership entry deleted."
        onDelete={() =>
          deleteLeadership(alumniId, row.finance_society_leadership_id)
        }
      />
    </div>
  );
}

/* ----------------------------------------------------------- add event ------ */

type EventOption = {
  event_id: number;
  event_name: string;
  event_date: string | null;
};

export function AddEventButton({
  alumniId,
  label = "+ Add event",
}: {
  alumniId: number;
  label?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [statusVal, setStatusVal] = useState<string>(
    ATTENDANCE_STATUS_OPTIONS[1],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Attendance-status options from the editable vocabulary (Admin → Vocabulary);
  // fetched only once the dialog opens (like the events list below). Falls back
  // to the constant until it loads / on error.
  const statusOptions = useVocabOptions(
    "attendance_status",
    ATTENDANCE_STATUS_OPTIONS,
    open,
  );

  // Fetch the events list the first time the dialog opens.
  useEffect(() => {
    if (!open || events !== null) return;
    let active = true;
    clientGet<EventOption[]>("/events")
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch(() => {
        if (active) setLoadError("Could not load events.");
      });
    return () => {
      active = false;
    };
  }, [open, events]);

  function close() {
    setOpen(false);
    setError(null);
    setEventId("");
  }

  function submit() {
    if (!eventId) {
      setError("Please choose an event.");
      return;
    }
    startTransition(async () => {
      const res = await addEventAttendance(
        alumniId,
        Number(eventId),
        statusVal,
      );
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        close();
        toast.success("Event attendance added.");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? (
        <Modal title="Add event attendance" onClose={close}>
          <div className="space-y-3">
            <div>
              <Label className="mb-1" htmlFor="event_id">
                Event
              </Label>
              <Select
                id="event_id"
                style={{ colorScheme: "light" }}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={events === null && !loadError}
              >
                <option value="">
                  {events === null
                    ? loadError
                      ? "Failed to load"
                      : "Loading…"
                    : "Choose an event…"}
                </option>
                {(events ?? []).map((ev) => (
                  <option key={ev.event_id} value={ev.event_id}>
                    {ev.event_name}
                    {ev.event_date
                      ? ` (${new Date(ev.event_date).toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "short", day: "numeric" },
                        )})`
                      : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1" htmlFor="attendance_status">
                Attendance status
              </Label>
              <Select
                id="attendance_status"
                style={{ colorScheme: "light" }}
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value)}
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </div>
            {error ? <p className="text-sm text-danger-600">{error}</p> : null}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={submit}
            >
              {pending ? "Saving…" : "Add event"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/* -------------------------------------------------- tag / status manager ---- */

/** One add/remove control group for either Tags or Status labels. */
function ChipManager({
  alumniId,
  name,
  heading,
  current,
  options,
  addAction,
  removeAction,
}: {
  alumniId: number;
  name: string;
  heading: string;
  current: string[];
  options: readonly string[];
  addAction: (alumniId: number, value: string) => Promise<{ error?: string } | null>;
  removeAction: (
    alumniId: number,
    value: string,
  ) => Promise<{ error?: string } | null>;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  // The `Do Not Contact` chip flips through the same confirm the header control
  // uses (#772). `removing` is also the label's CURRENT state, which is what
  // `doNotContactCopy` is asked for.
  const [confirming, setConfirming] = useState<{
    value: string;
    removing: boolean;
  } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const available = options.filter((o) => !current.includes(o));

  /** Run the add/remove for real. */
  function apply(value: string, removing: boolean) {
    const action = removing ? removeAction : addAction;
    const okMsg = isDoNotContact([value])
      ? doNotContactCopy(removing).successToast(name)
      : removing
        ? `Removed ${value}.`
        : `Added ${value}.`;
    setBusy(value);
    startTransition(async () => {
      const res = await action(alumniId, value);
      setBusy(null);
      if (res?.error) {
        setConfirmError(res.error);
        toast.error(res.error);
      } else {
        setConfirming(null);
        toast.success(okMsg);
        // Refresh so the chip list reflects the add/remove immediately.
        router.refresh();
      }
    });
  }

  /** Click handler: `Do Not Contact` confirms first, everything else applies. */
  function request(value: string, removing: boolean) {
    if (isDoNotContact([value])) {
      setConfirmError(null);
      setConfirming({ value, removing });
      return;
    }
    apply(value, removing);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {heading}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {current.length ? (
          current.map((v) => (
            <Badge
              key={v}
              // Tone is derived per value, not per list: tags and status labels
              // are all blue except "Do Not Contact" (red) and "Deceased"
              // (muted). See `chipTone`.
              variant={chipTone(v)}
              className="min-h-[32px] gap-1 py-1 pl-3 pr-1.5"
            >
              {v}
              {/* Remove control is its own 24x24 target, padded away from the
                  label, so tapping it can't be mistaken for adding a chip (B3). */}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                title={`Remove ${v}`}
                disabled={pending && busy === v}
                onClick={() => request(v, true)}
                className="-mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-xs text-gray-500">None yet.</span>
        )}
      </div>
      {available.length ? (
        <div className="mt-3 flex flex-wrap gap-2.5">
          {available.map((v) => (
            <button
              key={v}
              type="button"
              disabled={pending && busy === v}
              onClick={() => request(v, false)}
              className="inline-flex min-h-[32px] items-center rounded-md border border-dashed border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:border-brand-blue-600 hover:bg-brand-blue-50 hover:text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 disabled:opacity-50"
            >
              + {v}
            </button>
          ))}
        </div>
      ) : null}
      {confirming ? (
        <DoNotContactConfirm
          copy={doNotContactCopy(confirming.removing)}
          name={name}
          pending={pending}
          error={confirmError}
          onCancel={() => setConfirming(null)}
          onConfirm={() => apply(confirming.value, confirming.removing)}
        />
      ) : null}
    </div>
  );
}

/** Tag + status-label add/remove controls for the Engagement & tags drawer. */
export function TagStatusManager({
  alumniId,
  name,
  tags,
  statusLabels,
}: {
  alumniId: number;
  name: string;
  tags: string[];
  statusLabels: string[];
}) {
  return (
    <div className="space-y-5">
      <ChipManager
        alumniId={alumniId}
        name={name}
        heading="Tags"
        current={tags}
        options={TAG_OPTIONS}
        addAction={addTag}
        removeAction={removeTag}
      />
      <ChipManager
        alumniId={alumniId}
        name={name}
        heading="Status labels"
        current={statusLabels}
        options={STATUS_OPTIONS}
        addAction={addStatusLabel}
        removeAction={removeStatusLabel}
      />
    </div>
  );
}
