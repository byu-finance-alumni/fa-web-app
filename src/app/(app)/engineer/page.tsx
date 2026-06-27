import Link from "next/link";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";

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
      "See the app the way a given role sees it — navigation and access — without leaving your own account. Read-only.",
  },
  {
    href: "/engineer/vocabulary",
    title: "Vocabulary",
    description:
      "Add, rename, or hide the controlled-vocabulary options that populate the app's dropdowns.",
  },
  {
    href: "/engineer/logins",
    title: "Logins",
    description:
      "Every sign-in with its captured location, newest first — the security history behind each account.",
  },
  {
    href: "/engineer/support-contacts",
    title: "Support contacts",
    description:
      "Manage the support contacts shown to users on the in-app error screen.",
  },
];

export default function EngineerConsolePage() {
  return (
    <>
      <Topbar title="Engineer Console" />
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-6 max-w-2xl text-sm text-gray-500">
          Engineer-only tools. Everything here is restricted to the engineer
          role and re-enforced by the backend on every request.
        </p>
        <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="group block">
              <Card className="h-full p-5 transition-colors group-hover:border-brand-blue-300">
                <h2 className="text-sm font-semibold text-gray-900">
                  {tool.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{tool.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
