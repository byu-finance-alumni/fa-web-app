"use client";

import { useEffect, useState } from "react";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { env } from "@/lib/env";

type Status = "checking" | "online" | "offline";

/**
 * Temporary connectivity indicator: pings the FastAPI backend to show whether
 * the app can reach the API. "Reachable" = the server responded at all (we use
 * a no-cors probe, so any response counts; a network failure means offline).
 */
export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    async function check() {
      if (!env.apiUrl) {
        if (!cancelled) setStatus("offline");
        return;
      }
      try {
        await fetch(`${env.apiUrl}/health`, {
          mode: "no-cors",
          signal: controller.signal,
        });
        if (!cancelled) setStatus("online");
      } catch {
        if (!cancelled) setStatus("offline");
      } finally {
        clearTimeout(timeout);
      }
    }

    check();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  const config = {
    checking: {
      Icon: Loader2,
      label: "Checking API…",
      className: "text-gray-500",
      iconClassName: "animate-spin",
    },
    online: {
      Icon: Wifi,
      label: "API connected",
      className: "text-success-600",
      iconClassName: "",
    },
    offline: {
      Icon: WifiOff,
      label: "API not reachable",
      className: "text-danger-600",
      iconClassName: "",
    },
  }[status];

  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.className}`}
      title={env.apiUrl ? `${env.apiUrl}/health` : "NEXT_PUBLIC_API_URL not set"}
    >
      <Icon className={`h-4 w-4 ${config.iconClassName}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
