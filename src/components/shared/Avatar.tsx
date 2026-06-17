"use client";

/**
 * Avatar — shows a headshot photo when available, falling back to a colored
 * initials circle identical to {@link InitialsAvatar}. The headshot filename is
 * the alumnus's BYU net ID; the URL is derived from a public env base
 * (`NEXT_PUBLIC_HEADSHOT_BASE_URL`). When the env var is unset, the net ID is
 * null, or the image fails to load, the initials fallback is rendered instead.
 *
 * Uses a plain <img> (not next/image) so the onError fallback stays simple, and
 * is a client component for that handler. Generic/reusable — pass the size
 * classes and color class so callers control the look.
 *
 * When a real photo is shown, it is wrapped in a button that opens a
 * full-screen {@link AvatarLightbox}; the initials fallback is not zoomable.
 */

import { useState } from "react";
import { AvatarLightbox } from "./AvatarLightbox";

const HEADSHOT_BASE = process.env.NEXT_PUBLIC_HEADSHOT_BASE_URL;

export function Avatar({
  netId,
  initials,
  name,
  size = "h-16 w-16 text-lg",
  colorClass = "bg-navy-800",
}: {
  netId: string | null;
  initials: string;
  name: string;
  /** Tailwind sizing/text classes — defaults to the profile header size. */
  size?: string;
  /** Fallback circle background color (from avatarColor). */
  colorClass?: string;
}) {
  const [errored, setErrored] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const src =
    HEADSHOT_BASE && netId ? `${HEADSHOT_BASE}/${netId}.jpg` : null;

  if (src && !errored) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowLightbox(true)}
          aria-label={`View ${name}'s photo`}
          className={`shrink-0 cursor-zoom-in rounded-full focus:outline-none focus:ring-2 focus:ring-brand-blue-500 focus:ring-offset-2 ${size}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> keeps the onError headshot fallback simple */}
          <img
            src={src}
            alt={name}
            width={64}
            height={64}
            onError={() => setErrored(true)}
            className="h-full w-full rounded-full object-cover"
          />
        </button>
        {showLightbox ? (
          <AvatarLightbox
            src={src}
            alt={name}
            onClose={() => setShowLightbox(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorClass} ${size}`}
      aria-hidden="true"
    >
      {initials.toUpperCase()}
    </span>
  );
}
