import { describe, expect, it } from "vitest";

import { parseAlumniQuery } from "./alumniQueryParser";

/**
 * The dashboard search bar's natural-language parser.
 *
 * Written for #585: Tanya typed "Find me all alumni in Gilbert, Arizona" and got
 * nothing back. City and state were mutually exclusive and the state won, so the
 * single most natural way to write a location — "<City>, <State>" — collapsed to
 * the whole state and the city was silently dropped. There was no suite over this
 * module at the time, which is why it shipped; these tables are the regression
 * net, and they cover every phrasing the module docstring promises.
 *
 * The parser emits a deep-link, so each case is asserted as the set of facets it
 * produced — parameter ORDER is not part of the contract, the facets are.
 */

const THIS_YEAR = new Date().getFullYear();

/** Every filter a phrase produced, order-independent. */
function facets(query: string): Record<string, string> {
  const [path, search = ""] = parseAlumniQuery(query).split("?");
  expect(path).toBe("/alumni");
  return Object.fromEntries(new URLSearchParams(search));
}

type Case = [query: string, expected: Record<string, string>];

function table(cases: Case[]): void {
  it.each(cases)("%s", (query, expected) => {
    expect(facets(query)).toEqual(expected);
  });
}

describe('"<City>, <State>" sets BOTH facets (#585)', () => {
  table([
    // The reported query, verbatim. Before the fix: `?state=AZ` — every alum in
    // Arizona, i.e. none.
    ["Find me all alumni in Gilbert, Arizona", { city: "Gilbert", state: "AZ" }],
    // The comma is a strong enough signal to need no preposition at all.
    ["Gilbert, Arizona", { city: "Gilbert", state: "AZ" }],
    ["Gilbert, AZ", { city: "Gilbert", state: "AZ" }],
    ["provo, ut", { city: "Provo", state: "UT" }],
    // Not one query — every "<City>, <State>" collapsed the same way.
    ["Provo, Utah", { city: "Provo", state: "UT" }],
    ["Mesa, Arizona", { city: "Mesa", state: "AZ" }],
    ["Dallas, Texas", { city: "Dallas", state: "TX" }],
    // Multi-word cities, including ones whose name contains a state name.
    ["Salt Lake City, UT", { city: "Salt Lake City", state: "UT" }],
    ["alumni in Salt Lake City, Utah", { city: "Salt Lake City", state: "UT" }],
    ["alumni in Kansas City, Missouri", { city: "Kansas City", state: "MO" }],
    ["alumni in New Orleans, Louisiana", { city: "New Orleans", state: "LA" }],
    ["alumni in New York, New York", { city: "New York", state: "NY" }],
    ["alumni in St. George, Utah", { city: "St. George", state: "UT" }],
    ["alumni in Washington, DC", { city: "Washington", state: "DC" }],
    // Other prepositions reach the same place.
    ["alumni from Chicago, Illinois", { city: "Chicago", state: "IL" }],
    ["list all alumni based in Austin, Texas", { city: "Austin", state: "TX" }],
  ]);

  it("keeps city and state independent, not either/or", () => {
    // The actual defect: a matched state must not suppress the city.
    const both = facets("Find me all alumni in Gilbert, Arizona");
    expect(both.city).toBe("Gilbert");
    expect(both.state).toBe("AZ");
  });

  it("still narrows to the city when the state is written without a comma", () => {
    expect(facets("alumni in Gilbert Arizona")).toEqual({ city: "Gilbert", state: "AZ" });
  });
});

describe("state on its own", () => {
  table([
    ["alumni in Arizona", { state: "AZ" }],
    ["alumni in New York", { state: "NY" }],
    ["alumni in North Carolina", { state: "NC" }],
    ["alumni in New Mexico", { state: "NM" }],
    // A state name that CONTAINS another state name must win — longest first.
    ["alumni in West Virginia", { state: "WV" }],
    ["alumni in Virginia", { state: "VA" }],
    ["alumni in Washington DC", { state: "DC" }],
    ["alumni in Washington", { state: "WA" }],
  ]);

  it("never invents a city from a state-only phrase", () => {
    // Dropping the `!params.has("state")` guard must not leave the preposition,
    // or a fragment of the state, behind as a bogus city.
    for (const q of ["alumni in Arizona", "alumni in New York", "alumni in Utah"]) {
      expect(facets(q).city).toBeUndefined();
    }
  });
});

