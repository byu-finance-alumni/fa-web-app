import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { SupportContactsManager } from "@/components/admin/SupportContactsManager";
import type { SupportContact } from "@/types/support";
import type { UserContext } from "@/types/alumni";
import { ROLE } from "@/constants/roles";

/**
 * Engineer-only editor for the support contacts shown to signed-in users on the
 * in-app error screen. The page is gated to engineers in the UI (the sidebar
 * link is engineer-only too) and the backend re-enforces every write via
 * RequireEngineer. Reading the list uses the view-access GET.
 */
export default async function SupportContactsPage() {
  let isEngineer = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    isEngineer = ctx.roles?.includes(ROLE.ENGINEER) ?? false;
  } catch {
    /* fall through to the access-required screen */
  }

  if (!isEngineer) {
    return (
      <>
        <Topbar title="Support contacts" />
        <main className="flex-1 overflow-auto p-6">
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">Engineer access required</p>
            <p className="mt-1 text-sm text-gray-500">
              Only an engineer can manage support contacts.
            </p>
          </div>
        </main>
      </>
    );
  }

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
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">Couldn’t load contacts</p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </div>
        ) : (
          <SupportContactsManager contacts={contacts} />
        )}
      </main>
    </>
  );
}
