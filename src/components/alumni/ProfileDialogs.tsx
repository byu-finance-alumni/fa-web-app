"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { Archive, ArchiveRestore, Check } from "lucide-react";
import {
  addInteraction,
  addTask,
  archiveAlumni,
  restoreAlumni,
  setTaskComplete,
} from "@/app/(app)/alumni/actions";
import { useToast } from "@/components/ui/Toast";

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
        className="w-full max-w-md rounded-t-2xl border border-gray-300 bg-white p-5 shadow-lg sm:rounded-2xl"
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

const labelCls = "mb-1 block text-[11px] font-medium text-gray-500";
const fieldCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-blue-600 focus:outline-none focus:ring-1 focus:ring-brand-blue-600";

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
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

/** Run a side effect once a submit transitions from pending to resolved. */
function useOnSubmitSettled(
  pending: boolean,
  error: string | undefined,
  onSuccess: () => void,
  onError: () => void,
) {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      if (error) onError();
      else onSuccess();
    }
    wasPending.current = pending;
  }, [pending, error, onSuccess, onError]);
}

/* -------------------------------------------------- add interaction -------- */

export function AddInteractionButton({
  alumniId,
  label = "Add interaction",
  primary = false,
}: {
  alumniId: number;
  label?: string;
  primary?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addInteraction.bind(null, alumniId),
    null,
  );
  useOnSubmitSettled(
    pending,
    state?.error,
    () => {
      setOpen(false);
      toast.success("Interaction logged.");
    },
    () => toast.error(state?.error ?? "Failed to add interaction."),
  );

  const cls = primary
    ? "rounded-lg bg-brand-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-500"
    : "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        {label}
      </button>
      {open ? (
        <Modal title="Log interaction" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <div className="space-y-3">
              <div>
                <label className={labelCls} htmlFor="interaction_type">
                  Type
                </label>
                <select
                  id="interaction_type"
                  name="interaction_type"
                  className={`${fieldCls} bg-white`}
                  style={{ colorScheme: "light" }}
                  defaultValue={INTERACTION_TYPES[0]}
                >
                  {INTERACTION_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-white text-gray-900">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="interaction_notes">
                  Notes
                </label>
                <textarea
                  id="interaction_notes"
                  name="interaction_notes"
                  rows={4}
                  className={fieldCls}
                  placeholder="What was discussed?"
                />
              </div>
              {state?.error ? (
                <p className="text-sm text-danger-600">{state.error}</p>
              ) : null}
            </div>
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {label}
      </button>
      {open ? (
        <Modal title="New follow-up task" onClose={() => setOpen(false)}>
          <form action={formAction}>
            <div className="space-y-3">
              <div>
                <label className={labelCls} htmlFor="task_title">
                  Title
                </label>
                <input
                  id="task_title"
                  name="task_title"
                  className={fieldCls}
                  placeholder="e.g. Schedule mentorship call"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="due_date">
                  Due date
                </label>
                <input
                  id="due_date"
                  name="due_date"
                  type="date"
                  className={`${fieldCls} bg-white`}
                  style={{ colorScheme: "light" }}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="task_notes">
                  Notes
                </label>
                <textarea
                  id="task_notes"
                  name="task_notes"
                  rows={3}
                  className={fieldCls}
                />
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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (archived) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreAlumni(alumniId);
              setError(res?.error ?? null);
              if (res?.error) toast.error(res.error);
              else toast.success("Record unarchived.");
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-success-600 bg-white px-4 py-2 text-sm font-semibold text-success-600 hover:bg-success-50 disabled:opacity-60"
        >
          <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
          {pending ? "Restoring…" : "Unarchive"}
        </button>
        {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-danger-600 hover:bg-danger-50"
      >
        <Archive className="h-4 w-4" aria-hidden="true" />
        Archive
      </button>
      {confirming ? (
        <Modal title="Archive record" onClose={() => setConfirming(false)}>
          <p className="text-sm leading-relaxed text-gray-600">
            Are you sure you want to archive{" "}
            <span className="font-semibold text-gray-900">{name}</span>? The
            record will be hidden from the active alumni list. You can unarchive
            it again at any time — nothing is deleted.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-danger-600">{error}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
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
                  }
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-danger-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              {pending ? "Archiving…" : "Archive record"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
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
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setTaskComplete(alumniId, taskId, !completed);
          if (res?.error) toast.error(res.error);
          else toast.success(completed ? "Task reopened." : "Task completed.");
        })
      }
      aria-pressed={completed}
      title={completed ? "Mark open" : "Mark completed"}
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
        completed
          ? "border-success-600 bg-success-600 text-white"
          : "border-gray-300 bg-white hover:border-brand-blue-600"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {completed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  );
}
