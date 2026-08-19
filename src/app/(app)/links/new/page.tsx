import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AddLinkForm } from "@/components/links/AddLinkForm";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { canManageSurveys } from "@/constants/capabilities";

/**
 * Add link — staff manual entry for an opportunity a staff member heard about
 * directly rather than through the survey.
 *
 * A full-page two-step wizard, the same shape as Add alumni and Add event: the
 * attribution is settled first, then the opportunity itself. The page is only a
 * shell — the steps, their validation and their navigation all live in
 * {@link AddLinkForm}.
 *
 * Gated on the surveys-management capability, the same one the backend enforces
 * on `POST /opportunity-links`. Anyone without it is sent back to the read-only
 * list rather than shown a form that 403s on submit. Read the CAPABILITY, never
 * the role: an engineer can grant it to a narrower role from the permission
 * editor and a role check would bounce someone the backend would accept (#379).
 *
 * The bounce belongs to a 401/403 and to nothing else (#688). When the context
 * cannot be read at all we neither open the form nor move the user: the flag
 * stays false and the fault is named on this URL, which is the one a reload
 * retries.
 */
export default async function NewLinkPage() {
  let canCreate = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    canCreate = canManageSurveys(auth.ctx.capabilities);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Internship Links", href: "/links" },
          { label: "Add link" },
        ]}
      />
    );
  }
  // Outside every branch that could swallow it: redirect() throws a
  // control-flow signal.
  if (!canCreate) redirect("/links");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Internship Links", href: "/links" },
          { label: "Add link" },
        ]}
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <AddLinkForm />
      </main>
    </>
  );
}
