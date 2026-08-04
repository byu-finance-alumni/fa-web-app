import { describe, expect, it } from "vitest";

import {
  HEIC_REASON,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_EXPANDED_BYTES,
  MAX_FILES,
  MAX_FILE_BYTES,
  REQUEST_CHUNK,
  chunk,
  contentTypeForName,
  isArchiveJunk,
  limitBatch,
  makeArchiveFilter,
  mapWithConcurrency,
  netIdFromFilename,
  partitionPicked,
} from "./photoImport";

/**
 * Bulk photo import selection rules (#595).
 *
 * The regressions these exist for:
 *  1. `pickFiles` called `setFiles([])` when ANY file was rejected, so a single
 *     `.DS_Store` or HEIC in a 50-photo drag discarded the entire batch with a
 *     message about one file. Rejection must be per-file.
 *  2. The wizard advertised (and enforced) 1,000 files / 200 MB in one request,
 *     which Vercel's ~4.5 MB body cap made impossible. Bytes now go straight to
 *     storage and only metadata is chunked through the API, so the caps that
 *     remain are the per-file bucket limit and the per-request chunk size.
 */

/** A File stand-in — Node 20's File exists but building one per case is noisy. */
const file = (name: string, size = 1024): File =>
  ({ name, size }) as unknown as File;

describe("partitionPicked", () => {
  it("keeps the valid photos when some files are rejected", () => {
    const { accepted, archives, skipped } = partitionPicked([
      file("jdoe.jpg"),
      file(".DS_Store"),
      file("asmith.png"),
      file("IMG_0042.HEIC"),
      file("notes.txt"),
      file("photos.zip"),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["jdoe.jpg", "asmith.png"]);
    expect(archives.map((f) => f.name)).toEqual(["photos.zip"]);
    expect(skipped.map((s) => s.name)).toEqual([
      ".DS_Store",
      "IMG_0042.HEIC",
      "notes.txt",
    ]);
  });

  it("says plainly that HEIC is unsupported and what to do instead", () => {
    const { skipped } = partitionPicked([file("IMG_0042.heic")]);
    expect(skipped[0].reason).toBe(HEIC_REASON);
    expect(skipped[0].reason).toMatch(/JPEG/);
  });

  it("skips oversized and empty files individually", () => {
    const { accepted, skipped } = partitionPicked([
      file("big.jpg", MAX_FILE_BYTES + 1),
      file("empty.png", 0),
      file("fine.webp", 5000),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["fine.webp"]);
    expect(skipped.map((s) => s.name)).toEqual(["big.jpg", "empty.png"]);
    expect(skipped[0].reason).toMatch(/20 MB/);
  });

  it("accepts an extension in any case", () => {
    const { accepted } = partitionPicked([file("JDOE12.JPG"), file("a.PNG")]);
    expect(accepted).toHaveLength(2);
  });
});

describe("limitBatch", () => {
  it("trims the overflow instead of rejecting the whole selection", () => {
    const picked = Array.from({ length: MAX_FILES + 3 }, (_, i) =>
      file(`user${i}.jpg`),
    );
    const { kept, skipped } = limitBatch(picked);
    expect(kept).toHaveLength(MAX_FILES);
    expect(skipped).toHaveLength(3);
    expect(skipped[0].reason).toMatch(/limit/);
  });

  it("de-dupes by name, keeping the later pick", () => {
    const first = file("jdoe.jpg", 100);
    const second = file("JDOE.jpg", 200);
    const { kept, skipped } = limitBatch([first, second, file("asmith.png")]);
    expect(kept).toEqual([second, expect.objectContaining({ name: "asmith.png" })]);
    expect(skipped).toHaveLength(1);
  });
});

describe("net ID + content type derivation", () => {
  it("mirrors the backend: basename minus extension, trimmed", () => {
    expect(netIdFromFilename("jdoe12.jpg")).toBe("jdoe12");
    expect(netIdFromFilename("photos/jdoe12.PNG")).toBe("jdoe12");
    expect(netIdFromFilename("photos\\jdoe12.webp")).toBe("jdoe12");
    expect(netIdFromFilename(" jdoe12 .jpg")).toBe("jdoe12");
  });

  it("maps only the allow-listed extensions to a MIME type", () => {
    expect(contentTypeForName("a.jpg")).toBe("image/jpeg");
    expect(contentTypeForName("a.JPEG")).toBe("image/jpeg");
    expect(contentTypeForName("a.png")).toBe("image/png");
    expect(contentTypeForName("a.webp")).toBe("image/webp");
    expect(contentTypeForName("a.heic")).toBeNull();
    expect(contentTypeForName("a.gif")).toBeNull();
    expect(contentTypeForName("noextension")).toBeNull();
  });
});

describe("isArchiveJunk", () => {
  it("drops directories, macOS metadata and dotfiles", () => {
    expect(isArchiveJunk("photos/")).toBe(true);
    expect(isArchiveJunk("__MACOSX/._jdoe.jpg")).toBe(true);
    expect(isArchiveJunk("photos/__MACOSX/._jdoe.jpg")).toBe(true);
    expect(isArchiveJunk("photos/.DS_Store")).toBe(true);
    expect(isArchiveJunk("photos/jdoe.jpg")).toBe(false);
  });
});

describe("makeArchiveFilter", () => {
  const entry = (name: string, originalSize = 1024) => ({ name, originalSize });

  it("keeps real photos and drops junk", () => {
    const filter = makeArchiveFilter();
    expect(filter(entry("photos/jdoe.jpg"))).toBe(true);
    expect(filter(entry("photos/.DS_Store"))).toBe(false);
    expect(filter(entry("__MACOSX/._jdoe.jpg"))).toBe(false);
    expect(filter(entry("photos/"))).toBe(false);
  });

  it("refuses a member that declares more than the per-photo limit", () => {
    const filter = makeArchiveFilter();
    expect(filter(entry("huge.jpg", MAX_FILE_BYTES + 1))).toBe(false);
    expect(filter(entry("fine.jpg", MAX_FILE_BYTES))).toBe(true);
  });

  it("stops decompressing once the expansion budget is spent (zip bomb)", () => {
    const filter = makeArchiveFilter();
    const each = MAX_FILE_BYTES;
    const affordable = Math.floor(MAX_ARCHIVE_EXPANDED_BYTES / each);
    for (let i = 0; i < affordable; i++) {
      expect(filter(entry(`photo${i}.jpg`, each))).toBe(true);
    }
    // Budget exhausted — nothing else is allocated, however many members follow.
    expect(filter(entry("bomb.jpg", each))).toBe(false);
  });

  it("stops walking after the member-count ceiling", () => {
    const filter = makeArchiveFilter();
    for (let i = 0; i < MAX_ARCHIVE_ENTRIES; i++) filter(entry(`p${i}.jpg`, 1));
    expect(filter(entry("one-too-many.jpg", 1))).toBe(false);
  });
});

describe("chunk", () => {
  it("never exceeds the backend's per-request cap", () => {
    const names = Array.from({ length: 250 }, (_, i) => `u${i}.jpg`);
    const chunks = chunk(names, REQUEST_CHUNK);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.length <= REQUEST_CHUNK)).toBe(true);
    expect(chunks.flat()).toEqual(names);
  });

  it("returns nothing for an empty list", () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves order and never exceeds the limit in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles an empty list without hanging", async () => {
    await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
  });
});
