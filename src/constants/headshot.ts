/**
 * Where an alumni headshot is anchored inside its circular avatar (#867).
 *
 * Bulk-imported headshots are stored uncropped — tall portraits with the face in
 * the upper part of the frame. `object-cover` alone centres the crop, which on a
 * tall image cuts off the top of the head and frames the chin and collar. Pinning
 * the image 20% from the top keeps the face in the circle. A square photo made in
 * the cropper fills the circle exactly, so this changes nothing for it.
 *
 * ONE place to tune it. The class is written out in full (not assembled from the
 * number) because Tailwind finds classes by scanning source text, and the
 * fraction is the same position for code that frames an image itself — the
 * HeadshotCropper's starting offset. Change both together; a test pins that
 * they agree.
 *
 * Headshots only. The dashboard hero and the brand photo backdrop are wide
 * scenic images with their own framing and must NOT use this.
 */

/** Tailwind class for every headshot `<img>`; use alongside `object-cover`. */
export const HEADSHOT_OBJECT_POSITION = "object-[50%_20%]";

/** The same anchor as fractions: 0 = left/top edge, 1 = right/bottom edge. */
export const HEADSHOT_FOCAL_X = 0.5;
export const HEADSHOT_FOCAL_Y = 0.2;
