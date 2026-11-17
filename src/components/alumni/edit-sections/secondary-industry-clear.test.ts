import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * app#943 — Secondary industry must be savable BLANK from the staff
 * Employment form. A blank used to be dropped from the PATCH (omitted means
 * "leave it alone"), so clearing "Private Equity" and saving kept it. The
 * action now sends an explicit `null` for a blank secondary, while primary
 * industry keeps its old omit-on-blank behaviour.
 */

const apiPatch = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
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
    apiPatch,
    apiPost: vi.fn(),
    apiGet: vi.fn(),
    apiDelete: vi.fn(),
    apiPostForm: vi.fn(),
    apiPutForm: vi.fn(),
    apiGetText: vi.fn(),
    apiPostText: vi.fn(),
    ApiError,
  };
});

const { updateEmploymentSection, updateAlumni } = await import(
  "@/app/(app)/alumni/actions"
);

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function sentCareer(): Record<string, unknown> | undefined {
  expect(apiPatch).toHaveBeenCalledTimes(1);
  const body = apiPatch.mock.calls[0][1] as Record<string, unknown>;
  return body.career as Record<string, unknown> | undefined;
}

beforeEach(() => {
  apiPatch.mockReset();
  apiPatch.mockResolvedValue({ alumni_id: 7 });
});

describe("updateEmploymentSection — secondary industry (app#943)", () => {
  it("sends null when Secondary industry is cleared", async () => {
    await updateEmploymentSection(
      7,
      null,
      form({
        "career.current_employer": "Acme Capital",
        "career.current_industry": "Private Equity",
        "career.current_industry_secondary": "",
      }),
    );
    const career = sentCareer();
    expect(career).toMatchObject({
      current_employer: "Acme Capital",
      current_industry: "Private Equity",
    });
    expect(career).toHaveProperty("current_industry_secondary", null);
  });

  it("treats whitespace-only as blank", async () => {
    await updateEmploymentSection(
      7,
      null,
      form({ "career.current_industry_secondary": "   " }),
    );
    expect(sentCareer()).toEqual({ current_industry_secondary: null });
  });

  it("still sends a chosen value", async () => {
    await updateEmploymentSection(
      7,
      null,
      form({ "career.current_industry_secondary": "Real Estate" }),
    );
    expect(sentCareer()).toEqual({ current_industry_secondary: "Real Estate" });
  });

  it("never touches secondary when the field is not on the form", async () => {
    await updateEmploymentSection(
      7,
      null,
      form({ "career.current_employer": "Acme Capital" }),
    );
    expect(sentCareer()).not.toHaveProperty("current_industry_secondary");
  });

  it("leaves primary industry rules alone: a blank primary is still omitted", async () => {
    await updateEmploymentSection(
      7,
      null,
      form({
        "career.current_industry": "",
        "career.current_industry_secondary": "",
      }),
    );
    expect(sentCareer()).not.toHaveProperty("current_industry");
  });
});

describe("updateAlumni (full edit form) — secondary industry (app#943)", () => {
  it("sends null when Secondary industry is cleared", async () => {
    await updateAlumni(
      7,
      null,
      form({
        first_name: "Madsen",
        last_name: "Murphy",
        "career.current_industry": "Private Equity",
        "career.current_industry_secondary": "",
      }),
    );
    expect(sentCareer()).toHaveProperty("current_industry_secondary", null);
  });
});
