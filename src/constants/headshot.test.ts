import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HEADSHOT_FOCAL_X,
  HEADSHOT_FOCAL_Y,
  HEADSHOT_OBJECT_POSITION,
} from "./headshot";

/**
 * #867: every alumni headshot is anchored toward the top so an uncropped tall
 * portrait keeps the head in the circle. One constant, applied everywhere a
 * headshot renders — and kept OFF the scenic images.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("headshot framing (#867)", () => {
  it("the class and the cropper's fractions describe the same anchor", () => {
    const pct = (f: number) => `${Math.round(f * 100)}%`;
    expect(HEADSHOT_OBJECT_POSITION).toBe(
      `object-[${pct(HEADSHOT_FOCAL_X)}_${pct(HEADSHOT_FOCAL_Y)}]`,
    );
  });

  it.each([
    "src/components/alumni/ProfileHeadshot.tsx",
    "src/components/shared/RowAvatar.tsx",
    "src/components/needs-surveying/PendingSubmissions.tsx",
    "src/components/survey/survey-screens.tsx",
  ])("%s anchors its headshot with the shared constant", (path) => {
    const src = read(path);
    expect(src).toContain("object-cover ");
    expect(src).toContain("${HEADSHOT_OBJECT_POSITION}");
  });

  it("the cropper opens at the same anchor", () => {
    const src = read("src/components/alumni/HeadshotCropper.tsx");
    expect(src).toContain("* HEADSHOT_FOCAL_X");
    expect(src).toContain("* HEADSHOT_FOCAL_Y");
  });

  it("leaves the scenic images alone", () => {
    for (const path of [
      "src/components/dashboard/DashboardHero.tsx",
      "src/components/shell/BrandPhotoBackdrop.tsx",
    ]) {
      expect(read(path)).not.toContain("HEADSHOT_OBJECT_POSITION");
    }
  });
});
