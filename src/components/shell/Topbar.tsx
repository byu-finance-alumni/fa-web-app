import { SignOutButton } from "@/components/auth/SignOutButton";

export function Topbar({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-300 bg-white px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        {children}
        <SignOutButton />
      </div>
    </header>
  );
}
