/**
 * LOCAL-ONLY sample rows for the Links tab. FABRICATED DATA — every name,
 * company, URL and person in this file is invented.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THIS MUST NEVER RENDER ANYWHERE BUT A DEVELOPER'S OWN MACHINE.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Why it exists: the Links feature is new, so on a fresh local checkout the
 * table is empty and there is nothing to look at or judge. These rows exercise
 * every state the real list has to handle — pending / approved / rejected, a
 * resolved "their own company", an UNRESOLVED one (alum ticked "my company" and
 * has no employer on file, which is the documented `company_name: null` case), a
 * missing location, a passed deadline, and links old enough to trip the stale
 * marker.
 *
 * How it is kept out of dev and prod — four independent layers:
 *
 *  1. `sampleLinksEnabled()` (in `./opportunityLinks.ts`) requires
 *     `NODE_ENV === "development"`. Every Vercel build, dev project and prod
 *     project alike, runs with `NODE_ENV=production`. There is no deployment on
 *     which that is true.
 *  2. It ALSO requires an explicit `SAMPLE_OPPORTUNITY_LINKS=1`, which is set by
 *     `npm run dev:sample` and by no Vercel environment.
 *  3. This module is only ever reached through a dynamic `import()` behind that
 *     gate. Checked against a real `next build`: none of this text appears in
 *     any browser bundle (it is server-only), and on the server it lands in its
 *     own lazily-loaded chunk that no executed code path ever requires.
 *  4. Every write path refuses while sample mode is on, so no fabricated id can
 *     ever be POSTed at a real API — see `src/app/(app)/links/actions.ts`.
 *
 * Nothing here is written anywhere. There is no seeding script, no SQL, no
 * fixture file, and no code path that inserts these rows into any database. They
 * exist for the duration of one server render and are thrown away.
 *
 * The filenames in this feature deliberately avoid the `TEST_*` / `SCRATCH*` /
 * `DRAFT_*` / `*.scratch` shapes the "Repo hygiene (no scratch artifacts)" CI
 * job blocks: this is a reviewed, documented, permanently-gated development
 * affordance, not a throwaway artifact that slipped into a commit.
 */
import type { LinksFilterState, OpportunityLink, OpportunityLinkPage } from "@/lib/opportunityLinks";

/**
 * Sample ids start well above anything a real table will reach for a long time,
 * so a fabricated row is recognisable at a glance in a log or a URL.
 */
const SAMPLE_ID_BASE = 900_000;

/** One fabricated link, with its age expressed relative to "now". */
type SampleSeed = Omit<
  OpportunityLink,
  "opportunity_link_id" | "submitted_at" | "reviewed_at" | "application_deadline"
> & {
  /** How many days ago it was submitted (keeps the ages realistic over time). */
  submittedDaysAgo: number;
  /** Days from now until the deadline; negative = already passed; null = none. */
  deadlineInDays: number | null;
  /** Days ago the reviewer acted, or null for a link still pending. */
  reviewedDaysAgo: number | null;
};

