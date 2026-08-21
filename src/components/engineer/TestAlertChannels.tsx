"use client";

import { useState, useTransition } from "react";
import {
  sendTestAlert,
  type AlertPurpose,
  type AlertTestResult,
} from "@/app/(app)/engineer/maintenance/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * "Are the alert channels actually reachable?" — answered without breaking
 * anything.
 *
 * WHY THIS IS A CONTROL AND NOT A DOC. Until this existed the question could
 * only be answered by causing the thing you were checking for: an outage alert
 * needs three sustained failures, so proving the error channel meant
 * deliberately failing production for a minute. And on 2026-08-19 a real
 * security alert landed in the error channel because no security webhook was
 * set — the documented one-way fallback doing exactly its job, and completely
 * invisible from inside Slack. A rotated webhook, a moved channel or a wiped env
 * var all look identical from here: silence.
 *
 * THE RESULT IS PER CHANNEL ON PURPOSE. "Nothing arrived" has two very different
 * causes — nowhere to send, or a send that failed — and one boolean cannot tell
 * them apart. Each row says which, and a security test that is falling back to
 * the error channel says so in words rather than leaving the reader to work it
 * out from which channel pinged.
 *
 * Text-only, per the project's icon-free control convention.
 */
export function TestAlertChannels() {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState<AlertPurpose | null>(null);
  const [result, setResult] = useState<AlertTestResult | null>(null);

  function run(purpose: AlertPurpose) {
    setSending(purpose);
    startTransition(async () => {
      const res = await sendTestAlert(purpose);
      setSending(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      const landed = res.result.slack_delivered || res.result.email_delivered;
      if (landed) {
        toast.success("Test alert sent. Check the channel.");
      } else {
        // NOT an error toast: the send did not fail, there was nowhere to send.
        toast.error("Nothing was sent — no channel is configured for that kind.");
      }
    });
  }

  return (
    <section aria-labelledby="test-alert-heading">
      <h2
        id="test-alert-heading"
        className="mb-3 text-sm font-semibold text-gray-900"
      >
        Check the alert channels
      </h2>

      <Card className="p-5">
        <p className="text-sm text-gray-500">
          Sends one clearly-marked test message. Nothing breaks, no incident is
          opened, and a test can never hide a real alert that starts a second
          later.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => run("operational")}
            disabled={pending}
          >
            {sending === "operational" ? "Sending…" : "Test error alerts"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => run("security")}
            disabled={pending}
          >
            {sending === "security" ? "Sending…" : "Test security alerts"}
          </Button>
        </div>

        {result ? (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700">
              Last check: {result.purpose === "security" ? "security" : "error"}{" "}
              alerts
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <ChannelLine
                name="Slack"
                configured={result.slack_configured}
                delivered={result.slack_delivered}
              />
              <ChannelLine
                name="Email"
                configured={result.email_configured}
                delivered={result.email_delivered}
              />
            </dl>
            {result.fell_back_to_error_channel ? (
              <p className="mt-3 text-sm text-warning-600">
                Security alerts are going to the <strong>error</strong> channel:
                no separate security webhook is set. That is deliberate — a
                missing setting must never mean a missing attack alert — but it
                means attacks and 500s share one channel.
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>
    </section>
  );
}

/**
 * One channel's verdict. Three states, not two: "not configured" is neither a
 * success nor a failure, and colouring it red would send someone looking for a
 * broken webhook that was never meant to exist.
 */
function ChannelLine({
  name,
  configured,
  delivered,
}: {
  name: string;
  configured: boolean;
  delivered: boolean;
}) {
  const [text, tone] = !configured
    ? ["not set up", "text-gray-500"]
    : delivered
      ? ["delivered", "text-success-600"]
      : ["configured, but the send failed", "text-danger-600"];
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-gray-500">{name}</dt>
      <dd className={`font-medium ${tone}`}>{text}</dd>
    </div>
  );
}
