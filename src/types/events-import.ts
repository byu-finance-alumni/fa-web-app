/**
 * Types for the events bulk CSV import (#149, #156). These mirror the dict
 * payloads returned by the backend events import endpoints (which return plain
 * dicts, not response-model'd schemas, so they don't appear in api.gen.ts). Keep
 * in sync with fa-web-api/app/services/import_events.py.
 *
 * Model (#149): one CSV = one event's attendee list. The event's identity is
 * entered in the wizard and posted alongside the file; the CSV is just the
 * roster (Net ID + Name).
 */

export interface EventImportAttendee {
  row: number;
  net_id: string;
  name: string;
  /** Free-text Notes column, persisted onto the attendance row (#252). */
  notes: string | null;
  matched: boolean;
  alumni_id: number | null;
}

export interface EventImportIssue {
  code: string;
  message: string;
}

export interface EventImportEcho {
  event_name: string;
  event_date: string | null;
  event_type: string | null;
  event_location: string | null;
  event_notes: string | null;
}

export interface EventImportPreview {
  columns_ok: boolean;
  header_errors: string[];
  event: EventImportEcho;
  /** True when the event identity is valid and new — unmatched attendees don't
   *  block it (they're skipped and reported). */
  importable: boolean;
  event_errors: EventImportIssue[];
  summary: {
    total_rows: number;
    attendees_matched: number;
    attendees_unmatched: number;
  };
  attendees: EventImportAttendee[];
  warnings: EventImportIssue[];
}

export interface EventImportResult {
  imported: boolean;
  event_id: number | null;
  imported_attendees: number;
  unmatched: { row: number; net_id: string; name: string }[];
  event_error: string | null;
}
