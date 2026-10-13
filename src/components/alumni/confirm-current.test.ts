import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Mark info confirmed" on the alumni profile: the server action's request and
 * revalidation, and the page's gate on the `alumni.edit` capability.
 */

const apiPost = vi.fn();
const revalidatePath = vi.fn();
const updateTag = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath, updateTag }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/api", async () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    apiPost,
    apiGet: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
    apiPostForm: vi.fn(),
    apiPutForm: vi.fn(),
    apiGetText: vi.fn(),
    apiPostText: vi.fn(),
    ApiError,
  };
});

const { confirmAlumniCurrent } = await import("@/app/(app)/alumni/actions");
const { ApiError } = await import("@/lib/api");

beforeEach(() => {
  apiPost.mockReset();
  revalidatePath.mockReset();
  updateTag.mockReset();
});

describe("confirmAlumniCurrent", () => {
  it("POSTs confirm-current and revalidates the profile", async () => {
    apiPost.mockResolvedValue({});
    expect(await confirmAlumniCurrent(42)).toBeNull();
    expect(apiPost).toHaveBeenCalledWith("/alumni/42/confirm-current", {});
    expect(revalidatePath).toHaveBeenCalledWith("/alumni/42");
  });

  it("returns the error and revalidates nothing on failure", async () => {
    apiPost.mockRejectedValue(new ApiError(403, "Not allowed."));
    expect(await confirmAlumniCurrent(42)).toEqual({ error: "Not allowed." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("the profile's confirm button", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/app/(app)/alumni/[id]/page.tsx"),
    "utf8",
  );

  it("is gated on the alumni.edit capability, not a role", () => {
    expect(src).toContain("canConfirmCurrent = canEditAlumniRecord(ctx.capabilities)");
    expect(src).toMatch(/\{canConfirmCurrent \? \(\s*<span className="block">\s*<ConfirmCurrentButton/);
  });

  it("uses no icons", () => {
    const btn = readFileSync(
      resolve(process.cwd(), "src/components/alumni/ConfirmCurrentButton.tsx"),
      "utf8",
    );
    expect(btn).not.toContain("lucide-react");
    expect(btn).toContain('"Saving…"');
  });
});
