"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useProfileHref } from "@/hooks/useReturnTo";

/**
 * A `next/link` into a profile that carries the current page as `?from=` (#937),
 * so the profile's Back button returns here with the same filters, sort and
 * page. A drop-in for `<Link href="/alumni/42">` — usable from server
 * components, since it reads the URL on the client.
 */
export function ProfileLink({
  href,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const profileHref = useProfileHref();
  return <Link href={profileHref(href)} {...rest} />;
}
