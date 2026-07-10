"use client";

/**
 * ProfileHeadshot — the alumnus's headshot in the profile header.
 *
 * The image is served by the backend as a short-lived SIGNED URL (the bucket is
 * private), fetched server-side and passed in as `initialUrl`. When present it
 * renders as a rounded avatar that opens a full-screen {@link AvatarLightbox} on
 * click; when null — or the signed URL fails to load / has expired — it falls
 * back to the same colored initials circle used elsewhere.
 *
 * full_access+ users (gated by `canManage`, mirroring the profile page's
 * `hasFullAccess`) additionally get text-only Upload / Replace / Remove controls
 * that PUT/DELETE `/alumni/{id}/headshot`. After a successful upload we re-fetch
 * a fresh signed URL so the new photo shows without a full page reload. The
 * backend re-enforces the permission and the accepted image types; this just
 * shows friendly feedback.
 *
 * Uses a plain <img> (not next/image) so the onError → initials fallback stays
 * simple, matching the existing Avatar component.
 */

import { useRef, useState, useTransition } from "react";
import { AvatarLightbox } from "@/components/shared/AvatarLightbox";
import { useToast } from "@/components/ui/Toast";
import {
  confirmHeadshotUpload,
  deleteHeadshot,
  getHeadshotUploadUrl,
  getHeadshotUrl,
} from "@/app/(app)/alumni/actions";

/** Image types the backend accepts; also used for client-side pre-validation. */
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
// Matches the bucket's size limit; reject client-side for a friendly message.
const MAX_HEADSHOT_BYTES = 20 * 1024 * 1024;

export function ProfileHeadshot({
  alumniId,
  initialUrl,
  name,
  initials,
  size = "h-48 w-48 text-5xl",
  colorClass = "bg-navy-800",
  canManage,
}: {
  alumniId: number;
  /** Signed URL from the server, or null when no headshot is on file. */
  initialUrl: string | null;
  name: string;
  initials: string;
  /** Tailwind sizing/text classes for the avatar circle. */
  size?: string;
  /** Fallback initials-circle background color. */
  colorClass?: string;
  /** full_access+ — shows the Upload / Replace / Remove controls. */
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [errored, setErrored] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!url && !errored;

  const onPick = (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("That image type isn't supported. Use a JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_HEADSHOT_BYTES) {
      toast.error("That image is too large. Please use one under 20 MB.");
      return;
    }
    startTransition(async () => {
      // 1) Ask the backend for a signed URL scoped to this alumnus's object.
      const urlRes = await getHeadshotUploadUrl(alumniId);
      if (!urlRes.ok) {
        toast.error(urlRes.error);
        return;
      }
      // 2) PUT the image straight to Supabase Storage from the browser — this
      //    bypasses the ~4.5 MB serverless request-body cap that made large
      //    photos 413. Supabase enforces the bucket's size + type allow-list.
      try {
        const put = await fetch(urlRes.uploadUrl, {
          method: "PUT",
          headers: {
            "content-type": file.type,
            "x-upsert": "true",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
          },
          body: file,
        });
        if (!put.ok) {
          toast.error(
            put.status === 413
              ? "That image is too large. Please use one under 20 MB."
              : "Couldn't upload the photo — try again.",
          );
          return;
        }
      } catch {
        toast.error("Couldn't upload the photo — try again.");
        return;
      }
      // 3) Confirm so the backend audits the upload + revalidates the profile.
      const confirmed = await confirmHeadshotUpload(alumniId);
      if (!confirmed.ok) {
        toast.error(confirmed.error);
        return;
      }
      // Re-fetch a fresh signed URL so the new photo shows immediately.
      const fresh = await getHeadshotUrl(alumniId);
      if (fresh.ok) {
        setErrored(false);
        setUrl(fresh.url);
      }
      toast.success("Photo updated.");
    });
  };

  const onRemove = () => {
    startTransition(async () => {
      const res = await deleteHeadshot(alumniId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(null);
      setErrored(false);
      setShowLightbox(false);
      toast.success("Photo removed.");
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      {hasPhoto ? (
        <button
          type="button"
          onClick={() => setShowLightbox(true)}
          aria-label={`View ${name}'s photo`}
          className={`shrink-0 cursor-zoom-in rounded-full focus:outline-none focus:ring-2 focus:ring-brand-blue-500 focus:ring-offset-2 ${size}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> keeps the onError headshot fallback simple */}
          <img
            src={url as string}
            alt={name}
            onError={() => setErrored(true)}
            className="h-full w-full rounded-full object-cover"
          />
        </button>
      ) : (
        <span
          className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorClass} ${size}`}
          aria-hidden="true"
        >
          {initials.toUpperCase()}
        </span>
      )}

      {canManage ? (
        <div className="flex items-center gap-2 text-xs">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              // Reset so re-selecting the SAME file still fires onChange.
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="font-medium text-brand-blue-600 hover:text-brand-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Working…" : hasPhoto ? "Replace photo" : "Upload photo"}
          </button>
          {hasPhoto ? (
            <>
              <span aria-hidden="true" className="text-gray-300">
                ·
              </span>
              <button
                type="button"
                onClick={onRemove}
                disabled={pending}
                className="font-medium text-gray-500 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {showLightbox && hasPhoto ? (
        <AvatarLightbox
          src={url as string}
          alt={name}
          onClose={() => setShowLightbox(false)}
        />
      ) : null}
    </div>
  );
}
