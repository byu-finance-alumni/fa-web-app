"use client";

/**
 * AvatarLightbox — a full-screen viewer for a single headshot photo. Renders a
 * dark navy backdrop with the image centered (capped at ~90vw/90vh) and a close
 * (X) control in the top-right. Closes on ESC, on a backdrop click, or via the
 * close button; locks body scroll while open. Mirrors the inline Modal pattern
 * in ProfileDialogs.tsx (ESC listener + overlay + stopPropagation) and uses the
 * design-system tokens from UX-UI.md.
 *
 * Only used for real photos — the initials fallback is not zoomable.
 */

import { useEffect } from "react";
import { X } from "lucide-react";

export function AvatarLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt}, enlarged photo`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> mirrors the Avatar component and keeps the headshot source identical */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-lg"
      />
    </div>
  );
}
