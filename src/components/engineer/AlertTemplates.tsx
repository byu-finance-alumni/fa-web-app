"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  getAlertTemplates,
  resetAlertTemplate,
  saveAlertTemplate,
  type AlertTemplate,
} from "@/app/(app)/engineer/maintenance/actions";
import {
  TEMPLATE_MAX_LENGTH,
  dirtyKinds,
  insertPlaceholder,
  isDefault,
  isDirty,
  previewTemplate,
  templateProblem,
  unknownPlaceholders,
  unsavedSummary,
} from "@/app/(app)/engineer/maintenance/alert-templates";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

/**
 * Edit the wording of the Slack alerts, from the page where they are tested.
 *
 * WHY THE PREVIEW IS THE POINT. A template is not the message — `{ip_address}`
 * is, at the moment of writing, a promise that something will be substituted
 * later. The failure mode is silent and one-way: a message saved with a
 * plausible-looking `{ip_adress}` reads perfectly here and arrives in the
 * channel with literal braces in it, during an incident, when nobody is going
 * to stop and fix it. So the editor never shows the template on its own — the
 * rendered message sits underneath it with example values filled in, and any
 * token that would NOT be substituted is left visibly in braces there.
 *
 * WHY DRAFTS OUTLIVE THE PANEL. Every kind's draft is held for as long as the
 * page is open, so collapsing a message, opening another and coming back does
 * not throw the edit away. Closed messages with edits say so, the card counts
 * them, and the browser asks before the tab goes.
 *
 * The checks here save a round trip; they are NOT the validation. The backend
 * re-validates whatever it is handed, and its refusal is shown as a toast with
 * the draft still in the box.
 *
 * Text-only, per the project's icon-free control convention.
 */
