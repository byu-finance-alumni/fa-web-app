/**
 * The white wordmark that rides on the Marriott photo — "BYU" in bold followed
 * by a lighter descriptor, at the top bar's type scale.
 *
 * Extracted from `TopNav` (#756) so the app bar and the public survey shell
 * share one type treatment instead of two copies that drift. It renders TEXT
 * ONLY and is deliberately not a link: `TopNav` wraps it in a `Link` to
 * `/dashboard`, and the survey — which strangers open with no session — leaves
 * it inert, because every route in this app other than `/survey/*` bounces an
 * unauthenticated visitor to the login page.
 *
 * `text-xl sm:text-2xl` resolves to 24px everywhere the app bar renders (it is
 * `md:` and up), and steps down only on the phone widths the public survey has
 * to survive on.
 */
export function BrandWordmark({
  lead = "BYU",
  trail,
}: {
  /** The bold first word. Defaults to "BYU"; there is no reason to change it. */
  lead?: string;
  /** The lighter descriptor after it — "Alumni Database", "Finance Alumni Update". */
  trail: string;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
        {lead}
      </span>
      <span className="ml-2 text-xl font-normal text-white sm:text-2xl">
        {trail}
      </span>
    </span>
  );
}
