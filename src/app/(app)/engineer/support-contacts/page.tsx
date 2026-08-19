import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { Topbar } from "@/components/shell/Topbar";
import { SupportContactsManager } from "@/components/admin/SupportContactsManager";
import type { SupportContact } from "@/types/support";
import { isEngineer } from "@/constants/roles";
import { LoadError } from "@/components/shared/LoadError";

/**
 * Engineer-only editor for the support contacts shown to signed-in users on the
 * in-app error screen. The page is gated to engineers in the UI (the sidebar
 * link is engineer-only too) and the backend re-enforces every write via
 * RequireEngineer. Reading the list uses the view-access GET.
 */
export default async function SupportContactsPage() {
  // Role gate (defense-in-depth): support contacts are engineer-only. The
  // /engineer/* route group is already gated in engineer/layout.tsx; this
  // page-level check is belt-and-suspenders. Redirect non-engineers — and any
  // authed-but-unprovisioned user (a real 401/403) — to the
  // dashboard rather than rendering a dead-end "access required" shell. The
  // backend re-enforces RequireEngineer on every write.
  // Split the two failures apart (#688). A 401/403 — or a successful read that
  // simply lacks the role — is the backend's answer, and the redirect below is
  // correct. An unreadable context (5xx, timeout, unreachable) is not an answer
  // at all: bouncing then strands a legitimate user on a dashboard that is
  // failing for the same reason, under a URL they never asked for, and the
  // report comes back as "the console vanished" instead of "the API is down".
  // `gate` stays null on anything but a verified-success read, so the page can
  // only render for someone we positively confirmed.
  const auth = await readAuthContext();
  if (auth.status === "unavailable") {
    return <AccessCheckError status={auth.httpStatus} title="Support contacts" />;
  }
  const gate = auth.status === "ok" ? auth.ctx : null;
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  let contacts: SupportContact[] = [];
  let error: ApiError | null = null;
  try {
    contacts = await apiGet<SupportContact[]>("/support-contacts");
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load contacts.");
  }

  return (
    <>
      <Topbar title="Support contacts" />
      <main className="flex-1 overflow-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-gray-500">
          Shown to signed-in users on the error screen so they know who to
          contact. These are <span className="font-medium text-gray-700">not</span>{" "}
          shown on the public sign-in page.
        </p>
        {error ? (
          <LoadError status={error.status} noun="the support contacts" />
        ) : (
          <SupportContactsManager contacts={contacts} />
        )}
      </main>
    </>
  );
}
