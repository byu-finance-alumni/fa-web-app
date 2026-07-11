"use client";

/**
 * HeadshotCropper — a modal for positioning a photo inside the circular avatar.
 *
 * Drag to reposition and use the slider to zoom; a circular guide shows exactly
 * what will be visible on the profile. On save we render the chosen square
 * region to a canvas and hand back a JPEG blob, which the caller uploads via the
 * usual direct-to-storage flow.
 *
 * The `src` MUST be a local object URL (created from a File or a fetched Blob),
 * NOT a remote URL — drawing a cross-origin image to a canvas taints it and
 * `toBlob` would throw. Mirrors the modal pattern in {@link AvatarLightbox}
 * (ESC to close + scroll lock) and uses the design-system tokens from UX-UI.md.
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Side of the square crop viewport, in px (a large avatar). */
const VIEWPORT = 288;
/** Max exported edge — plenty for an avatar; never upscales past the source. */
const MAX_OUTPUT = 1024;

export function HeadshotCropper({
  src,
  busy,
  onCancel,
  onSave,
}: {
  /** Local object URL of the image to crop. */
  src: string;
  /** Upload in flight — controls are disabled and the modal can't be dismissed. */
  busy: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  // Constrain the offset so the image always fully covers the viewport (no gaps).
  const clamp = (x: number, y: number, z: number, base = baseScale, n = nat) => {
    if (!n) return { x, y };
    const minX = VIEWPORT - n.w * base * z;
    const minY = VIEWPORT - n.h * base * z;
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  };

  // Load the natural size, size the image to "cover" the viewport, and center it.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const base = Math.max(
        VIEWPORT / img.naturalWidth,
        VIEWPORT / img.naturalHeight,
      );
      const n = { w: img.naturalWidth, h: img.naturalHeight };
      setNat(n);
      setBaseScale(base);
      setZoom(1);
      setOffset({
        x: (VIEWPORT - n.w * base) / 2,
        y: (VIEWPORT - n.h * base) / 2,
      });
    };
    img.src = src;
  }, [src]);

  // ESC to cancel + lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onCancel]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (busy) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setOffset(
      clamp(
        drag.current.ox + (e.clientX - drag.current.x),
        drag.current.oy + (e.clientY - drag.current.y),
        zoom,
      ),
    );
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onZoom = (z: number) => {
    // Keep the viewport center anchored as the zoom changes.
    const c = VIEWPORT / 2;
    const k = z / zoom;
    setOffset(clamp(c - (c - offset.x) * k, c - (c - offset.y) * k, z));
    setZoom(z);
  };

  const save = () => {
    const img = imgRef.current;
    if (!img || !nat) return;
    const eff = baseScale * zoom;
    const srcSize = VIEWPORT / eff; // side of the visible square, in source px
    const out = Math.min(MAX_OUTPUT, Math.round(srcSize));
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      -offset.x / eff,
      -offset.y / eff,
      srcSize,
      srcSize,
      0,
      0,
      out,
      out,
    );
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob);
      },
      "image/jpeg",
      0.9,
    );
  };

  const dispW = nat ? nat.w * baseScale * zoom : 0;
  const dispH = nat ? nat.h * baseScale * zoom : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Adjust photo"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-navy-800">Adjust photo</h2>
        <p className="mb-4 mt-1 text-sm text-gray-500">
          Drag to reposition and use the slider to zoom. The circle is what shows
          on the profile.
        </p>

        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-md bg-navy-900"
          style={{
            width: VIEWPORT,
            height: VIEWPORT,
            cursor: busy ? "default" : "grab",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- cropped locally on a canvas; next/image cannot help here */}
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: offset.x,
              top: offset.y,
              width: dispW,
              height: dispH,
              maxWidth: "none",
            }}
          />
          {/* Circular safe-area guide: dim everything outside the inscribed circle. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80"
            style={{ boxShadow: "0 0 0 9999px rgba(12, 20, 40, 0.55)" }}
            aria-hidden="true"
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          disabled={busy || !nat}
          onChange={(e) => onZoom(parseFloat(e.target.value))}
          className="mt-4 w-full accent-brand-blue-600"
          aria-label="Zoom"
        />

        <div className="mt-5 flex justify-end gap-4 text-sm">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !nat}
            className="rounded-md bg-brand-blue-600 px-4 py-2 font-medium text-white hover:bg-brand-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
