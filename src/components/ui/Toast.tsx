"use client";

/**
 * Minimal, generic toast/notification primitive for the app.
 *
 * Styling values come from the design system (UX-UI.md): success uses
 * `success-600/50`, errors use `danger-600/50`, info reuses `brand-blue-600`.
 * Toasts are announced via an `aria-live` region for assistive tech.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Saved");
 *   toast.error("Something went wrong");
 *
 * Mount <ToastProvider> once near the app root.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, CircleAlert, Info, X, type LucideIcon } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANTS: Record<
  ToastVariant,
  { icon: LucideIcon; surface: string; iconColor: string; role: "status" | "alert" }
> = {
  success: {
    icon: Check,
    surface: "border-success-600/30 bg-success-50 text-success-600",
    iconColor: "text-success-600",
    role: "status",
  },
  error: {
    icon: CircleAlert,
    surface: "border-danger-600/30 bg-danger-50 text-danger-600",
    iconColor: "text-danger-600",
    role: "alert",
  },
  info: {
    icon: Info,
    surface: "border-brand-blue-300 bg-brand-blue-50 text-navy-800",
    iconColor: "text-brand-blue-600",
    role: "status",
  },
};

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0"
      >
        {toasts.map((t) => {
          const v = VARIANTS[t.variant];
          const Icon = v.icon;
          return (
            <div
              key={t.id}
              role={v.role}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${v.surface}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${v.iconColor}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded p-0.5 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): { toast: ToastApi } {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return { toast: ctx };
}