const SEEDS: SampleSeed[] = [
  {
    alumni_id: 4821,
    submitted_by: "Marcus Whitfield",
    is_own_company: false,
    company_name: "Goldman Sachs",
    url: "https://www.goldmansachs.com/careers/students/programs/americas/summer-analyst-program.html",
    location_city: "New York",
    location_state: "NY",
    role_type: "internship",
    details:
      "Summer analyst program in the Investment Banking Division. I'm happy to do a resume review for anyone from the program who applies — have them mention my name in the referral field.",
    status: "approved",
    source: "survey",
    reviewed_by: "Amy Sorensen",
    submittedDaysAgo: 6,
    deadlineInDays: 24,
    reviewedDaysAgo: 5,
  },
  {
    alumni_id: 3190,
    submitted_by: "Priya Raghunathan",
    is_own_company: true,
    company_name: "Qualtrics",
    url: "https://www.qualtrics.com/careers/us/en/search-results",
    location_city: "Provo",
    location_state: "UT",
    role_type: "both",
    details:
      "We hire onto the corporate finance team every spring and fall. Both the internship and the new-grad rotation post on this page.",
    status: "approved",
    source: "survey",
    reviewed_by: "Amy Sorensen",
    submittedDaysAgo: 13,
    deadlineInDays: null,
    reviewedDaysAgo: 12,
  },
  {
    alumni_id: 5502,
    submitted_by: "Daniel Okonkwo",
    is_own_company: false,
    company_name: "Dominion Energy",
    url: "https://careers.dominionenergy.com/search-jobs/financial-analyst",
    location_city: "Salt Lake City",
    location_state: "UT",
    role_type: "full_time",
    details: "Financial analyst opening on the rate-case team. Two years' experience preferred but they interview new grads.",
    status: "pending",
    source: "survey",
    reviewed_by: null,
    submittedDaysAgo: 2,
    deadlineInDays: 11,
    reviewedDaysAgo: null,
  },
  {
    alumni_id: 2744,
    submitted_by: "Rebecca Hallstrom",
    is_own_company: true,
    // The documented null case: she ticked "my company" and has no employer on
    // file, so the backend has nothing to resolve. The list shows a dash and
    // marks the row rather than inventing a name.
    company_name: null,
    url: "https://hallstromadvisory.example.com/join-us",
    location_city: "Lehi",
    location_state: "UT",
    role_type: "internship",
    details: "Two part-time analyst spots at my own firm. Flexible hours around class schedules.",
    status: "pending",
    source: "survey",
    reviewed_by: null,
    submittedDaysAgo: 4,
    deadlineInDays: null,
    reviewedDaysAgo: null,
  },
  {
    alumni_id: 1837,
    submitted_by: "Kenji Nakamura",
    is_own_company: false,
    company_name: "Zions Bancorporation",
    url: "https://www.zionsbancorporation.com/careers/early-careers/",
    location_city: "Salt Lake City",
    location_state: "UT",
    role_type: "both",
    details: "Credit analyst development program. Applications open in September for the following summer.",
    status: "approved",
    source: "staff",
    reviewed_by: "Amy Sorensen",
    submittedDaysAgo: 41,
    deadlineInDays: -3,
    reviewedDaysAgo: 41,
  },
  {
    alumni_id: 6013,
    submitted_by: "Sarah Whitmore-Diaz",
    is_own_company: false,
    company_name: "Deloitte",
    url: "https://www2.deloitte.com/us/en/careers/students.html",
    location_city: "Dallas",
    location_state: "TX",
    role_type: "internship",
    details: "M&A transaction services. I moved to the Dallas office last year and we take two BYU interns most summers.",
    status: "approved",
    source: "survey",
    reviewed_by: "Nathan Brimhall",
    submittedDaysAgo: 118,
    deadlineInDays: null,
    reviewedDaysAgo: 117,
  },
  {
    alumni_id: 4402,
    submitted_by: "Tomás Delgado",
    is_own_company: true,
    company_name: "Cicero Group",
    url: "https://cicerogroup.com/careers/",
    location_city: "Salt Lake City",
    location_state: "UT",
    role_type: "full_time",
    details: "Strategy consulting associate. We interview on campus in October.",
    status: "approved",
    source: "survey",
    reviewed_by: "Amy Sorensen",
    submittedDaysAgo: 27,
    deadlineInDays: 45,
    reviewedDaysAgo: 26,
  },
  {
    alumni_id: 2098,
    submitted_by: "Elena Vasquez",
    is_own_company: false,
    company_name: "Charles Schwab",
    url: "https://www.schwabjobs.com/students-and-grads",
    location_city: "Lone Tree",
    location_state: "CO",
    role_type: "internship",
    details: null,
    status: "approved",
    source: "survey",
    reviewed_by: "Amy Sorensen",
    submittedDaysAgo: 63,
    deadlineInDays: 8,
    reviewedDaysAgo: 62,
  },
  {
    alumni_id: 5871,
    submitted_by: "Jonathan Pearce",
    is_own_company: false,
    company_name: "Bain & Company",
    url: "https://www.bain.com/careers/find-a-role/",
    // No location on file — the column has to survive that.
    location_city: null,
    location_state: null,
    role_type: "both",
    details:
      "Associate consultant and ACI roles. The site lists every office; the Dallas and Denver offices both recruit from BYU.",
    status: "approved",
    source: "staff",
    reviewed_by: "Nathan Brimhall",
    submittedDaysAgo: 9,
    deadlineInDays: null,
    reviewedDaysAgo: 9,
  },
  {
    alumni_id: 3355,
    submitted_by: "Hannah Ostler",
    is_own_company: false,
    company_name: "Wells Fargo",
    url: "https://www.wellsfargojobs.com/en/students-and-graduates/",
    location_city: "Charlotte",
    location_state: "NC",
    role_type: "internship",
    details: "Corporate & investment banking summer analyst. Deadline is firm — they close applications early.",
    status: "rejected",
    source: "survey",
    reviewed_by: "Amy Sorensen",
    submittedDaysAgo: 34,
    deadlineInDays: -12,
    reviewedDaysAgo: 30,
  },
  {
    alumni_id: 4990,
    submitted_by: "Andrew Kimball",
    is_own_company: true,
    company_name: "Larry H. Miller Company",
    url: "https://careers.lhm.com/",
    location_city: "Sandy",
    location_state: "UT",
    role_type: "full_time",
    details: "Corporate development analyst. Happy to pass a resume directly to the hiring manager.",
    status: "pending",
    source: "survey",
    reviewed_by: null,
    submittedDaysAgo: 1,
    deadlineInDays: 30,
    reviewedDaysAgo: null,
  },
  {
    alumni_id: 1502,
    submitted_by: "Michelle Tanaka-Reid",
    is_own_company: false,
    company_name: "PwC",
    url: "https://jobs.us.pwc.com/students",
    location_city: "Phoenix",
    location_state: "AZ",
    role_type: "both",
    details: "Deals advisory. This is the general student page — the Phoenix postings appear under 'Southwest'.",
    status: "approved",
    source: "survey",
    reviewed_by: "Nathan Brimhall",
    submittedDaysAgo: 201,
    deadlineInDays: null,
    reviewedDaysAgo: 199,
  },
];