describe("city on its own", () => {
  table([
    ["alumni in Gilbert", { city: "Gilbert" }],
    ["alumni from Provo", { city: "Provo" }],
    ["based in Provo", { city: "Provo" }],
    ["alumni living in Gilbert", { city: "Gilbert" }],
    ["alumni located in Gilbert", { city: "Gilbert" }],
  ]);
});

describe("fuzzy phrasings still hand off to the backend geocoder", () => {
  // Explicitly fuzzy wording is NOT a city/state lookup — it goes to `near`
  // (+ `radius`), which the backend geocodes. The comma form must not steal it:
  // "near Los Angeles, California" stays one `near` phrase.
  table([
    ["within 50 miles of Seattle", { near: "Seattle", radius: "50" }],
    ["within 25 mi from Provo", { near: "Provo", radius: "25" }],
    ["near Los Angeles, California", { near: "Los Angeles, California" }],
    ["around Gilbert", { near: "Gilbert" }],
    ["Bay Area", { near: "Bay Area" }],
    ["Greater Seattle area", { near: "Greater Seattle area" }],
    ["greater NYC area", { near: "greater NYC area" }],
  ]);
});

describe("industry", () => {
  table([
    ["consulting", { industry: "Consulting" }],
    ["alumni in wealth management", { industry: "Wealth Management" }],
    // Shorthand aliases.
    ["alumni in ib", { industry: "Investment Banking" }],
    ["vc alumni", { industry: "Venture Capital" }],
  ]);
});

describe("industry + location together", () => {
  table([
    // The docstring's own example. The industry is removed from the text first
    // so "work in investment banking" can't be read as a city.
    [
      "alumni near Las Vegas that work in investment banking",
      { industry: "Investment Banking", near: "Las Vegas" },
    ],
    [
      "alumni in Gilbert that work in investment banking",
      { industry: "Investment Banking", city: "Gilbert" },
    ],
    [
      "alumni in Gilbert, Arizona that work in investment banking",
      { industry: "Investment Banking", city: "Gilbert", state: "AZ" },
    ],
    [
      "people in wealth management in Provo, Utah",
      { industry: "Wealth Management", city: "Provo", state: "UT" },
    ],
    [
      "vc alumni in Menlo Park, CA",
      { industry: "Venture Capital", city: "Menlo Park", state: "CA" },
    ],
  ]);
});

describe("intents", () => {
  const recent = { ymin: String(THIS_YEAR - 5), ymax: String(THIS_YEAR) };
  table([
    ["willing to mentor", { mentor: "1" }],
    ["mentors in Texas", { state: "TX", mentor: "1" }],
    ["recent grads", recent],
    ["alumni who graduated in the last 5 years", recent],
    ["recent grads in private equity", { industry: "Private Equity", ...recent }],
    [
      "someone in Boise, Idaho who is willing to mentor",
      { city: "Boise", state: "ID", mentor: "1" },
    ],
  ]);
});

describe("filler words never leak into the city", () => {
  table([
    // The lead-in is not part of the place: not "me all alumni in Gilbert",
    // not "all", not "the".
    ["Find me all alumni in Gilbert", { city: "Gilbert" }],
    ["show me people in mesa, az", { city: "Mesa", state: "AZ" }],
    ["who is in Provo", { city: "Provo" }],
    ["list all alumni based in Gilbert", { city: "Gilbert" }],
    // Nothing city-like survives → the state alone, rather than a junk filter
    // that returns an empty page.
    ["alumni in, Utah", { state: "UT" }],
    ["alumni in a really long place name here, Utah", { state: "UT" }],
  ]);

  it("rejects a captured phrase that is only filler", () => {
    for (const q of ["alumni in the", "alumni in that", "alumni in people"]) {
      expect(facets(q).city).toBeUndefined();
    }
  });
});

describe("falls back to a plain search", () => {
  table([
    // A bare name is the other thing people type — it must not be mistaken for
    // a place, and must not come back structured.
    ["Jake Gunnell", { q: "Jake Gunnell" }],
    ["Gunnell, Jake", { q: "Gunnell, Jake" }],
    ["Provo", { q: "Provo" }],
    ["alumni", { q: "alumni" }],
    ["Goldman Sachs", { q: "Goldman Sachs" }],
  ]);

  it("returns the bare list for an empty query", () => {
    expect(parseAlumniQuery("")).toBe("/alumni");
    expect(parseAlumniQuery("   ")).toBe("/alumni");
  });
});
