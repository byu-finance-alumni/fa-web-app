/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Regenerate with:  npm run gen:api-types
 * Source schema:    <API>/openapi.json
 *
 * Types are derived from the fa-web-api FastAPI OpenAPI schema. CI regenerates
 * this file from the served schema and fails on drift, so it always reflects
 * the deployed backend contract. See scripts/gen-api-types.mjs.
 *
 * (eslint ignores this path; see eslint.config.mjs.)
 */

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health
         * @description Liveness check — confirms the API process is up.
         */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/db": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health Db
         * @description Readiness check — verifies a live database connection (SELECT 1).
         */
        get: operations["health_db_health_db_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Me
         * @description Return the authenticated user's verified identity.
         *
         *     Requires a valid Supabase access token in the `Authorization: Bearer`
         *     header.
         */
        get: operations["me_auth_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Context
         * @description Return the signed-in user resolved against the database, with roles.
         *
         *     Used by the frontend for role-aware UI. Returns 403 if the authenticated
         *     user isn't provisioned (no active `users` row). ``must_change_password``
         *     reflects the current user's force-change flag.
         *
         *     EXEMPT from the force-password-change gate: a flagged user must be able to
         *     read their own context (to learn they're flagged) — so this depends on the
         *     exempt resolver, not the gated ``get_current_db_user``.
         */
        get: operations["context_auth_context_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record Login
         * @description Record a successful sign-in for the AUTHENTICATED caller.
         *
         *     Logins happen client-side via Supabase, so the backend has no native login
         *     hook — the frontend calls this exactly once, right after a successful
         *     password sign-in, with the freshly-issued token. It does two things:
         *
         *       1. Stamps ``users.last_login_at`` = now (the column existed but nothing
         *          ever wrote it, so it was always NULL).
         *       2. Inserts a ``login_events`` row (the security log backing the engineer
         *          "Logins" tab; email is snapshotted so the history survives the user's
         *          later deletion).
         *
         *     Uses the force-password-change-EXEMPT resolver: a user on an admin-issued
         *     temp password has still genuinely signed in, so their login must be recorded
         *     even before they clear the flag. Takes no body and keys only on the token's
         *     own identity, so a caller can only ever record their OWN login.
         *
         *     Best-effort by contract: the frontend never blocks the post-login redirect
         *     on this call. It is deliberately NOT written to ``audit_logs`` — sign-in
         *     events are a security log, not the record-change audit trail.
         */
        post: operations["record_login_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Password Complete
         * @description Clear the force-password-change flag for the AUTHENTICATED caller.
         *
         *     EXEMPT from the force-password-change gate (it depends on the exempt
         *     resolver): this is the very endpoint a flagged user calls to clear the flag,
         *     so it must remain reachable while ``must_change_password`` is true.
         *
         *     Called by the frontend AFTER the user has set a new password via their own
         *     Supabase session (the actual password change happens client-side). This
         *     endpoint only flips ``users.must_change_password`` to false, and ONLY for
         *     the token's own user — it takes no id and so can never clear anyone else's
         *     flag. Any role may call it (it is a self-service action, not an admin one).
         *
         *     Idempotent: a caller whose flag is already false simply gets a 200 and no
         *     audit row is written.
         */
        post: operations["password_complete_auth_password_complete_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login/precheck": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login Precheck
         * @description Return whether a login for this email may proceed right now (read-only).
         *
         *     Unauthenticated. The frontend calls this before attempting the Supabase
         *     sign-in and refuses to attempt it when ``allowed`` is false, collapsing both
         *     throttle reasons into one generic message.
         */
        post: operations["login_precheck_auth_login_precheck_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login/record": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login Record
         * @description Record a login attempt outcome and return the resulting throttle status.
         *
         *     Unauthenticated. Only FAILURES are accumulated here: a failure may trip the
         *     cooldown and (for a registered email) the hard lock. A ``success=true`` from
         *     this unauthenticated caller is deliberately IGNORED — it must NOT clear the
         *     rolling counter, because an attacker could otherwise POST ``{email,
         *     success:true}`` to wipe a legitimately-set cooldown and brute-force
         *     unbounded. The genuine success-clear happens on the AUTHENTICATED path
         *     (``get_current_db_user``), which only a real, signed-in user can reach.
         *
         *     The ``locked`` flag the service returns is intentionally NOT echoed to the
         *     client (anti-enumeration); only the coarse ``reason`` is.
         */
        post: operations["login_record_auth_login_record_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Alumni */
        get: operations["list_alumni_alumni_get"];
        put?: never;
        /** Create Alumni */
        post: operations["create_alumni_alumni_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/filter-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Alumni Filter Options
         * @description Distinct option lists for the advanced-filter panel's multi-selects.
         *
         *     Declared before the ``/{alumni_id}`` routes so the literal path always wins
         *     (``alumni_id`` is int-typed, so a non-numeric segment can't match it anyway).
         */
        get: operations["alumni_filter_options_alumni_filter_options_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/import/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Alumni Import Template
         * @description Download the bulk-import CSV template: the exact Alumni columns plus one
         *     example row (full_access). Same column source as the xlsx intake template.
         */
        get: operations["alumni_import_template_alumni_import_template_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/import/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Import Alumni
         * @description Dry-run a bulk CSV import (full_access, NO writes).
         *
         *     Parses + maps the uploaded CSV against the Alumni template columns, then
         *     evaluates every row (clean + duplicate-detect against the DB and earlier
         *     rows in the file + completeness warnings). Returns the full preview report;
         *     a bad header set surfaces as ``columns_ok: false`` with ``header_errors``.
         */
        post: operations["preview_import_alumni_alumni_import_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import Alumni
         * @description Commit a bulk CSV import (full_access). Re-evaluates and inserts every
         *     importable row in one transaction (audit logging fires per row); rejected
         *     rows are skipped and reported. A bad header set imports nothing.
         */
        post: operations["import_alumni_alumni_import_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Alumni
         * @description Single lightweight alumni core record.
         *
         *     Archived records 404 (they were removed from the directory). view_only
         *     ("Professor") callers receive a FERPA-minimized record — sensitive PII,
         *     notes, and import provenance are nulled. This lightweight read is not
         *     audit-logged (the full profile aggregate is).
         */
        get: operations["get_alumni_alumni__alumni_id__get"];
        put?: never;
        post?: never;
        /**
         * Archive Alumni
         * @description Soft-delete (archive) an alumni record.
         */
        delete: operations["archive_alumni_alumni__alumni_id__delete"];
        options?: never;
        head?: never;
        /** Update Alumni */
        patch: operations["update_alumni_alumni__alumni_id__patch"];
        trace?: never;
    };
    "/alumni/{alumni_id}/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Alumni Profile
         * @description Full profile aggregate (core + contact, career, employment, leadership,
         *     engagement, surveys, interactions, tasks, attachments, audit) for the tabs.
         *
         *     Archived records 404. Follow-up tasks are edit-only: view_only ("Professor")
         *     users get an empty ``tasks`` list AND a FERPA-minimized aggregate (sensitive
         *     PII nulled, free-text notes and audit trail stripped) — enforced here, not
         *     just hidden in the UI. Anyone with edit access — engineer / super_admin /
         *     full_access / student — sees all. The disclosure is audit-logged
         *     (``view_profile``).
         */
        get: operations["get_alumni_profile_alumni__alumni_id__profile_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Alumni Profile
         * @description Server-side, audited profile export (full_access).
         *
         *     Returns the full profile aggregate as a MINIMIZED JSON body: the embedded
         *     ``audit`` trail is excluded and internal user PKs (interaction ``user_id``,
         *     task ``assigned_to_user_id``) are never present. Writes an ``export_profile``
         *     audit row before returning. Archived records 404. The frontend calls this
         *     instead of doing a client-side export.
         */
        get: operations["export_alumni_profile_alumni__alumni_id__export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/interactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Interaction
         * @description Log an interaction on an alumni's timeline (full_access).
         */
        post: operations["add_interaction_alumni__alumni_id__interactions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Task
         * @description Create a follow-up task for an alumni (full_access).
         */
        post: operations["add_task_alumni__alumni_id__tasks_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/tasks/{task_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update Task Completion
         * @description Toggle a follow-up task's completion state (full_access).
         */
        patch: operations["update_task_completion_alumni__alumni_id__tasks__task_id__patch"];
        trace?: never;
    };
    "/alumni/{alumni_id}/employment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Employment
         * @description Add a prior role to an alumni's employment history (full_access).
         */
        post: operations["add_employment_alumni__alumni_id__employment_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/employment/{employment_history_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Employment
         * @description Delete a prior role from an alumni's employment history (full_access). 404
         *     if the row is missing or belongs to another alumnus.
         */
        delete: operations["delete_employment_alumni__alumni_id__employment__employment_history_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Employment
         * @description Edit a prior role on an alumni's employment history (full_access). 404 if
         *     the row is missing or belongs to another alumnus.
         */
        patch: operations["update_employment_alumni__alumni_id__employment__employment_history_id__patch"];
        trace?: never;
    };
    "/alumni/{alumni_id}/education": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Education
         * @description Add an education entry to an alumni's record (full_access).
         */
        post: operations["add_education_alumni__alumni_id__education_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/education/{education_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Education
         * @description Delete an education entry from an alumni's record (full_access). 404 if the
         *     row is missing or belongs to another alumnus.
         */
        delete: operations["delete_education_alumni__alumni_id__education__education_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Education
         * @description Edit an education entry on an alumni's record (full_access). 404 if the
         *     row is missing or belongs to another alumnus.
         */
        patch: operations["update_education_alumni__alumni_id__education__education_id__patch"];
        trace?: never;
    };
    "/alumni/{alumni_id}/leadership": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Leadership
         * @description Add a Finance Society leadership entry to an alumni (full_access).
         */
        post: operations["add_leadership_alumni__alumni_id__leadership_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/leadership/{finance_society_leadership_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Leadership
         * @description Delete a Finance Society leadership entry (full_access). 404 if the row is
         *     missing or belongs to another alumnus.
         */
        delete: operations["delete_leadership_alumni__alumni_id__leadership__finance_society_leadership_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Leadership
         * @description Edit a Finance Society leadership entry (full_access). 404 if the row is
         *     missing or belongs to another alumnus.
         */
        patch: operations["update_leadership_alumni__alumni_id__leadership__finance_society_leadership_id__patch"];
        trace?: never;
    };
    "/alumni/{alumni_id}/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Tag
         * @description Attach a canonical engagement tag to an alumni (full_access). Returns the
         *     resulting tag list. Idempotent.
         */
        post: operations["add_tag_alumni__alumni_id__tags_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/tags/{tag}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove Tag
         * @description Detach a tag from an alumni (full_access). Returns the resulting tag list.
         *     404 if the alumni doesn't have that tag.
         */
        delete: operations["remove_tag_alumni__alumni_id__tags__tag__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/status-labels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Status Label
         * @description Attach a canonical status label to an alumni (full_access). Returns the
         *     resulting label list. Idempotent.
         */
        post: operations["add_status_label_alumni__alumni_id__status_labels_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/status-labels/{label}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove Status Label
         * @description Detach a status label from an alumni (full_access). Returns the resulting
         *     label list. 404 if the alumni doesn't have that label.
         */
        delete: operations["remove_status_label_alumni__alumni_id__status_labels__label__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Event Attendance
         * @description Mark an alumni as an attendee of an existing event (full_access). 404 if
         *     the event/alumni is unknown; 409 if attendance already exists.
         */
        post: operations["add_event_attendance_alumni__alumni_id__events_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Create Alumni
         * @description Dry-run data-hygiene preview for a NEW alumni (full_access, no writes).
         *
         *     Returns ``{cleaned, changes, warnings, blockers}`` — the cleaned (normalized)
         *     payload, the per-field changes cleaning would make, soft warnings (completeness
         *     + fuzzy possible-duplicates), and exact-duplicate blockers (a non-empty list
         *     means the real POST would 409). The preview reads stored data, so it is
         *     audit-logged (``preview``).
         */
        post: operations["preview_create_alumni_alumni_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Update Alumni
         * @description Dry-run data-hygiene preview for an EDIT (full_access, no writes).
         *
         *     Loads the current record (404 if missing/archived) and computes the preview
         *     against the EFFECTIVE record (the cleaned partial overlaid on the stored
         *     values) so duplicate + completeness checks reflect the resulting state. The
         *     preview reads stored data, so it is audit-logged (``preview``).
         */
        post: operations["preview_update_alumni_alumni__alumni_id__preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restore Alumni
         * @description Restore (unarchive) a previously archived alumni record.
         */
        post: operations["restore_alumni_alumni__alumni_id__restore_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Summary
         * @description KPIs, distributions (cohort / top employers / by state), and recent
         *     activity for the dashboard.
         */
        get: operations["summary_dashboard_summary_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/birthdays": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Birthdays
         * @description Active alumni whose birthday falls in the current calendar month, ordered
         *     by day-of-month ascending (earliest in the month first). Each row carries
         *     the alumnus's current/most-recent employer via the same correlated scalar
         *     subquery the alumni list uses, so the value matches that view exactly.
         *
         *     Filters on the month component of ``birth_date`` (the year is irrelevant for
         *     a recurring birthday). Aggregation/derivation happens in PostgreSQL.
         *
         *     FERPA: the full date of birth (incl. year) is sensitive PII and is NOT needed
         *     to wish someone a happy birthday — so this view-only endpoint returns only the
         *     recurring month+day (``birth_month`` / ``birth_day``), never the birth year,
         *     so view_only users can't harvest full DOBs. The disclosure is audited.
         *
         *     Returns, e.g.
         *     [{"id": 7, "first_name": "Jane", "last_name": "Doe",
         *       "current_employer": "Goldman Sachs", "graduation_year": 2019,
         *       "birth_month": 6, "birth_day": 3}, ...].
         */
        get: operations["birthdays_dashboard_birthdays_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/event-participation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Event Participation
         * @description Per-event participation for the ~last 12 months (past/current events —
         *     these are what have "participation"). One row per event with its attendee
         *     count, aggregated in PostgreSQL (LEFT JOIN so an event with 0 attendees
         *     still appears), ordered chronologically and capped at 10 so it fits the
         *     dashboard panel.
         *
         *     Returns oldest→newest, e.g.
         *     [{"event_id": 12, "event_name": "Spring Mixer", "event_type": "Networking",
         *       "event_date": "2026-05-29", "participant_count": 34}, ...].
         */
        get: operations["event_participation_dashboard_event_participation_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Activity Feed
         * @description Paginated all-time interaction feed (newest first) — the full version
         *     of the dashboard's old recent-activity panel, now on its own page. Supports
         *     optional server-side filtering by free-text search, interaction type, and an
         *     inclusive date range; all filtering happens in PostgreSQL.
         *
         *     FERPA: this is a searchable feed of individual-alumni CRM interactions, so it
         *     is gated to full_access (view_only gets 403) and the search/disclosure is
         *     audited (actor + that a search happened, never the returned rows).
         */
        get: operations["activity_feed_dashboard_activity_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/data-quality": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Data Quality
         * @description The data-quality alert counts (same predicates as the summary KPIs),
         *     for the dedicated data-quality page.
         *
         *     Full-access only (matches the sidebar gate): view_only users get 403, like
         *     the cross-alumni Tasks list.
         */
        get: operations["data_quality_dashboard_data_quality_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/contacted-this-month": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Contacted This Month List
         * @description The alumni behind the "Contacted this month" KPI — one row per distinct
         *     alumnus contacted in the last 30 days, carrying their most recent
         *     interaction in the window (DISTINCT ON matches the KPI's distinct count).
         *
         *     FERPA: exposes individual alumni + CRM interaction data, so it is gated to
         *     full_access (view_only gets 403) and the disclosure is audited; only the
         *     aggregate count KPI on /summary stays view-accessible.
         */
        get: operations["contacted_this_month_list_dashboard_contacted_this_month_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/follow-ups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Upcoming Follow Ups List
         * @description The open tasks behind the "Upcoming follow-ups" KPI (incomplete, due
         *     today or later), soonest due first — same predicate as the KPI count.
         *
         *     FERPA: exposes individual alumni + their assigned follow-up tasks, so it is
         *     gated to full_access (view_only gets 403) and the disclosure is audited; only
         *     the aggregate count KPI on /summary stays view-accessible.
         */
        get: operations["upcoming_follow_ups_list_dashboard_follow_ups_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Users
         * @description List provisioned users with their assigned roles (paginated).
         *
         *     Paginated (default 50, hard cap 200 — mirrors the audit endpoint) so a single
         *     request can't enumerate the entire user directory at once, and each call is
         *     audited (``list_users``) so reads of the user list leave a forensic trail.
         *     The ``total`` count lets the UI page through. The access itself is recorded
         *     (actor + applied limit/offset); the returned rows are NOT logged.
         */
        get: operations["list_users_admin_users_get"];
        put?: never;
        /**
         * Create User
         * @description Provision a brand-new login user. super_admin only.
         *
         *     Flow:
         *       1. Reject up front if a ``users`` row with that email already exists. The
         *          message is generic (anti-enumeration, consistent with the rest of the
         *          codebase) — a 409 either way.
         *       2. Generate a CSPRNG temp password and create the Supabase *auth* user over
         *          the Admin API (server-side, service-role key, ``email_confirm=True`` so
         *          the user can sign in immediately). A transport/non-2xx failure raises
         *          ServiceError (502) WITHOUT leaking the upstream response, and BEFORE we
         *          touch our DB — so a failed provision never leaves an orphaned row.
         *       3. Insert the ``users`` row (linked by ``auth_user_id``) and a
         *          ``user_roles`` row for the chosen role. If this DB write fails after the
         *          auth identity was created, the auth user is deleted (compensating
         *          action) so no orphaned identity with a known temp password is left.
         *       4. Audit the action (``create_user``; actor = the super_admin, entity = the
         *          new user; ``new_value`` = email). The password is NEVER logged, audited,
         *          or returned in any channel other than this one-time response body.
         *
         *     The temp password is returned ONCE for the super_admin to hand to the user;
         *     the user should change it on next login.
         */
        post: operations["create_user_admin_users_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/logins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Logins
         * @description List recorded sign-ins, newest first (paginated). Engineer only.
         *
         *     Backs the Admin -> Logins tab. Rows come from ``login_events`` (written by
         *     POST /auth/login on each successful sign-in); the snapshotted email means a
         *     deleted user's past logins remain attributable. Paginated (default 50, hard
         *     cap 200 — mirrors the users/audit endpoints) so one request can't enumerate
         *     the whole history. Reading the log is itself audited (``read_login_log``;
         *     actor + applied limit/offset) — the returned rows are not logged.
         *
         *     Only logins WITH a captured IP are returned (so the tab is consistent — every
         *     row has IP + location). Logins recorded before IP capture, and local-dev
         *     sign-ins with no Vercel geo headers, have a null ``ip_address`` and are
         *     omitted; ``total`` reflects the filtered set so pagination stays correct.
         */
        get: operations["list_logins_admin_logins_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete User
         * @description Permanently delete a user — both the ``users`` row and the Supabase auth
         *     identity. super_admin and engineer only (engineer satisfies the guard).
         *
         *     This is the irreversible counterpart to deactivation: use PATCH
         *     ``/users/{id}`` (``active=false``) to suspend access reversibly; use this to
         *     remove the account entirely (e.g. a wrong/duplicate provision).
         *
         *     Integrity is handled by the schema's foreign keys, NOT by cascading our own
         *     deletes: ``user_roles`` is ``ON DELETE CASCADE`` (role grants are removed
         *     with the user), and every other reference — audit logs, interactions, tasks,
         *     events, attachments, import batches — is ``ON DELETE SET NULL``. So the
         *     FERPA audit trail and all alumni-side history are preserved; only the actor
         *     pointer on those rows becomes null.
         *
         *     Guards (mirroring remove_role):
         *       * You cannot delete your own account.
         *       * Privilege ceiling: only an engineer may delete a user who holds the
         *         engineer role.
         *       * Last-holder guard: you cannot delete the final holder of a top role
         *         (super_admin / engineer), which would lock administration out for
         *         everyone.
         *
         *     Order of operations: the DB row (plus a ``delete_user`` audit entry,
         *     attributed to the actor and recording the deleted user's email) is committed
         *     FIRST, then the Supabase auth identity is best-effort deleted. If that last
         *     step fails the account is already gone from the app (the auth layer requires
         *     a matching ``users`` row), so we log the orphaned auth UUID for manual
         *     reconciliation rather than failing the request.
         */
        delete: operations["delete_user_admin_users__user_id__delete"];
        options?: never;
        head?: never;
        /**
         * Set User Active
         * @description Deactivate or reactivate an existing user. super_admin only.
         *
         *     Deactivation is the REVERSIBLE way to remove access: once ``active`` is false
         *     the auth dependency rejects every authenticated request from that user, but
         *     the row/roles/history are kept and access can be restored later. (Permanent
         *     removal is the separate DELETE ``/users/{id}`` endpoint.) A super_admin cannot
         *     deactivate their own account — that could lock administration out of the
         *     system. Every change is audited; a no-op (already in the requested state) is
         *     idempotent and not re-audited.
         */
        patch: operations["set_user_active_admin_users__user_id__patch"];
        trace?: never;
    };
    "/admin/users/{user_id}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Assign Role
         * @description Grant a role to an existing user (idempotent). super_admin and up.
         *
         *     Rate-limited per actor (best-effort, in-process) to brake bulk privilege
         *     changes. Privilege ceiling: only an ``engineer`` may grant the ``engineer``
         *     role. A
         *     ``super_admin`` (who is below engineer) cannot mint an account that outranks
         *     them — that would be a privilege escalation above the actor's own ceiling.
         */
        post: operations["assign_role_admin_users__user_id__roles_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{user_id}/roles/{role_name}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove Role
         * @description Revoke a role from an existing user (idempotent). super_admin and up.
         *
         *     Privilege ceiling (symmetric with assign_role): only an ``engineer`` may
         *     remove the ``engineer`` role. A ``super_admin`` cannot demote an engineer —
         *     the engineer tier is managed exclusively by engineers.
         *
         *     Guards against an admin removing their OWN top role (super_admin or
         *     engineer), which would lock user administration (or, for engineer, vocab /
         *     database administration) out of the system if they were the last holder.
         */
        delete: operations["remove_role_admin_users__user_id__roles__role_name__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{user_id}/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reset Password
         * @description Set a strong one-time temporary password on a user. super_admin only.
         *
         *     Flow:
         *       1. Load the target user and resolve its Supabase auth identity
         *          (``users.auth_user_id``).
         *       2. Generate a CSPRNG temp password and set it on the Supabase auth user via
         *          the Admin API (server-side, service-role key). A non-2xx / transport
         *          failure raises ServiceError (502) WITHOUT leaking the upstream response.
         *       3. On success, clear any hard lock (``locked_at`` / ``locked_reason``) and
         *          delete the rolling ``login_attempts`` row for that email, so the user can
         *          log in again immediately.
         *       4. Audit the action (``reset_password``; actor = the super_admin, entity =
         *          target user). The password is NEVER logged, audited, or returned in any
         *          channel other than this one-time response body.
         *
         *     The temp password is returned ONCE in the response for the super_admin to
         *     hand to the user; the user should change it on next login.
         */
        post: operations["reset_password_admin_users__user_id__reset_password_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{user_id}/name": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update User Name
         * @description Edit a user's first/last name. super_admin only.
         *
         *     Only fields present in the body are applied (``exclude_unset``); each field
         *     that actually changes is audited separately (``update_user``; ``field_name``
         *     = ``first_name``/``last_name``; old + new value). A no-op (same value, or no
         *     fields sent) is idempotent and not audited. 404 if the user doesn't exist.
         */
        patch: operations["update_user_name_admin_users__user_id__name_patch"];
        trace?: never;
    };
    "/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Events */
        get: operations["list_events_events_get"];
        put?: never;
        /**
         * Create Event
         * @description Create an event (full_access). Stamps the acting user and audits the
         *     write (entity_type "event", action "create").
         */
        post: operations["create_event_events_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Event Options
         * @description Distinct, sorted, non-null event types for the filter menu (view access).
         */
        get: operations["event_options_events_options_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{event_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Event */
        get: operations["get_event_events__event_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update Event
         * @description Partially update an event (full_access). Only the fields present in the
         *     request body are applied; each changed field is audited with its old/new
         *     value (entity_type "event", action "update"). 404 if the event is unknown.
         */
        patch: operations["update_event_events__event_id__patch"];
        trace?: never;
    };
    "/events/{event_id}/attendees": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Event Attendees
         * @description Alumni who attended an event (view-access read). 404 if the event is
         *     unknown so callers can distinguish "no attendees" from "no such event".
         */
        get: operations["list_event_attendees_events__event_id__attendees_get"];
        put?: never;
        /**
         * Add Event Attendee
         * @description Add an alumni to an event's attendance (full_access). 404 if the event or
         *     alumni is unknown; 409 if the (event, alumni) pair already exists. Audits the
         *     write (entity_type "event", action "add_attendee", entity_id event_id,
         *     new_value the alumni id/name).
         *
         *     Note: this is the event-roster management surface and stays ``full_access``
         *     on purpose. Recording attendance from an alumnus's PROFILE
         *     (``POST /alumni/{id}/events``) is profile data-entry and is intentionally
         *     open to ``student`` via ``RequireAlumniEdit`` — a deliberate split, not an
         *     oversight. Students manage attendance per-alumnus, not from the event roster.
         */
        post: operations["add_event_attendee_events__event_id__attendees_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{event_id}/attendees/{alumni_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove Event Attendee
         * @description Remove an alumni from an event's attendance (full_access). 404 if no such
         *     attendance row exists. Audits the write (entity_type "event", action
         *     "remove_attendee", entity_id event_id, old_value the alumni id).
         */
        delete: operations["remove_event_attendee_events__event_id__attendees__alumni_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Audit
         * @description Most recent audit events, newest first, with optional server-side
         *     filtering by action type, entity type, acting-user email, and date range.
         *     Paginated (offset + total) so forensic review can reach past the first
         *     page — without it, events older than one page were invisible and could be
         *     buried by flooding the log. All filtering happens in PostgreSQL.
         */
        get: operations["list_audit_audit_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/audit/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Audit Options
         * @description Distinct, sorted, non-null action and entity types for the filter menu
         *     (super admin only — the audit trail's old/new values can contain alumni
         *     PII). Two small queries against ``audit_logs`` — the backend still accepts
         *     any value, so the toolbar always offers an "Any" default too.
         */
        get: operations["audit_options_audit_options_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Summary
         * @description Analytics cards + the available filter options.
         */
        get: operations["summary_geography_summary_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/states": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * States
         * @description Per-state alumni counts for the choropleth map and Top States ranking.
         */
        get: operations["states_geography_states_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/breakdown": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Breakdown
         * @description Full ranked list for a dimension (the 'View all' breakdown table).
         */
        get: operations["breakdown_geography_breakdown_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/states/{state}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * State Detail
         * @description Count + top cities / employers / industries for one state.
         */
        get: operations["state_detail_geography_states__state__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/states/{state}/alumni": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * State Alumni
         * @description Paginated, sortable alumni list for a state.
         *
         *     FERPA: this lists the individual alumni behind a state count, so it is gated
         *     to full_access (view_only gets 403) and the disclosure is audited; the
         *     aggregate state/city counts stay view-accessible.
         */
        get: operations["state_alumni_geography_states__state__alumni_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/cities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * City Detail
         * @description City drill-down: count + employer / industry / grad-year distribution
         *     AND the individual alumni in that city.
         *
         *     FERPA: the response includes the named alumni in the city, so it is gated to
         *     full_access (view_only gets 403) and the disclosure is audited; the aggregate
         *     state/city counts stay view-accessible.
         */
        get: operations["city_detail_geography_cities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Tasks
         * @description Paginated cross-alumni follow-up tasks, most urgent first by default
         *     (open before completed, then soonest due). Defaults to open tasks only; pass
         *     ``all=true`` to include completed tasks too. ``sort``, ``overdue``,
         *     ``assignee`` and ``q`` further order/filter the set.
         */
        get: operations["list_tasks_tasks_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vocabulary/{category}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Vocabulary
         * @description Active option strings for a category (dropdown payload). An unknown
         *     category is a 422 (validated against VocabularyCategory).
         */
        get: operations["get_vocabulary_vocabulary__category__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/vocabulary/{category}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Vocabulary Admin
         * @description All terms in a category, INCLUDING inactive ones, for the admin UI.
         */
        get: operations["list_vocabulary_admin_admin_vocabulary__category__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/vocabulary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Vocabulary Term
         * @description Add a term (or reactivate a previously-deactivated identical one).
         *     409 if an active term with the same value already exists in the category.
         */
        post: operations["create_vocabulary_term_admin_vocabulary_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/vocabulary/{term_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Deactivate Vocabulary Term
         * @description Soft-delete a term (active=false): hidden from new-entry dropdowns, but
         *     still valid on existing records. Idempotent.
         */
        delete: operations["deactivate_vocabulary_term_admin_vocabulary__term_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Vocabulary Term
         * @description Edit a term (rename / reorder / activate-deactivate). 404 if missing;
         *     409 if a rename collides with another term in the same category.
         */
        patch: operations["update_vocabulary_term_admin_vocabulary__term_id__patch"];
        trace?: never;
    };
    "/support-contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Support Contacts
         * @description The support contacts to show a logged-in user (ordered).
         */
        get: operations["list_support_contacts_support_contacts_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/support-contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Support Contacts Admin
         * @description Same list, behind the engineer gate, for the editor UI.
         */
        get: operations["list_support_contacts_admin_admin_support_contacts_get"];
        put?: never;
        /**
         * Create Support Contact
         * @description Add a support contact (engineer only).
         */
        post: operations["create_support_contact_admin_support_contacts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/support-contacts/{contact_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Support Contact
         * @description Remove a support contact (engineer only). 404 if missing.
         */
        delete: operations["delete_support_contact_admin_support_contacts__contact_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Support Contact
         * @description Edit a support contact (engineer only). 404 if missing.
         */
        patch: operations["update_support_contact_admin_support_contacts__contact_id__patch"];
        trace?: never;
    };
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Root
         * @description Root endpoint — basic service identification.
         */
        get: operations["root__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AdminTaskItem
         * @description A single follow-up task in the cross-alumni admin task list.
         *
         *     Reuses the ``TaskRead`` task fields, plus the owning alumnus's id and display
         *     name so the row can deep-link to the profile. ``assigned_to`` is the
         *     resolved assignee display name (None when unassigned).
         */
        AdminTaskItem: {
            /** Follow Up Task Id */
            follow_up_task_id: number;
            /** Alumni Id */
            alumni_id: number;
            /** Alumni Name */
            alumni_name: string | null;
            /** Task Title */
            task_title: string | null;
            /** Due Date */
            due_date: string | null;
            /** Completed */
            completed: boolean;
            /** Completed At */
            completed_at: string | null;
            /** Task Notes */
            task_notes: string | null;
            /** Assigned To User Id */
            assigned_to_user_id: number | null;
            /** Assigned To */
            assigned_to: string | null;
        };
        /**
         * AdminTaskPage
         * @description A page of cross-alumni follow-up tasks plus the pagination envelope.
         */
        AdminTaskPage: {
            /** Items */
            items: components["schemas"]["AdminTaskItem"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /**
         * AlumniCreateFull
         * @description Create payload: required core fields plus optional nested sections.
         *
         *     Core validation (``_require_identifier``, name/id/year/linkedin rules) is
         *     inherited unchanged from ``AlumniCreate``. The nested sections are written
         *     by the service only when they contain at least one non-empty value.
         */
        AlumniCreateFull: {
            /** Byu Id */
            byu_id: string | null;
            /** Mst Id */
            mst_id: string | null;
            /** Net Id */
            net_id: string | null;
            /** First Name */
            first_name: string | null;
            /** Middle Name */
            middle_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Preferred First Name */
            preferred_first_name: string | null;
            /** Birth Name */
            birth_name: string | null;
            /** Gender */
            gender: string | null;
            /** Birth Year */
            birth_year: number | null;
            /** Birth Date */
            birth_date: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Spouse First Name */
            spouse_first_name: string | null;
            /** Spouse Last Name */
            spouse_last_name: string | null;
            /** Spouse Birth Date */
            spouse_birth_date: string | null;
            /** Spouse Alumni Id */
            spouse_alumni_id: number | null;
            /** Deceased */
            deceased: boolean | null;
            /** Linkedin Url */
            linkedin_url: string | null;
            /** Notes */
            notes: string | null;
            contact: components["schemas"]["ContactCreate"] | null;
            career: components["schemas"]["CareerCreate"] | null;
            education: components["schemas"]["app__schemas__alumni__EducationCreate"] | null;
            engagement: components["schemas"]["EngagementCreate"] | null;
        };
        /**
         * AlumniListItem
         * @description List-row variant: adds the alumnus's current employer + industry (joined
         *     from ``current_employment``) for the alumni table. Single-record reads use
         *     plain ``AlumniRead``, which omits these.
         */
        AlumniListItem: {
            /** Alumni Id */
            alumni_id: number;
            /** Source Id */
            source_id: number | null;
            /** Byu Id */
            byu_id: string | null;
            /** Mst Id */
            mst_id: string | null;
            /** Net Id */
            net_id: string | null;
            /** First Name */
            first_name: string | null;
            /** Middle Name */
            middle_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Preferred First Name */
            preferred_first_name: string | null;
            /** Birth Name */
            birth_name: string | null;
            /** Gender */
            gender: string | null;
            /** Birth Year */
            birth_year: number | null;
            /** Birth Date */
            birth_date: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Spouse First Name */
            spouse_first_name: string | null;
            /** Spouse Last Name */
            spouse_last_name: string | null;
            /** Spouse Birth Date */
            spouse_birth_date: string | null;
            /** Spouse Alumni Id */
            spouse_alumni_id: number | null;
            /** Deceased */
            deceased: boolean;
            /** Linkedin Url */
            linkedin_url: string | null;
            /** Notes */
            notes: string | null;
            /** Archived */
            archived: boolean;
            /** Manually Edited At */
            manually_edited_at: string | null;
            /** Last Imported At */
            last_imported_at: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Current Employer */
            current_employer: string | null;
            /** Current Industry */
            current_industry: string | null;
        };
        /**
         * AlumniPage
         * @description A page of alumni plus the pagination envelope.
         */
        AlumniPage: {
            /** Items */
            items: components["schemas"]["AlumniListItem"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /** AlumniRead */
        AlumniRead: {
            /** Alumni Id */
            alumni_id: number;
            /** Source Id */
            source_id: number | null;
            /** Byu Id */
            byu_id: string | null;
            /** Mst Id */
            mst_id: string | null;
            /** Net Id */
            net_id: string | null;
            /** First Name */
            first_name: string | null;
            /** Middle Name */
            middle_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Preferred First Name */
            preferred_first_name: string | null;
            /** Birth Name */
            birth_name: string | null;
            /** Gender */
            gender: string | null;
            /** Birth Year */
            birth_year: number | null;
            /** Birth Date */
            birth_date: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Spouse First Name */
            spouse_first_name: string | null;
            /** Spouse Last Name */
            spouse_last_name: string | null;
            /** Spouse Birth Date */
            spouse_birth_date: string | null;
            /** Spouse Alumni Id */
            spouse_alumni_id: number | null;
            /** Deceased */
            deceased: boolean;
            /** Linkedin Url */
            linkedin_url: string | null;
            /** Notes */
            notes: string | null;
            /** Archived */
            archived: boolean;
            /** Manually Edited At */
            manually_edited_at: string | null;
            /** Last Imported At */
            last_imported_at: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * AlumniUpdateFull
         * @description Update payload: optional core fields plus optional nested sections.
         *
         *     Mirrors ``AlumniCreateFull`` so the edit wizard can persist every section.
         *     Core stays all-optional (inherited from ``AlumniUpdate``); each nested
         *     section is upserted by the service only when it carries a non-empty value.
         *     The same section schemas are reused, so industry validation and empty-string
         *     trimming behave identically to create.
         */
        AlumniUpdateFull: {
            /** Byu Id */
            byu_id: string | null;
            /** Mst Id */
            mst_id: string | null;
            /** Net Id */
            net_id: string | null;
            /** First Name */
            first_name: string | null;
            /** Middle Name */
            middle_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Preferred First Name */
            preferred_first_name: string | null;
            /** Birth Name */
            birth_name: string | null;
            /** Gender */
            gender: string | null;
            /** Birth Year */
            birth_year: number | null;
            /** Birth Date */
            birth_date: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Spouse First Name */
            spouse_first_name: string | null;
            /** Spouse Last Name */
            spouse_last_name: string | null;
            /** Spouse Birth Date */
            spouse_birth_date: string | null;
            /** Spouse Alumni Id */
            spouse_alumni_id: number | null;
            /** Deceased */
            deceased: boolean | null;
            /** Linkedin Url */
            linkedin_url: string | null;
            /** Notes */
            notes: string | null;
            contact: components["schemas"]["ContactCreate"] | null;
            career: components["schemas"]["CareerCreate"] | null;
            education: components["schemas"]["app__schemas__alumni__EducationCreate"] | null;
            engagement: components["schemas"]["EngagementCreate"] | null;
        };
        /** AttachmentRead */
        AttachmentRead: {
            /** Attachment Id */
            attachment_id: number;
            /** File Name */
            file_name: string;
            /** File Type */
            file_type: string | null;
            /** Attachment Notes */
            attachment_notes: string | null;
            /**
             * Uploaded At
             * Format: date-time
             */
            uploaded_at: string;
            /** Uploaded By User Id */
            uploaded_by_user_id: number | null;
        };
        /**
         * AttendeeCreate
         * @description Body for adding an attendee to an event (full_access). ``extra='forbid'``
         *     rejects unknown keys; ``alumni_id`` is required; ``attendance_status`` is an
         *     optional free-text label capped at 100 chars (blank collapses to None).
         */
        AttendeeCreate: {
            /** Alumni Id */
            alumni_id: number;
            /** Attendance Status */
            attendance_status?: string | null;
        };
        /** AuditEntryRead */
        AuditEntryRead: {
            /** Audit Log Id */
            audit_log_id: number;
            /** Action Type */
            action_type: string;
            /** Field Name */
            field_name: string | null;
            /** Old Value */
            old_value: string | null;
            /** New Value */
            new_value: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** User Id */
            user_id: number | null;
        };
        /**
         * AuthenticatedUser
         * @description Verified identity extracted from a Supabase access token.
         *
         *     `token_role` is the raw role claim from the JWT. It is informational only
         *     and must NOT drive authorization — roles are resolved from the database.
         */
        AuthenticatedUser: {
            /** Auth User Id */
            auth_user_id: string;
            /** Email */
            email: string | null;
            /** Token Role */
            token_role: string | null;
        };
        /** Body_import_alumni_alumni_import_post */
        Body_import_alumni_alumni_import_post: {
            /** File */
            file: string;
        };
        /** Body_preview_import_alumni_alumni_import_preview_post */
        Body_preview_import_alumni_alumni_import_preview_post: {
            /** File */
            file: string;
        };
        /** Breakdown */
        Breakdown: {
            /** Dimension */
            dimension: string;
            /** Title */
            title: string;
            /** Items */
            items: components["schemas"]["BreakdownItem"][];
        };
        /** BreakdownItem */
        BreakdownItem: {
            /** Key */
            key: string;
            /** Label */
            label: string;
            /** Sublabel */
            sublabel: string | null;
            /** Count */
            count: number;
        };
        /** CareerCreate */
        CareerCreate: {
            /** Current Employer */
            current_employer?: string | null;
            /** Current Title */
            current_title?: string | null;
            /** Current Industry */
            current_industry?: string | null;
            /** Current Industry Secondary */
            current_industry_secondary?: string | null;
            /** Current City */
            current_city?: string | null;
            /** Current State */
            current_state?: string | null;
            /** Current Country */
            current_country?: string | null;
            /** Current Zip */
            current_zip?: string | null;
            /** Seniority Level */
            seniority_level?: string | null;
        };
        /** CityAlumniRow */
        CityAlumniRow: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** Graduation Year */
            graduation_year: number | null;
            /** Current Employer */
            current_employer: string | null;
        };
        /** CityCount */
        CityCount: {
            /** City */
            city: string;
            /** Count */
            count: number;
        };
        /** CityDetail */
        CityDetail: {
            /** State */
            state: string;
            /** State Name */
            state_name: string;
            /** City */
            city: string;
            /** Alumni Count */
            alumni_count: number;
            /** Employers */
            employers: components["schemas"]["EmployerCount"][];
            /** Industries */
            industries: components["schemas"]["IndustryCount"][];
            /** By Graduation Year */
            by_graduation_year: components["schemas"]["YearCount"][];
            /** Alumni */
            alumni: components["schemas"]["CityAlumniRow"][];
        };
        /** ContactCreate */
        ContactCreate: {
            /** Personal Email */
            personal_email?: string | null;
            /** Work Email */
            work_email?: string | null;
            /** Phone */
            phone?: string | null;
            /** Address Line 1 */
            address_line_1?: string | null;
            /** Address Line 2 */
            address_line_2?: string | null;
            /** City */
            city?: string | null;
            /** State */
            state?: string | null;
            /** Zip */
            zip?: string | null;
            /** Country */
            country?: string | null;
            /** Region */
            region?: string | null;
        };
        /** ContactRead */
        ContactRead: {
            /** Contact Info Id */
            contact_info_id: number;
            /** Personal Email */
            personal_email: string | null;
            /** Work Email */
            work_email: string | null;
            /** Phone */
            phone: string | null;
            /** Address Line 1 */
            address_line_1: string | null;
            /** Address Line 2 */
            address_line_2: string | null;
            /** City */
            city: string | null;
            /** State */
            state: string | null;
            /** Zip */
            zip: string | null;
            /** Country */
            country: string | null;
            /** Region */
            region: string | null;
        };
        /**
         * CreateUserRequest
         * @description Provision a new login user. ``role_name`` is restricted to the
         *     non-privileged roles (full_access / student / view_only) — the top roles
         *     (engineer, super_admin) are NOT bootstrappable here — so an unknown or
         *     disallowed role is a 422 before any query runs; names follow the alumni NAME
         *     rules (≤100 chars). ``extra='forbid'`` rejects unknown keys.
         */
        CreateUserRequest: {
            /** Email */
            email: string;
            /** First Name */
            first_name?: string | null;
            /** Last Name */
            last_name?: string | null;
            /**
             * Role Name
             * @default view_only
             * @enum {string}
             */
            role_name: "full_access" | "student" | "view_only";
        };
        /**
         * CreateUserResponse
         * @description The created user plus the one-time temporary password (shown exactly once,
         *     like the reset flow). The password is NEVER persisted or audited.
         */
        CreateUserResponse: {
            /** User Id */
            user_id: number;
            /** Email */
            email: string;
            /** First Name */
            first_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Active */
            active: boolean;
            /** Roles */
            roles: string[];
            /** Temp Password */
            temp_password: string;
        };
        /** CurrentCareerRead */
        CurrentCareerRead: {
            /** Current Employment Id */
            current_employment_id: number;
            /** Current Employer */
            current_employer: string | null;
            /** Current Title */
            current_title: string | null;
            /** Current Industry */
            current_industry: string | null;
            /** Current Industry Secondary */
            current_industry_secondary: string | null;
            /** Current City */
            current_city: string | null;
            /** Current State */
            current_state: string | null;
            /** Current Country */
            current_country: string | null;
            /** Current Zip */
            current_zip: string | null;
            /** Seniority Level */
            seniority_level: string | null;
            /** Last Verified At */
            last_verified_at: string | null;
        };
        /** DBHealthResponse */
        DBHealthResponse: {
            /** Status */
            status: string;
            /** Database */
            database: string;
        };
        /**
         * DeleteUserResponse
         * @description Confirmation of a permanent user deletion (the row is gone, so there is
         *     nothing left to serialize). The deleted user's id + email are echoed back so
         *     the UI can confirm exactly which account was removed.
         */
        DeleteUserResponse: {
            /** Deleted */
            deleted: boolean;
            /** User Id */
            user_id: number;
            /** Email */
            email: string;
        };
        /** EducationRead */
        EducationRead: {
            /** Education Id */
            education_id: number;
            /** University */
            university: string | null;
            /** College */
            college: string | null;
            /** Department */
            department: string | null;
            /** Degree */
            degree: string | null;
            /** Major */
            major: string | null;
            /** Degree Status */
            degree_status: string | null;
            /** Degree Year */
            degree_year: number | null;
        };
        /**
         * EducationUpdate
         * @description Edit fields on an existing education entry (all optional, same shape).
         */
        EducationUpdate: {
            /** University */
            university?: string | null;
            /** College */
            college?: string | null;
            /** Department */
            department?: string | null;
            /** Degree */
            degree?: string | null;
            /** Major */
            major?: string | null;
            /** Degree Status */
            degree_status?: string | null;
            /** Degree Year */
            degree_year?: number | null;
        };
        /** EmployerCount */
        EmployerCount: {
            /** Employer */
            employer: string;
            /** Count */
            count: number;
        };
        /**
         * EmploymentHistoryCreate
         * @description Add a prior role to an alumnus's employment history (Employment panel).
         */
        EmploymentHistoryCreate: {
            /** Employer Name */
            employer_name: string;
            /** Employment Title */
            employment_title?: string | null;
            /** Employment Industry */
            employment_industry?: string | null;
            /** City */
            city?: string | null;
            /** State */
            state?: string | null;
            /** Start Year */
            start_year?: number | null;
            /** End Year */
            end_year?: number | null;
            /**
             * Is Current
             * @default false
             */
            is_current: boolean;
        };
        /** EmploymentHistoryRead */
        EmploymentHistoryRead: {
            /** Employment History Id */
            employment_history_id: number;
            /** Employer Name */
            employer_name: string | null;
            /** Employment Title */
            employment_title: string | null;
            /** Employment Industry */
            employment_industry: string | null;
            /** City */
            city: string | null;
            /** State */
            state: string | null;
            /** Start Year */
            start_year: number | null;
            /** End Year */
            end_year: number | null;
            /** Is Current */
            is_current: boolean;
        };
        /**
         * EmploymentHistoryUpdate
         * @description Edit fields on an existing employment-history row (all optional).
         */
        EmploymentHistoryUpdate: {
            /** Employer Name */
            employer_name?: string | null;
            /** Employment Title */
            employment_title?: string | null;
            /** Employment Industry */
            employment_industry?: string | null;
            /** City */
            city?: string | null;
            /** State */
            state?: string | null;
            /** Start Year */
            start_year?: number | null;
            /** End Year */
            end_year?: number | null;
            /** Is Current */
            is_current?: boolean | null;
        };
        /** EngagementCreate */
        EngagementCreate: {
            /**
             * Nettrek Host Willing
             * @default false
             */
            nettrek_host_willing: boolean;
            /**
             * Finance Conference Willing
             * @default false
             */
            finance_conference_willing: boolean;
            /**
             * Mentor Willing
             * @default false
             */
            mentor_willing: boolean;
            /**
             * Company Event Sponsor Willing
             * @default false
             */
            company_event_sponsor_willing: boolean;
            /**
             * Guest Speaker Willing
             * @default false
             */
            guest_speaker_willing: boolean;
            /**
             * Help At Event Willing
             * @default false
             */
            help_at_event_willing: boolean;
            /**
             * Case Competition Host Willing
             * @default false
             */
            case_competition_host_willing: boolean;
            /**
             * Women In Finance Mentor Willing
             * @default false
             */
            women_in_finance_mentor_willing: boolean;
            /**
             * Hired Finance Intern
             * @default false
             */
            hired_finance_intern: boolean;
            /**
             * Hired Finance Full Time
             * @default false
             */
            hired_finance_full_time: boolean;
            /**
             * Piff Donor
             * @default false
             */
            piff_donor: boolean;
            /**
             * Cfp Designation
             * @default false
             */
            cfp_designation: boolean;
            /**
             * Cfa Designation
             * @default false
             */
            cfa_designation: boolean;
            /** Engagement Notes */
            engagement_notes?: string | null;
        };
        /** EngagementNoteRead */
        EngagementNoteRead: {
            /** Engagement Id */
            engagement_id: number;
            /** Engagement Interest Type */
            engagement_interest_type: string | null;
            /** Engagement Notes */
            engagement_notes: string | null;
        };
        /** ErrorBody */
        ErrorBody: {
            /** Code */
            code: string;
            /** Message */
            message: string;
        };
        /**
         * ErrorResponse
         * @description Matches the project-wide error envelope.
         *
         *     {"error": {"code": "...", "message": "..."}}
         */
        ErrorResponse: {
            error: components["schemas"]["ErrorBody"];
        };
        /**
         * EventAttendanceCreate
         * @description Mark an alumnus as an attendee of an existing event.
         */
        EventAttendanceCreate: {
            /** Event Id */
            event_id: number;
            /** Attendance Status */
            attendance_status?: string | null;
        };
        /** EventAttendedRead */
        EventAttendedRead: {
            /** Event Id */
            event_id: number;
            /** Event Name */
            event_name: string;
            /** Event Type */
            event_type: string | null;
            /** Event Date */
            event_date: string | null;
            /** Event Location */
            event_location: string | null;
            /** Attendance Status */
            attendance_status: string | null;
        };
        /**
         * EventCreate
         * @description Client-editable fields for creating an event. ``extra='forbid'`` rejects
         *     unknown keys; ``event_name`` is required, non-empty, and at most 255 chars.
         *     ``event_type``/``event_location`` are capped at 255 chars and ``event_notes``
         *     at 10000 chars.
         */
        EventCreate: {
            /** Event Name */
            event_name: string;
            /** Event Type */
            event_type?: string | null;
            /** Event Date */
            event_date?: string | null;
            /** Event Location */
            event_location?: string | null;
            /** Event Notes */
            event_notes?: string | null;
        };
        /**
         * EventUpdate
         * @description Partial update of an event's client-editable fields (full_access). Every
         *     field is optional; only the keys actually sent are applied. Reuses
         *     ``EventCreate``'s validators (non-empty / length caps), but ``event_name``
         *     may be omitted — only an explicitly provided blank name is rejected.
         */
        EventUpdate: {
            /** Event Name */
            event_name?: string | null;
            /** Event Type */
            event_type?: string | null;
            /** Event Date */
            event_date?: string | null;
            /** Event Location */
            event_location?: string | null;
            /** Event Notes */
            event_notes?: string | null;
        };
        /** FilterOptions */
        FilterOptions: {
            /** Employers */
            employers: string[];
            /** Past Employers */
            past_employers: string[];
            /** Titles */
            titles: string[];
            /** Seniority Levels */
            seniority_levels: string[];
            /** Industries */
            industries: string[];
            /** Cities */
            cities: string[];
            /** States */
            states: string[];
            /** Tags */
            tags: string[];
            /** Status Labels */
            status_labels: string[];
            /** Leadership Roles */
            leadership_roles: string[];
            /** Survey Statuses */
            survey_statuses: string[];
            /** Graduation Years */
            graduation_years: number[];
        };
        /** GeoAlumniPage */
        GeoAlumniPage: {
            /** Items */
            items: components["schemas"]["GeoAlumniRow"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /** GeoAlumniRow */
        GeoAlumniRow: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** City */
            city: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Current Employer */
            current_employer: string | null;
            /** Current Title */
            current_title: string | null;
        };
        /**
         * GeoOptions
         * @description Filter-dropdown option lists (capped server-side).
         */
        GeoOptions: {
            /** Employers */
            employers: string[];
            /** Cities */
            cities: string[];
            /** Industries */
            industries: string[];
            /** Graduation Years */
            graduation_years: number[];
            /** Regions */
            regions: string[];
            /** Tags */
            tags: string[];
        };
        /** GeoSummary */
        GeoSummary: {
            /** Total Alumni */
            total_alumni: number;
            /** States Represented */
            states_represented: number;
            /** Cities Represented */
            cities_represented: number;
            top_employer: components["schemas"]["EmployerCount"] | null;
            /** Top Employers */
            top_employers: components["schemas"]["EmployerCount"][];
            /** Top Industries */
            top_industries: components["schemas"]["IndustryCount"][];
            /** Top Cities */
            top_cities: components["schemas"]["TopCity"][];
            largest_hub: components["schemas"]["TopCity"] | null;
            options: components["schemas"]["GeoOptions"];
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail: components["schemas"]["ValidationError"][];
        };
        /** HealthResponse */
        HealthResponse: {
            /** Status */
            status: string;
            /** Environment */
            environment: string;
            /** Version */
            version: string;
        };
        /** IndustryCount */
        IndustryCount: {
            /** Industry */
            industry: string;
            /** Count */
            count: number;
        };
        /**
         * InteractionCreate
         * @description Log an interaction against an alumni (Interactions tab).
         */
        InteractionCreate: {
            /** Interaction Type */
            interaction_type: string;
            /** Interaction Date Time */
            interaction_date_time?: string | null;
            /** Interaction Notes */
            interaction_notes?: string | null;
        };
        /** InteractionRead */
        InteractionRead: {
            /** Interaction Id */
            interaction_id: number;
            /** Interaction Type */
            interaction_type: string | null;
            /** Interaction Date Time */
            interaction_date_time: string | null;
            /** Interaction Notes */
            interaction_notes: string | null;
            /** Logged By */
            logged_by: string | null;
        };
        /**
         * LeadershipCreate
         * @description Add a Finance Society leadership entry to an alumnus's record.
         */
        LeadershipCreate: {
            /** Leadership Role */
            leadership_role: string;
            /** Role Year */
            role_year?: number | null;
        };
        /** LeadershipRead */
        LeadershipRead: {
            /** Finance Society Leadership Id */
            finance_society_leadership_id: number;
            /** Leadership Role */
            leadership_role: string;
            /** Role Year */
            role_year: number | null;
        };
        /**
         * LeadershipUpdate
         * @description Edit fields on an existing leadership entry (all optional).
         */
        LeadershipUpdate: {
            /** Leadership Role */
            leadership_role?: string | null;
            /** Role Year */
            role_year?: number | null;
        };
        /**
         * LoginContext
         * @description Optional client context for a sign-in, forwarded by the frontend login
         *     action from the incoming request — the client IP (``x-forwarded-for``) and
         *     Vercel's IP-geolocation headers. All optional and length-bounded; purely
         *     informational (never trusted for authorization), stored on the
         *     ``login_events`` row for the engineer Logins tab. ``extra='forbid'`` rejects
         *     unknown keys.
         */
        LoginContext: {
            /** Ip Address */
            ip_address: string | null;
            /** City */
            city: string | null;
            /** Region */
            region: string | null;
            /** Country */
            country: string | null;
        };
        /**
         * LoginEventPage
         * @description A page of login events, newest first, with the total for pagination.
         */
        LoginEventPage: {
            /** Items */
            items: components["schemas"]["LoginEventRow"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /**
         * LoginEventRow
         * @description One recorded sign-in for the engineer Logins tab. ``user_id`` is null once
         *     the user has been deleted; ``email`` is the snapshot taken at sign-in, so the
         *     row still shows who it was. ``ip_address`` + ``city``/``region``/``country``
         *     are the approximate (IP-based) origin captured at sign-in; any may be null.
         */
        LoginEventRow: {
            /** Login Event Id */
            login_event_id: number;
            /** User Id */
            user_id: number | null;
            /** Email */
            email: string;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Ip Address */
            ip_address: string | null;
            /** City */
            city: string | null;
            /** Region */
            region: string | null;
            /** Country */
            country: string | null;
        };
        /**
         * LoginPrecheckRequest
         * @description Email to evaluate the pre-login throttle/lock state for.
         */
        LoginPrecheckRequest: {
            /** Email */
            email: string;
        };
        /**
         * LoginRecordRequest
         * @description Outcome of a login attempt, to update the rolling failed-login counter.
         */
        LoginRecordRequest: {
            /** Email */
            email: string;
            /** Success */
            success: boolean;
        };
        /**
         * LoginRecordedResponse
         * @description Acknowledgement that a successful sign-in was recorded, echoing the
         *     stamped time so a client could display it.
         */
        LoginRecordedResponse: {
            /**
             * Status
             * @default ok
             */
            status: string;
            /**
             * Last Login At
             * Format: date-time
             */
            last_login_at: string;
        };
        /**
         * LoginThrottleStatus
         * @description Pre-login throttle status.
         *
         *     ``reason`` is intentionally coarse and the frontend MUST collapse
         *     ``cooldown`` and ``locked`` into ONE generic user-facing message
         *     (anti-enumeration — see app/services/login_lockout.py). ``retry_after_seconds``
         *     is set for ``cooldown`` only; ``locked`` has no self-clearing timer (a
         *     super_admin reset is required).
         */
        LoginThrottleStatus: {
            /** Allowed */
            allowed: boolean;
            /** Reason */
            reason: string;
            /** Retry After Seconds */
            retry_after_seconds: number | null;
        };
        /**
         * PasswordCompleteResponse
         * @description Acknowledgement that the caller's force-change flag was cleared.
         */
        PasswordCompleteResponse: {
            /**
             * Status
             * @default ok
             */
            status: string;
        };
        /**
         * ProfileRead
         * @description The full profile aggregate for one alumni.
         */
        ProfileRead: {
            alumni: components["schemas"]["AlumniRead"];
            /** Spouse Alumni Name */
            spouse_alumni_name: string | null;
            contact: components["schemas"]["ContactRead"] | null;
            current_career: components["schemas"]["CurrentCareerRead"] | null;
            /**
             * Employment History
             * @default []
             */
            employment_history: components["schemas"]["EmploymentHistoryRead"][];
            /**
             * Education
             * @default []
             */
            education: components["schemas"]["EducationRead"][];
            /**
             * Leadership
             * @default []
             */
            leadership: components["schemas"]["LeadershipRead"][];
            program_engagement: components["schemas"]["ProgramEngagementRead"] | null;
            /**
             * Engagement Notes
             * @default []
             */
            engagement_notes: components["schemas"]["EngagementNoteRead"][];
            /**
             * Tags
             * @default []
             */
            tags: string[];
            /**
             * Status Labels
             * @default []
             */
            status_labels: string[];
            /**
             * Surveys
             * @default []
             */
            surveys: components["schemas"]["SurveyRead"][];
            /**
             * Interactions
             * @default []
             */
            interactions: components["schemas"]["InteractionRead"][];
            /**
             * Interaction Count
             * @default 0
             */
            interaction_count: number;
            /**
             * Tasks
             * @default []
             */
            tasks: components["schemas"]["TaskRead"][];
            /**
             * Attachments
             * @default []
             */
            attachments: components["schemas"]["AttachmentRead"][];
            /**
             * Events
             * @default []
             */
            events: components["schemas"]["EventAttendedRead"][];
            /**
             * Audit
             * @default []
             */
            audit: components["schemas"]["AuditEntryRead"][];
        };
        /** ProgramEngagementRead */
        ProgramEngagementRead: {
            /** Engagement Profile Id */
            engagement_profile_id: number;
            /** Nettrek Host Willing */
            nettrek_host_willing: boolean;
            /** Finance Conference Willing */
            finance_conference_willing: boolean;
            /** Mentor Willing */
            mentor_willing: boolean;
            /** Company Event Sponsor Willing */
            company_event_sponsor_willing: boolean;
            /** Guest Speaker Willing */
            guest_speaker_willing: boolean;
            /** Help At Event Willing */
            help_at_event_willing: boolean;
            /** Case Competition Host Willing */
            case_competition_host_willing: boolean;
            /** Women In Finance Mentor Willing */
            women_in_finance_mentor_willing: boolean;
            /** Hired Finance Intern */
            hired_finance_intern: boolean;
            /** Hired Finance Full Time */
            hired_finance_full_time: boolean;
            /** Piff Donor */
            piff_donor: boolean;
            /** Cfp Designation */
            cfp_designation: boolean;
            /** Cfa Designation */
            cfa_designation: boolean;
            /** Engagement Notes */
            engagement_notes: string | null;
        };
        /**
         * ResetPasswordResponse
         * @description The one-time temporary password, shown to the super_admin exactly once.
         */
        ResetPasswordResponse: {
            /** Temp Password */
            temp_password: string;
        };
        /**
         * RoleAssign
         * @description Assign a canonical role to a user. ``role_name`` is validated against the
         *     RoleName enum, so an unknown role is a 422 before any query runs.
         */
        RoleAssign: {
            role_name: components["schemas"]["RoleName"];
        };
        /**
         * RoleName
         * @enum {string}
         */
        RoleName: "engineer" | "super_admin" | "full_access" | "student" | "view_only";
        /** StateCount */
        StateCount: {
            /** State */
            state: string;
            /** State Name */
            state_name: string;
            /** Alumni Count */
            alumni_count: number;
        };
        /** StateDetail */
        StateDetail: {
            /** State */
            state: string;
            /** State Name */
            state_name: string;
            /** Alumni Count */
            alumni_count: number;
            /** Cities */
            cities: components["schemas"]["CityCount"][];
            /** Employers */
            employers: components["schemas"]["EmployerCount"][];
            /** Industries */
            industries: components["schemas"]["IndustryCount"][];
            /** By Graduation Year */
            by_graduation_year: components["schemas"]["YearCount"][];
        };
        /**
         * StatusLabelCreate
         * @description Attach a canonical status label to an alumnus.
         */
        StatusLabelCreate: {
            /** Label */
            label: string;
        };
        /**
         * SupportContactCreate
         * @description Add a support contact (engineer only).
         */
        SupportContactCreate: {
            /** Role Label */
            role_label: string;
            /** Name */
            name: string;
            /** Email */
            email: string;
            /**
             * Sort Order
             * @default 0
             */
            sort_order: number;
        };
        /** SupportContactRead */
        SupportContactRead: {
            /** Support Contact Id */
            support_contact_id: number;
            /** Role Label */
            role_label: string;
            /** Name */
            name: string;
            /** Email */
            email: string;
            /** Sort Order */
            sort_order: number;
        };
        /**
         * SupportContactUpdate
         * @description Edit a support contact (engineer only). Only fields present are applied.
         */
        SupportContactUpdate: {
            /** Role Label */
            role_label?: string | null;
            /** Name */
            name?: string | null;
            /** Email */
            email?: string | null;
            /** Sort Order */
            sort_order?: number | null;
        };
        /** SurveyRead */
        SurveyRead: {
            /** Survey Id */
            survey_id: number;
            /** Survey Year */
            survey_year: number | null;
            /** Survey Due Date */
            survey_due_date: string | null;
            /** Completed */
            completed: boolean;
            /** Completed At */
            completed_at: string | null;
            /** Survey Status */
            survey_status: string | null;
            /** Survey Notes */
            survey_notes: string | null;
        };
        /**
         * TagCreate
         * @description Attach a canonical engagement tag to an alumnus.
         */
        TagCreate: {
            /** Tag */
            tag: string;
        };
        /**
         * TaskCompleteUpdate
         * @description Toggle a task's completion state.
         */
        TaskCompleteUpdate: {
            /** Completed */
            completed: boolean;
        };
        /**
         * TaskCreate
         * @description Create a follow-up task (Tasks tab).
         */
        TaskCreate: {
            /** Task Title */
            task_title: string;
            /** Due Date */
            due_date?: string | null;
            /** Task Notes */
            task_notes?: string | null;
        };
        /** TaskRead */
        TaskRead: {
            /** Follow Up Task Id */
            follow_up_task_id: number;
            /** Task Title */
            task_title: string | null;
            /** Due Date */
            due_date: string | null;
            /** Completed */
            completed: boolean;
            /** Completed At */
            completed_at: string | null;
            /** Task Notes */
            task_notes: string | null;
            /** Assigned To */
            assigned_to: string | null;
        };
        /** TopCity */
        TopCity: {
            /** City */
            city: string;
            /** State */
            state: string;
            /** Count */
            count: number;
        };
        /**
         * UpdateUserNameRequest
         * @description Edit a user's name. Both fields optional; same NAME rules (≤100 chars).
         *     Only keys present in the body (``exclude_unset``) are applied — so a client
         *     can clear a name by sending ``null``, or leave it untouched by omitting it.
         *     ``extra='forbid'`` rejects unknown keys (notably ``active``, which has its own
         *     endpoint).
         */
        UpdateUserNameRequest: {
            /** First Name */
            first_name?: string | null;
            /** Last Name */
            last_name?: string | null;
        };
        /**
         * UserActiveUpdate
         * @description Activate or deactivate an existing user account.
         *
         *     Deactivation is the REVERSIBLE way to remove access: it flips
         *     ``users.active`` to false, which the auth dependency layer enforces — a
         *     deactivated user is blocked (403) on every authenticated route but keeps
         *     their row, roles, and history and can be reactivated later. To remove an
         *     account permanently instead, use DELETE ``/users/{id}``.
         */
        UserActiveUpdate: {
            /** Active */
            active: boolean;
        };
        /**
         * UserContext
         * @description An authenticated user resolved against the database, with roles.
         *
         *     This is the object authorization decisions are made from — `roles` comes
         *     from the `user_roles` table, never from the token.
         */
        UserContext: {
            /** User Id */
            user_id: number;
            /**
             * Auth User Id
             * Format: uuid
             */
            auth_user_id: string;
            /** Email */
            email: string | null;
            /** First Name */
            first_name: string | null;
            /** Last Name */
            last_name: string | null;
            /**
             * Roles
             * @default []
             */
            roles: string[];
            /**
             * Must Change Password
             * @default false
             */
            must_change_password: boolean;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input: unknown;
            /** Context */
            ctx: Record<string, never>;
        };
        /**
         * VocabularyCategory
         * @enum {string}
         */
        VocabularyCategory: "industry" | "event_type" | "attendance_status" | "interaction_type";
        /**
         * VocabularyTermCreate
         * @description Create a vocabulary term. ``category`` must be one of the known
         *     categories (422 otherwise); ``value`` is trimmed and length-checked.
         */
        VocabularyTermCreate: {
            category: components["schemas"]["VocabularyCategory"];
            /** Value */
            value: string;
            /**
             * Sort Order
             * @default 0
             */
            sort_order: number;
        };
        /** VocabularyTermRead */
        VocabularyTermRead: {
            /** Term Id */
            term_id: number;
            /** Category */
            category: string;
            /** Value */
            value: string;
            /** Sort Order */
            sort_order: number;
            /** Active */
            active: boolean;
        };
        /**
         * VocabularyTermUpdate
         * @description Edit a term. Any subset of fields; only those present are applied
         *     (``exclude_unset``). ``category`` is immutable, so it is not editable here.
         */
        VocabularyTermUpdate: {
            /** Value */
            value?: string | null;
            /** Sort Order */
            sort_order?: number | null;
            /** Active */
            active?: boolean | null;
        };
        /** YearCount */
        YearCount: {
            /** Year */
            year: number;
            /** Count */
            count: number;
        };
        /** EducationCreate */
        app__schemas__alumni__EducationCreate: {
            /** University */
            university?: string | null;
            /** College */
            college?: string | null;
            /** Department */
            department?: string | null;
            /** Degree */
            degree?: string | null;
            /** Major */
            major?: string | null;
            /** Degree Status */
            degree_status?: string | null;
            /** Degree Year */
            degree_year?: number | null;
        };
        /**
         * EducationCreate
         * @description Add an education entry to an alumnus's record (Education panel).
         */
        app__schemas__profile__EducationCreate: {
            /** University */
            university?: string | null;
            /** College */
            college?: string | null;
            /** Department */
            department?: string | null;
            /** Degree */
            degree?: string | null;
            /** Major */
            major?: string | null;
            /** Degree Status */
            degree_status?: string | null;
            /** Degree Year */
            degree_year?: number | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    health_db_health_db_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DBHealthResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    me_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthenticatedUser"];
                };
            };
        };
    };
    context_auth_context_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserContext"];
                };
            };
        };
    };
    record_login_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["LoginContext"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginRecordedResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    password_complete_auth_password_complete_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasswordCompleteResponse"];
                };
            };
        };
    };
    login_precheck_auth_login_precheck_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginPrecheckRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginThrottleStatus"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    login_record_auth_login_record_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRecordRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginThrottleStatus"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_alumni_alumni_get: {
        parameters: {
            query?: {
                /** @description Search names and external ids (case-insensitive). */
                q?: string | null;
                graduation_year?: number | null;
                grad_year_min?: number | null;
                grad_year_max?: number | null;
                /** @description Filter by deceased flag. */
                deceased?: boolean | null;
                /** @description Current employer(s) — repeatable (OR), exact match. */
                employer?: string[] | null;
                /** @description Prior employer(s) from employment history — repeatable. */
                past_employer?: string[] | null;
                /** @description Industry / work area (primary or secondary) — repeatable. */
                industry?: string[] | null;
                /** @description Current job title(s) — repeatable, exact match. */
                title?: string[] | null;
                /** @description Seniority level(s) — repeatable, exact match. */
                seniority?: string[] | null;
                /** @description Current city/cities — repeatable, exact match. */
                city?: string[] | null;
                /** @description Current state(s) — repeatable, exact match. */
                state?: string[] | null;
                /** @description Engagement tag(s) — repeatable, exact match. */
                tag?: string[] | null;
                /** @description Status label(s) — repeatable, exact match. */
                status_label?: string[] | null;
                /** @description Finance Society leadership role(s) — repeatable. */
                leadership_role?: string[] | null;
                /** @description Survey status value(s) — repeatable, exact match. */
                survey_status?: string[] | null;
                /** @description Only alumni with an interaction on/after this date. */
                contacted_after?: string | null;
                /** @description Only alumni NOT contacted since this date (stale). */
                contacted_before?: string | null;
                /** @description Only alumni with no logged interactions. */
                never_contacted?: boolean;
                /** @description Only alumni who attended at least one event. */
                attended_event?: boolean;
                /** @description Only PIFF donors. */
                donor?: boolean;
                /** @description Only alumni willing to mentor. */
                mentor_willing?: boolean;
                /** @description Only alumni willing to guest speak. */
                guest_speaker_willing?: boolean;
                /** @description Only alumni with no contact-info email on file. */
                missing_email?: boolean;
                /** @description Only alumni with no current employer on file. */
                missing_employer?: boolean;
                /** @description Only alumni flagged as duplicate candidates. */
                duplicate?: boolean;
                include_archived?: boolean;
                /** @description Sort order: name | grad_desc | grad_asc. */
                sort?: string;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniPage"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_alumni_alumni_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AlumniCreateFull"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    alumni_filter_options_alumni_filter_options_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FilterOptions"];
                };
            };
        };
    };
    alumni_import_template_alumni_import_template_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    preview_import_alumni_alumni_import_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_preview_import_alumni_alumni_import_preview_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    import_alumni_alumni_import_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_import_alumni_alumni_import_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_alumni_alumni__alumni_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    archive_alumni_alumni__alumni_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_alumni_alumni__alumni_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AlumniUpdateFull"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_alumni_profile_alumni__alumni_id__profile_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_alumni_profile_alumni__alumni_id__export_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_interaction_alumni__alumni_id__interactions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InteractionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InteractionRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_task_alumni__alumni_id__tasks_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaskRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_task_completion_alumni__alumni_id__tasks__task_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                task_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskCompleteUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaskRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_employment_alumni__alumni_id__employment_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmploymentHistoryCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmploymentHistoryRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_employment_alumni__alumni_id__employment__employment_history_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                employment_history_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_employment_alumni__alumni_id__employment__employment_history_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                employment_history_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmploymentHistoryUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmploymentHistoryRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_education_alumni__alumni_id__education_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["app__schemas__profile__EducationCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EducationRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_education_alumni__alumni_id__education__education_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                education_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_education_alumni__alumni_id__education__education_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                education_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EducationUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EducationRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_leadership_alumni__alumni_id__leadership_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LeadershipCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeadershipRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_leadership_alumni__alumni_id__leadership__finance_society_leadership_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                finance_society_leadership_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_leadership_alumni__alumni_id__leadership__finance_society_leadership_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                finance_society_leadership_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LeadershipUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeadershipRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_tag_alumni__alumni_id__tags_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TagCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_tag_alumni__alumni_id__tags__tag__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_status_label_alumni__alumni_id__status_labels_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StatusLabelCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_status_label_alumni__alumni_id__status_labels__label__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                label: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_event_attendance_alumni__alumni_id__events_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EventAttendanceCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventAttendedRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    preview_create_alumni_alumni_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AlumniCreateFull"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    preview_update_alumni_alumni__alumni_id__preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AlumniUpdateFull"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    restore_alumni_alumni__alumni_id__restore_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    summary_dashboard_summary_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    birthdays_dashboard_birthdays_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    }[];
                };
            };
        };
    };
    event_participation_dashboard_event_participation_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    }[];
                };
            };
        };
    };
    activity_feed_dashboard_activity_get: {
        parameters: {
            query?: {
                /** @description Case-insensitive substring matched against the alumnus's first / last / preferred name OR the interaction type. */
                q?: string | null;
                /** @description Interaction type (case-insensitive exact). */
                type?: string | null;
                /** @description Only interactions on/after this date (inclusive). */
                date_from?: string | null;
                /** @description Only interactions on/before this date (inclusive). */
                date_to?: string | null;
                /** @description Sort order: recent (newest first) | oldest. */
                sort?: string;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    data_quality_dashboard_data_quality_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    contacted_this_month_list_dashboard_contacted_this_month_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    }[];
                };
            };
        };
    };
    upcoming_follow_ups_list_dashboard_follow_ups_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    }[];
                };
            };
        };
    };
    list_users_admin_users_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_user_admin_users_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateUserRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateUserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_logins_admin_logins_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginEventPage"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_user_admin_users__user_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeleteUserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    set_user_active_admin_users__user_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserActiveUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    assign_role_admin_users__user_id__roles_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoleAssign"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_role_admin_users__user_id__roles__role_name__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
                role_name: components["schemas"]["RoleName"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reset_password_admin_users__user_id__reset_password_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResetPasswordResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_user_name_admin_users__user_id__name_patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateUserNameRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_events_events_get: {
        parameters: {
            query?: {
                /** @description Substring match on event name or location (case-insensitive). */
                q?: string | null;
                /** @description Event type (case-insensitive exact match). */
                event_type?: string | null;
                /** @description Only events on or after this date (inclusive). */
                date_from?: string | null;
                /** @description Only events on or before this date (inclusive). */
                date_to?: string | null;
                /** @description Sort order: date | upcoming | type. */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    }[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_event_events_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EventCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    event_options_events_options_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    get_event_events__event_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_event_events__event_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EventUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_event_attendees_events__event_id__attendees_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    }[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_event_attendee_events__event_id__attendees_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AttendeeCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_event_attendee_events__event_id__attendees__alumni_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                event_id: number;
                alumni_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_audit_audit_get: {
        parameters: {
            query?: {
                /** @description Exact action type, e.g. 'update'. */
                action_type?: string | null;
                /** @description Exact entity type, e.g. 'alumni'. */
                entity_type?: string | null;
                /** @description Acting user's email (case-insensitive substring; min 3 chars to prevent single-character enumeration of the directory). */
                user?: string | null;
                /** @description Only events on/after this date (inclusive). */
                date_from?: string | null;
                /** @description Only events on/before this date (inclusive). */
                date_to?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    audit_options_audit_options_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    summary_geography_summary_get: {
        parameters: {
            query?: {
                employer?: string | null;
                industry?: string | null;
                year?: number | null;
                region?: string | null;
                tag?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GeoSummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    states_geography_states_get: {
        parameters: {
            query?: {
                employer?: string | null;
                industry?: string | null;
                year?: number | null;
                region?: string | null;
                tag?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StateCount"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    breakdown_geography_breakdown_get: {
        parameters: {
            query: {
                dimension: string;
                employer?: string | null;
                industry?: string | null;
                year?: number | null;
                region?: string | null;
                tag?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Breakdown"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    state_detail_geography_states__state__get: {
        parameters: {
            query?: {
                employer?: string | null;
                industry?: string | null;
                year?: number | null;
                region?: string | null;
                tag?: string | null;
            };
            header?: never;
            path: {
                state: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StateDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    state_alumni_geography_states__state__alumni_get: {
        parameters: {
            query?: {
                sort?: string;
                limit?: number;
                offset?: number;
                employer?: string | null;
                industry?: string | null;
                year?: number | null;
                region?: string | null;
                tag?: string | null;
            };
            header?: never;
            path: {
                state: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GeoAlumniPage"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    city_detail_geography_cities_get: {
        parameters: {
            query: {
                state: string;
                city: string;
                employer?: string | null;
                industry?: string | null;
                year?: number | null;
                region?: string | null;
                tag?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CityDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_tasks_tasks_get: {
        parameters: {
            query?: {
                /** @description Filter by completion state: false (default) = open tasks only, true = completed only, omitted via ?completed= is treated as false. Pass all=true to include both. */
                completed?: boolean | null;
                /** @description Include tasks of every completion state. */
                all?: boolean;
                /** @description Sort order: due (default, soonest due first, open before completed) | due_desc | alumni (owning alumnus A–Z) | created (newest task first) | status (open before completed). Unknown values fall back to 'due'. */
                sort?: string;
                /** @description Only tasks with a due date before today that are not completed. */
                overdue?: boolean;
                /** @description Filter by assignee: a user id, or the literal 'unassigned' for tasks with no assignee. */
                assignee?: string | null;
                /** @description Case-insensitive search over task title and alumnus name. */
                q?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminTaskPage"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_vocabulary_vocabulary__category__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category: components["schemas"]["VocabularyCategory"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_vocabulary_admin_admin_vocabulary__category__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category: components["schemas"]["VocabularyCategory"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermRead"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_vocabulary_term_admin_vocabulary_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VocabularyTermCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    deactivate_vocabulary_term_admin_vocabulary__term_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                term_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_vocabulary_term_admin_vocabulary__term_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                term_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VocabularyTermUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyTermRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_support_contacts_support_contacts_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportContactRead"][];
                };
            };
        };
    };
    list_support_contacts_admin_admin_support_contacts_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportContactRead"][];
                };
            };
        };
    };
    create_support_contact_admin_support_contacts_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupportContactCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportContactRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_support_contact_admin_support_contacts__contact_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contact_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportContactRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_support_contact_admin_support_contacts__contact_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contact_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupportContactUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportContactRead"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    root__get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
}