export function AlertTemplates() {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [templates, setTemplates] = useState<AlertTemplate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // One draft per kind, kept whether or not that kind's editor is open.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openKind, setOpenKind] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    const res = await getAlertTemplates();
    if (!res.ok) {
      setLoadError(res.error);
      return;
    }
    setLoadError(null);
    setTemplates(res.page.items);
    // Never clobber a draft that is already on screen — a reload is not a
    // reason to lose someone's typing.
    setDrafts((prev) => {
      const next = { ...prev };
      for (const t of res.page.items) next[t.kind] ??= t.value;
      return next;
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = templates ? dirtyKinds(templates, drafts) : [];
  const unsaved = unsavedSummary(dirty.length);

  // The last line of defence for an unsaved edit. It only fires on a real
  // navigation away, which is exactly when a draft would be lost for good.
  useEffect(() => {
    if (dirty.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.length]);

  /** Fold a saved/reset template back in, and re-baseline its draft to it. */
  function applySaved(saved: AlertTemplate) {
    setTemplates((prev) =>
      prev
        ? prev.map((t) => (t.kind === saved.kind ? saved : t))
        : [saved],
    );
    setDrafts((prev) => ({ ...prev, [saved.kind]: saved.value }));
  }

  function save(t: AlertTemplate) {
    const draft = drafts[t.kind] ?? t.value;
    const problem = templateProblem(draft, t.placeholders);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusyKind(t.kind);
    startTransition(async () => {
      const res = await saveAlertTemplate(t.kind, draft);
      setBusyKind(null);
      if (!res.ok) {
        // The draft stays in the box: a refusal is something to fix, not
        // something to lose work over.
        toast.error(res.error);
        return;
      }
      applySaved(res.template);
      toast.success(`Saved. New ${t.label.toLowerCase()} alerts use this wording.`);
    });
  }

  function reset(t: AlertTemplate) {
    setBusyKind(t.kind);
    startTransition(async () => {
      const res = await resetAlertTemplate(t.kind);
      setBusyKind(null);
      setConfirmReset(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      applySaved(res.template);
      toast.success("Back to the standard wording.");
    });
  }

  function insert(t: AlertTemplate, name: string) {
    const current = drafts[t.kind] ?? t.value;
    const box = editorRef.current;
    const at = box ? box.selectionStart : current.length;
    const to = box ? box.selectionEnd : current.length;
    const { text, cursor } = insertPlaceholder(current, at, to, name);
    setDrafts((prev) => ({ ...prev, [t.kind]: text }));
    // Put the caret back where the typing left off, after React has written the
    // new value into the textarea.
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function copy(name: string) {
    const token = `{${name}}`;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(name);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(`Couldn't copy — the placeholder is ${token}.`);
    }
  }

  return (
    <section aria-labelledby="alert-templates-heading">
      <h2
        id="alert-templates-heading"
        className="mb-3 text-sm font-semibold text-gray-900"
      >
        Slack messages
      </h2>

      <Card className="p-5">
        <p className="text-sm text-gray-500">
          The wording of each alert that gets posted to Slack. Changes apply to
          the next alert of that kind — they do not re-send anything that has
          already fired.
        </p>

        {unsaved ? (
          <p
            role="status"
            className="mt-3 text-sm font-medium text-warning-600"
          >
            {unsaved} Nothing is sent to Slack until you save.
          </p>
        ) : null}

        {loadError ? (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-sm text-danger-600">{loadError}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : !templates ? (
          <p className="mt-4 text-sm text-gray-500">Loading the messages…</p>
        ) : templates.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No messages are editable yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200 border-t border-gray-200">
            {templates.map((t) => {
              const draft = drafts[t.kind] ?? t.value;
              const edited = isDirty(draft, t.value);
              const open = openKind === t.kind;
              const problem = open
                ? templateProblem(draft, t.placeholders)
                : null;
              const leftover = unknownPlaceholders(draft, t.placeholders);
              const preview = previewTemplate(t, draft);
              const busy = busyKind === t.kind && pending;

              return (
                <li key={t.kind} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 max-w-xl">
                      <p className="text-sm font-medium text-gray-900">
                        {t.label}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {t.description}
                      </p>
                      {edited ? (
                        <p className="mt-1 text-sm font-medium text-warning-600">
                          Edited, not saved
                        </p>
                      ) : !isDefault(t.value, t.default_value) ? (
                        <p className="mt-1 text-sm text-gray-500">
                          Using custom wording
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setOpenKind(open ? null : t.kind)}
                      aria-expanded={open}
                      aria-controls={`alert-template-${t.kind}`}
                    >
                      {open ? "Close" : edited ? "Keep editing" : "Edit"}
                    </Button>
                  </div>

                  {open ? (
                    <div id={`alert-template-${t.kind}`} className="mt-4">
                      <label
                        htmlFor={`alert-template-text-${t.kind}`}
                        className="block text-xs font-medium uppercase tracking-wide text-gray-500"
                      >
                        Message
                      </label>
                      <Textarea
                        id={`alert-template-text-${t.kind}`}
                        ref={editorRef}
                        value={draft}
                        rows={5}
                        spellCheck={false}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [t.kind]: e.target.value,
                          }))
                        }
                        aria-invalid={problem ? true : undefined}
                        aria-describedby={
                          problem ? `alert-template-problem-${t.kind}` : undefined
                        }
                        className="mt-1 font-mono text-xs"
                      />
                      <div className="mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <p
                          id={`alert-template-problem-${t.kind}`}
                          className="text-xs text-danger-600"
                        >
                          {problem ?? ""}
                        </p>
                        <p className="text-xs tabular-nums text-gray-500">
                          {draft.length} / {TEMPLATE_MAX_LENGTH}
                        </p>
                      </div>

                      {t.placeholders.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Placeholders this message can use
                          </p>
                          <ul className="mt-2 space-y-2">
                            {t.placeholders.map((p) => (
                              <li
                                key={p.name}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1"
                              >
                                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-900">
                                  {`{${p.name}}`}
                                </code>
                                <span className="min-w-0 flex-1 text-sm text-gray-500">
                                  {p.description}
                                </span>
                                <span className="flex gap-2">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => insert(t, p.name)}
                                    aria-label={`Insert {${p.name}} into the message`}
                                  >
                                    Insert
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void copy(p.name)}
                                    aria-label={`Copy {${p.name}}`}
                                  >
                                    {copied === p.name ? "Copied" : "Copy"}
                                  </Button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-gray-500">
                          This message takes no placeholders — it is sent
                          exactly as written.
                        </p>
                      )}

                      <div className="mt-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          What Slack will show
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs text-gray-900">
                          {preview.trim() ? preview : "Nothing would be sent."}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {leftover.length > 0
                            ? `Example values, except ${leftover
                                .map((n) => `{${n}}`)
                                .join(", ")} — Slack will not fill ${
                                leftover.length === 1 ? "that" : "those"
                              } in and ${
                                leftover.length === 1 ? "it" : "they"
                              } will arrive exactly like this.`
                            : "Example values stand in for the real ones."}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => save(t)}
                          disabled={!edited || !!problem || busy}
                        >
                          {busy ? "Saving…" : "Save message"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setDrafts((prev) => ({
                              ...prev,
                              [t.kind]: t.value,
                            }))
                          }
                          disabled={!edited || busy}
                        >
                          Discard changes
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmReset(t.kind)}
                          disabled={
                            (isDefault(t.value, t.default_value) && !edited) ||
                            busy
                          }
                        >
                          Reset to default
                        </Button>
                      </div>

                      {confirmReset === t.kind ? (
                        <div className="mt-3 rounded-md border border-gray-300 bg-gray-50 p-3">
                          <p className="text-sm text-gray-600">
                            Put this message back to the wording it shipped
                            with? The current wording
                            {edited ? " and your unsaved edit" : ""} will be
                            gone.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setConfirmReset(null)}
                              disabled={busy}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => reset(t)}
                              disabled={busy}
                            >
                              {busy ? "Resetting…" : "Reset to default"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
