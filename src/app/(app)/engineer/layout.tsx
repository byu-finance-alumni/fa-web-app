import { redirect } from "next/navigation";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { isEngineer } from "@/constants/roles";

/**
 * Engineer Console gate (#162). Every `/engineer/*` route is engineer-only, so
 * we resolve the signed-in user's roles once here and bounce non-engineers to
 * the dashboard rather than rendering any console tool. The backend re-enforces
 * the engineer capability on every underlying endpoint — this is UX only.
 *
 * THREE OUTCOMES, NOT TWO (#688). This gate used to have only two branches, and
 * the wrong one caught the outage case: on any error that was not a 401/403 it
 * fell through and RENDERED the console, on the reasoning that the
 * engineer-only endpoints 403 a non-engineer anyway so nothing could leak. That
 * is fail-OPEN. The endpoints are the security boundary and they do hold, but
 * the console is not a neutral shell — it carries maintenance mode, the
 * permission editor, and the survey kill switch, and handing those controls to
 * an account whose roles we could not read is a door opened on a guess. It also
 * produced the worst possible outage screen: a full console whose every panel
 * failed, with nothing saying why.
 *
 *   ok + engineer      → render the console.
 *   ok + not engineer  → redirect. A read succeeded and the answer was no.
 *   denied (401/403)   → redirect. Also a real answer.
 *   unavailable        → render the error. We could not ask, so we do not open.
 *
 * `redirect()` runs outside every branch that could swallow its control-flow
 * signal.
 */
export default async function EngineerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await readAuthContext();
  if (auth.status === "unavailable") {
    return <AccessCheckError status={auth.httpStatus} title="Engineer Console" />;
  }
  // False unless a successful read positively showed the engineer role.
  const isConfirmedEngineer = auth.status === "ok" && isEngineer(auth.ctx.roles);
  if (!isConfirmedEngineer) redirect("/dashboard");

  return <>{children}</>;
}
