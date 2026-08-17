"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_ADD_LINK_FORM,
  URL_MAX,
  ROLE_TYPES,
  ROLE_TYPE_LABELS,
  validateAddLink,
  type AddLinkErrors,
  type AddLinkFormValues,
  type LinkRoleType,
} from "@/lib/opportunityLinks";
import {
  createLink,
  searchAlumniForLink,
  type AlumnusOption,
} from "@/app/(app)/links/actions";

/**
 * Staff "Add link" form.
 *
 * Staff entry lands APPROVED — a staff member typing a link in IS the review
 * step, so it does not queue behind one. The form says so rather than leaving
 * the reader to infer it from a list that does not show their row.
 *
 * The company field is an either/or, not a pair: ticking "use their current
 * employer" is what tells the backend to RESOLVE the name from the employment
 * record at read time (so it follows a job change), which is a different thing
 * from storing a snapshot of today's employer name. The typed box is therefore
 * disabled while the box is ticked, not merely ignored.
 *
 * Text-only controls (standing project rule). Validation mirrors the backend's
 * shape but is UX only — the server action re-validates and the API is the
 * control.
 */
export function AddLinkForm({ sampleMode }: { sampleMode: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<AddLinkFormValues>(EMPTY_ADD_LINK_FORM);
  const [errors, setErrors] = useState<AddLinkErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const ids = useId();

  const set = <K extends keyof AddLinkFormValues>(
    key: K,
    value: AddLinkFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error as soon as it is touched — re-validation happens on
    // submit, so leaving a stale message under a corrected field reads as a bug.
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const found = validateAddLink(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    startSubmit(async () => {
      const result = await createLink(values);
      if (result.ok) {
        router.push("/links");
        router.refresh();
      } else {
        setSubmitError(result.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-4">
      {sampleMode ? (
        <Card className="border-warning-600/40 bg-warning-50 p-4">
          <p className="text-sm font-semibold text-warning-600">
            Sample data — local development only
          </p>
          <p className="mt-1 text-sm text-gray-700">
            The alumnus picker is serving fabricated names and saving is
            disabled, so nothing here can reach an API.
          </p>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Who is this from?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlumnusPicker
            selectedId={values.alumniId}
            onSelect={(id) => set("alumniId", id)}
            error={errors.alumniId}
            inputId={`${ids}-alum`}
          />

          <fieldset className="rounded-md border border-gray-200 p-3">
            <legend className="px-1 text-xs font-medium text-gray-700">
              Company
            </legend>
            <label className="flex items-start gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                checked={values.isOwnCompany}
                onChange={(e) => {
                  set("isOwnCompany", e.target.checked);
                  if (e.target.checked) set("companyName", "");
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              />
              <span>
                This is their own company
                <span className="mt-0.5 block text-xs text-gray-500">
                  The list shows their current employer from their record, so it
                  follows a job change instead of freezing today&apos;s name.
                </span>
              </span>
            </label>

            <div className="mt-3">
              <Label className="mb-1.5" htmlFor={`${ids}-company`}>
                Company name
              </Label>
              <Input
                id={`${ids}-company`}
                value={values.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                disabled={values.isOwnCompany}
                placeholder={
                  values.isOwnCompany
                    ? "Resolved from their employer record"
                    : "e.g. Goldman Sachs"
                }
                aria-invalid={errors.companyName ? true : undefined}
              />
              <FieldError message={errors.companyName} />
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The opportunity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5" htmlFor={`${ids}-url`}>
              Link URL
            </Label>
            <Input
              id={`${ids}-url`}
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://example.com/careers"
              inputMode="url"
              maxLength={URL_MAX}
              aria-invalid={errors.url ? true : undefined}
            />
            <FieldError message={errors.url} />
            <p className="mt-1 text-xs text-gray-500">
              Must be a full http:// or https:// address. A careers page outlasts
              a single posting.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="mb-1.5" htmlFor={`${ids}-city`}>
                City
              </Label>
              <Input
                id={`${ids}-city`}
                value={values.locationCity}
                onChange={(e) => set("locationCity", e.target.value)}
                placeholder="e.g. Provo"
              />
            </div>
            <div>
              <Label className="mb-1.5" htmlFor={`${ids}-state`}>
                State
              </Label>
              <Input
                id={`${ids}-state`}
                value={values.locationState}
                onChange={(e) => set("locationState", e.target.value)}
                placeholder="e.g. UT"
              />
            </div>
            <div>
              <Label className="mb-1.5" htmlFor={`${ids}-role`}>
                Role type
              </Label>
              <Select
                id={`${ids}-role`}
                value={values.roleType}
                onChange={(e) => set("roleType", e.target.value as LinkRoleType)}
                style={{ colorScheme: "light" }}
              >
                {ROLE_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_TYPE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="md:max-w-xs">
            <Label className="mb-1.5" htmlFor={`${ids}-deadline`}>
              Application deadline (optional)
            </Label>
            <Input
              id={`${ids}-deadline`}
              type="date"
              value={values.applicationDeadline}
              onChange={(e) => set("applicationDeadline", e.target.value)}
              style={{ colorScheme: "light" }}
            />
          </div>

          <div>
            <Label className="mb-1.5" htmlFor={`${ids}-details`}>
              Details (optional)
            </Label>
            <Textarea
              id={`${ids}-details`}
              value={values.details}
              onChange={(e) => set("details", e.target.value)}
              rows={4}
              placeholder="What the role is, who to mention, anything a student should know before applying."
            />
          </div>
        </CardContent>
      </Card>

      {submitError ? (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {submitError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting || sampleMode}>
          {isSubmitting ? "Saving…" : "Save link"}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/links">Cancel</Link>
        </Button>
        <p className="ml-1 text-xs text-gray-500">
          Staff-added links are approved straight away.
        </p>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-danger-600">
      {message}
    </p>
  );
}

/**
 * Typeahead over the alumni list. Debounced, and every result is rendered as
 * plain text in a button — there is no free-text id entry, so the attribution
 * can only ever be a record that actually exists.
 */
function AlumnusPicker({
  selectedId,
  onSelect,
  error,
  inputId,
}: {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  error?: string;
  inputId: string;
}) {
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<AlumnusOption[]>([]);
  const [chosen, setChosen] = useState<AlumnusOption | null>(null);
  const [isSearching, startSearch] = useTransition();
  // Drops a stale response that resolves after a newer one — otherwise a slow
  // request for "ma" can overwrite the results for "marcus".
  const requestSeq = useRef(0);

  useEffect(() => {
    if (chosen) return;
    const q = term.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      const seq = ++requestSeq.current;
      startSearch(async () => {
        const results = await searchAlumniForLink(q);
        if (seq === requestSeq.current) setOptions(results);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, chosen]);

  if (chosen && selectedId !== null) {
    return (
      <div>
        <Label className="mb-1.5">Alumnus</Label>
        <div className="flex items-center justify-between gap-3 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-900">
            <span className="font-semibold">{chosen.name}</span>
            {chosen.detail ? (
              <span className="text-gray-500"> · {chosen.detail}</span>
            ) : null}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setChosen(null);
              onSelect(null);
              setTerm("");
              setOptions([]);
            }}
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="mb-1.5" htmlFor={inputId}>
        Alumnus
      </Label>
      <Input
        id={inputId}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search by name"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
      />
      <FieldError message={error} />
      {term.trim().length >= 2 ? (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white">
          {isSearching && options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No matching alumni.</p>
          ) : (
            <ul>
              {options.map((o) => (
                <li key={o.alumni_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(o);
                      onSelect(o.alumni_id);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-brand-blue-50 focus-visible:bg-brand-blue-50 focus-visible:outline-none"
                  >
                    <span className="font-medium text-gray-900">{o.name}</span>
                    {o.detail ? (
                      <span className="text-gray-500"> · {o.detail}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
