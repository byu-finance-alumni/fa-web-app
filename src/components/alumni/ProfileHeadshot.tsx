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
import { HeadshotCropper } from "@/components/alumni/HeadshotCropper";
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
// Publishable (browser-safe) key, sent on the direct-to-storage PUT.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function ProfileHeadshot({
  alumniId,
  initialUrl,
  name,
  initials,
  size = "h-48 w-48 text-5xl",
  colorClass = "bg-navy-800",
  canManage,
  align = "center",
  compactControls = false,
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
  /** Cross-axis alignment of the avatar + its manage controls. "center" (the
   *  default) keeps the existing desktop header; "start" left-aligns for the
   *  mobile LinkedIn header. */
  align?: "center" | "start";
  /** Compact mode (mobile): a single "Edit photo" / "Add photo" link that opens
   *  the picker (upload/replace incl. crop), instead of the full
   *  Replace · Edit · Remove row — so it stays narrow under the avatar. */
  compactControls?: boolean;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [errored, setErrored] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  // Object URL of the image currently open in the cropper (from a picked file
  // or the fetched current photo), or null when the cropper is closed.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!url && !errored;

  const closeCropper = () => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  // A picked file is validated, then opened in the cropper (so every photo gets
  // positioned in the circle before it's saved) rather than uploaded as-is.
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
    setCropSrc(URL.createObjectURL(file));
  };

  // Re-open the cropper on the CURRENT photo so its circular crop can be
  // adjusted. The signed URL is fetched to a local blob first — drawing a
  // cross-origin image to a canvas would taint it and break the export.
  const onEdit = () => {
    if (!url) return;
    startTransition(async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        setCropSrc(URL.createObjectURL(await res.blob()));
      } catch {
        toast.error("Couldn't open the photo to edit — try again.");
      }
    });
  };

  // Shared direct-to-storage upload: mint a signed URL, PUT the (cropped) image
  // straight to Supabase — bypassing the ~4.5 MB serverless request-body cap —
  // then confirm so the backend audits it + revalidates the profile.
  const onCropSave = (blob: Blob) => {
    startTransition(async () => {
      const urlRes = await getHeadshotUploadUrl(alumniId);
      if (!urlRes.ok) {
        toast.error(urlRes.error);
        return;
      }
      try {
        const put = await fetch(urlRes.uploadUrl, {
          method: "PUT",
          headers: {
            "content-type": "image/jpeg",
            "x-upsert": "true",
            apikey: SUPABASE_KEY,
          },
          body: blob,
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
      closeCropper();
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
    <div
      className={`flex shrink-0 flex-col gap-2 ${
        align === "start" ? "items-start" : "items-center"
      }`}
    >
      {hasPhoto ? (
        <button
          type="button"
          onClick={() => setShowLightbox(true)}
          aria-label={`View ${name}'s photo`}
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-brand-blue-500 focus:ring-offset-2 ${size}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> keeps the onError headshot fallback simple */}
          {/* `block` (not the default inline) + the flex/overflow-hidden wrapper
              above avoids the inline-image baseline gap that, under this button's
              text-5xl line-height, spilled past the fixed h-48 box and pushed the
              page past 100vh (a second scrollbar on profiles that have a photo). */}
          <img
            src={url as string}
            alt={name}
            onError={() => setErrored(true)}
            className="block h-full w-full rounded-full object-cover"
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
            {pending
              ? "Working…"
              : compactControls
                ? hasPhoto
                  ? "Edit photo"
                  : "Add photo"
                : hasPhoto
                  ? "Replace photo"
                  : "Upload photo"}
          </button>
          {hasPhoto && !compactControls ? (
            <>
              <span aria-hidden="true" className="text-gray-300">
                ·
              </span>
              <button
                type="button"
                onClick={onEdit}
                disabled={pending}
                className="font-medium text-brand-blue-600 hover:text-brand-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit
              </button>
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

      {cropSrc ? (
        <HeadshotCropper
          src={cropSrc}
          busy={pending}
          onCancel={closeCropper}
          onSave={onCropSave}
        />
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
