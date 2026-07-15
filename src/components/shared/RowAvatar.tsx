"use client";

/**
 * RowAvatar — a small round table-row avatar. Shows the alumnus's headshot when
 * a (short-lived, signed) URL is available, otherwise the deterministic initials
 * circle from {@link InitialsAvatar}. The headshot bucket is private, so the URL
 * is the same signed URL the profile header uses (GET /alumni/{id}/headshot),
 * minted server-side and passed down per row; a null URL covers both "no photo
 * on file" and "no net_id", and a load failure degrades to the same initials
 * fallback. Text-only fallback — no icon.
 *
 * Uses a plain <img> (not next/image) so the onError → initials fallback stays
 * simple, matching {@link Avatar} / {@link ProfileHeadshot}.
 */

import { useState } from "react";
import { InitialsAvatar } from "./InitialsAvatar";

export function RowAvatar({
  url,
  name,
}: {
  /** Signed headshot URL, or null when none is on file / net_id is missing. */
  url: string | null;
  /** Display name — drives the initials fallback. */
  name: string;
}) {
  const [errored, setErrored] = useState(false);

  if (url && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- plain <img> keeps the onError initials fallback simple
      <img
        src={url}
        alt=""
        width={32}
        height={32}
        onError={() => setErrored(true)}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return <InitialsAvatar name={name} size="sm" />;
}
