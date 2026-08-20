"use client";

import { useState, useTransition } from "react";
import {
  setAlertDeliveryMode,
  type AlertDeliveryMode,
  type AlertDeliveryState,
} from "@/app/(app)/engineer/maintenance/actions";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/card";
import {
  ALERT_DELIVERY_OPTIONS,
  deliveryConfirmation,
  deliveryGaps,
} from "./alert-delivery-mode";

/**
 * Where alerts go: Slack only, or Slack and e-mail.
 *
 * WHY THIS IS A CONTROL AND NOT A DEPLOY. Both channels used to fire on every
 * alert, so the first real security alert arrived twice; that was changed so
 * Slack is the channel and the e-mail is the backstop. Choosing between the two
 * had lived in an environment variable, which means a redeploy to change your
 * mind. It is a setting now, stored server-side, because the point is to change
 * it in the moment.
 *
 * ⚠️ THE COPY IS THE FEATURE HERE. "Slack only" is exactly the phrase somebody
 * reads as "and if Slack breaks we hear nothing", which is the opposite of what
 * it does — the e-mail is not switched off, it becomes the backstop, and it
 * still fires whenever the Slack post fails or the channel is not configured.
 * So each option states what it does in a full sentence, and the line under
 * them says the backstop survives BOTH settings. Anything shorter would leave a
 * reader to guess, and the wrong guess here is somebody deciding the alerting is
 * riskier than it is — or, worse, that it is safer.
 *
 * The one case where that promise is NOT true is when no alert mailbox is
 * configured at all, and the card says so in warning tone rather than repeating
 * a reassurance that has stopped being accurate.
 *
 * Radio options rather than a switch: two named states, each needing a sentence,
 * both visible at once. A switch would force the reader to work out what "off"
 * means. Text-only, per the project's icon-free control convention.
 */
export function AlertDeliveryControl({ state }: { state: AlertDeliveryState }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<AlertDeliveryMode>(state.mode);
  const [changed, setChanged] = useState<{
    at: string | null;
    by: string | null;
  }>({ at: state.updated_at, by: state.updated_by_email });
  const gaps = deliveryGaps(state);

  function choose(next: AlertDeliveryMode) {
    if (next === mode || pending) return;
    const previous = mode;
    // Optimistic, then corrected by whatever the server actually stored. A
    // radio that does not move until a round trip completes reads as broken.
    setMode(next);
    startTransition(async () => {
      const res = await setAlertDeliveryMode(next);
      if (!res.ok) {
        setMode(previous);
        toast.error(res.error);
        return;
      }
      setMode(res.state.mode);
      setChanged({ at: res.state.updated_at, by: res.state.updated_by_email });
      toast.success(deliveryConfirmation(res.state.mode));
    });
  }

  return (
    <section aria-labelledby="alert-delivery-heading">
      <h2
        id="alert-delivery-heading"
        className="mb-3 text-sm font-semibold text-gray-900"
      >
        Where alerts are delivered
      </h2>

      <Card className="p-5">
        <fieldset disabled={pending}>
          <legend className="sr-only">Alert delivery</legend>

          <div className="space-y-3">
            {ALERT_DELIVERY_OPTIONS.map((option) => (
              <Choice
                key={option.value}
                name="alert-delivery-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={choose}
                label={option.label}
                detail={option.detail}
              />
            ))}
          </div>
        </fieldset>

        {/*
          The sentence this card exists for. It sits below both options, not
          inside one, because it is true of both — "Slack only" never means
          "and silence if Slack breaks".
        */}
        <p className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-500">
          Either way, an alert still reaches the mailbox if the Slack post
          fails — a revoked webhook, a Slack outage, or no channel set up. The
          setting decides whether e-mail is a{" "}
          <span className="font-medium text-gray-700">copy</span> or a{" "}
          <span className="font-medium text-gray-700">backstop</span>, never
          whether it exists.
        </p>

        {gaps.includes("no-backstop") ? (
          <p className="mt-3 text-sm text-warning-600">
            No alert mailbox is set up, so right now there is{" "}
            <strong>no backstop</strong>: if the Slack post fails, nothing is
            delivered. Set <code>ALERT_EMAIL_TO</code> on the API to restore it.
          </p>
        ) : null}

        {gaps.includes("no-slack") ? (
          <p className="mt-3 text-sm text-warning-600">
            No Slack webhook is set up, so every alert is arriving by e-mail
            whichever option is selected.
          </p>
        ) : null}

        {changed.at ? (
          <p className="mt-3 text-sm text-gray-500">
            Last changed {formatChanged(changed.at)}
            {changed.by ? ` by ${changed.by}` : ""}.
          </p>
        ) : null}
      </Card>
    </section>
  );
}

/**
 * One option. The label and its sentence are both inside the `<label>`, so the
 * whole block is a click target and a screen reader announces the explanation
 * with the choice rather than after it.
 */
function Choice({
  name,
  value,
  checked,
  onChange,
  label,
  detail,
}: {
  name: string;
  value: AlertDeliveryMode;
  checked: boolean;
  onChange: (mode: AlertDeliveryMode) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-brand-blue-600 focus-visible:ring-2 focus-visible:ring-brand-blue-500"
      />
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-sm text-gray-500">{detail}</span>
      </span>
    </label>
  );
}

/**
 * Utah time, to the minute — the same clock the rest of this page uses. Only
 * the day and time matter here; a setting is not read to the second.
 */
function formatChanged(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}
