"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  addEducation,
  addEmploymentRole,
  addEventAttendance,
  addInteraction,
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
import type { Education, EmploymentHistory, Leadership } from "@/types/profile";
import {
  ATTENDANCE_STATUS_OPTIONS,
  INDUSTRY_OPTIONS,
  STATUS_OPTIONS,
  TAG_OPTIONS,
} from "@/constants/dropdowns";
import { clientGet } from "@/lib/api-client";
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
    : "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
      >
        {label}
      </button>
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
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls} htmlFor="employer_name">
          Employer
        </label>
        <input
          id="employer_name"
          name="employer_name"
          className={fieldCls}
          placeholder="e.g. Goldman Sachs"
          defaultValue={row?.employer_name ?? ""}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="employment_title">
          Title
        </label>
        <input
          id="employment_title"
          name="employment_title"
          className={fieldCls}
          placeholder="e.g. Analyst"
          defaultValue={row?.employment_title ?? ""}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="employment_industry">
          Industry
        </label>
        <select
          id="employment_industry"
          name="employment_industry"
          className={`${fieldCls} bg-white`}
          style={{ colorScheme: "light" }}
          defaultValue={row?.employment_industry ?? ""}
        >
          <option value="" className="bg-white text-gray-900">
            —
          </option>
          {INDUSTRY_OPTIONS.map((opt) => (
            <option key={opt} value={opt} className="bg-white text-gray-900">
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="city">
            City
          </label>
          <input
            id="city"
            name="city"
            className={fieldCls}
            defaultValue={row?.city ?? ""}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="state">
            State
          </label>
          <input
            id="state"
            name="state"
            className={fieldCls}
            defaultValue={row?.state ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="start_year">
            Start year
          </label>
          <input
            id="start_year"
            name="start_year"
            type="number"
            min={1900}
            max={2100}
            className={fieldCls}
            defaultValue={row?.start_year ?? ""}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="end_year">
            End year
          </label>
          <input
            id="end_year"
            name="end_year"
            type="number"
            min={1900}
            max={2100}
            className={fieldCls}
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
                  const res = await onDelete();
                  if (res?.error) {
                    toast.error(res.error);
                  } else {
                    setConfirming(false);
                    toast.success(successMessage);
                  }
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-danger-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {pending ? "Deleting…" : "Delete"}
            </button>
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
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white transition hover:bg-gray-50 ${
        tone === "danger"
          ? "text-danger-600 hover:border-danger-600"
          : "text-gray-500 hover:border-brand-blue-600 hover:text-brand-blue-600"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
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
        <label className={labelCls} htmlFor="university">
          University
        </label>
        <input
          id="university"
          name="university"
          className={fieldCls}
          placeholder="e.g. Brigham Young University"
          defaultValue={row?.university ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="college">
            College
          </label>
          <input
            id="college"
            name="college"
            className={fieldCls}
            defaultValue={row?.college ?? ""}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="department">
            Department
          </label>
          <input
            id="department"
            name="department"
            className={fieldCls}
            defaultValue={row?.department ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="degree">
            Degree
          </label>
          <input
            id="degree"
            name="degree"
            className={fieldCls}
            placeholder="e.g. BS"
            defaultValue={row?.degree ?? ""}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="major">
            Major
          </label>
          <input
            id="major"
            name="major"
            className={fieldCls}
            placeholder="e.g. Finance"
            defaultValue={row?.major ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="degree_status">
            Degree status
          </label>
          <input
            id="degree_status"
            name="degree_status"
            className={fieldCls}
            placeholder="e.g. Completed"
            defaultValue={row?.degree_status ?? ""}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="degree_year">
            Degree year
          </label>
          <input
            id="degree_year"
            name="degree_year"
            type="number"
            min={1900}
            max={2100}
            className={fieldCls}
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
      >
        {label}
      </button>
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
        <label className={labelCls} htmlFor="leadership_role">
          Role
        </label>
        <input
          id="leadership_role"
          name="leadership_role"
          className={fieldCls}
          placeholder="e.g. President"
          defaultValue={row?.leadership_role ?? ""}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="role_year">
          Year
        </label>
        <input
          id="role_year"
          name="role_year"
          type="number"
          min={1900}
          max={2100}
          className={fieldCls}
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
      >
        {label}
      </button>
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
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [statusVal, setStatusVal] = useState<string>(
    ATTENDANCE_STATUS_OPTIONS[1],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
      >
        {label}
      </button>
      {open ? (
        <Modal title="Add event attendance" onClose={close}>
          <div className="space-y-3">
            <div>
              <label className={labelCls} htmlFor="event_id">
                Event
              </label>
              <select
                id="event_id"
                className={`${fieldCls} bg-white`}
                style={{ colorScheme: "light" }}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={events === null && !loadError}
              >
                <option value="" className="bg-white text-gray-900">
                  {events === null
                    ? loadError
                      ? "Failed to load"
                      : "Loading…"
                    : "Choose an event…"}
                </option>
                {(events ?? []).map((ev) => (
                  <option
                    key={ev.event_id}
                    value={ev.event_id}
                    className="bg-white text-gray-900"
                  >
                    {ev.event_name}
                    {ev.event_date
                      ? ` (${new Date(ev.event_date).toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "short", day: "numeric" },
                        )})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="attendance_status">
                Attendance status
              </label>
              <select
                id="attendance_status"
                className={`${fieldCls} bg-white`}
                style={{ colorScheme: "light" }}
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value)}
              >
                {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                  <option
                    key={opt}
                    value={opt}
                    className="bg-white text-gray-900"
                  >
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            {error ? <p className="text-sm text-danger-600">{error}</p> : null}
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
              {pending ? "Saving…" : "Add event"}
            </button>
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
  heading,
  current,
  options,
  addAction,
  removeAction,
  toneAccent,
}: {
  alumniId: number;
  heading: string;
  current: string[];
  options: readonly string[];
  addAction: (alumniId: number, value: string) => Promise<{ error?: string } | null>;
  removeAction: (
    alumniId: number,
    value: string,
  ) => Promise<{ error?: string } | null>;
  toneAccent: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const available = options.filter((o) => !current.includes(o));

  function run(
    value: string,
    action: (id: number, v: string) => Promise<{ error?: string } | null>,
    okMsg: string,
  ) {
    setBusy(value);
    startTransition(async () => {
      const res = await action(alumniId, value);
      setBusy(null);
      if (res?.error) toast.error(res.error);
      else toast.success(okMsg);
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {heading}
      </p>
      <div className="flex flex-wrap gap-2">
        {current.length ? (
          current.map((v) => (
            <span
              key={v}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneAccent}`}
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                disabled={pending && busy === v}
                onClick={() => run(v, removeAction, `Removed ${v}.`)}
                className="rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">None yet.</span>
        )}
      </div>
      {available.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {available.map((v) => (
            <button
              key={v}
              type="button"
              disabled={pending && busy === v}
              onClick={() => run(v, addAction, `Added ${v}.`)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:border-brand-blue-600 hover:text-brand-blue-600 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              {v}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Tag + status-label add/remove controls for the Engagement & tags drawer. */
export function TagStatusManager({
  alumniId,
  tags,
  statusLabels,
}: {
  alumniId: number;
  tags: string[];
  statusLabels: string[];
}) {
  return (
    <div className="space-y-5">
      <ChipManager
        alumniId={alumniId}
        heading="Tags"
        current={tags}
        options={TAG_OPTIONS}
        addAction={addTag}
        removeAction={removeTag}
        toneAccent="bg-brand-blue-50 text-navy-800"
      />
      <ChipManager
        alumniId={alumniId}
        heading="Status labels"
        current={statusLabels}
        options={STATUS_OPTIONS}
        addAction={addStatusLabel}
        removeAction={removeStatusLabel}
        toneAccent="bg-gray-100 text-gray-700"
      />
    </div>
  );
}
