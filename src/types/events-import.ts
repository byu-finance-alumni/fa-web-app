/**
 * Types for the events bulk CSV import (#156). These mirror the dict payloads
 * returned by the backend events import endpoints (which return plain dicts, not
 * response-model'd schemas, so they don't appear in api.gen.ts). Keep in sync
 * with fa-web-api/app/services/import_events.py.
 */

export interface EventImportAttendee {
  row: number;
  net_id: string;
  name: string;
  matched: boolean;
  alumni_id: number | null;
}

export interface EventImportIssue {
  code: string;
  message: string;
}

export interface EventImportGroup {
  event_title: string;
  event_date: string | null;
  status: "importable" | "rejected";
  attendee_count: number;
  attendees: EventImportAttendee[];
  blockers: EventImportIssue[];
  warnings: EventImportIssue[];
}

export interface EventImportPreview {
  columns_ok: boolean;
  header_errors: string[];
  summary: {
    total_rows: number;
    events: number;
    importable_events: number;
    rejected_events: number;
    attendees_matched: number;
    attendees_unmatched: number;
  };
  events: EventImportGroup[];
}

export interface EventImportResult {
  imported_events: number;
  imported_attendees: number;
  skipped_events: number;
  rejects: { event: string; date: string | null; reason: string }[];
}
