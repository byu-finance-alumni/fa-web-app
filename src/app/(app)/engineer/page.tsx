import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { isEngineer } from "@/constants/roles";
import { ENGINEER_SECURITY_HREFS } from "@/components/shell/nav";

/**
 * Engineer Console home (#162). A dedicated, engineer-only landing that gathers
 * every engineer tool in one purpose-built place instead of scattering them
 * through the admin UI. The route group is engineer-gated in layout.tsx.
 */

type Tool = {
  href: string;
  title: string;
  description: string;
};

const TOOLS: Tool[] = [
  {
    href: "/engineer/permissions",
    title: "Permissions",
    description:
      "Toggle what each role can do. Changes are enforced server-side on every request and feed the role-capabilities table in the Users section.",
  },
  {
    href: "/engineer/preview",
    title: "Preview as role",
    description:
      "See the app the way a given role sees it, navigation and access included, without leaving your own account. Read-only.",
  },
  {
    href: "/vocabulary",
    title: "Vocabulary",
    description:
      "Add, rename, or hide the controlled-vocabulary options that populate the app's dropdowns. Also available to any role granted the vocab capability.",
  },
  {
    href: "/engineer/surveys",
    title: "Surveys",
    description:
      "What survey campaigns are running, who started each one and when. Pause and resume any of them, or stop them all.",
  },
  {
    href: "/engineer/logins",
    title: "Logins",
    description:
      "Every sign-in with its captured location, newest first: the security history behind each account.",
  },
  {
    href: "/engineer/login-failures",
    title: "Login failures",
    description:
      "Every failed sign-in attempt, newest first: who, when, from what IP, and why. The attempted email may not match any account.",
  },
  {
    href: "/engineer/sessions",
    title: "Sessions",
    description:
      "Everyone signed in right now, oldest first: how long each session has been open, and the control to end one or sign an account out everywhere.",
  },
  {
    href: "/engineer/maintenance",
    title: "Maintenance mode",
    description:
      "Close the site for maintenance: signs out everyone except engineers, blocks their sign-in, and shows a maintenance page. Reversible from the same screen, because engineers stay signed in.",
  },
  {
    href: "/engineer/support-contacts",
    title: "Support contacts",
    description:
      "Manage the support contacts shown to users on the in-app error screen.",
  },
];

/**
 * The console is grouped the same way the sidebar is, so the two cannot disagree
 * about what "Security" means: membership is read from the sidebar's Security
 * group (`ENGINEER_SECURITY_HREFS`) rather than restated here, and the cards
 * follow that group's order. Anything not in it stays where it was.
 */
const SECURITY_ORDER = new Map(
  ENGINEER_SECURITY_HREFS.map((href, i) => [href, i] as const),
);

const SECTIONS: { title: string; tools: Tool[] }[] = [
  { title: "Tools", tools: TOOLS.filter((t) => !SECURITY_ORDER.has(t.href)) },
  {
    title: "Security",
    tools: TOOLS.filter((t) => SECURITY_ORDER.has(t.href)).sort(
      (a, b) => SECURITY_ORDER.get(a.href)! - SECURITY_ORDER.get(b.href)!,
    ),
  },
];

export default async function EngineerConsolePage() {
  // Role gate (defense-in-depth): the engineer console is engineer-only. The
  // /engineer/* route group is already gated in engineer/layout.tsx; this
  // page-level check is belt-and-suspenders. Redirect non-engineers — and any
  // authed-but-unprovisioned user (a real 401/403) — to the
  // dashboard rather than rendering the console. The backend re-enforces it too.
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
    return <AccessCheckError status={auth.httpStatus} title="Engineer Console" />;
  }
  const gate = auth.status === "ok" ? auth.ctx : null;
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  return (
    <>
      <Topbar title="Engineer Console" />
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-6 max-w-2xl text-sm text-gray-500">
          Engineer-only tools. Everything here is restricted to the engineer
          role and re-enforced by the backend on every request.
        </p>
        {SECTIONS.map((section) => (
          <section key={section.title} className="mb-8 last:mb-0">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              {section.title}
            </h2>
            <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
              {section.tools.map((tool) => (
                <Link key={tool.href} href={tool.href} className="group block">
                  <Card className="h-full p-5 transition-colors group-hover:border-brand-blue-300">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {tool.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {tool.description}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
