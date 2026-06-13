/** Mirrors the backend geography endpoints (fa-web-api app/services/geography.py). */

export interface StateCount {
  state: string;
  state_name: string;
  alumni_count: number;
}

export interface GeoSummary {
  total_alumni: number;
  states_represented: number;
  cities_represented: number;
  top_employer: { employer: string; count: number } | null;
  top_employers: { employer: string; count: number }[];
  top_industries: { industry: string; count: number }[];
  top_cities: { city: string; state: string; count: number }[];
  largest_hub: { city: string; state: string; count: number } | null;
  options: {
    employers: string[];
    cities: string[];
    industries: string[];
    graduation_years: number[];
    regions: string[];
    tags: string[];
  };
}

export interface StateDetail {
  state: string;
  state_name: string;
  alumni_count: number;
  cities: { city: string; count: number }[];
  employers: { employer: string; count: number }[];
  industries: { industry: string; count: number }[];
  by_graduation_year: { year: number; count: number }[];
}

export interface GeoAlumniRow {
  alumni_id: number;
  name: string;
  city: string | null;
  graduation_year: number | null;
  current_employer: string | null;
  current_title: string | null;
}

export interface GeoAlumniPage {
  items: GeoAlumniRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface Breakdown {
  dimension: string;
  title: string;
  items: {
    key: string;
    label: string;
    sublabel: string | null;
    count: number;
  }[];
}

export interface CityDetail {
  state: string;
  state_name: string;
  city: string;
  alumni_count: number;
  employers: { employer: string; count: number }[];
  industries: { industry: string; count: number }[];
  by_graduation_year: { year: number; count: number }[];
  alumni: {
    alumni_id: number;
    name: string;
    graduation_year: number | null;
    current_employer: string | null;
  }[];
}
