import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The new-people survey page is a Client Component, which cannot export
 * metadata, so the noindex lives here (api#661 round 2). The link is a shared
 * secret: a copy pasted somewhere public must not end up in a search index.
 * The proxy also sends `X-Robots-Tag: noindex, nofollow` for all of `/survey/*`;
 * this is the in-page `<meta>` the security review asked for as well.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NewPeopleSurveyLayout({ children }: { children: ReactNode }) {
  return children;
}