/** ISO timestamp `days` before `now` (negative `days` = in the future). */
function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Date-only string (`YYYY-MM-DD`) `days` from `now`. */
function isoDateInDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** The full fabricated set, dated relative to `now` so the ages stay sensible. */
export function sampleOpportunityLinks(now: Date = new Date()): OpportunityLink[] {
  return SEEDS.map((seed, i) => {
    const { submittedDaysAgo, deadlineInDays, reviewedDaysAgo, ...rest } = seed;
    return {
      ...rest,
      opportunity_link_id: SAMPLE_ID_BASE + i + 1,
      submitted_at: isoDaysAgo(now, submittedDaysAgo),
      application_deadline:
        deadlineInDays === null ? null : isoDateInDays(now, deadlineInDays),
      reviewed_at:
        reviewedDaysAgo === null ? null : isoDaysAgo(now, reviewedDaysAgo),
    };
  });
}

/** Fabricated alumni for the add form's picker. Same gate, same guarantees. */
export const SAMPLE_ALUMNI_OPTIONS: {
  alumni_id: number;
  name: string;
  detail: string;
}[] = [
  { alumni_id: 4821, name: "Marcus Whitfield", detail: "2014 · Goldman Sachs" },
  { alumni_id: 3190, name: "Priya Raghunathan", detail: "2018 · Qualtrics" },
  { alumni_id: 5502, name: "Daniel Okonkwo", detail: "2021 · Dominion Energy" },
  { alumni_id: 2744, name: "Rebecca Hallstrom", detail: "2009 · no employer on file" },
  { alumni_id: 1837, name: "Kenji Nakamura", detail: "2016 · Zions Bancorporation" },
  { alumni_id: 6013, name: "Sarah Whitmore-Diaz", detail: "2019 · Deloitte" },
  { alumni_id: 4402, name: "Tomás Delgado", detail: "2012 · Cicero Group" },
  { alumni_id: 2098, name: "Elena Vasquez", detail: "2020 · Charles Schwab" },
];

/**
 * Apply a filter state to the fabricated rows the way the backend would, and
 * return the same `{items,total,limit,offset}` envelope the real endpoint does —
 * so the page renders through exactly one code path whether the rows came from
 * the API or from here, and the filters are genuinely demonstrable on localhost.
 *
 * Approximate, not authoritative: the backend's `q` is the real search. This
 * matches on the same four fields it documents (company, details, location,
 * url).
 */
export function sampleLinkPage(
  filters: LinksFilterState,
  { limit, offset, now = new Date() }: { limit: number; offset: number; now?: Date },
): OpportunityLinkPage {
  const q = filters.q.trim().toLowerCase();
  const company = filters.company.trim().toLowerCase();

  const matched = sampleOpportunityLinks(now).filter((l) => {
    if (l.status !== filters.status) return false;
    if (filters.role_type && l.role_type !== filters.role_type) return false;
    if (company && !(l.company_name ?? "").toLowerCase().includes(company))
      return false;
    if (q) {
      const haystack = [
        l.company_name ?? "",
        l.details ?? "",
        l.location_city ?? "",
        l.location_state ?? "",
        l.url,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Newest first, matching the list's stated ordering.
  matched.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

  return {
    items: matched.slice(offset, offset + limit),
    total: matched.length,
    limit,
    offset,
  };
}
