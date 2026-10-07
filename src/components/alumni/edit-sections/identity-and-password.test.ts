import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Two backend hardening changes the UI has to follow:
 *
 *  - fa-web-api#593: changing an alumnus's identity/status fields (is_alumni,
 *    deceased, NetID, BYU ID) needs `alumni.archive`, not just edit access. Of
 *    those, only the NetID is editable after creation (Personal section), so it
 *    renders DISABLED for an editor without the capability — disabled, not
 *    read-only, so the value is not even submitted and the partial PATCH leaves
 *    it alone.
 *  - fa-web-api#592: the forced password change is done by the BACKEND
 *    (`POST /auth/password/change`). The browser must no longer set the password
 *    itself and then ask the backend to clear the flag on its word.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/app/(app)/alumni/actions", () => ({
  updatePersonalSection: vi.fn(),
}));

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const DEFAULTS = {
  first_name: "Jane",
  middle_name: "",
  last_name: "Doe",
  preferred_first_name: "",
  birth_name: "",
  personal_email: "",
  work_email: "",
  phone: "",
  preferred_contact_method: "",
  city: "",
  state: "",
  country: "",
  net_id: "jdoe12",
  spouse_name: "",
  citizenship: "",
  home_country: "",
};

/** The `disabled` ATTRIBUTE (not the `disabled:` Tailwind variants in class). */
const DISABLED_ATTR = /\sdisabled=""/;

/** The rendered `<input>` tag for `name`. */
function inputTag(html: string, name: string): string {
  const match = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  expect(match, `no input named ${name}`).not.toBeNull();
  return match![0];
}

async function renderPersonal(canChangeIdentity: boolean): Promise<string> {
  const { PersonalSectionForm } = await import("./PersonalSectionForm");
  return renderToStaticMarkup(
    createElement(PersonalSectionForm, {
      id: 5,
      defaults: DEFAULTS,
      canChangeIdentity,
    }),
  );
}

describe("NetID needs alumni.archive to change (fa-web-api#593)", () => {
  it("is disabled, with a reason, for an editor without the capability", async () => {
    const html = await renderPersonal(false);
    const tag = inputTag(html, "net_id");
    expect(tag).toMatch(DISABLED_ATTR);
    // Still SHOWN — the value is context, only the edit is withheld.
    expect(tag).toContain('value="jdoe12"');
    expect(html).toContain("Only users who can archive alumni can change the NetID.");
  });

  it("is an ordinary editable field for an archive holder", async () => {
    const html = await renderPersonal(true);
    expect(inputTag(html, "net_id")).not.toMatch(DISABLED_ATTR);
    expect(html).not.toContain("Only users who can archive alumni");
  });

  it("leaves every other Personal field editable either way", async () => {
    const html = await renderPersonal(false);
    for (const name of ["first_name", "last_name", "citizenship"]) {
      expect(inputTag(html, name)).not.toMatch(DISABLED_ATTR);
    }
  });

  it("derives the flag from the CAPABILITY, not a role", () => {
    const loader = read("src/app/(app)/alumni/[id]/edit/load-profile.ts");
    expect(loader).toContain("canArchiveAlumni(auth.ctx.capabilities)");
  });
});

describe("forced password change goes through the backend (fa-web-api#592)", () => {
  const FORM = read("src/components/auth/SetPasswordForm.tsx");
  const ACTIONS = read("src/app/set-password/actions.ts");

  it("never sets the password from the browser", () => {
    expect(FORM).not.toContain("updateUser");
    expect(FORM).not.toContain("@/utils/supabase/client");
  });

  it("posts the new password to /auth/password/change", () => {
    expect(FORM).toContain("changePassword(values.password)");
    expect(ACTIONS).toContain('apiPost("/auth/password/change", { new_password: newPassword })');
  });

  it("no longer calls the deprecated flag-only route", () => {
    expect(FORM).not.toContain("password/complete");
    expect(ACTIONS).not.toMatch(/apiPost\(\s*"\/auth\/password\/complete"/);
  });
});
