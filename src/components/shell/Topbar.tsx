import { SignOutButton } from "@/components/auth/SignOutButton";

export function Topbar({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-300 bg-white px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      {/* Center zone — equal 1fr columns either side keep it truly centered */}
      <div className="flex items-center justify-center">{children}</div>
      <div className="flex items-center justify-end gap-3">
        <SignOutButton />
      </div>
    </header>
  );
}
