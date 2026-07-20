/**
 * MOCK re-survey campaign data for the by-class console on the Needs Surveying
 * tab. There is no backend for survey campaigns, so these hand-built numbers
 * stand in for what an API would return. They are internally consistent:
 *
 *   responses ≤ recipients ≤ totalAlumni
 *   round1.responses = round1.recipients − noReply.length   (round 1 non-responders)
 *   round2.recipients = noReply.length                      (follow-up targets)
 *   noChangeCount + changeRecords.length ≤ (round1 + round2 responses)
 *
 * Every `ProposedChange.fieldKey` is a real `SURVEY_FIELDS` key (see
 * `src/types/survey.ts`) and its `label` mirrors that field's label. Names and
 * emails are fabricated.
 */

import type { ClassCampaign } from "@/types/surveyCampaign";

export const SAMPLE_CAMPAIGNS: ClassCampaign[] = [
  {
    gradYear: 2024,
    totalAlumni: 246,
    round1: { sentDate: "2026-03-03", recipients: 221, responses: 209 },
    round2: { sentDate: "2026-04-14", recipients: 12, responses: 5 },
    nextSendDate: "2027-03-02",
    noReply: [
      { alumniId: 24001, name: "Ethan Caldwell", email: "ethan.caldwell@gmail.com" },
      { alumniId: 24002, name: "Maya Thompson", email: "maya.thompson@outlook.com" },
      { alumniId: 24003, name: "Derek Nguyen", email: "derek.nguyen@gmail.com" },
      { alumniId: 24004, name: "Sofia Ramirez", email: "sofia.ramirez@yahoo.com" },
      { alumniId: 24005, name: "Aaron Patel", email: "aaron.patel@gmail.com" },
      { alumniId: 24006, name: "Chloe Bennett", email: "chloe.bennett@gmail.com" },
      { alumniId: 24007, name: "Marcus Lee", email: "marcus.lee@icloud.com" },
      { alumniId: 24008, name: "Priya Shah", email: "priya.shah@gmail.com" },
      { alumniId: 24009, name: "Tyler Brooks", email: "tyler.brooks@gmail.com" },
      { alumniId: 24010, name: "Hannah Foster", email: "hannah.foster@gmail.com" },
      { alumniId: 24011, name: "Diego Morales", email: "diego.morales@gmail.com" },
      { alumniId: 24012, name: "Grace Kim", email: "grace.kim@gmail.com" },
    ],
    noChangeCount: 208,
    changeRecords: [
      {
        alumniId: 24101,
        name: "Jordan Avery",
        changes: [
          { fieldKey: "contact.personal_email", label: "Personal email", before: "jordan.a@byu.edu", after: "jordan.avery@gmail.com" },
          { fieldKey: "employment.current_title", label: "Current title", before: "Analyst", after: "Associate" },
        ],
      },
      {
        alumniId: 24102,
        name: "Emily Carter",
        changes: [
          { fieldKey: "employment.current_employer", label: "Current employer", before: "Goldman Sachs", after: "Morgan Stanley" },
          { fieldKey: "employment.current_industry", label: "Industry", before: "Investment Banking", after: "Wealth Management" },
        ],
      },
      {
        alumniId: 24103,
        name: "Ryan Mitchell",
        changes: [
          { fieldKey: "contact.phone", label: "Phone", before: "(801) 555-0142", after: "(212) 555-0839" },
          { fieldKey: "program.mentor_willing", label: "Willing to mentor students", before: "No", after: "Yes" },
        ],
      },
      {
        alumniId: 24104,
        name: "Olivia Reed",
        changes: [
          { fieldKey: "contact.city", label: "City", before: "Provo", after: "Denver" },
          { fieldKey: "contact.state", label: "State", before: "UT", after: "CO" },
        ],
      },
      {
        alumniId: 24105,
        name: "Nathan Cole",
        changes: [
          { fieldKey: "employment.current_title", label: "Current title", before: "Analyst", after: "Senior Analyst" },
          { fieldKey: "employment.seniority_level", label: "Seniority level", before: "Analyst", after: "Senior Analyst" },
        ],
      },
      {
        alumniId: 24106,
        name: "Ava Sullivan",
        changes: [
          { fieldKey: "profile.linkedin_url", label: "LinkedIn URL", before: "linkedin.com/in/ava-s", after: "linkedin.com/in/ava-sullivan-cfa" },
          { fieldKey: "program.piff_donor", label: "Pay It Forward donor", before: "No", after: "Yes" },
        ],
      },
    ],
    submitted: false,
  },
  {
    gradYear: 2023,
    totalAlumni: 231,
    round1: { sentDate: "2026-03-03", recipients: 210, responses: 201 },
    round2: { sentDate: "2026-04-14", recipients: 9, responses: 3 },
    nextSendDate: "2027-03-02",
    noReply: [
      { alumniId: 23001, name: "Lucas Ward", email: "lucas.ward@gmail.com" },
      { alumniId: 23002, name: "Emma Sullivan", email: "emma.sullivan@outlook.com" },
      { alumniId: 23003, name: "Jared Kim", email: "jared.kim@gmail.com" },
      { alumniId: 23004, name: "Natalie Cruz", email: "natalie.cruz@yahoo.com" },
      { alumniId: 23005, name: "Owen Bailey", email: "owen.bailey@gmail.com" },
      { alumniId: 23006, name: "Mia Rivera", email: "mia.rivera@icloud.com" },
      { alumniId: 23007, name: "Caleb Turner", email: "caleb.turner@gmail.com" },
      { alumniId: 23008, name: "Sydney Ross", email: "sydney.ross@gmail.com" },
      { alumniId: 23009, name: "Isaac Hill", email: "isaac.hill@gmail.com" },
    ],
    noChangeCount: 199,
    changeRecords: [
      {
        alumniId: 23101,
        name: "Brandon Hayes",
        changes: [
          { fieldKey: "employment.current_employer", label: "Current employer", before: "PwC", after: "Deloitte" },
          { fieldKey: "employment.current_title", label: "Current title", before: "Audit Associate", after: "Audit Senior" },
        ],
      },
      {
        alumniId: 23102,
        name: "Natalie Wong",
        changes: [
          { fieldKey: "contact.personal_email", label: "Personal email", before: "natalie.w@byu.edu", after: "natalie.wong@gmail.com" },
        ],
      },
      {
        alumniId: 23103,
        name: "Kevin Alvarez",
        changes: [
          { fieldKey: "employment.current_industry", label: "Industry", before: "Commercial Banking", after: "Investment Banking" },
          { fieldKey: "employment.seniority_level", label: "Seniority level", before: "Analyst", after: "Associate" },
        ],
      },
      {
        alumniId: 23104,
        name: "Rachel Green",
        changes: [
          { fieldKey: "program.guest_speaker_willing", label: "Willing to be a guest speaker", before: "No", after: "Yes" },
        ],
      },
      {
        alumniId: 23105,
        name: "Sam Porter",
        changes: [
          { fieldKey: "contact.city", label: "City", before: "Salt Lake City", after: "Austin" },
          { fieldKey: "contact.state", label: "State", before: "UT", after: "TX" },
          { fieldKey: "contact.phone", label: "Phone", before: "(801) 555-0117", after: "(512) 555-0431" },
        ],
      },
    ],
    submitted: false,
  },
  {
    gradYear: 2022,
    totalAlumni: 208,
    round1: { sentDate: "2026-03-04", recipients: 188, responses: 178 },
    round2: { sentDate: null, recipients: 10, responses: 0 },
    nextSendDate: "2027-03-03",
    noReply: [
      { alumniId: 22001, name: "Vanessa Long", email: "vanessa.long@gmail.com" },
      { alumniId: 22002, name: "Kyle Mercer", email: "kyle.mercer@outlook.com" },
      { alumniId: 22003, name: "Bianca Rossi", email: "bianca.rossi@gmail.com" },
      { alumniId: 22004, name: "Trevor Dixon", email: "trevor.dixon@yahoo.com" },
      { alumniId: 22005, name: "Amber Wells", email: "amber.wells@gmail.com" },
      { alumniId: 22006, name: "Sean Fletcher", email: "sean.fletcher@icloud.com" },
      { alumniId: 22007, name: "Jasmine Patel", email: "jasmine.patel@gmail.com" },
      { alumniId: 22008, name: "Cole Bennett", email: "cole.bennett@gmail.com" },
      { alumniId: 22009, name: "Erica Vaughn", email: "erica.vaughn@gmail.com" },
      { alumniId: 22010, name: "Noah Barrett", email: "noah.barrett@gmail.com" },
    ],
    noChangeCount: 173,
    changeRecords: [
      {
        alumniId: 22101,
        name: "Lauren Brooks",
        changes: [
          { fieldKey: "employment.current_employer", label: "Current employer", before: "Fidelity", after: "BlackRock" },
          { fieldKey: "employment.current_title", label: "Current title", before: "Associate", after: "Vice President" },
        ],
      },
      {
        alumniId: 22102,
        name: "Cody Reynolds",
        changes: [
          { fieldKey: "profile.linkedin_url", label: "LinkedIn URL", before: "linkedin.com/in/cody-r", after: "linkedin.com/in/cody-reynolds-cfa" },
          { fieldKey: "program.mentor_willing", label: "Willing to mentor students", before: "No", after: "Yes" },
        ],
      },
      {
        alumniId: 22103,
        name: "Bethany Clark",
        changes: [
          { fieldKey: "contact.work_email", label: "Work email", before: "bclark@wellsfargo.com", after: "bethany.clark@jpmorgan.com" },
          { fieldKey: "employment.current_employer", label: "Current employer", before: "Wells Fargo", after: "JPMorgan Chase" },
        ],
      },
      {
        alumniId: 22104,
        name: "Isaac Turner",
        changes: [
          { fieldKey: "employment.current_industry", label: "Industry", before: "Consulting", after: "Private Equity" },
        ],
      },
      {
        alumniId: 22105,
        name: "Megan Foster",
        changes: [
          { fieldKey: "contact.phone", label: "Phone", before: "(801) 555-0288", after: "(646) 555-0173" },
          { fieldKey: "contact.city", label: "City", before: "Provo", after: "New York" },
        ],
      },
    ],
    submitted: false,
  },
  {
    gradYear: 2021,
    totalAlumni: 196,
    round1: { sentDate: "2026-03-04", recipients: 176, responses: 168 },
    round2: { sentDate: "2026-04-15", recipients: 8, responses: 4 },
    nextSendDate: "2027-03-03",
    noReply: [
      { alumniId: 21001, name: "Gabriela Santos", email: "gabriela.santos@gmail.com" },
      { alumniId: 21002, name: "Wesley Todd", email: "wesley.todd@outlook.com" },
      { alumniId: 21003, name: "Kayla Nash", email: "kayla.nash@gmail.com" },
      { alumniId: 21004, name: "Brett Coleman", email: "brett.coleman@yahoo.com" },
      { alumniId: 21005, name: "Lindsey Park", email: "lindsey.park@gmail.com" },
      { alumniId: 21006, name: "Omar Haddad", email: "omar.haddad@icloud.com" },
      { alumniId: 21007, name: "Chelsea Wu", email: "chelsea.wu@gmail.com" },
      { alumniId: 21008, name: "Dominic Ray", email: "dominic.ray@gmail.com" },
    ],
    noChangeCount: 168,
    changeRecords: [
      {
        alumniId: 21101,
        name: "Trevor Hansen",
        changes: [
          { fieldKey: "employment.current_title", label: "Current title", before: "Senior Analyst", after: "Manager" },
          { fieldKey: "employment.seniority_level", label: "Seniority level", before: "Senior", after: "Manager" },
        ],
      },
      {
        alumniId: 21102,
        name: "Alyssa Reed",
        changes: [
          { fieldKey: "program.piff_donor", label: "Pay It Forward donor", before: "No", after: "Yes" },
        ],
      },
      {
        alumniId: 21103,
        name: "Jordan Blake",
        changes: [
          { fieldKey: "employment.current_employer", label: "Current employer", before: "KPMG", after: "EY" },
          { fieldKey: "contact.city", label: "City", before: "Chicago", after: "Dallas" },
          { fieldKey: "contact.state", label: "State", before: "IL", after: "TX" },
        ],
      },
      {
        alumniId: 21104,
        name: "Cameron Wells",
        changes: [
          { fieldKey: "contact.personal_email", label: "Personal email", before: "cam.wells@gmail.com", after: "cameron.wells@outlook.com" },
        ],
      },
    ],
    submitted: false,
  },
  {
    gradYear: 2020,
    totalAlumni: 184,
    round1: { sentDate: "2026-03-05", recipients: 161, responses: 150 },
    round2: { sentDate: null, recipients: 11, responses: 0 },
    nextSendDate: "2027-03-04",
    noReply: [
      { alumniId: 20001, name: "Felix Grant", email: "felix.grant@gmail.com" },
      { alumniId: 20002, name: "Renee Baldwin", email: "renee.baldwin@outlook.com" },
      { alumniId: 20003, name: "Tobias Frank", email: "tobias.frank@gmail.com" },
      { alumniId: 20004, name: "Melanie Ortiz", email: "melanie.ortiz@yahoo.com" },
      { alumniId: 20005, name: "Spencer Hoyt", email: "spencer.hoyt@gmail.com" },
      { alumniId: 20006, name: "Carla Jimenez", email: "carla.jimenez@icloud.com" },
      { alumniId: 20007, name: "Preston Vance", email: "preston.vance@gmail.com" },
      { alumniId: 20008, name: "Naomi Blackwell", email: "naomi.blackwell@gmail.com" },
      { alumniId: 20009, name: "Hunter Deveraux", email: "hunter.deveraux@gmail.com" },
      { alumniId: 20010, name: "Yasmin Farah", email: "yasmin.farah@gmail.com" },
      { alumniId: 20011, name: "Colton Reeves", email: "colton.reeves@gmail.com" },
    ],
    noChangeCount: 146,
    changeRecords: [
      {
        alumniId: 20101,
        name: "Dylan Marsh",
        changes: [
          { fieldKey: "employment.current_employer", label: "Current employer", before: "American Express", after: "Capital One" },
          { fieldKey: "employment.current_title", label: "Current title", before: "Manager", after: "Senior Manager" },
        ],
      },
      {
        alumniId: 20102,
        name: "Sierra Nguyen",
        changes: [
          { fieldKey: "program.mentor_willing", label: "Willing to mentor students", before: "No", after: "Yes" },
          { fieldKey: "program.guest_speaker_willing", label: "Willing to be a guest speaker", before: "No", after: "Yes" },
        ],
      },
      {
        alumniId: 20103,
        name: "Blake Ferguson",
        changes: [
          { fieldKey: "employment.current_industry", label: "Industry", before: "Corporate Finance", after: "Venture Capital" },
        ],
      },
      {
        alumniId: 20104,
        name: "Paige Sanders",
        changes: [
          { fieldKey: "contact.city", label: "City", before: "Lehi", after: "Seattle" },
          { fieldKey: "contact.state", label: "State", before: "UT", after: "WA" },
        ],
      },
    ],
    submitted: false,
  },
  {
    gradYear: 2019,
    totalAlumni: 172,
    round1: { sentDate: "2026-03-05", recipients: 149, responses: 142 },
    round2: { sentDate: "2026-04-16", recipients: 7, responses: 2 },
    nextSendDate: "2027-03-04",
    noReply: [
      { alumniId: 19001, name: "Adrian Beck", email: "adrian.beck@gmail.com" },
      { alumniId: 19002, name: "Whitney Sloan", email: "whitney.sloan@outlook.com" },
      { alumniId: 19003, name: "Marcus Delgado", email: "marcus.delgado@gmail.com" },
      { alumniId: 19004, name: "Tessa Lindqvist", email: "tessa.lindqvist@yahoo.com" },
      { alumniId: 19005, name: "Reid Callahan", email: "reid.callahan@gmail.com" },
      { alumniId: 19006, name: "Simone Archer", email: "simone.archer@icloud.com" },
      { alumniId: 19007, name: "Devon Pratt", email: "devon.pratt@gmail.com" },
    ],
    noChangeCount: 141,
    changeRecords: [
      {
        alumniId: 19101,
        name: "Garrett Lowe",
        changes: [
          { fieldKey: "employment.current_title", label: "Current title", before: "Vice President", after: "Director" },
          { fieldKey: "employment.seniority_level", label: "Seniority level", before: "VP", after: "Director" },
        ],
      },
      {
        alumniId: 19102,
        name: "Monica Reyes",
        changes: [
          { fieldKey: "contact.personal_email", label: "Personal email", before: "monica.reyes@byu.edu", after: "monica.reyes@gmail.com" },
          { fieldKey: "contact.phone", label: "Phone", before: "(801) 555-0912", after: "(415) 555-0688" },
        ],
      },
      {
        alumniId: 19103,
        name: "Austin Cole",
        changes: [
          { fieldKey: "program.piff_donor", label: "Pay It Forward donor", before: "No", after: "Yes" },
        ],
      },
    ],
    submitted: false,
  },
];

/**
 * Total surveys sent across all classes and rounds — the sum of every round's
 * `recipients` where the round has actually gone out (`sentDate` is set). Seeds
 * the console's live "surveys sent" counter, which then increments as staff send
 * follow-ups in the prototype.
 */
export function initialSentCount(campaigns: ClassCampaign[]): number {
  return campaigns.reduce((total, c) => {
    const r1 = c.round1.sentDate ? c.round1.recipients : 0;
    const r2 = c.round2.sentDate ? c.round2.recipients : 0;
    return total + r1 + r2;
  }, 0);
}
