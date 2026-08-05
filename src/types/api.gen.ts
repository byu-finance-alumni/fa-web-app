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
    "/maintenance/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Maintenance Status
         * @description PUBLIC (no auth): is the site in maintenance mode, and what should the
         *     maintenance page say?
         *
         *     Intentionally unauthenticated — a logged-out visitor has to be able to learn
         *     that the site is closed. The response is capped to ``{enabled, message}``
         *     (see ``MaintenanceStatus``): no actor, no timestamps, no version, no
         *     account-shaped data of any kind, so it cannot be used to enumerate anything.
         *     Both fields are single site-wide values that every visitor sees identically.
         *
         *     Served from the same short-lived process cache the request gate uses, so
         *     hammering this endpoint does not translate into database load.
         */
        get: operations["maintenance_status_maintenance_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/maintenance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Maintenance State
         * @description Engineer console view: the public status plus who turned it on and when.
         *
         *     Uncached — the console must show the true current value, not a value up to
         *     a few seconds stale.
         */
        get: operations["get_maintenance_state_maintenance_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/maintenance/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Enable Maintenance
         * @description Turn maintenance mode ON.
         *
         *     Pauses logins and every authenticated request for non-engineers, and ends
         *     the live session of every signed-in non-engineer account. Engineers — the
         *     caller included — keep their session and their access, so this same console
         *     can turn it back off without signing in again.
         *
         *     Rate-limited (``ENABLE_MAINTENANCE_LIMITER``, which resolves the actor
         *     through ``require_engineer``, so the route stays engineer-gated). The
         *     matching ``/disable`` is deliberately NOT limited — see the note on the
         *     limiter for why throttling the recovery direction would be a lockout.
         */
        post: operations["enable_maintenance_maintenance_enable_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/maintenance/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Disable Maintenance
         * @description Turn maintenance mode OFF and restore normal logins.
         *
         *     Reachable while maintenance is ON: ``RequireEngineer`` resolves through the
         *     strict user dependency, whose maintenance gate exempts engineers.
         */
        post: operations["disable_maintenance_maintenance_disable_post"];
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
         *
         *     NOTE (#189): this deliberately uses the token-only resolver, so it does NOT
         *     reflect single-session validity — a superseded token still gets 200 here. It
         *     is a pure token-identity echo, and session validity has its own purpose-built
         *     endpoint (``GET /auth/session/active``) that the frontend polls. If /me is
         *     ever meant to gate on session validity too, switch it to the session-aware
         *     resolver (``get_current_db_user``) — a scoped change left out here on purpose,
         *     since it would also change the response to a DB ``UserContext``.
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
         *     reflects the current user's force-change flag. ``capabilities`` carries the
         *     user's effective capability codes under the live permission config (#164) so
         *     the UI can show/hide controls — the backend still re-enforces every request.
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
         *       3. Clears the rolling failed-login counter for this email (#182) — a real
         *          sign-in is the correct, un-abusable place to reset it, so it no longer
         *          runs on every authenticated request.
         *       4. Claims this sign-in as the account's single active session (#147).
         *
         *     Uses the force-password-change-EXEMPT resolver: a user on an admin-issued
         *     temp password has still genuinely signed in, so their login must be recorded
         *     even before they clear the flag. Takes no body and keys only on the token's
         *     own identity, so a caller can only ever record their OWN login.
         *
         *     Best-effort by contract: the frontend never blocks the post-login redirect
         *     on this call. It is deliberately NOT written to ``audit_logs`` — sign-in
         *     events are a security log, not the record-change audit trail.
         *
         *     MAINTENANCE MODE: refused (503 / ``maintenance_mode``) for non-exempt users
         *     while the site-wide pause is on, BEFORE anything is written. That ordering is
         *     the point — this route is what claims ``active_session_id``, so letting it
         *     run would hand a paused user a valid session claim and undo the force-logout
         *     the switch just performed. Engineers are exempt, so an engineer can always
         *     sign back in and reach the console to turn maintenance off.
         */
        post: operations["record_login_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/session/active": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Session Active
         * @description Report whether THIS session is still the account's active session (#147).
         *
         *     Uses the force-change-EXEMPT resolver, which does NOT reject a superseded
         *     session (unlike the data routes) — so a superseded device can still ask "am I
         *     still signed in?" and get a clean ``{active: false}`` instead of a 401. The
         *     frontend polls this and, on ``false``, signs the device out and explains why.
         *
         *     Fails OPEN (``active: true``) when the account has no claimed session yet
         *     (``active_session_id`` NULL — e.g. a session predating this feature) or the
         *     token carried no ``session_id``, so nobody is spuriously logged out.
         */
        get: operations["session_active_auth_session_active_get"];
        put?: never;
        post?: never;
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
         *     (``POST /auth/login`` -> ``_clear_login_attempts``), which only a real,
         *     signed-in user can reach.
         *
         *     The ``locked`` flag the service returns is intentionally NOT echoed to the
         *     client (anti-enumeration); only the coarse ``reason`` is.
         *
         *     On a failure, in addition to bumping the rolling counter, a per-attempt
         *     ``login_failures`` row is logged (attempted email snapshotted + forwarded IP /
         *     geo / reason) so the engineer Login-failures tab can show who failed, when,
         *     and from where. That insert is BEST-EFFORT: a logging failure is swallowed so
         *     it can never break the throttle response, and it is a pure side-effect — the
         *     response body is unchanged, preserving the anti-enumeration behavior.
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
    "/alumni/{alumni_id}/headshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Headshot
         * @description Return a short-lived signed URL for the alumnus's headshot, or
         *     ``{"url": null}`` when none is set. Any authenticated view role may fetch it
         *     (the headshot shows on the profile); the bucket is private so the signed URL
         *     is the only way to view the image and it expires within the hour.
         */
        get: operations["get_headshot_alumni__alumni_id__headshot_get"];
        /**
         * Upload Headshot
         * @description Upload or replace an alumnus's headshot (full_access and up).
         *
         *     Stored PRIVATELY in the ``headshots`` bucket, keyed by the alumnus's net ID,
         *     overwriting any existing image. Only JPEG/PNG/WebP within the upload cap are
         *     accepted; the image is only ever served back via a short-lived signed URL.
         */
        put: operations["upload_headshot_alumni__alumni_id__headshot_put"];
        post?: never;
        /**
         * Delete Headshot
         * @description Remove an alumnus's headshot (full_access and up). A missing image is a
         *     no-op (still 204).
         */
        delete: operations["delete_headshot_alumni__alumni_id__headshot_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/headshot/upload-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Headshot Upload Url
         * @description Mint a short-lived signed URL the browser PUTs the image to DIRECTLY
         *     (full_access and up). This bypasses the ~4.5 MB request-body cap on our
         *     serverless functions, so headshots up to the bucket limit (20 MB) work.
         *
         *     The token is scoped to exactly this alumnus's object key (their net ID), so
         *     the browser can only write that one path and never sees the service key.
         *     Supabase enforces the bucket's size + JPEG/PNG/WebP allow-list on the PUT.
         *
         *     We log an ``upload_headshot_started`` audit HERE: minting is the necessary
         *     precondition for any image change and is fully attributable, so the FERPA
         *     trail can't be lost if the browser never reaches confirm (dropped connection
         *     / closed tab). Confirm writes the terminal ``upload_headshot`` (success) or
         *     ``upload_headshot_rejected`` once the object is validated, so this "started"
         *     row never masquerades as a completed, conforming upload.
         */
        post: operations["create_headshot_upload_url_alumni__alumni_id__headshot_upload_url_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/headshot/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm Headshot Upload
         * @description Validate + record the outcome of a direct-to-storage headshot upload
         *     (full_access and up). Writes the terminal audit so the trail reflects reality:
         *     ``upload_headshot`` when a conforming object is present, or
         *     ``upload_headshot_rejected`` when the uploaded object violates the contract
         *     (the attribution for the attempt is already on the mint's
         *     ``upload_headshot_started`` row).
         *
         *     Defense-in-depth: the bucket's own allow-list/size-limit is the primary guard
         *     on the direct PUT, but we re-check the object's type + size here and delete
         *     anything outside the contract, so a bucket misconfig can't silently let a bad
         *     file through. The probe FAILS OPEN — if it can't read the object we fall back
         *     to a plain existence check rather than reject a legitimate upload.
         */
        post: operations["confirm_headshot_upload_alumni__alumni_id__headshot_confirm_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/headshots/urls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Headshot Urls
         * @description Signed headshot URLs for a BATCH of alumni, keyed by ``alumni_id``.
         *
         *     The roster used to call ``GET /alumni/{id}/headshot`` once per visible row —
         *     25 function invocations and 25 single-row ``SELECT``s to render one page (a
         *     textbook N+1). This does the same work in one request: one query for all the
         *     net IDs, then storage round-trips only for the alumni that actually have one.
         *     Ids are deduplicated first, so the same alumnus is never signed twice in a
         *     single call.
         *
         *     Same read gate as the single-headshot route (any view role). An id that
         *     doesn't exist, an alumnus with no net ID, or one with no image on file all
         *     come back ``null`` — the list falls back to the initials avatar — because a
         *     roster must not fail because one row has no photo.
         */
        get: operations["get_headshot_urls_alumni_headshots_urls_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/headshots/bulk/upload-urls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Bulk Headshot Upload Urls
         * @description Mint per-file signed upload URLs for a bulk photo import (full_access+).
         *
         *     Takes FILE NAMES ONLY — no image bytes — so the request stays a few KB no
         *     matter how big the batch is. Each name's net ID is its basename minus the
         *     extension, matched to an alumnus case-insensitively; a name that matches
         *     nobody, or isn't a JPEG/PNG/WebP, comes back reported and WITHOUT a URL, so
         *     it can never be uploaded. Every minted URL is scoped by the server to that
         *     alumnus's own object key, so the browser never chooses where bytes land and
         *     never sees the service key.
         *
         *     Like the single-headshot route, minting writes an ``upload_headshot_started``
         *     audit row: it is the attributable precondition for an image change, so the
         *     FERPA trail survives a browser that never reaches confirm. Confirm writes the
         *     terminal ``upload_headshot`` / ``upload_headshot_rejected``.
         */
        post: operations["create_bulk_headshot_upload_urls_alumni_headshots_bulk_upload_urls_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/headshots/bulk/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm Bulk Headshot Upload
         * @description Validate + audit the objects a bulk photo import landed (full_access+).
         *
         *     Takes every file in the batch with the browser's per-file upload outcome and
         *     returns the authoritative report the wizard renders (``matched`` /
         *     ``no_match`` / ``invalid`` / ``error`` plus tallies). Nothing the browser
         *     sends is trusted: net IDs are re-derived, alumni re-resolved, and each landed
         *     object re-validated (type, size, sniffed magic bytes). A non-conforming
         *     object is DELETED and audited ``upload_headshot_rejected``; a conforming one
         *     is audited ``upload_headshot``, exactly like the single-headshot path.
         *
         *     The per-file ``uploaded`` flag decides only what we REPORT, never whether we
         *     look. Every matched alumnus's object is probed either way, so a client that
         *     PUTs a bad image and then claims the upload failed can't skip validation and
         *     leave that object sitting in the bucket. Conversely, a file the client says
         *     failed is never audited ``upload_headshot`` even if a conforming object is
         *     present — that object may be the alumnus's PREVIOUS headshot, and a failed
         *     upload must not be recorded as a successful one.
         */
        post: operations["confirm_bulk_headshot_upload_alumni_headshots_bulk_confirm_post"];
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
         * @description Download the bulk-import CSV template (full_access). ``kind=alumni`` (the
         *     default) returns the full Alumni columns; ``kind=friend`` returns the curated
         *     friend (non-alumni contact) column set (#294). Same column source as the xlsx
         *     intake template.
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
         *     Parses + maps the uploaded CSV against the template columns for ``kind``
         *     (``alumni`` default, or ``friend`` for non-alumni contacts, #294), then
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
         * @description Commit a bulk CSV import (full_access). ``kind=friend`` imports non-alumni
         *     contacts (``is_alumni=false``, #294); ``kind=alumni`` (default) imports
         *     alumni. Re-evaluates and inserts every importable row in one transaction
         *     (audit logging fires per row); rejected rows are skipped and reported. A bad
         *     header set imports nothing.
         */
        post: operations["import_alumni_alumni_import_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/import/update/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Update Import Alumni
         * @description Dry-run a bulk UPDATE from an uploaded CSV (full_access, NO writes).
         *
         *     Maps whichever of the alumni template columns the file carries (a Net ID or
         *     BYU ID column is required; unrecognized columns are ignored and echoed in
         *     ``ignored_columns``), then for each row resolves the match (BYU ID -> Net ID,
         *     active only) and computes a per-field diff against the CURRENT stored values.
         *     Returns the structured preview; an unusable header row surfaces as
         *     ``columns_ok: false``.
         */
        post: operations["preview_update_import_alumni_alumni_import_update_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/import/update": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Update Import Alumni
         * @description Commit a bulk UPDATE from an uploaded CSV (full_access).
         *
         *     Re-evaluates and applies every matched, changed row in one transaction, each
         *     through the single-record edit path (so cleaning + provenance + per-field
         *     audit fire). Parses with the same partial header rules as the preview, so the
         *     two agree on which columns count. Blank cells are left unchanged, columns the
         *     file omits are left unchanged, unrecognized columns are ignored; unmatched
         *     rows are reported, never created; rows with no effective change are reported
         *     ``unchanged``. An unusable header row updates nothing.
         */
        post: operations["update_import_alumni_alumni_import_update_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/import/update/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Cohort Update Template
         * @description Download an ACTIVE cohort as a FILLED intake-template CSV (full_access).
         *
         *     Pick the cohort by EITHER ``grad_year`` (the BYU graduation year) OR
         *     ``class_year`` (the Marriott "Class of" year) — provide exactly one. Powers
         *     the round-trip: download the cohort in the EXACT import-template column
         *     format, edit cells offline, then re-upload through ``POST
         *     /alumni/import/update`` (which matches by BYU ID / Net ID and applies only
         *     the changed cells). Both years are validated to the alumni-schema bounds. A
         *     cohort larger than the export cap is a 413 asking the caller to narrow it
         *     down. Audit-logged (``export_alumni``) like the other exports.
         */
        get: operations["export_cohort_update_template_alumni_import_update_export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/export/columns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Alumni Export Columns
         * @description The catalog of exportable columns + the default-checked selection, for the
         *     export column picker (full_access).
         */
        get: operations["alumni_export_columns_alumni_export_columns_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export Alumni
         * @description Export the filtered alumni list as CSV with the chosen columns
         *     (full_access). Hits the SAME population the list view shows: the body
         *     mirrors every ``GET /alumni`` filter and runs the same
         *     ``build_alumni_query`` predicates, with ``near``/``radius`` re-resolved
         *     through the same geocoding path (#366).
         *
         *     An unknown column key is a 422; so is an unknown designation token or a
         *     ``near`` phrase that can't be pinpointed — both fail closed rather than
         *     dropping the predicate and handing back a wider population than the list
         *     showed. A result set larger than the export cap is a 413 asking the caller to
         *     narrow filters. Audit-logged (``export_alumni``).
         */
        post: operations["export_alumni_alumni_export_post"];
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
         *     engagement, surveys, interactions, tasks, attachments, Pay It Forward, audit)
         *     for the tabs.
         *
         *     Archived records 404. Follow-up tasks are edit-only: view_only ("Professor")
         *     users get an empty ``tasks`` list AND a FERPA-minimized aggregate (sensitive
         *     PII nulled, free-text notes and audit trail stripped) — enforced here, not
         *     just hidden in the UI. Anyone with edit access — engineer / super_admin /
         *     full_access / student — sees all. The disclosure is audit-logged
         *     (``view_profile``).
         *
         *     The ``pay_it_forward`` roll-up (#403) always includes the donation count and
         *     last-gift date, but its dollar amounts are gated to amount-viewers
         *     (``donations.view``, #379 — seeded to exactly the roles that previously held
         *     ``alumni.full``), mirroring the donations endpoints.
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
         * @description Log an interaction on an alumni's timeline.
         *
         *     Gated on the ``interactions.create`` capability (#379), which is seeded to
         *     EVERY role — including view_only ("Professor"): adding an interaction is the
         *     one timeline write a professor may perform (#129), and it is now its own
         *     grantable capability rather than a special case buried in the view guard.
         *     The row is stamped with the actor's user id so ownership gates edit / delete
         *     for users without ``alumni.edit``.
         */
        post: operations["add_interaction_alumni__alumni_id__interactions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alumni/{alumni_id}/interactions/{interaction_id}": {
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
         * Delete Interaction
         * @description Delete an interaction from an alumni's timeline. 404 if the row is missing
         *     or belongs to another alumnus.
         *
         *     Same gate as the edit route: ``interactions.create`` to reach it at all, plus
         *     ``alumni.edit`` to remove an interaction somebody else logged (#129/#379).
         */
        delete: operations["delete_interaction_alumni__alumni_id__interactions__interaction_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Interaction
         * @description Edit an interaction on an alumni's timeline. 404 if the row is missing or
         *     belongs to another alumnus.
         *
         *     Requires ``interactions.create`` (#379, held by every role by default).
         *     Holders who ALSO hold ``alumni.edit`` may amend ANY interaction; a holder
         *     without it — a professor, by default — may amend only the interactions they
         *     logged themselves, and gets 403 on someone else's (#129).
         *
         *     ``can_edit_others`` is resolved from the LIVE permission config rather than
         *     from a hardcoded role list, so an engineer who grants ``alumni.edit`` to a
         *     role in the permission editor actually widens this too.
         */
        patch: operations["update_interaction_alumni__alumni_id__interactions__interaction_id__patch"];
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
         *
         *     Aggregate counts only — no per-alumnus identity is returned, so (unlike the
         *     per-row drill-downs in this module) it deliberately writes no record-of-
         *     disclosure audit row. Drill-downs reached from the tiles audit their own
         *     reads.
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
         *     interaction in the window.
         *
         *     Applies the same active-alumni filter as the KPI count
         *     (archived=false AND is_alumni=true) so archived / friend-of-program records
         *     never leak into the list and the row count reconciles with the tile (#179).
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
    "/dashboard/presets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Dashboard Presets
         * @description The quick-filter presets to show on the dashboard (ordered).
         */
        get: operations["list_dashboard_presets_dashboard_presets_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/dashboard-presets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Dashboard Presets Admin
         * @description Same list, behind the admin gate, for the editor UI.
         */
        get: operations["list_dashboard_presets_admin_admin_dashboard_presets_get"];
        put?: never;
        /**
         * Create Dashboard Preset
         * @description Add a quick-filter preset (engineer / super_admin).
         */
        post: operations["create_dashboard_preset_admin_dashboard_presets_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/dashboard-presets/{preset_id}": {
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
         * Delete Dashboard Preset
         * @description Remove a quick-filter preset (engineer / super_admin). 404 if missing.
         */
        delete: operations["delete_dashboard_preset_admin_dashboard_presets__preset_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Dashboard Preset
         * @description Edit a quick-filter preset (engineer / super_admin). 404 if missing.
         */
        patch: operations["update_dashboard_preset_admin_dashboard_presets__preset_id__patch"];
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
        /**
         * Purge Logins
         * @description Delete ALL recorded sign-ins (the entire ``login_events`` history).
         *     Engineer only.
         *
         *     The irreversible counterpart to GET /admin/logins: it wipes the whole
         *     login-history table in one shot (e.g. to clear accumulated dev/test noise
         *     from the Admin -> Logins tab). Engineer-gated (RequireEngineer) like the
         *     listing. Since #199 stops auditing engineer actions, this purge is
         *     intentionally NOT written to the audit trail. Returns the row count removed.
         *
         *     SCOPE (security review, #199/#200): this deletes ONLY ``login_events``. It
         *     deliberately does NOT touch ``engineer_action_log`` -- that append-only table
         *     is the tamper-resistant record of engineer actions and has no purge path, so
         *     an engineer cannot use this endpoint (or any other) to erase their own trail.
         */
        delete: operations["purge_logins_admin_logins_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/login-failures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Login Failures
         * @description List recorded FAILED sign-in attempts, newest first (paginated). Engineer
         *     only.
         *
         *     Backs the Admin -> Login-failures tab. Rows come from ``login_failures``
         *     (written by POST /auth/login/record on each failure); the snapshotted email
         *     is the address that was ATTEMPTED, which may not belong to any account (a
         *     probe/typo). Engineer-gated (RequireEngineer) exactly like GET /admin/logins,
         *     and paginated (default 50, hard cap 200 — mirrors the logins/users/audit
         *     endpoints) so one request can't enumerate the whole log. Reading the log is
         *     itself audited (``read_login_failure_log``; actor + applied limit/offset) —
         *     the returned rows are not logged.
         *
         *     Unlike GET /admin/logins (which filters to rows WITH a captured IP), this
         *     returns ALL failures: an attempt with no IP (local dev, or a client that
         *     forwarded no context) is still a meaningful failure to surface, and dropping
         *     it would hide real activity from a security log.
         */
        get: operations["list_login_failures_admin_login_failures_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/engineer-actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Engineer Actions
         * @description List recorded engineer actions, newest first (paginated). super_admin only.
         *
         *     Reads the append-only ``engineer_action_log`` -- the tamper-resistant oversight
         *     trail of engineer actions (#199/#200). ROLE-gated to ``super_admin`` and
         *     explicitly denied to the ``engineer`` (see require_super_admin_role_strict), so
         *     the audited party can neither read nor disable it; there is no delete/purge
         *     route for this table at all. Paginated (default 50, hard cap 200 -- mirrors the
         *     users/logins/audit endpoints) so one request can't enumerate the whole log.
         *
         *     Reading the log is itself audited (``read_engineer_action_log``; actor +
         *     applied limit/offset) -- the returned rows are not logged.
         */
        get: operations["list_engineer_actions_admin_engineer_actions_get"];
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
         *       * Privilege ceiling (#178): an actor may only delete a user whose highest
         *         role is at or below the actor's own highest tier (ranked via
         *         ROLE_ORDER) — so only an engineer may delete an engineer, and only
         *         super_admin/engineer may delete a super_admin.
         *       * Last-holder guard: you cannot delete the final holder of a top role when
         *         that would lock administration out of the system. The last ENGINEER is
         *         always protected (the engineer holds unique vocab/database powers no
         *         other role can). The last SUPER_ADMIN is protected only when NO engineer
         *         remains — the engineer tier is a superset of super_admin (engineer ⊇
         *         super_admin), so as long as an engineer exists, user administration is
         *         still available and the sole super_admin CAN be deleted (notably, an
         *         engineer deleting it).
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
         *     changes. Privilege ceiling (#178): an actor may only grant a role at or
         *     below their own highest tier (ranked via ROLE_ORDER). So only an
         *     ``engineer`` may grant ``engineer``, and only ``super_admin``/``engineer``
         *     may grant ``super_admin`` — a lower role that was delegated ``USER_ADMIN``
         *     still cannot mint an account that outranks it.
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
         *     Privilege ceiling (symmetric with assign_role, #178): an actor may only
         *     remove a role at or below their own highest tier (ranked via ROLE_ORDER).
         *     So only an ``engineer`` may remove ``engineer``, and only
         *     ``super_admin``/``engineer`` may remove ``super_admin`` — a lower role that
         *     was delegated ``USER_ADMIN`` cannot strip a role that outranks it.
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
    "/engineer/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Permissions
         * @description Return the full permission matrix (engineer-only).
         */
        get: operations["get_permissions_engineer_permissions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Toggle Permission
         * @description Grant or revoke one capability for one role (engineer-only, audited).
         *
         *     Rejects (422) toggling the engineer role (its grants are fixed) or a
         *     non-assignable capability (the ``engineer`` console capability can never be
         *     handed to another role). 404 if the role doesn't exist.
         */
        patch: operations["toggle_permission_engineer_permissions_patch"];
        trace?: never;
    };
    "/engineer/preview-log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Log Preview
         * @description Record that the engineer entered preview-as-role mode for a role (#165).
         *
         *     Preview-as-role is a read-only frontend affordance — it never grants the
         *     engineer access to anything they couldn't already reach — but entering it is
         *     audited so the trail shows when the engineer was viewing the app as another
         *     role. 422 if the role is unknown.
         */
        post: operations["log_preview_engineer_preview_log_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/role-capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Role Capabilities
         * @description Read-only permission matrix for the role-capabilities table (#163).
         *
         *     Same data as the engineer editor but behind the user-admin gate (engineer +
         *     super_admin), so a super_admin can SEE what each role can do without being
         *     able to change it. The table renders the non-engineer roles.
         */
        get: operations["get_role_capabilities_admin_role_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
         * @description Create an event (``events.create``). Stamps the acting user and audits the
         *     write (entity_type "event", action "create").
         *
         *     Gated on the editable ``events.create`` capability (#378), seeded to the same
         *     roles that previously held ``alumni.full``. Note that PATCH/DELETE and the
         *     attendee-roster routes below deliberately stay on ``alumni.full`` — this
         *     issue scoped the new toggles to authoring (create + bulk upload), and
         *     silently widening who can edit or delete existing events would be a
         *     different, unreviewed permission change.
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
    "/events/import/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Events Import Template
         * @description Download the events bulk-import CSV template (``events.import``): the exact
         *     columns plus a few example rows (two attendees share one event to show how
         *     rows group into a single event).
         */
        get: operations["events_import_template_events_import_template_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/attendees/match/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Attendee Match Template
         * @description Download a STARTING-POINT conference-attendee CSV (#612, full_access).
         *
         *     Only a starting point: unlike every other importer here, the attendee
         *     matcher does not require these columns. It aliases the header spellings a
         *     conference registration export actually uses (Email / E-mail Address /
         *     Company / Employer / Organization / Job Title ...) and IGNORES anything it
         *     doesn't recognise, so a raw registration export can be uploaded untouched.
         *
         *     Declared before the ``/{event_id}`` routes so the literal path wins.
         */
        get: operations["attendee_match_template_events_attendees_match_template_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/import/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Import Events
         * @description Dry-run a single-event attendee CSV import (``events.import``, NO writes).
         *
         *     The event's identity (title/date/type/…) comes from the wizard as form
         *     fields; the CSV is the attendee roster. Resolves attendees by Net ID and
         *     flags unmatched/duplicate attendees, a bad date, and a pre-existing event. A
         *     bad header set surfaces as ``columns_ok: false`` with ``header_errors``.
         */
        post: operations["preview_import_events_events_import_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import Events Commit
         * @description Commit a single-event attendee CSV import (``events.import``). Re-evaluates and,
         *     if the event identity is valid and new, inserts the event + its matched
         *     attendees in one transaction (audit logging fires for the event and each
         *     attendee); unmatched attendees are skipped and reported. A bad header set
         *     imports nothing.
         */
        post: operations["import_events_commit_events_import_post"];
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
        /**
         * Delete Event
         * @description Delete an event (full_access). Cascades to its attendance rows (and any
         *     attached notes) via the FK ``ON DELETE CASCADE``. 404 if the event is
         *     unknown. Audits the write (entity_type "event", action "delete").
         */
        delete: operations["delete_event_events__event_id__delete"];
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
         *
         *     ``notes`` echoes the per-attendance ``attendance_notes`` (#181) so the notes
         *     the bulk importer writes are actually readable on the roster.
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
         *     Note: this is the event-roster management surface and stays on
         *     ``events.manage`` on purpose. Recording attendance from an alumnus's PROFILE
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
    "/events/{event_id}/attendees/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Event Attendees
         * @description Download an event's attendee list as CSV — columns **Name, Email, Net ID**
         *     (#219). Gated at ``full_access`` (a rung above the view-only attendee list)
         *     because bulk contact details — alumni PII — leave the system here, and audited
         *     as a disclosure (action ``export_event_attendees``, row count only, never the
         *     data itself). 404 if the event is unknown.
         *
         *     Email is the alumnus's personal email, falling back to the work email. Rows
         *     are ordered by name, matching the on-screen roster.
         */
        get: operations["export_event_attendees_events__event_id__attendees_export_get"];
        put?: never;
        post?: never;
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
    "/events/{event_id}/attendees/match/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Attendee Match
         * @description Propose matches for a conference attendee list (full_access, NO writes).
         *
         *     Matching precedence, per row:
         *       1. **Email**, when the file gives one - an exact, case-insensitive hit on
         *          the alumnus's personal OR work email. Treated as high confidence, and
         *          when an email hit exists the name-only candidates for that row are
         *          dropped (Jake, 2026-08-04).
         *       2. **Name**, otherwise - surname against ``last_name`` AND ``birth_name``
         *          (the maiden-name column), given name against ``first_name`` /
         *          ``preferred_first_name`` / ``middle_name`` through a nickname table.
         *       3. **Given name + employer**, as the safety net for an alumna whose
         *          married surname this database has never seen.
         *
         *     Company corroborates (raising confidence) and never keys or rejects.
         *     Rows with several plausible records come back ``ambiguous`` with EVERY
         *     candidate listed - the top-scoring one is never silently chosen. 404 if the
         *     event is unknown.
         *
         *     Audited as a disclosure preview: row counts only, never the data.
         */
        post: operations["preview_attendee_match_events__event_id__attendees_match_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{event_id}/attendees/match/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve Attendee Matches
         * @description Record attendance for HUMAN-APPROVED matches (full_access).
         *
         *     Approving a match marks that person as attending THIS event and changes
         *     nothing else on the alumnus (Jake, 2026-08-04). Every ``alumni_id`` is
         *     re-validated server-side (must exist and not be archived) - the client's
         *     proposal is never trusted.
         *
         *     **Idempotent per (event, alumni):** an alumnus already on the roster is
         *     reported ``already_attending`` and skipped, so re-running the same file
         *     never double-adds. 404 if the event is unknown.
         */
        post: operations["approve_attendee_matches_events__event_id__attendees_match_approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{event_id}/attendees/match/friends": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Attendee Friends
         * @description Create "friend of the program" records for chosen no-match rows
         *     (full_access) and attach each to this event.
         *
         *     ``rows`` is a comma-separated list of the 1-based spreadsheet row numbers the
         *     reviewer chose. The SAME file is re-posted and re-parsed server-side rather
         *     than trusting a client-built payload - the same defence-in-depth stance the
         *     alumni importer takes.
         *
         *     Each friend carries **everything in the file that maps to an existing DB
         *     column** (Jake, 2026-08-04): the row is mapped through the alumni importer's
         *     own column mapping with ``is_alumni = false`` and written through the shared
         *     ``create_alumni`` path, so cleaning, duplicate detection and audit logging
         *     fire exactly as for a manual create. Columns that map to nothing are
         *     ignored, never an error. 404 if the event is unknown.
         */
        post: operations["create_attendee_friends_events__event_id__attendees_match_friends_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/donors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Donors
         * @description List donors with per-year and lifetime roll-ups (full_access+, paginated).
         *
         *     Everyone sees who gave and in which years; ``lifetime_total`` and each
         *     ``per_year.total`` are non-null only for amount-viewers (full_access+).
         *
         *     Returns a ``{items, total, limit, offset}`` envelope. The ranking, LIMIT, and
         *     OFFSET are pushed into PostgreSQL; only the page's per-year breakdown is then
         *     aggregated (``WHERE alumni_id IN (<page ids>)``), so the endpoint is bounded
         *     regardless of donor count. Amount-viewers see the biggest givers first;
         *     others get a stable name sort (the lifetime ranking is amount-gated too).
         */
        get: operations["list_donors_donations_donors_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Donations Summary
         * @description Fund totals (full_access+). Donor / donation COUNTS are public; the dollar
         *     ``total_raised`` and each ``per_year.total`` are gated to amount-viewers.
         */
        get: operations["donations_summary_donations_summary_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/alumni/{alumni_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Alumni Donations
         * @description A single donor's donation history (full_access+). 404 if the alumnus is
         *     unknown. Each entry's ``amount`` and ``notes`` are gated to amount-viewers.
         */
        get: operations["list_alumni_donations_donations_alumni__alumni_id__get"];
        put?: never;
        /**
         * Add Donation
         * @description Add a donation to an alumnus (donations.manage). 404 if the alumnus is
         *     unknown or archived. Audits the write (entity_type "donation", action
         *     "create").
         */
        post: operations["add_donation_donations_alumni__alumni_id__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/{donation_id}": {
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
         * Delete Donation
         * @description Delete a donation (donations.manage tier: super_admin / engineer). 404 if
         *     unknown. Audits the write (entity_type "donation", action "delete") with the
         *     actor's user id — the DB trigger snapshots the actor email for the FERPA
         *     trail. Returns 204.
         *
         *     Gated to the ``donations.manage`` tier (super_admin / engineer), matching the
         *     other donation writes (add / update). Tightened back from the temporary
         *     ``alumni.full`` gate so full_access can no longer delete donations.
         */
        delete: operations["delete_donation_donations__donation_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Donation
         * @description Partially update a donation (donations.manage). Only fields present in the
         *     body are applied; each change is audited. 404 if the donation is unknown.
         */
        patch: operations["update_donation_donations__donation_id__patch"];
        trace?: never;
    };
    "/donations/import/template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Donations Import Template
         * @description Download the donations bulk-import CSV template (donations.manage): columns
         *     Net ID, Name, Month, Year, Amount plus a couple of example rows.
         */
        get: operations["donations_import_template_donations_import_template_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/import/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Import Donations
         * @description Dry-run a donations bulk CSV import (donations.manage, NO writes). Matches
         *     donors by Net ID and flags unmatched Net IDs, bad month/year, and non-numeric
         *     amounts. A bad header set surfaces as ``columns_ok: false``.
         */
        post: operations["preview_import_donations_donations_import_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/donations/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import Donations Commit
         * @description Commit a donations bulk CSV import (donations.manage). Re-evaluates and inserts
         *     every importable donation in one transaction (audited per row); rejected rows
         *     are skipped and reported. A bad header set imports nothing.
         */
        post: operations["import_donations_commit_donations_import_post"];
        delete?: never;
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
    "/geography/counties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Counties
         * @description Per-county alumni counts (5-digit FIPS) for the national county choropleth.
         *
         *     Aggregate counts only (no PII), so view-accessible like ``/states``.
         */
        get: operations["counties_geography_counties_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/countries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Countries
         * @description Per-country alumni counts (international) for the world-map view.
         *
         *     Aggregate counts only (no PII), so view-accessible like ``/states``.
         */
        get: operations["countries_geography_countries_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/countries/{country}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Country Detail
         * @description Country drill-down: count + top employers / industries + grad-year
         *     histogram (aggregate only, so view-accessible like ``/states/{state}``).
         */
        get: operations["country_detail_geography_countries__country__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geography/countries/{country}/alumni": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Country Alumni
         * @description Paginated, sortable alumni list for one country (world-view drill-down).
         *
         *     FERPA: this lists the individual alumni behind a country count, so it is
         *     gated to full_access (view_only gets 403) and the disclosure is audited; the
         *     aggregate country count/detail stay view-accessible.
         */
        get: operations["country_alumni_geography_countries__country__alumni_get"];
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
    "/geography/radius": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Radius Alumni
         * @description Alumni within ``miles`` of (lat, lng), nearest first.
         *
         *     Distance is city-level (an alumnus's location is their city's coordinates,
         *     via the city_geo crosswalk — the only geographic signal stored). FERPA: this
         *     lists the individual alumni behind a location, so it is gated to full_access
         *     (view_only gets 403) and the disclosure is audited.
         */
        get: operations["radius_alumni_geography_radius_get"];
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
    "/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Notes
         * @description List the notes on one entity, newest first (any view-access role). 404 if
         *     the parent entity doesn't exist. The disclosure is audit-logged. A view_only
         *     caller sees note authors by first name only; editors see full names.
         */
        get: operations["list_notes_notes_get"];
        put?: never;
        /**
         * Create Note
         * @description Create a note on an alumni / interaction / event (notes.manage). 404 if the
         *     target entity doesn't exist.
         */
        post: operations["create_note_notes_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notes/{note_id}": {
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
         * Delete Note
         * @description Delete a note (full_access). 404 if the note doesn't exist. The body is
         *     snapshotted to the audit trail before removal.
         */
        delete: operations["delete_note_notes__note_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Note
         * @description Edit a note's body (full_access). 404 if the note doesn't exist.
         */
        patch: operations["update_note_notes__note_id__patch"];
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
    "/vocabulary/state-regions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get State Regions
         * @description The 50-states + DC -> region crosswalk (#283).
         *
         *     Lets the edit form fill in Region the moment an Employment State is picked,
         *     so the value is visible before saving and matches what the server will derive
         *     on write. The frontend must NOT keep its own copy of this map — a hand-copied
         *     map would silently rot and no test could catch the disagreement.
         *
         *     Despite living under ``/vocabulary`` (it is dropdown data for a form, on the
         *     same read gate), this is NOT editable vocabulary: it is static reference data
         *     defined in code, so it has no admin CRUD and cannot be changed at runtime.
         *
         *     Cacheable — the payload is identical for every caller, contains no PII, and
         *     only ever changes on deploy. The one-hour max-age is short enough that a
         *     correction to the map propagates the same day.
         */
        get: operations["get_state_regions_vocabulary_state_regions_get"];
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
         *     category (or scope) is a 422.
         *
         *     ``scope=primary`` narrows the ``industry`` category to the primary-industry
         *     options (#282). The terms it hides are still ACTIVE vocabulary and are still
         *     accepted on write — they are only withheld from the primary dropdown.
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
         *
         *     Returns 201 Created for a genuinely new term, 200 OK when an existing
         *     soft-deleted term was reactivated (nothing new was created) (#176).
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
    "/admin/vocabulary/{term_id}/permanent": {
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
         * Delete Vocabulary Term
         * @description Permanently remove a term (hard delete), unlike the soft-delete DELETE
         *     above. Existing records that already stored this value keep it — only the
         *     managed option is removed, so it no longer appears in any admin list or
         *     dropdown and cannot be restored. Writes an audit row. 404 if missing.
         */
        delete: operations["delete_vocabulary_term_admin_vocabulary__term_id__permanent_delete"];
        options?: never;
        head?: never;
        patch?: never;
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
    "/survey/respond/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Survey Respond Info
         * @description PUBLIC (token-gated, no login): the alum's current on-file info for the
         *     confirm page. The signed token is the credential — an invalid or expired one
         *     404s with the same message either way.
         */
        get: operations["survey_respond_info_survey_respond__token__get"];
        put?: never;
        /**
         * Survey Submit
         * @description PUBLIC (token-gated): stage the alum's submitted changes for admin review.
         *     Nothing is applied to the record here.
         */
        post: operations["survey_submit_survey_respond__token__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/respond/{token}/photo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Survey Submit Photo
         * @description PUBLIC (token-gated): attach a NEW profile photo to a just-staged response.
         *
         *     A separate step from the JSON field-submit so the field submit is unaffected.
         *     The signed token gates it (no login); the same JPEG/PNG/WebP + size validation
         *     as the headshot upload runs here before the image is staged for admin review.
         *     The photo only becomes the alum's headshot if an admin applies the response.
         */
        post: operations["survey_submit_photo_survey_respond__token__photo_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/campaigns/{grad_year}/responses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Survey Pending Responses
         * @description Admin review queue: pending responses for a grad year, each with a diff.
         */
        get: operations["survey_pending_responses_survey_campaigns__grad_year__responses_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/responses/{response_id}/apply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Survey Apply Response
         * @description Apply a staged response to the alum's record.
         */
        post: operations["survey_apply_response_survey_responses__response_id__apply_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/responses/{response_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Survey Reject Response
         * @description Reject a staged response — nothing is written to the record.
         */
        post: operations["survey_reject_response_survey_responses__response_id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/graduation-years": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Survey Graduation Years
         * @description Distinct graduation years present in the DB (eligible alumni) + counts,
         *     newest first — powers the console's year picker.
         */
        get: operations["survey_graduation_years_survey_graduation_years_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Survey Send Usage
         * @description Real Resend send usage (emails actually sent today / this calendar month),
         *     for the console's daily/monthly tallies against the send caps.
         */
        get: operations["survey_send_usage_survey_usage_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/send-config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Survey Send Config
         * @description The account-wide send cap the scheduler paces against — the daily/monthly
         *     email budget and whether it's enforced.
         */
        get: operations["get_survey_send_config_survey_send_config_get"];
        put?: never;
        /**
         * Update Survey Send Config
         * @description Update the send cap. ``enabled=false`` removes the internal cap (e.g. after
         *     upgrading the Resend plan) — sends are then limited only by Resend itself.
         */
        post: operations["update_survey_send_config_survey_send_config_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/campaigns/{grad_year}/send": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send Survey Campaign */
        post: operations["send_survey_campaign_survey_campaigns__grad_year__send_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/campaigns/{grad_year}/recipients": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Survey Recipient Breakdown
         * @description Who this year's survey would reach, and who it would not (#392).
         *
         *     The console's send confirmation reads THIS rather than doing its own
         *     arithmetic on the year picker's totals. That arithmetic
         *     (``total_alumni - responded``) ignored suppression, unreachable alumni and
         *     the shared-address dedupe, so the button promised a number the send could not
         *     deliver — the parity bug this codebase keeps re-growing.
         *
         *     The same function backs `SurveySendResult.breakdown`, so the figure shown
         *     before a send and the figure explaining it afterwards cannot disagree.
         *
         *     Read-only, sends nothing, takes no send lock — safe to poll while the daily
         *     cron is mid-run. Gated like the rest of the console.
         */
        get: operations["survey_recipient_breakdown_survey_campaigns__grad_year__recipients_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/campaigns/{grad_year}/unreachable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Survey Unreachable
         * @description The alumni this year's survey CANNOT email, by name (#392).
         *
         *     ``SurveyRecipientBreakdown.unreachable`` is this set as a count; this is the
         *     worklist behind it, so "we can't reach 20 of them" becomes something staff
         *     can act on. Each row says WHY and shows whatever is in the two email columns,
         *     because a typo'd work address is fixable on sight while a wholly missing one
         *     has to be chased.
         *
         *     Campaign-scoped, NOT schedule-scoped: a year with no schedule still has a
         *     contact-data gap worth seeing, so this never 404s — an empty list means
         *     everyone is reachable.
         *
         *     Contains no suppressed alumni. Deceased / Do Not Contact are excluded from
         *     the campaign by decision, not by a gap, and must never be presented as people
         *     to chase for an address.
         *
         *     Read-only and gated like the rest of the console (it returns alumni contact
         *     details).
         */
        get: operations["list_survey_unreachable_survey_campaigns__grad_year__unreachable_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Survey Schedules
         * @description All auto-send schedules (newest cohort first) + per-stage sent counts.
         *
         *     Also backs the engineer Surveys console (which needs who started each
         *     campaign and when) — the console reads this rather than a second endpoint,
         *     since it wants exactly this list. The engineer holds every capability, so
         *     the full-access gate already admits them.
         */
        get: operations["list_survey_schedules_survey_schedules_get"];
        put?: never;
        /**
         * Create Survey Schedule
         * @description Create — or replace — the auto-send schedule for a graduation year.
         */
        post: operations["create_survey_schedule_survey_schedules_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/{grad_year}/new-cycle/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Preview Survey New Cycle
         * @description What starting a new survey cycle for this year would do (#357).
         *
         *     Read-only: nothing is scheduled and nothing is sent. Backs the confirmation
         *     shown before the irreversible `new-cycle` call, so staff see how many alumni
         *     would be emailed — and how many of those already received the current
         *     cycle — before committing to it.
         */
        get: operations["preview_survey_new_cycle_survey_schedules__grad_year__new_cycle_preview_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/{grad_year}/new-cycle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start Survey New Cycle
         * @description Start the NEXT survey campaign for a graduation year (#357).
         *
         *     Advances the year's cycle, making the whole eligible cohort emailable again
         *     while every previous cycle's send log stays intact as history. Nothing is
         *     deleted.
         *
         *     Deliberately separate from `POST /schedules`, which REPLACES a year's
         *     schedule without advancing the cycle (Jake, 2026-08-03). That one is the
         *     "I mistyped the start date" correction and must never re-email anyone; this
         *     one is the annual re-run and always will. Confirm with the user against
         *     `new-cycle/preview` first — the send it sets up cannot be recalled.
         */
        post: operations["start_survey_new_cycle_survey_schedules__grad_year__new_cycle_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Survey Schedules Bulk
         * @description Create — or replace — the auto-send schedule for many graduation years in
         *     one call. A duplicate year in the payload resolves to a single row (last one
         *     wins). Returns the full, refreshed schedule list.
         */
        post: operations["create_survey_schedules_bulk_survey_schedules_bulk_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/{grad_year}/non-responders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Survey Non Responders
         * @description Who needs MANUAL follow-up for this year's current campaign (#359).
         *
         *     The alumni who received all three of this cycle's emails and never replied —
         *     #151's third step. `SurveyScheduleItem.non_responders` is the same set as a
         *     count; this is the call sheet behind it, so "N never responded" is something
         *     staff can act on rather than just read.
         *
         *     Read-only, and gated like the rest of the console (full access) because it
         *     returns alumni contact details. Empty list = nobody left to chase; 404 = the
         *     year has no campaign at all. Cycle-scoped: a previous campaign's
         *     non-responders are not in here.
         */
        get: operations["list_survey_non_responders_survey_schedules__grad_year__non_responders_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/{grad_year}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pause Survey Schedule
         * @description Pause a graduation year's schedule — sending stops until it is resumed.
         *
         *     The reversible stop, alongside the terminal `cancel`; same full-access gate,
         *     since a routine "hold this cohort for a few days" is less drastic than the
         *     cancel already available here. Pausing an already-paused campaign succeeds
         *     unchanged; pausing a completed or cancelled one is a 409.
         */
        post: operations["pause_survey_schedule_survey_schedules__grad_year__pause_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/{grad_year}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resume Survey Schedule
         * @description Resume a paused schedule where its cadence left off.
         *
         *     `start_date` is shifted forward by however long it was paused, so the stage
         *     the cron sends next is the one that was due when it stopped — a pause never
         *     silently ages a campaign past its reminder windows. Resuming a campaign that
         *     is already running succeeds unchanged; resuming a completed or cancelled one
         *     is a 409 (cancel stays terminal).
         */
        post: operations["resume_survey_schedule_survey_schedules__grad_year__resume_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/pause-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pause All Survey Schedules
         * @description Pause EVERY running survey campaign at once — the reversible kill switch.
         *
         *     Sits beside `cancel-all` in the engineer console and is gated the same way
         *     (RequireEngineer): a blanket stop of every cohort is a maintenance action
         *     whatever its reversibility. Each paused year can be resumed individually and
         *     picks its cadence up where it stopped. Returns the count + the years paused
         *     so the console can report exactly what it stopped; calling it with nothing
         *     running succeeds and reports 0.
         */
        post: operations["pause_all_survey_schedules_survey_schedules_pause_all_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/{grad_year}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel Survey Schedule
         * @description Cancel a graduation year's schedule — no further sends.
         *
         *     Terminal, and non-destructive: the row stays with its `cycle_seq`, next to
         *     the send log it explains. This is what a campaign that has already emailed
         *     people gets instead of `DELETE` below (#398). Audited.
         */
        post: operations["cancel_survey_schedule_survey_schedules__grad_year__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/{grad_year}": {
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
         * Delete Survey Schedule
         * @description Remove a survey campaign — ANY campaign, whatever its status (#398).
         *
         *     For the campaign scheduled against the wrong year, or created by mistake:
         *     pausing hid it, but the row stayed forever. This removes it, and with it any
         *     future send (the cron only ever selects rows that exist). No status is
         *     exempt — `scheduled`, `active`, `paused`, `completed` and `cancelled` all
         *     delete. The first cut refused any campaign that had ever emailed anyone,
         *     which in practice meant every real one.
         *
         *     DELETES NO HISTORY. `survey_send_log` and `survey_responses` are not touched
         *     here or anywhere in this path — a "delete campaign" that took the alumni's
         *     submitted answers with it is precisely what Jake ruled out on #395 the same
         *     day. The response says how many of each were kept.
         *
         *     What it does instead of refusing: RETIRES the campaign's cycle. The deleted
         *     row's `cycle_seq` is recorded in `survey_campaign_retirement`, and the next
         *     campaign for that year starts above it — so the alumni this one emailed are
         *     eligible again, and the send log's unique key cannot refuse their new rows.
         *     Without that, deleting the row would leave the send-log rows looking like the
         *     current cycle's and the next campaign would find everyone already emailed and
         *     send to nobody (#357). Alumni who ANSWERED stay held out by the 365-day
         *     annual window, exactly as after a new cycle.
         *
         *     `POST /schedules/{year}/cancel` is still here and still distinct: it stops a
         *     live campaign and KEEPS it listed with its counts.
         *
         *     Engineer-gated like the other maintenance controls (pause-all / cancel-all /
         *     per-alumnus reset) rather than `surveys.manage`, which is assignable.
         */
        delete: operations["delete_survey_schedule_survey_schedules__grad_year__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/schedules/cancel-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel All Survey Schedules
         * @description Stop EVERY running survey campaign at once — the engineer kill switch.
         *
         *     Cancels all scheduled/active schedules in one statement, which is what stops
         *     the daily cron sending (it only picks up those two statuses). Deliberately
         *     narrower than the full-access per-year cancel: a blanket stop of every cohort
         *     is a maintenance action, so it is engineer-gated (RequireEngineer) like the
         *     rest of the engineer console. Returns the count + the years cancelled so the
         *     console can report exactly what it stopped; calling it with nothing running
         *     succeeds and reports 0.
         */
        post: operations["cancel_all_survey_schedules_survey_schedules_cancel_all_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/alumni/{alumni_id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Survey Alumnus State
         * @description One alumnus's survey state: what was emailed, what came back, and what is
         *     holding them out of the next send (#395).
         *
         *     Read-only, and the REQUIRED first half of the reset below — the engineer has
         *     to be able to see that someone looks "blocked" only because they legitimately
         *     replied three months ago, in which case re-asking them may not be wanted.
         *     `blocked_reasons` says so in plain words; empty means a reset would change
         *     nothing at all.
         *
         *     Engineer-gated (`RequireEngineer` = the non-assignable `engineer`
         *     capability), matching its twin below: the read exists to inform that one
         *     decision, so widening it would only invite the reset to be run blind.
         */
        get: operations["survey_alumnus_state_survey_alumni__alumni_id__state_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/alumni/{alumni_id}/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Survey Reset Alumnus
         * @description Make ONE alumnus surveyable again (#395) — the UI replacement for
         *     hand-running DELETE statements, which now deletes nothing itself.
         *
         *     DESTROYS NOTHING (Jake, 2026-08-05). It records a reset in
         *     `survey_reset_log`; their submitted answers, the record of the emails sent to
         *     them, and any staged survey photo all stay in the database and on their
         *     profile. A `pending` answer stays pending and stays in the review queue.
         *     Eligibility queries stop counting what predates the reset — that is the
         *     entire effect. Callers must show `GET /survey/alumni/{alumni_id}/state`
         *     first, because a reset that unblocks nothing is simply noise.
         *
         *     Gated on `RequireEngineer` — the `engineer` capability, which is the one
         *     capability the permission editor cannot grant to another role. Deliberately
         *     NOT `surveys.manage`: that capability IS assignable, and this button decides
         *     who receives a real email, so it stays with the maintenance controls
         *     (pause-all / cancel-all) rather than with response review.
         *
         *     Scoped to exactly one alumnus. There is no bulk or cohort variant; the annual
         *     cohort re-run is `POST /schedules/{grad_year}/new-cycle`.
         */
        post: operations["survey_reset_alumnus_survey_alumni__alumni_id__reset_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/survey/cron/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Survey Cron Run
         * @description Run the survey send scheduler (POST). See :func:`_run_cron`.
         */
        post: operations["survey_cron_run_survey_cron_run_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
         * ActivityFeed
         * @description Paginated interaction feed for ``GET /dashboard/activity``.
         */
        ActivityFeed: {
            /** Items */
            items: components["schemas"]["InteractionActivity"][];
            /** Types */
            types: string[];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
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
            /** Graduation Month */
            graduation_month: number | null;
            /** Graduation Semester */
            graduation_semester: string | null;
            /** Graduation Class */
            graduation_class: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Graduate Graduation Year */
            graduate_graduation_year: number | null;
            /** Citizenship */
            citizenship: string | null;
            /** Marital Status */
            marital_status: string | null;
            /** Home Country */
            home_country: string | null;
            /** Employment Status */
            employment_status: string | null;
            /** Other Designations */
            other_designations: string | null;
            /** Languages */
            languages: string | null;
            /** Survey Completed Date */
            survey_completed_date: string | null;
            /** Profile Updated Date */
            readonly profile_updated_date: string | null;
            /** Profile Updated By */
            profile_updated_by: string | null;
            /** Mba Program */
            mba_program: string | null;
            /** Law School */
            law_school: string | null;
            /** Medical School */
            medical_school: string | null;
            /** Graduate School */
            graduate_school: string | null;
            /** Startup Involvement */
            startup_involvement: string | null;
            /** Advisory Roles */
            advisory_roles: string | null;
            /** Secondary Employment */
            secondary_employment: string | null;
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
            /** Is Alumni */
            is_alumni: boolean | null;
            /** Linkedin Url */
            linkedin_url: string | null;
            /** Notes */
            notes: string | null;
            contact: components["schemas"]["ContactCreate"] | null;
            career: components["schemas"]["CareerCreate"] | null;
            education: components["schemas"]["app__schemas__alumni__EducationCreate"] | null;
            engagement: components["schemas"]["EngagementCreate"] | null;
            former: components["schemas"]["FormerCreate"] | null;
            leadership: components["schemas"]["app__schemas__alumni__LeadershipCreate"] | null;
        };
        /**
         * AlumniExportFilters
         * @description The list view's filter set, as a body model so the export hits exactly the
         *     same population the user is looking at. Every field is optional; unset fields
         *     fall back to ``build_alumni_query``'s defaults. Mirrors the ``GET /alumni``
         *     query parameters one-for-one.
         */
        AlumniExportFilters: {
            /** Q */
            q: string | null;
            /** Net Id */
            net_id: string | null;
            /** First Name */
            first_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Preferred Name */
            preferred_name: string | null;
            /** Email */
            email: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Grad Year Min */
            grad_year_min: number | null;
            /** Grad Year Max */
            grad_year_max: number | null;
            /** Deceased */
            deceased: boolean | null;
            /** Gender */
            gender: string | null;
            /** Industry Group */
            industry_group: string | null;
            /** Employer */
            employer: string[] | null;
            /** Past Employer */
            past_employer: string[] | null;
            /** Industry */
            industry: string[] | null;
            /** Secondary Industry */
            secondary_industry: string[] | null;
            /** Title */
            title: string[] | null;
            /** Seniority */
            seniority: string[] | null;
            /** Employment Status */
            employment_status: string[] | null;
            /** City */
            city: string[] | null;
            /** State */
            state: string[] | null;
            /** Near */
            near: string | null;
            /** Radius */
            radius: number | null;
            /** Tag */
            tag: string[] | null;
            /** Status Label */
            status_label: string[] | null;
            /** Leadership Role */
            leadership_role: string[] | null;
            /** Survey Status */
            survey_status: string[] | null;
            /**
             * Needs Survey
             * @default false
             */
            needs_survey: boolean;
            /** Contacted After */
            contacted_after: string | null;
            /** Contacted Before */
            contacted_before: string | null;
            /**
             * Never Contacted
             * @default false
             */
            never_contacted: boolean;
            /**
             * Attended Event
             * @default false
             */
            attended_event: boolean;
            /** Spoke After */
            spoke_after: string | null;
            /** Spoke Before */
            spoke_before: string | null;
            /**
             * Donor
             * @default false
             */
            donor: boolean;
            /**
             * Mentor Willing
             * @default false
             */
            mentor_willing: boolean;
            /**
             * Guest Speaker Willing
             * @default false
             */
            guest_speaker_willing: boolean;
            /**
             * Cfp
             * @default false
             */
            cfp: boolean;
            /**
             * Cfa
             * @default false
             */
            cfa: boolean;
            /**
             * Cpa
             * @default false
             */
            cpa: boolean;
            /** Designations */
            designations: string[] | null;
            /**
             * Graduate Degree
             * @default false
             */
            graduate_degree: boolean;
            /**
             * Missing Email
             * @default false
             */
            missing_email: boolean;
            /**
             * Missing Employer
             * @default false
             */
            missing_employer: boolean;
            /**
             * Missing Phone
             * @default false
             */
            missing_phone: boolean;
            /**
             * Duplicate
             * @default false
             */
            duplicate: boolean;
            /** Is Alumni */
            is_alumni: boolean | null;
            /**
             * Include Archived
             * @default false
             */
            include_archived: boolean;
            /**
             * Sort
             * @default name
             */
            sort: string;
        };
        /**
         * AlumniExportRequest
         * @description Body for ``POST /alumni/export``: the chosen column keys (a non-empty
         *     subset of the catalog) and the active filters.
         */
        AlumniExportRequest: {
            /** Columns */
            columns: string[];
            filters?: components["schemas"]["AlumniExportFilters"];
        };
        /**
         * AlumniHygienePreview
         * @description ``hygiene.build_preview`` output: the cleaned payload, the per-field
         *     changes, soft warnings, and exact-duplicate blockers.
         */
        AlumniHygienePreview: {
            /** Cleaned */
            cleaned: {
                [key: string]: unknown;
            };
            /** Changes */
            changes: components["schemas"]["ImportChange"][];
            /** Warnings */
            warnings: {
                [key: string]: unknown;
            }[];
            /** Blockers */
            blockers: {
                [key: string]: unknown;
            }[];
        };
        /**
         * AlumniImportPreview
         * @description ``POST /alumni/import/preview`` dry-run report.
         */
        AlumniImportPreview: {
            /** Columns Ok */
            columns_ok: boolean;
            /** Header Errors */
            header_errors: string[];
            summary: components["schemas"]["AlumniImportSummary"];
            /** Rows */
            rows: components["schemas"]["AlumniImportRowReport"][];
        };
        /**
         * AlumniImportResult
         * @description ``POST /alumni/import`` commit result.
         */
        AlumniImportResult: {
            /** Imported */
            imported: number;
            /** Skipped */
            skipped: number;
            /** Created Ids */
            created_ids: number[];
            /** Rejects */
            rejects: components["schemas"]["ImportReject"][];
        };
        /** AlumniImportRowReport */
        AlumniImportRowReport: {
            /** Row */
            row: number;
            /** Name */
            name: string | null;
            /** Status */
            status: string;
            /**
             * Changes
             * @default []
             */
            changes: components["schemas"]["ImportChange"][];
            /**
             * Warnings
             * @default []
             */
            warnings: {
                [key: string]: unknown;
            }[];
            /**
             * Blockers
             * @default []
             */
            blockers: {
                [key: string]: unknown;
            }[];
            /** Error */
            error: string | null;
        };
        /** AlumniImportSummary */
        AlumniImportSummary: {
            /** Total */
            total: number;
            /** Importable */
            importable: number;
            /** Rejected */
            rejected: number;
            /** With Warnings */
            with_warnings: number;
            /** Cleaned */
            cleaned: number;
        };
        /**
         * AlumniListItem
         * @description List-row variant: adds the alumnus's current employer + industry (joined
         *     from ``current_employment``) and current city + state (from
         *     ``alumni_contact_info`` — the SAME source the geography map shades by, so the
         *     list and the map agree on a record's location) for the alumni table.
         *     Single-record reads use plain ``AlumniRead``, which omits these.
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
            /** Graduation Semester */
            graduation_semester: string | null;
            /** Graduation Class */
            graduation_class: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Graduate Graduation Year */
            graduate_graduation_year: number | null;
            /** Citizenship */
            citizenship: string | null;
            /** Marital Status */
            marital_status: string | null;
            /** Hometown */
            hometown: string | null;
            /** Home Country */
            home_country: string | null;
            /** Employment Status */
            employment_status: string | null;
            /** Other Designations */
            other_designations: string | null;
            /** Survey Completed Date */
            survey_completed_date: string | null;
            /** Profile Updated Date */
            profile_updated_date: string | null;
            /** Profile Updated By */
            profile_updated_by: string | null;
            /** Profile Updated By Name */
            profile_updated_by_name: string | null;
            /** Mba Program */
            mba_program: string | null;
            /** Law School */
            law_school: string | null;
            /** Medical School */
            medical_school: string | null;
            /** Graduate School */
            graduate_school: string | null;
            /** Startup Involvement */
            startup_involvement: string | null;
            /** Advisory Roles */
            advisory_roles: string | null;
            /** Secondary Employment */
            secondary_employment: string | null;
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
            /**
             * Is Alumni
             * @default true
             */
            is_alumni: boolean;
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
            /** Current Industry Secondary */
            current_industry_secondary: string | null;
            /** Current City */
            current_city: string | null;
            /** Current State */
            current_state: string | null;
        };
        /**
         * AlumniLocation
         * @description Interpretation of a natural-language location search (#358).
         *
         *     Returned on ``AlumniPage.location`` only when the list request carried a
         *     ``near`` phrase. ``label`` is a short human string ("Los Angeles, CA within
         *     50 mi"); ``radius_miles`` is the effective radius; ``resolved`` is ``False``
         *     when the phrase couldn't be pinpointed (the list then falls back to the
         *     normal search and the UI shows a soft note).
         */
        AlumniLocation: {
            /** Label */
            label: string;
            /** Radius Miles */
            radius_miles: number | null;
            /**
             * Resolved
             * @default true
             */
            resolved: boolean;
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
            location: components["schemas"]["AlumniLocation"] | null;
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
            /** Graduation Semester */
            graduation_semester: string | null;
            /** Graduation Class */
            graduation_class: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Graduate Graduation Year */
            graduate_graduation_year: number | null;
            /** Citizenship */
            citizenship: string | null;
            /** Marital Status */
            marital_status: string | null;
            /** Hometown */
            hometown: string | null;
            /** Home Country */
            home_country: string | null;
            /** Employment Status */
            employment_status: string | null;
            /** Other Designations */
            other_designations: string | null;
            /** Survey Completed Date */
            survey_completed_date: string | null;
            /** Profile Updated Date */
            profile_updated_date: string | null;
            /** Profile Updated By */
            profile_updated_by: string | null;
            /** Profile Updated By Name */
            profile_updated_by_name: string | null;
            /** Mba Program */
            mba_program: string | null;
            /** Law School */
            law_school: string | null;
            /** Medical School */
            medical_school: string | null;
            /** Graduate School */
            graduate_school: string | null;
            /** Startup Involvement */
            startup_involvement: string | null;
            /** Advisory Roles */
            advisory_roles: string | null;
            /** Secondary Employment */
            secondary_employment: string | null;
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
            /**
             * Is Alumni
             * @default true
             */
            is_alumni: boolean;
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
         * AlumniUpdateFieldChange
         * @description One field a matched row would change: ``old`` -> ``new``. ``old``/``new``
         *     are free-form (``Any``) since a cell can hold a string, int, bool, or date.
         */
        AlumniUpdateFieldChange: {
            /** Field */
            field: string;
            /**
             * Section
             * @default core
             */
            section: string;
            /** Old */
            old: unknown;
            /** New */
            new: unknown;
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
            /** Graduation Month */
            graduation_month: number | null;
            /** Graduation Semester */
            graduation_semester: string | null;
            /** Graduation Class */
            graduation_class: number | null;
            /** Finance Program Year */
            finance_program_year: number | null;
            /** Graduate Degree */
            graduate_degree: string | null;
            /** Graduate Graduation Year */
            graduate_graduation_year: number | null;
            /** Citizenship */
            citizenship: string | null;
            /** Marital Status */
            marital_status: string | null;
            /** Home Country */
            home_country: string | null;
            /** Employment Status */
            employment_status: string | null;
            /** Other Designations */
            other_designations: string | null;
            /** Languages */
            languages: string | null;
            /** Survey Completed Date */
            survey_completed_date: string | null;
            /** Profile Updated Date */
            readonly profile_updated_date: string | null;
            /** Profile Updated By */
            profile_updated_by: string | null;
            /** Mba Program */
            mba_program: string | null;
            /** Law School */
            law_school: string | null;
            /** Medical School */
            medical_school: string | null;
            /** Graduate School */
            graduate_school: string | null;
            /** Startup Involvement */
            startup_involvement: string | null;
            /** Advisory Roles */
            advisory_roles: string | null;
            /** Secondary Employment */
            secondary_employment: string | null;
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
            /** Is Alumni */
            is_alumni: boolean | null;
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
         * AlumniUpdatePreview
         * @description ``POST /alumni/import/update/preview`` dry-run report.
         */
        AlumniUpdatePreview: {
            /** Columns Ok */
            columns_ok: boolean;
            /** Header Errors */
            header_errors: string[];
            /**
             * Ignored Columns
             * @default []
             */
            ignored_columns: string[];
            summary: components["schemas"]["AlumniUpdateSummary"];
            /** Rows */
            rows: components["schemas"]["AlumniUpdateRowReport"][];
        };
        /**
         * AlumniUpdateResult
         * @description ``POST /alumni/import/update`` commit result.
         */
        AlumniUpdateResult: {
            /** Updated */
            updated: number;
            /** Unchanged */
            unchanged: number;
            /** Unmatched */
            unmatched: number;
            /** Errors */
            errors: number;
            /** Updated Ids */
            updated_ids: number[];
            /** Results */
            results: components["schemas"]["AlumniUpdateRowResult"][];
        };
        /**
         * AlumniUpdateRowReport
         * @description Per-row detail in an update preview.
         *
         *     ``status`` is one of ``update`` (matched, has changes), ``no_changes``
         *     (matched, nothing differs), ``unmatched`` (no active match — not created),
         *     ``unmatched_archived`` (matches only an archived record — not updated), or
         *     ``error`` (mapping/validation failure). ``message`` explains an unmatched
         *     row; ``error`` carries a mapping/validation message.
         */
        AlumniUpdateRowReport: {
            /** Row */
            row: number;
            /** Name */
            name: string | null;
            /** Alumni Id */
            alumni_id: number | null;
            /** Status */
            status: string;
            /**
             * Changes
             * @default []
             */
            changes: components["schemas"]["AlumniUpdateFieldChange"][];
            /** Error */
            error: string | null;
            /** Message */
            message: string | null;
        };
        /**
         * AlumniUpdateRowResult
         * @description Per-row outcome in an update commit. ``status`` is ``updated``,
         *     ``unchanged``, ``unmatched``, ``unmatched_archived``, or ``error``.
         */
        AlumniUpdateRowResult: {
            /** Row */
            row: number;
            /** Name */
            name: string | null;
            /** Alumni Id */
            alumni_id: number | null;
            /** Status */
            status: string;
            /** Message */
            message: string | null;
        };
        /** AlumniUpdateSummary */
        AlumniUpdateSummary: {
            /** Total */
            total: number;
            /** Matched */
            matched: number;
            /** Unmatched */
            unmatched: number;
            /** With Changes */
            with_changes: number;
            /** Errors */
            errors: number;
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
            /** Uploaded By */
            uploaded_by: string | null;
        };
        /**
         * AttendeeApplyItem
         * @description Per-approval outcome. ``status`` is ``added``, ``already_attending``
         *     (idempotent no-op — re-running the same file never double-adds), or
         *     ``not_found`` (unknown or archived alumnus).
         */
        AttendeeApplyItem: {
            /** Alumni Id */
            alumni_id: number;
            /** Row */
            row: number | null;
            /** Status */
            status: string;
            /** Name */
            name: string | null;
            /** Message */
            message: string | null;
        };
        /**
         * AttendeeApplyResult
         * @description ``POST /events/{event_id}/attendees/match/approve`` result.
         */
        AttendeeApplyResult: {
            /** Event Id */
            event_id: number;
            /** Added */
            added: number;
            /** Already Attending */
            already_attending: number;
            /** Not Found */
            not_found: number;
            /**
             * Items
             * @default []
             */
            items: components["schemas"]["AttendeeApplyItem"][];
        };
        /**
         * AttendeeApproval
         * @description One human-approved match. ``alumni_id`` is the record the reviewer PICKED
         *     — for an ambiguous row that is a real choice between candidates, and the
         *     server re-validates it (exists, not archived) before writing.
         */
        AttendeeApproval: {
            /** Alumni Id */
            alumni_id: number;
            /** Row */
            row: number | null;
            /** Attendance Status */
            attendance_status: string | null;
            /** Notes */
            notes: string | null;
        };
        /**
         * AttendeeApprovalRequest
         * @description ``POST /events/{event_id}/attendees/match/approve`` body.
         *
         *     There is deliberately no "approve everything above X% confidence" option:
         *     the client can only send ids a human ticked.
         */
        AttendeeApprovalRequest: {
            /** Approvals */
            approvals: components["schemas"]["AttendeeApproval"][];
        };
        /**
         * AttendeeCreate
         * @description Body for adding an attendee to an event (full_access). ``extra='forbid'``
         *     rejects unknown keys; ``alumni_id`` is required; ``attendance_status`` is an
         *     optional free-text label capped at 100 chars (blank collapses to None);
         *     ``notes`` is optional free-text (per-attendance notes, #181) capped at 10000
         *     chars (blank collapses to None), matching the ``attendance_notes`` the bulk
         *     importer writes.
         */
        AttendeeCreate: {
            /** Alumni Id */
            alumni_id: number;
            /** Attendance Status */
            attendance_status?: string | null;
            /** Notes */
            notes?: string | null;
        };
        /**
         * AttendeeFriendItem
         * @description Per-row outcome of creating a friend from a no-match row. ``status`` is
         *     ``created``, ``skipped`` (somebody with this name + employer is already on
         *     the event's roster — the idempotency guard, so re-posting the same file
         *     never creates a second copy) or ``rejected`` (the create path refused it,
         *     e.g. an exact duplicate).
         */
        AttendeeFriendItem: {
            /** Row */
            row: number;
            /** Name */
            name: string;
            /** Status */
            status: string;
            /** Alumni Id */
            alumni_id: number | null;
            /** Message */
            message: string | null;
        };
        /**
         * AttendeeFriendResult
         * @description ``POST /events/{event_id}/attendees/match/friends`` result. Every created
         *     friend is ALSO attached to the event, so the operator never has to make two
         *     passes.
         */
        AttendeeFriendResult: {
            /** Event Id */
            event_id: number;
            /** Created */
            created: number;
            /** Attached */
            attached: number;
            /** Rejected */
            rejected: number;
            /**
             * Skipped
             * @default 0
             */
            skipped: number;
            /**
             * Items
             * @default []
             */
            items: components["schemas"]["AttendeeFriendItem"][];
            /**
             * Header Errors
             * @default []
             */
            header_errors: string[];
        };
        /**
         * AttendeeMatchAttendee
         * @description The attendee AS THE FILE DESCRIBES THEM, echoed beside the candidates so
         *     the reviewer compares like with like.
         */
        AttendeeMatchAttendee: {
            /** Name */
            name: string;
            /** First Name */
            first_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Maiden Name */
            maiden_name: string | null;
            /** Email */
            email: string | null;
            /** Company */
            company: string | null;
            /** Title */
            title: string | null;
            /** Graduation Year */
            graduation_year: number | null;
        };
        /**
         * AttendeeMatchCandidate
         * @description One proposed alumnus for one attendee row.
         *
         *     Carries enough context to DECIDE (name, grad year, employer, title, work
         *     city/state, net id, emails) plus ``evidence`` — the human-readable reasons
         *     this record was proposed, including the ones that argue against it (an
         *     employer that differs is listed too). ``score``/``confidence`` rank
         *     candidates; they never authorise an automatic write.
         */
        AttendeeMatchCandidate: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
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
            /** Net Id */
            net_id: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /**
             * Is Alumni
             * @default true
             */
            is_alumni: boolean;
            /** Employer */
            employer: string | null;
            /** Title */
            title: string | null;
            /** City */
            city: string | null;
            /** State */
            state: string | null;
            /** Personal Email */
            personal_email: string | null;
            /** Work Email */
            work_email: string | null;
            /** Tier */
            tier: string;
            /** Score */
            score: number;
            /** Confidence */
            confidence: string;
            /**
             * Evidence
             * @default []
             */
            evidence: string[];
            /**
             * Already Attending
             * @default false
             */
            already_attending: boolean;
        };
        /**
         * AttendeeMatchEventEcho
         * @description The event the upload is scoped to — there is always an obvious
         *     "attending what?" answer (Jake, 2026-08-04).
         */
        AttendeeMatchEventEcho: {
            /** Event Id */
            event_id: number;
            /** Event Name */
            event_name: string;
            /** Event Date */
            event_date: string | null;
        };
        /**
         * AttendeeMatchPreview
         * @description ``POST /events/{event_id}/attendees/match/preview`` — a DRY RUN.
         *
         *     ``ignored_columns`` are the file's columns that map to no DB field. They are
         *     dropped, reported, and never an error (Jake, 2026-08-04).
         */
        AttendeeMatchPreview: {
            /** Columns Ok */
            columns_ok: boolean;
            /**
             * Header Errors
             * @default []
             */
            header_errors: string[];
            /**
             * Ignored Columns
             * @default []
             */
            ignored_columns: string[];
            event: components["schemas"]["AttendeeMatchEventEcho"] | null;
            summary: components["schemas"]["AttendeeMatchSummary"];
            /**
             * Rows
             * @default []
             */
            rows: components["schemas"]["AttendeeMatchRow"][];
            /**
             * Warnings
             * @default []
             */
            warnings: {
                [key: string]: unknown;
            }[];
        };
        /**
         * AttendeeMatchRow
         * @description One row of the uploaded attendee list and what was proposed for it.
         *
         *     ``status``:
         *       * ``matched``    — exactly ONE plausible record. Still a proposal: it is
         *         written only when a human approves that specific ``alumni_id``.
         *       * ``ambiguous``  — several plausible records. ALL of them are in
         *         ``candidates``; the top-scoring one is never silently chosen.
         *       * ``no_match``   — nothing plausible. Eligible for friend creation.
         *       * ``not_reviewed`` — the review hit its aggregate disclosure budget before
         *         reaching this row. NOT the same as ``no_match``: re-upload the remaining
         *         rows as a smaller file rather than creating friends for them.
         *     ``friend_fields`` lists the DB fields a friend record built from this row
         *     would carry, so "create a friend" is not a black box.
         */
        AttendeeMatchRow: {
            /** Row */
            row: number;
            /** Status */
            status: string;
            attendee: components["schemas"]["AttendeeMatchAttendee"];
            /** Match Key */
            match_key: string;
            /**
             * Candidates
             * @default []
             */
            candidates: components["schemas"]["AttendeeMatchCandidate"][];
            /**
             * Warnings
             * @default []
             */
            warnings: string[];
            /**
             * Friend Fields
             * @default []
             */
            friend_fields: string[];
        };
        /**
         * AttendeeMatchSummary
         * @description ``not_reviewed`` counts rows the review deliberately stopped short of:
         *     one preview may surface at most ``MAX_CANDIDATES_TOTAL`` alumni records, and
         *     saying "not reviewed" is honest where "no match" would read as "she isn't in
         *     the database" and invite a duplicate friend record.
         */
        AttendeeMatchSummary: {
            /** Total Rows */
            total_rows: number;
            /** Matched */
            matched: number;
            /** Ambiguous */
            ambiguous: number;
            /** No Match */
            no_match: number;
            /**
             * Not Reviewed
             * @default 0
             */
            not_reviewed: number;
            /** Already Attending */
            already_attending: number;
        };
        /**
         * AttendeeRead
         * @description One row of an event's attendee roster (view access). ``notes`` surfaces the
         *     per-attendance ``attendance_notes`` (#181) — previously write-only "dark data"
         *     set by the bulk importer with no read path.
         */
        AttendeeRead: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** Graduation Year */
            graduation_year: number | null;
            /** Attendance Status */
            attendance_status: string | null;
            /** Notes */
            notes: string | null;
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
            /** Performed By */
            performed_by: string | null;
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
            /** Session Id */
            session_id: string | null;
        };
        /**
         * BirthdayRow
         * @description One alumnus with a birthday this month (``GET /dashboard/birthdays``).
         *     Only the recurring month+day is exposed — never the birth year (FERPA).
         */
        BirthdayRow: {
            /** Id */
            id: number;
            /** First Name */
            first_name: string | null;
            /** Last Name */
            last_name: string | null;
            /** Current Employer */
            current_employer: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Birth Month */
            birth_month: number | null;
            /** Birth Day */
            birth_day: number | null;
        };
        /** Body_create_attendee_friends_events__event_id__attendees_match_friends_post */
        Body_create_attendee_friends_events__event_id__attendees_match_friends_post: {
            /** File */
            file: string;
            /** Rows */
            rows: string;
        };
        /** Body_import_alumni_alumni_import_post */
        Body_import_alumni_alumni_import_post: {
            /** File */
            file: string;
        };
        /** Body_import_donations_commit_donations_import_post */
        Body_import_donations_commit_donations_import_post: {
            /** File */
            file: string;
        };
        /** Body_import_events_commit_events_import_post */
        Body_import_events_commit_events_import_post: {
            /** File */
            file: string;
            /** Event Name */
            event_name: string;
            /** Event Date */
            event_date?: string | null;
            /** Event Type */
            event_type?: string | null;
            /** Event Location */
            event_location?: string | null;
            /** Event Notes */
            event_notes?: string | null;
        };
        /** Body_preview_attendee_match_events__event_id__attendees_match_preview_post */
        Body_preview_attendee_match_events__event_id__attendees_match_preview_post: {
            /** File */
            file: string;
        };
        /** Body_preview_import_alumni_alumni_import_preview_post */
        Body_preview_import_alumni_alumni_import_preview_post: {
            /** File */
            file: string;
        };
        /** Body_preview_import_donations_donations_import_preview_post */
        Body_preview_import_donations_donations_import_preview_post: {
            /** File */
            file: string;
        };
        /** Body_preview_import_events_events_import_preview_post */
        Body_preview_import_events_events_import_preview_post: {
            /** File */
            file: string;
            /** Event Name */
            event_name: string;
            /** Event Date */
            event_date?: string | null;
            /** Event Type */
            event_type?: string | null;
            /** Event Location */
            event_location?: string | null;
            /** Event Notes */
            event_notes?: string | null;
        };
        /** Body_preview_update_import_alumni_alumni_import_update_preview_post */
        Body_preview_update_import_alumni_alumni_import_update_preview_post: {
            /** File */
            file: string;
        };
        /** Body_survey_submit_photo_survey_respond__token__photo_post */
        Body_survey_submit_photo_survey_respond__token__photo_post: {
            /** Survey Response Id */
            survey_response_id: number;
            /** Photo */
            photo: string;
        };
        /** Body_update_import_alumni_alumni_import_update_post */
        Body_update_import_alumni_alumni_import_update_post: {
            /** File */
            file: string;
        };
        /** Body_upload_headshot_alumni__alumni_id__headshot_put */
        Body_upload_headshot_alumni__alumni_id__headshot_put: {
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
        /**
         * CapabilityInfo
         * @description One capability row in the matrix — code plus UI-facing copy.
         *
         *     ``assignable`` is False for the engineer meta-capability, which the editor
         *     renders locked to the engineer (it cannot be granted to another role).
         */
        CapabilityInfo: {
            /** Code */
            code: string;
            /** Label */
            label: string;
            /** Description */
            description: string;
            /** Assignable */
            assignable: boolean;
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
            /** Preferred Contact Method */
            preferred_contact_method?: string | null;
            /** Best Contact */
            best_contact?: string | null;
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
            /** Preferred Contact Method */
            preferred_contact_method: string | null;
            /** Best Contact */
            best_contact: string | null;
        };
        /**
         * CountryCount
         * @description Per-country alumni count for the world map (international alumni only).
         */
        CountryCount: {
            /** Country */
            country: string;
            /** Alumni Count */
            alumni_count: number;
        };
        /**
         * CountryDetail
         * @description Aggregate drill-down for one country (world-view country click-through).
         *
         *     No cities (international city data isn't populated) — count + top employers /
         *     industries + grad-year histogram, mirroring ``StateDetail``.
         */
        CountryDetail: {
            /** Country */
            country: string;
            /** Alumni Count */
            alumni_count: number;
            /** Employers */
            employers: components["schemas"]["EmployerCount"][];
            /** Industries */
            industries: components["schemas"]["IndustryCount"][];
            /** By Graduation Year */
            by_graduation_year: components["schemas"]["YearCount"][];
        };
        /**
         * CountyCount
         * @description Per-county alumni count for the national county choropleth.
         *
         *     ``county_fips`` is the 5-digit FIPS code (matching the us-atlas county ids
         *     the map renders).
         */
        CountyCount: {
            /** County Fips */
            county_fips: string;
            /** Count */
            count: number;
        };
        /**
         * CreateUserRequest
         * @description Provision a new login user. ``role_name`` accepts any known role; WHICH
         *     role the creator may actually assign is enforced in the handler by the
         *     privilege-ceiling guard (an actor can only create a user at or below their
         *     own tier) — mirroring the assign-role endpoint, so a super_admin still can't
         *     bootstrap an engineer above their own tier. An unknown role is a 422; names
         *     follow the alumni NAME rules (≤100 chars). ``extra='forbid'`` rejects unknown
         *     keys.
         */
        CreateUserRequest: {
            /** Email */
            email: string;
            /** First Name */
            first_name?: string | null;
            /** Last Name */
            last_name?: string | null;
            /** @default view_only */
            role_name: components["schemas"]["RoleName"];
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
         * DashboardEmployerCount
         * @description One employer bucket in the top-employers distribution.
         */
        DashboardEmployerCount: {
            /** Employer */
            employer: string;
            /** Count */
            count: number;
        };
        /**
         * DashboardGradYearCount
         * @description One graduation-year bucket in the cohort distribution.
         */
        DashboardGradYearCount: {
            /** Year */
            year: number;
            /** Count */
            count: number;
        };
        /**
         * DashboardIndustryBreakdown
         * @description Industry breakdown for the dashboard wheel (#351/#352/#353).
         *
         *     ``industries`` covers EVERY canonical finance industry (from the controlled
         *     vocab) — including ones with a count of 0 — so the legend can list them all.
         *     ``other`` (the catch-all "Other" vocab value + any non-canonical value) and
         *     ``unknown`` (active alumni with NO industry on file) are SEPARATE buckets,
         *     distinct from each other. ``graduate_student`` (#294) is likewise its own
         *     bucket — alumni whose current industry is "Graduate Student" — split out of
         *     ``other`` so the dashboard can show it as its own bar. "Military" (#608) gets
         *     NO such bucket — Jake kept the chart about finance sectors, so it folds into
         *     ``other`` like any other non-wheel value.
         */
        DashboardIndustryBreakdown: {
            /** Industries */
            industries: components["schemas"]["DashboardIndustryCount"][];
            /** Other */
            other: number;
            /** Unknown */
            unknown: number;
            /** Graduate Student */
            graduate_student: number;
        };
        /**
         * DashboardIndustryCount
         * @description One finance-industry bucket in the industry breakdown (#353).
         */
        DashboardIndustryCount: {
            /** Industry */
            industry: string;
            /** Count */
            count: number;
        };
        /**
         * DashboardPresetCreate
         * @description Add a quick-filter preset (engineer / super_admin).
         */
        DashboardPresetCreate: {
            /** Label */
            label: string;
            /** Href */
            href: string;
            /**
             * Sort Order
             * @default 0
             */
            sort_order: number;
        };
        /** DashboardPresetRead */
        DashboardPresetRead: {
            /** Dashboard Preset Id */
            dashboard_preset_id: number;
            /** Label */
            label: string;
            /** Href */
            href: string;
            /** Sort Order */
            sort_order: number;
        };
        /**
         * DashboardPresetUpdate
         * @description Edit a quick-filter preset. Only fields present are applied.
         */
        DashboardPresetUpdate: {
            /** Label */
            label?: string | null;
            /** Href */
            href?: string | null;
            /** Sort Order */
            sort_order?: number | null;
        };
        /**
         * DashboardStateCount
         * @description One state bucket in the by-state distribution.
         */
        DashboardStateCount: {
            /** State */
            state: string;
            /** Count */
            count: number;
        };
        /**
         * DashboardSummary
         * @description KPIs + distributions for ``GET /dashboard/summary`` (aggregate counts
         *     only; no per-alumnus identity).
         */
        DashboardSummary: {
            /** Total Alumni */
            total_alumni: number;
            /** Archived */
            archived: number;
            /** Deceased */
            deceased: number;
            /** Missing Email */
            missing_email: number;
            /** Missing Employer */
            missing_employer: number;
            /** Contacted This Month */
            contacted_this_month: number;
            /** Alumni Edited This Month */
            alumni_edited_this_month: number;
            /** Not Contacted 6Mo */
            not_contacted_6mo: number;
            /** Not Contacted 12Mo */
            not_contacted_12mo: number;
            /** Not Contacted 24Mo */
            not_contacted_24mo: number;
            /** Upcoming Follow Ups */
            upcoming_follow_ups: number;
            /** Duplicate Count */
            duplicate_count: number;
            /** Attended Event This Month */
            attended_event_this_month: number;
            /** Upcoming Events */
            upcoming_events: number;
            /** Events This Month */
            events_this_month: number;
            /** Guest Speakers This Month */
            guest_speakers_this_month: number;
            /** Piff Donors */
            piff_donors: number;
            /** Willing Mentors */
            willing_mentors: number;
            /** By Graduation Year */
            by_graduation_year: components["schemas"]["DashboardGradYearCount"][];
            /** Top Employers */
            top_employers: components["schemas"]["DashboardEmployerCount"][];
            /** By State */
            by_state: components["schemas"]["DashboardStateCount"][];
            industry_breakdown: components["schemas"]["DashboardIndustryBreakdown"];
        };
        /**
         * DataQuality
         * @description Data-quality alert counts for ``GET /dashboard/data-quality``.
         */
        DataQuality: {
            /** Total Alumni */
            total_alumni: number;
            /** Complete Alumni */
            complete_alumni: number;
            /** Missing Email */
            missing_email: number;
            /** Missing Employer */
            missing_employer: number;
            /** Missing Phone */
            missing_phone: number;
            /** Duplicate Count */
            duplicate_count: number;
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
        /**
         * DonationCreate
         * @description Body for adding a donation to an alumnus (super_admin). ``extra='forbid'``
         *     rejects unknown keys. ``amount`` is required and non-negative; ``year`` is
         *     required; ``month`` is optional (1-12); ``notes`` is optional free text.
         */
        DonationCreate: {
            /** Amount */
            amount: number | string;
            /** Year */
            year: number;
            /** Month */
            month?: number | null;
            /** Notes */
            notes?: string | null;
        };
        /**
         * DonationImportPreview
         * @description ``POST /donations/import/preview`` dry-run report.
         */
        DonationImportPreview: {
            /** Columns Ok */
            columns_ok: boolean;
            /** Header Errors */
            header_errors: string[];
            summary: components["schemas"]["DonationImportSummary"];
            /** Rows */
            rows: components["schemas"]["DonationImportRowReport"][];
        };
        /**
         * DonationImportResult
         * @description ``POST /donations/import`` commit result.
         */
        DonationImportResult: {
            /** Imported */
            imported: number;
            /** Skipped */
            skipped: number;
            /** Rejects */
            rejects: components["schemas"]["ImportReject"][];
        };
        /** DonationImportRowReport */
        DonationImportRowReport: {
            /** Row */
            row: number;
            /** Mstid */
            mstid: string | null;
            /** Name */
            name: string | null;
            /** Match Method */
            match_method: string | null;
            /** Month */
            month: number | null;
            /** Year */
            year: number | null;
            /** Amount */
            amount: number | null;
            /** Alumni Id */
            alumni_id: number | null;
            /** Status */
            status: string;
            /**
             * Blockers
             * @default []
             */
            blockers: {
                [key: string]: unknown;
            }[];
            /**
             * Warnings
             * @default []
             */
            warnings: {
                [key: string]: unknown;
            }[];
        };
        /** DonationImportSummary */
        DonationImportSummary: {
            /** Total */
            total: number;
            /** Importable */
            importable: number;
            /** Rejected */
            rejected: number;
        };
        /**
         * DonationUpdate
         * @description Partial update of a donation (super_admin). Every field optional; only the
         *     keys sent are applied. Reuses ``DonationCreate``'s validators.
         */
        DonationUpdate: {
            /** Amount */
            amount?: number | string | null;
            /** Year */
            year?: number | null;
            /** Month */
            month?: number | null;
            /** Notes */
            notes?: string | null;
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
            /** Cfp Designation */
            cfp_designation?: string | null;
            /** Cfa Designation */
            cfa_designation?: string | null;
            /** Cpa Designation */
            cpa_designation?: string | null;
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
        /**
         * EngineerActionPage
         * @description A page of engineer actions, newest first, with the total for pagination.
         */
        EngineerActionPage: {
            /** Items */
            items: components["schemas"]["EngineerActionRow"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /**
         * EngineerActionRow
         * @description One recorded engineer action for the super_admin oversight view.
         *     ``actor_user_id`` is null once the engineer has been deleted; ``actor_email``
         *     is the snapshot taken at write time, so the row still shows who acted.
         */
        EngineerActionRow: {
            /** Engineer Action Log Id */
            engineer_action_log_id: number;
            /** Actor User Id */
            actor_user_id: number | null;
            /** Actor Email */
            actor_email: string | null;
            /** Action Type */
            action_type: string;
            /** Entity Type */
            entity_type: string;
            /** Entity Id */
            entity_id: number | null;
            /** Field Name */
            field_name: string | null;
            /** Old Value */
            old_value: string | null;
            /** New Value */
            new_value: string | null;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
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
         *     ``event_date`` is REQUIRED (M4) — a missing date is a 422, never a dateless
         *     event. ``event_type``/``event_location`` are capped at 255 chars and
         *     ``event_notes`` at 10000 chars.
         *
         *     Note: ``event_type`` stays OPTIONAL — it's free text with no enforced
         *     controlled vocabulary at the schema layer, and bulk-imported events may
         *     legitimately have no type; requiring it would reject valid data.
         */
        EventCreate: {
            /** Event Name */
            event_name: string;
            /** Event Type */
            event_type?: string | null;
            /**
             * Event Date
             * Format: date
             */
            event_date: string;
            /** Event Location */
            event_location?: string | null;
            /** Event Notes */
            event_notes?: string | null;
        };
        /** EventImportAttendee */
        EventImportAttendee: {
            /** Row */
            row: number;
            /** Net Id */
            net_id: string | null;
            /** Name */
            name: string | null;
            /** Notes */
            notes: string | null;
            /** Matched */
            matched: boolean;
            /** Alumni Id */
            alumni_id: number | null;
        };
        /**
         * EventImportEventMeta
         * @description The event identity entered in the wizard (echoed back in the report).
         */
        EventImportEventMeta: {
            /** Event Name */
            event_name: string | null;
            /** Event Date */
            event_date: string | null;
            /** Event Type */
            event_type: string | null;
            /** Event Location */
            event_location: string | null;
            /** Event Notes */
            event_notes: string | null;
        };
        /**
         * EventImportPreview
         * @description ``POST /events/import/preview`` dry-run report.
         */
        EventImportPreview: {
            /** Columns Ok */
            columns_ok: boolean;
            /** Header Errors */
            header_errors: string[];
            event: components["schemas"]["EventImportEventMeta"];
            /** Importable */
            importable: boolean;
            /** Event Errors */
            event_errors: {
                [key: string]: unknown;
            }[];
            summary: components["schemas"]["EventImportSummary"];
            /** Attendees */
            attendees: components["schemas"]["EventImportAttendee"][];
            /** Warnings */
            warnings: {
                [key: string]: unknown;
            }[];
        };
        /**
         * EventImportResult
         * @description ``POST /events/import`` commit result.
         */
        EventImportResult: {
            /** Imported */
            imported: boolean;
            /** Event Id */
            event_id: number | null;
            /** Imported Attendees */
            imported_attendees: number;
            /** Unmatched */
            unmatched: components["schemas"]["EventImportUnmatched"][];
            /** Event Error */
            event_error: string | null;
        };
        /** EventImportSummary */
        EventImportSummary: {
            /** Total Rows */
            total_rows: number;
            /** Attendees Matched */
            attendees_matched: number;
            /** Attendees Unmatched */
            attendees_unmatched: number;
        };
        /** EventImportUnmatched */
        EventImportUnmatched: {
            /** Row */
            row: number;
            /** Net Id */
            net_id: string | null;
            /** Name */
            name: string | null;
        };
        /**
         * EventParticipationRow
         * @description One event with its attendee count
         *     (``GET /dashboard/event-participation``).
         */
        EventParticipationRow: {
            /** Event Id */
            event_id: number;
            /** Event Name */
            event_name: string | null;
            /** Event Type */
            event_type: string | null;
            /** Event Date */
            event_date: string | null;
            /** Participant Count */
            participant_count: number;
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
        /**
         * ExportColumn
         * @description One offerable export column: a stable ``key``, a human ``label`` for the
         *     CSV header + the picker, and a ``group`` for sectioning the picker UI.
         */
        ExportColumn: {
            /** Key */
            key: string;
            /** Label */
            label: string;
            /** Group */
            group: string;
        };
        /**
         * ExportColumnCatalog
         * @description The full set of exportable columns plus the default-checked selection.
         */
        ExportColumnCatalog: {
            /** Columns */
            columns: components["schemas"]["ExportColumn"][];
            /** Default Selected */
            default_selected: string[];
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
            /** Secondary Industries */
            secondary_industries: string[];
            /** Employment Statuses */
            employment_statuses: string[];
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
            /** Graduation Classes */
            graduation_classes: number[];
        };
        /**
         * FollowUpRow
         * @description One open follow-up task in ``GET /dashboard/follow-ups``.
         */
        FollowUpRow: {
            /** Task Id */
            task_id: number;
            /** Alumni Id */
            alumni_id: number;
            /** Alumni Name */
            alumni_name: string;
            /** Title */
            title: string | null;
            /** Due Date */
            due_date: string | null;
            /** Assigned To */
            assigned_to: string | null;
        };
        /**
         * FormerCreate
         * @description A single PRIOR (non-current) role -> one ``employment_history`` row.
         *
         *     max_length mirrors database/schema.sql column widths (see ContactCreate).
         *     The service persists this with ``is_current=False``.
         */
        FormerCreate: {
            /** Employer Name */
            employer_name?: string | null;
            /** Employment Title */
            employment_title?: string | null;
            /** Employment Industry */
            employment_industry?: string | null;
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
        /**
         * GraduationYearCount
         * @description One graduation year present in the DB + how many eligible alumni it has.
         *     Drives the survey console's year picker.
         */
        GraduationYearCount: {
            /** Graduation Year */
            graduation_year: number;
            /** Total Alumni */
            total_alumni: number;
            /**
             * Responded
             * @default 0
             */
            responded: number;
            /**
             * Unreachable
             * @default 0
             */
            unreachable: number;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail: components["schemas"]["ValidationError"][];
        };
        /**
         * HeadshotBulkConfirmFile
         * @description One file's client-reported upload outcome. ``uploaded`` is the browser's
         *     claim that its direct PUT succeeded — the server re-derives the net_id,
         *     re-resolves the alumnus, and re-validates the landed object regardless, so
         *     this only decides whether an object is worth probing.
         */
        HeadshotBulkConfirmFile: {
            /** Filename */
            filename: string;
            /**
             * Uploaded
             * @default false
             */
            uploaded: boolean;
            /** Message */
            message: string | null;
        };
        /**
         * HeadshotBulkConfirmRequest
         * @description ``POST /alumni/headshots/bulk/confirm`` request: every file in the batch
         *     with the browser's per-file upload outcome.
         */
        HeadshotBulkConfirmRequest: {
            /** Files */
            files: components["schemas"]["HeadshotBulkConfirmFile"][];
        };
        /**
         * HeadshotBulkItem
         * @description Per-file outcome in a bulk headshot import (#401).
         *
         *     ``status`` is one of:
         *       * ``matched``  — net_id resolved to an alumnus and the image was uploaded;
         *       * ``no_match`` — no alumnus has that net_id (nothing uploaded);
         *       * ``invalid``  — bad MIME type, empty file, or over the per-file size cap;
         *       * ``error``    — storage upload failed (transient / service error).
         *     ``net_id`` is the value derived from the file name (basename minus extension),
         *     echoed even when unmatched so the caller can reconcile.
         */
        HeadshotBulkItem: {
            /** Filename */
            filename: string;
            /** Net Id */
            net_id: string | null;
            /** Status */
            status: string;
            /** Message */
            message: string;
        };
        /**
         * HeadshotBulkResult
         * @description ``POST /alumni/headshots/bulk/confirm`` per-file report + tallies.
         */
        HeadshotBulkResult: {
            /** Total */
            total: number;
            /** Matched */
            matched: number;
            /** No Match */
            no_match: number;
            /** Invalid */
            invalid: number;
            /** Errors */
            errors: number;
            /** Items */
            items: components["schemas"]["HeadshotBulkItem"][];
        };
        /**
         * HeadshotBulkUploadRequest
         * @description Filenames the browser wants signed upload URLs for (#595). METADATA ONLY
         *     — image bytes never travel through the function, which is what broke the old
         *     multipart route on Vercel's ~4.5 MB request-body cap.
         */
        HeadshotBulkUploadRequest: {
            /** Filenames */
            filenames: string[];
        };
        /**
         * HeadshotBulkUploadTarget
         * @description Per-filename outcome of minting bulk upload URLs.
         *
         *     ``status`` is one of:
         *       * ``ready``    — the net_id matched an alumnus; PUT the image to
         *         ``upload_url`` (which is scoped SERVER-SIDE to that alumnus's object
         *         key — the browser never chooses a key);
         *       * ``no_match`` — no alumnus has that net_id; nothing to upload;
         *       * ``invalid``  — the file name has no usable net_id or isn't a
         *         JPEG/PNG/WebP by extension.
         *     Only ``ready`` carries an ``upload_url``.
         */
        HeadshotBulkUploadTarget: {
            /** Filename */
            filename: string;
            /** Net Id */
            net_id: string | null;
            /** Status */
            status: string;
            /** Message */
            message: string;
            /** Upload Url */
            upload_url: string | null;
        };
        /**
         * HeadshotBulkUploadUrls
         * @description ``POST /alumni/headshots/bulk/upload-urls`` response.
         */
        HeadshotBulkUploadUrls: {
            /** Targets */
            targets: components["schemas"]["HeadshotBulkUploadTarget"][];
        };
        /**
         * HeadshotUrls
         * @description Signed headshot URLs for a batch of alumni, keyed by ``alumni_id``.
         *
         *     Every requested id is present in ``urls``; the value is ``None`` when the
         *     alumnus has no net ID (the object key) or no image on file. Batching exists
         *     so a roster page costs ONE request instead of one per row — see
         *     ``GET /alumni/headshots/urls``.
         */
        HeadshotUrls: {
            /** Urls */
            urls: {
                [key: string]: string | null;
            };
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
        /**
         * ImportChange
         * @description One field the cleaning step normalized: ``before`` -> ``after``.
         */
        ImportChange: {
            /** Section */
            section: string;
            /** Field */
            field: string;
            /** Label */
            label: string;
            /** Before */
            before: unknown;
            /** After */
            after: unknown;
        };
        /**
         * ImportReject
         * @description One skipped row in a commit result.
         */
        ImportReject: {
            /** Row */
            row: number;
            /** Name */
            name: string | null;
            /** Reason */
            reason: string;
        };
        /** IndustryCount */
        IndustryCount: {
            /** Industry */
            industry: string;
            /** Count */
            count: number;
        };
        /**
         * InteractionActivity
         * @description One interaction row in the activity feed / contacted-this-month list.
         *
         *     Matches ``dashboard._serialize_interaction`` exactly. ``by`` is the actor's
         *     display name (email fallback); ``by_user_id`` their user id — both null when
         *     the actor user was removed. No internal user PK beyond ``by_user_id``.
         */
        InteractionActivity: {
            /** Interaction Id */
            interaction_id: number;
            /** Alumni Id */
            alumni_id: number;
            /** Alumni Name */
            alumni_name: string;
            /** Type */
            type: string | null;
            /** When */
            when: string | null;
            /** By */
            by: string | null;
            /** By User Id */
            by_user_id: number | null;
        };
        /**
         * InteractionCreate
         * @description Log an interaction against an alumni (Interactions tab).
         *
         *     ``interaction_type`` and ``interaction_date_time`` are both REQUIRED (H1) —
         *     an empty payload is a 422, never a silently-defaulted record. The date/time
         *     must not be in the future (H2).
         */
        InteractionCreate: {
            /** Interaction Type */
            interaction_type: string;
            /**
             * Interaction Date Time
             * Format: date-time
             */
            interaction_date_time: string;
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
         * InteractionUpdate
         * @description Edit fields on an existing interaction (all optional).
         */
        InteractionUpdate: {
            /** Interaction Type */
            interaction_type?: string | null;
            /** Interaction Date Time */
            interaction_date_time?: string | null;
            /** Interaction Notes */
            interaction_notes?: string | null;
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
         * @description Optional client context for a sign-in attempt, forwarded by the frontend
         *     login action from the incoming request — the client IP (``x-forwarded-for``)
         *     and Vercel's IP-geolocation headers. All optional and length-bounded; purely
         *     informational (never trusted for authorization), stored on the
         *     ``login_events`` row (success) or ``login_failures`` row (failure) for the
         *     engineer Logins tabs. ``extra='forbid'`` rejects unknown keys.
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
         * LoginFailurePage
         * @description A page of login failures, newest first, with the total for pagination.
         */
        LoginFailurePage: {
            /** Items */
            items: components["schemas"]["LoginFailureRow"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /**
         * LoginFailureRow
         * @description One recorded FAILED sign-in for the engineer Login-failures tab. ``email``
         *     is the attempted address, snapshotted at the attempt (it may not belong to any
         *     account — a probe/typo). ``ip_address`` + ``city``/``region``/``country`` are
         *     the approximate (IP-based) origin, and ``reason`` a coarse failure code; any
         *     may be null.
         */
        LoginFailureRow: {
            /** Login Failure Id */
            login_failure_id: number;
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
            /** Reason */
            reason: string | null;
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
         * LoginPurgeResult
         * @description Count of login-history rows removed by the engineer purge (#200).
         */
        LoginPurgeResult: {
            /** Deleted */
            deleted: number;
        };
        /**
         * LoginRecordRequest
         * @description Outcome of a login attempt, to update the rolling failed-login counter.
         *
         *     On a FAILURE the optional ``context`` (client IP + geo) and coarse ``reason``
         *     are also logged as a per-attempt ``login_failures`` row (the engineer
         *     Login-failures tab). Both are ignored on success. ``extra='forbid'`` rejects
         *     unknown keys.
         */
        LoginRecordRequest: {
            /** Email */
            email: string;
            /** Success */
            success: boolean;
            context?: components["schemas"]["LoginContext"] | null;
            /** Reason */
            reason?: string | null;
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
         * MaintenanceEnableRequest
         * @description Optional override for the public maintenance message.
         *
         *     Bounded because the value is rendered to the public. Omit (or send null) to
         *     use the default copy.
         */
        MaintenanceEnableRequest: {
            /** Message */
            message?: string | null;
        };
        /**
         * MaintenanceEnableResult
         * @description State after enabling, plus how many sessions the switch ended.
         */
        MaintenanceEnableResult: {
            /** Enabled */
            enabled: boolean;
            /** Message */
            message: string | null;
            /** Enabled At */
            enabled_at: string | null;
            /** Enabled By Email */
            enabled_by_email: string | null;
            /**
             * Sessions Ended
             * @default 0
             */
            sessions_ended: number;
        };
        /**
         * MaintenanceState
         * @description Engineer-console view: the public status plus operational detail.
         */
        MaintenanceState: {
            /** Enabled */
            enabled: boolean;
            /** Message */
            message: string | null;
            /** Enabled At */
            enabled_at: string | null;
            /** Enabled By Email */
            enabled_by_email: string | null;
        };
        /**
         * MaintenanceStatus
         * @description PUBLIC status — the only thing an unauthenticated caller may learn.
         *
         *     ``enabled`` plus the engineer-authored public ``message``. NEVER add the
         *     actor, the timestamps, version/build info, or any other internal detail:
         *     this endpoint is reachable by anyone on the internet.
         */
        MaintenanceStatus: {
            /** Enabled */
            enabled: boolean;
            /** Message */
            message: string | null;
        };
        /**
         * NoteCreate
         * @description Body for creating a note. ``extra='forbid'`` rejects unknown keys.
         */
        NoteCreate: {
            entity_type: components["schemas"]["NoteEntityType"];
            /** Entity Id */
            entity_id: number;
            /** Body */
            body: string;
        };
        /**
         * NoteEntityType
         * @description The three levels a note can attach to.
         * @enum {string}
         */
        NoteEntityType: "alumni" | "interaction" | "event";
        /**
         * NoteRead
         * @description A note as returned to clients. ``author`` is the resolved display name of
         *     the creator (snapshot of the user record at read time, or ``None`` if the
         *     user was deleted).
         */
        NoteRead: {
            /** Note Id */
            note_id: number;
            entity_type: components["schemas"]["NoteEntityType"];
            /** Entity Id */
            entity_id: number;
            /** Body */
            body: string;
            /** Author */
            author: string | null;
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
         * NoteUpdate
         * @description Body for editing a note. Only the free-text body is mutable; the attach
         *     target is fixed at creation.
         */
        NoteUpdate: {
            /** Body */
            body: string;
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
         * PayItForwardSummary
         * @description Per-alumnus Pay It Forward Fund roll-up shown on the profile (#403).
         *
         *     Aggregated from the donations ledger. ``last_donation_amount`` and
         *     ``total_lifetime_amount`` are DOLLAR amounts, gated to amount-viewers
         *     (full_access+) exactly like the donations endpoints — they are ``null`` for a
         *     caller without that capability, while ``donation_count`` and
         *     ``last_donation_date`` stay visible. ``last_donation_date`` is month-level:
         *     the ledger records a year + optional month (no day), so the day is always the
         *     1st and the month defaults to January when only a year is on file. A
         *     non-donor has ``donation_count == 0`` and every other field ``null``.
         */
        PayItForwardSummary: {
            /** Last Donation Amount */
            last_donation_amount: number | null;
            /** Last Donation Date */
            last_donation_date: string | null;
            /** Total Lifetime Amount */
            total_lifetime_amount: number | null;
            /**
             * Donation Count
             * @default 0
             */
            donation_count: number;
        };
        /**
         * PermissionMatrix
         * @description The full permission config: every capability and every role's grants.
         *
         *     Ordered most → least privileged. The capabilities table (#163) renders the
         *     non-engineer roles; the permission editor (#164) renders the full matrix and
         *     toggles the editable cells.
         */
        PermissionMatrix: {
            /** Capabilities */
            capabilities: components["schemas"]["CapabilityInfo"][];
            /** Roles */
            roles: components["schemas"]["RoleGrants"][];
        };
        /**
         * PermissionToggleRequest
         * @description Grant or revoke a single capability for a single role.
         */
        PermissionToggleRequest: {
            /** Role */
            role: string;
            /** Capability */
            capability: string;
            /** Granted */
            granted: boolean;
        };
        /**
         * PreviewLogRequest
         * @description Record that the engineer entered preview-as-role mode for ``role`` (#165).
         */
        PreviewLogRequest: {
            /** Role */
            role: string;
        };
        /**
         * PreviewLogResponse
         * @description Acknowledgement that a preview-as-role entry was logged.
         */
        PreviewLogResponse: {
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
            /** Next Survey Date */
            next_survey_date: string | null;
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
            pay_it_forward: components["schemas"]["PayItForwardSummary"];
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
            cfp_designation: string | null;
            /** Cfa Designation */
            cfa_designation: string | null;
            /** Cpa Designation */
            cpa_designation: string | null;
            /** Engagement Notes */
            engagement_notes: string | null;
        };
        /** RadiusAlumniRow */
        RadiusAlumniRow: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** City */
            city: string | null;
            /** State */
            state: string | null;
            /** Graduation Year */
            graduation_year: number | null;
            /** Current Employer */
            current_employer: string | null;
            /** Current Title */
            current_title: string | null;
            /** Distance Miles */
            distance_miles: number;
        };
        /** RadiusPage */
        RadiusPage: {
            /** Items */
            items: components["schemas"]["RadiusAlumniRow"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
            /** Center Lat */
            center_lat: number;
            /** Center Lng */
            center_lng: number;
            /** Radius Miles */
            radius_miles: number;
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
         * RoleGrants
         * @description A role and the capability codes it currently holds.
         *
         *     ``editable`` is False for the engineer (its grants are fixed — it always
         *     holds everything). ``label`` is the display name (``view_only`` → "Professor").
         */
        RoleGrants: {
            /** Role */
            role: string;
            /** Label */
            label: string;
            /** Editable */
            editable: boolean;
            /** Capabilities */
            capabilities: string[];
        };
        /**
         * RoleName
         * @enum {string}
         */
        RoleName: "engineer" | "super_admin" | "full_access" | "student" | "view_only";
        /**
         * SessionActiveResponse
         * @description Whether the caller's session is still the account's single active one.
         */
        SessionActiveResponse: {
            /** Active */
            active: boolean;
        };
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
         * StateRegionMap
         * @description The 50-states + DC -> region crosswalk, plus the valid region list.
         *
         *     ``region_by_state`` is keyed by the canonical FULL state name (matching
         *     :data:`app.core.us_states.STATE_NAME_BY_CODE`'s values), because that is the
         *     form the state values are normalized to before region is derived. Clients
         *     holding a 2-letter code should expand it to the full name before looking up.
         * @example {
         *       "region_by_state": {
         *         "California": "West",
         *         "Connecticut": "Northeast",
         *         "Florida": "Southeast",
         *         "Ohio": "Midwest",
         *         "Texas": "Southwest",
         *         "Utah": "Mountain West"
         *       },
         *       "regions": [
         *         "Northeast",
         *         "Southeast",
         *         "Midwest",
         *         "Southwest",
         *         "West",
         *         "Mountain West"
         *       ]
         *     }
         */
        StateRegionMap: {
            /**
             * Regions
             * @description The valid regions, in display order — the full option set for a Region dropdown.
             */
            regions: string[];
            /**
             * Region By State
             * @description Canonical full state name -> region, for all 50 states + DC. Every value is one of ``regions``.
             */
            region_by_state: {
                [key: string]: string;
            };
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
        /**
         * SurveyAlumniResponse
         * @description One submission this alumnus made (`survey_responses`), any status.
         */
        SurveyAlumniResponse: {
            /** Survey Response Id */
            survey_response_id: number;
            /**
             * Submitted At
             * Format: date-time
             */
            submitted_at: string;
            /** Status */
            status: string;
            /** Field Count */
            field_count: number;
            /** Has Photo */
            has_photo: boolean;
            /**
             * Superseded
             * @default false
             */
            superseded: boolean;
            /** Blocks Resend */
            blocks_resend: boolean;
        };
        /**
         * SurveyAlumniSend
         * @description One survey email this alumnus was actually sent (`survey_send_log`).
         */
        SurveyAlumniSend: {
            /** Graduation Year */
            graduation_year: number;
            /** Cycle Seq */
            cycle_seq: number;
            /** Stage */
            stage: number;
            /** Stage Label */
            stage_label: string;
            /**
             * Sent At
             * Format: date-time
             */
            sent_at: string;
            /**
             * Superseded
             * @default false
             */
            superseded: boolean;
            /** Current Cycle */
            current_cycle: boolean;
        };
        /**
         * SurveyAlumniState
         * @description An alumnus's complete survey state, for the engineer to read BEFORE
         *     deciding whether a reset is warranted (#395).
         *
         *     A reset destroys nothing, but it is still usually unnecessary: someone can
         *     look blocked simply because they legitimately answered three months ago, and
         *     re-asking them then is a judgement call, not a repair. So the state is
         *     reported as facts (what went out, what came back, when, with what status,
         *     what a previous reset already superseded) plus `blocked_reasons` in plain
         *     words, rather than a single yes/no.
         */
        SurveyAlumniState: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** Graduation Year */
            graduation_year: number | null;
            /** Email */
            email: string | null;
            /**
             * Archived
             * @default false
             */
            archived: boolean;
            /** Schedule Status */
            schedule_status: string | null;
            /** Schedule Start Date */
            schedule_start_date: string | null;
            /** Schedule Cycle Seq */
            schedule_cycle_seq: number | null;
            /** Sends */
            sends: components["schemas"]["SurveyAlumniSend"][];
            /** Responses */
            responses: components["schemas"]["SurveyAlumniResponse"][];
            /**
             * Reset Count
             * @default 0
             */
            reset_count: number;
            /** Last Reset At */
            last_reset_at: string | null;
            /** Blocked Reasons */
            blocked_reasons: string[];
        };
        /**
         * SurveyChange
         * @description One field an alum's response would change: what's on file vs submitted.
         */
        SurveyChange: {
            /** Field Key */
            field_key: string;
            /** Label */
            label: string;
            /** Before */
            before: string;
            /** After */
            after: string;
        };
        /**
         * SurveyNewCyclePreview
         * @description What ``POST /survey/schedules/{year}/new-cycle`` WOULD do (#357).
         *
         *     Backs the confirmation staff see before starting the next annual campaign.
         *     Starting a cycle emails the whole eligible cohort again and cannot be
         *     undone, so the dialog states the blast size in real numbers rather than
         *     asking "are you sure?" about an abstraction.
         */
        SurveyNewCyclePreview: {
            /** Graduation Year */
            graduation_year: number;
            /** Current Cycle */
            current_cycle: number;
            /** Next Cycle */
            next_cycle: number;
            /** Current Status */
            current_status: string;
            /** Would Email */
            would_email: number;
            /** Previously Emailed */
            previously_emailed: number;
        };
        /**
         * SurveyNewCycleRequest
         * @description Start the next survey campaign for a graduation year (#357).
         *
         *     Carries only the new start date — the cycle number is server-assigned, never
         *     client-supplied, so a caller can neither skip a cycle nor re-open an old one
         *     and re-email against its log.
         */
        SurveyNewCycleRequest: {
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
        };
        /**
         * SurveyNonResponder
         * @description One alum who needs manual follow-up (#359): they received every email of
         *     their year's current campaign and never replied.
         *
         *     Enough to act on — a name and an address — and nothing more. The count alone
         *     (``SurveyScheduleItem.non_responders``) tells staff there is work; this tells
         *     them who to call.
         */
        SurveyNonResponder: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** Email */
            email: string | null;
            /** Last Sent At */
            last_sent_at: string | null;
        };
        /**
         * SurveyRead
         * @description One row of the profile's Surveys tab.
         *
         *     Mostly NOT a stored row: `profile._derive_survey_history` builds these from
         *     `survey_responses` / `survey_send_log` / `survey_schedule`, plus any legacy
         *     `surveys` rows. Derived rows carry a synthetic `survey_id` (0 or negative) —
         *     it is a list key only, never a handle to fetch or mutate. See
         *     `models.crm.Survey` before adding a write path.
         */
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
         * SurveyRecipientBreakdown
         * @description Who a year's survey reaches, and who it does not — the console's one
         *     account of a cohort (#392).
         *
         *     The buckets PARTITION the year's alumni (is_alumni, not archived)::
         *
         *         cohort_total = suppressed + already_responded + unreachable + eligible
         *         recipients   = eligible - duplicate_emails
         *
         *     Every consumer reads these same numbers — the year picker, the send
         *     confirmation, and the send result — because they are produced by the same
         *     queries the send itself runs. Deriving a count separately from the send is
         *     the standing bug in this area: the console reports a figure, a different
         *     number goes out, and nobody can tell which was wrong.
         *
         *     `suppressed` and `unreachable` are SEPARATE and must stay that way in the UI.
         *     Deceased / Do Not Contact is a decision to honour; no usable address is a gap
         *     to close. Summing them into one "not emailed" total would either hide real
         *     gaps or put Do Not Contact alumni on a chase list.
         */
        SurveyRecipientBreakdown: {
            /** Graduation Year */
            graduation_year: number;
            /** Cohort Total */
            cohort_total: number;
            /** Suppressed */
            suppressed: number;
            /** Already Responded */
            already_responded: number;
            /** Unreachable */
            unreachable: number;
            /** Eligible */
            eligible: number;
            /** Duplicate Emails */
            duplicate_emails: number;
            /** Recipients */
            recipients: number;
            /** Work Email Fallback */
            work_email_fallback: number;
        };
        /**
         * SurveyResetResult
         * @description What a per-alumnus reset did (#395, revised 2026-08-05).
         *
         *     NOTHING IS DELETED. The counts say what stopped counting toward eligibility
         *     and — just as importantly — what is still there, because the operator has to
         *     be able to see that their answers survived. A reset that found nothing
         *     succeeds and reports zeros.
         */
        SurveyResetResult: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** Reset Seq */
            reset_seq: number;
            /** Sends Superseded */
            sends_superseded: number;
            /** Responses Superseded */
            responses_superseded: number;
            /** Responses Preserved */
            responses_preserved: number;
            /** Pending Preserved */
            pending_preserved: number;
        };
        /**
         * SurveyRespondInfo
         * @description The alum's current on-file info for the public confirm page, resolved from
         *     a survey token. `fields` is keyed by the frontend's SURVEY_FIELDS keys
         *     (`table.column`), mirroring the sample-alum shape so the page can drop it in.
         */
        SurveyRespondInfo: {
            /** First Name */
            first_name: string;
            /** Full Name */
            full_name: string;
            /** Fields */
            fields: {
                [key: string]: string;
            };
        };
        /**
         * SurveyResponseItem
         * @description One pending response for the admin review queue, with its diff.
         */
        SurveyResponseItem: {
            /** Survey Response Id */
            survey_response_id: number;
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** Submitted At */
            submitted_at: string;
            /** Changes */
            changes: components["schemas"]["SurveyChange"][];
            /** Photo Preview Url */
            photo_preview_url: string | null;
        };
        /**
         * SurveyScheduleBulkRequest
         * @description Create/replace the auto-send schedule for many graduation years at once
         *     (#542). Lets an admin schedule every class from one dialog instead of one at
         *     a time. A duplicate ``graduation_year`` in the list resolves to a single
         *     row — last one wins.
         */
        SurveyScheduleBulkRequest: {
            /** Schedules */
            schedules: components["schemas"]["SurveyScheduleCreateRequest"][];
        };
        /**
         * SurveyScheduleCancelAllResult
         * @description Outcome of the engineer kill switch (``POST /survey/schedules/cancel-all``).
         *
         *     Reports exactly what was stopped so the console can say so honestly rather
         *     than claiming a blanket success: ``cancelled`` is the number of campaigns
         *     moved to ``cancelled``, and ``graduation_years`` names them. Both are empty /
         *     0 when nothing was running — the call is idempotent.
         */
        SurveyScheduleCancelAllResult: {
            /** Cancelled */
            cancelled: number;
            /** Graduation Years */
            graduation_years: number[];
        };
        /**
         * SurveyScheduleCreateRequest
         * @description Create/replace the auto-send schedule for a graduation year (#542).
         */
        SurveyScheduleCreateRequest: {
            /** Graduation Year */
            graduation_year: number;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
        };
        /**
         * SurveyScheduleDeleteResult
         * @description Outcome of removing a campaign (``DELETE /survey/schedules/{year}``, #398).
         *
         *     Only the ``survey_schedule`` row goes, whatever the campaign's status. Every
         *     number here is a KEPT count, because the reasonable assumption about a button
         *     labelled "delete campaign" is that the emails and the alumni's submitted
         *     answers went with it. They did not — they were RETIRED, which is a statement
         *     about what the next campaign for this year can see, not about what is in the
         *     database — and the console says the numbers out loud rather than leaving the
         *     assumption standing.
         */
        SurveyScheduleDeleteResult: {
            /** Graduation Year */
            graduation_year: number;
            /** Previous Status */
            previous_status: string;
            /** Retired Cycle */
            retired_cycle: number;
            /** Next Cycle */
            next_cycle: number;
            /** Emails Retired */
            emails_retired: number;
            /** Responses Kept */
            responses_kept: number;
        };
        /**
         * SurveyScheduleItem
         * @description One survey schedule + how many emails each stage has sent so far.
         */
        SurveyScheduleItem: {
            /** Survey Schedule Id */
            survey_schedule_id: number;
            /** Graduation Year */
            graduation_year: number;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /** Status */
            status: string;
            /**
             * Cycle Seq
             * @default 1
             */
            cycle_seq: number;
            /** Last Run At */
            last_run_at: string | null;
            /** Created At */
            created_at: string | null;
            /** Created By */
            created_by: string | null;
            /** Paused At */
            paused_at: string | null;
            /**
             * Sent Initial
             * @default 0
             */
            sent_initial: number;
            /**
             * Sent Reminder 1
             * @default 0
             */
            sent_reminder_1: number;
            /**
             * Sent Reminder 2
             * @default 0
             */
            sent_reminder_2: number;
            /**
             * Non Responders
             * @default 0
             */
            non_responders: number;
            /**
             * Emails Sent All Time
             * @default 0
             */
            emails_sent_all_time: number;
        };
        /**
         * SurveySchedulePauseAllResult
         * @description Outcome of the engineer blanket pause (``POST /survey/schedules/pause-all``).
         *
         *     Same shape and contract as :class:`SurveyScheduleCancelAllResult` — the two
         *     controls sit together in the console — but reports what was PAUSED, which is
         *     reversible: every year named here can be resumed and will pick its cadence up
         *     where it left off. Both fields are empty / 0 when nothing was running; the
         *     call is idempotent.
         */
        SurveySchedulePauseAllResult: {
            /** Paused */
            paused: number;
            /** Graduation Years */
            graduation_years: number[];
        };
        /**
         * SurveyScheduleRunItem
         * @description What one due schedule did on this cron run.
         */
        SurveyScheduleRunItem: {
            /** Graduation Year */
            graduation_year: number;
            /** Stage */
            stage: number | null;
            /** Sent */
            sent: number;
            /** Remaining */
            remaining: number;
            /** Retry After Seconds */
            retry_after_seconds: number | null;
            /** Non Responders */
            non_responders: number | null;
        };
        /**
         * SurveyScheduleRunSummary
         * @description Summary of a cron run over every due schedule.
         */
        SurveyScheduleRunSummary: {
            /** Ran */
            ran: components["schemas"]["SurveyScheduleRunItem"][];
            /**
             * Skipped Locked
             * @default false
             */
            skipped_locked: boolean;
        };
        /**
         * SurveySendConfigItem
         * @description The account-wide send cap the scheduler paces against. When ``enabled``,
         *     the daily cron sends at most ``daily_limit`` emails per UTC day and
         *     ``monthly_limit`` per calendar month across every graduation year, spreading
         *     a big cohort over several days. When disabled there is no internal cap —
         *     sends are limited only by Resend.
         */
        SurveySendConfigItem: {
            /** Enabled */
            enabled: boolean;
            /** Daily Limit */
            daily_limit: number;
            /** Monthly Limit */
            monthly_limit: number;
        };
        /**
         * SurveySendConfigUpdateRequest
         * @description Update the send cap (in-console admin control). ``enabled`` false turns
         *     the cap off (e.g. after upgrading the Resend plan).
         */
        SurveySendConfigUpdateRequest: {
            /** Enabled */
            enabled: boolean;
            /** Daily Limit */
            daily_limit: number;
            /** Monthly Limit */
            monthly_limit: number;
        };
        /**
         * SurveySendResult
         * @description Summary returned by the send endpoint.
         *
         *     `dry_run=True` prepares (and counts) everything but sends nothing — the safe
         *     default. `prepared` is how many emails were built for this call (capped by
         *     the daily limit); `sent` is how many actually went to Resend; `remaining` is
         *     recipients left over for a later day under the cap.
         */
        SurveySendResult: {
            /** Graduation Year */
            graduation_year: number;
            /** Total Recipients */
            total_recipients: number;
            /** Prepared */
            prepared: number;
            /** Sent */
            sent: number;
            /** Remaining */
            remaining: number;
            /** Dry Run */
            dry_run: boolean;
            /** Retry After Seconds */
            retry_after_seconds: number | null;
            /** Sample */
            sample: components["schemas"]["SurveySendSample"][];
            /**
             * Stage Complete
             * @default false
             */
            stage_complete: boolean;
            breakdown: components["schemas"]["SurveyRecipientBreakdown"] | null;
        };
        /**
         * SurveySendSample
         * @description One prepared recipient, surfaced in a dry-run so staff can eyeball it.
         */
        SurveySendSample: {
            /** Email */
            email: string;
            /** Link */
            link: string;
            /**
             * Email Source
             * @default personal
             */
            email_source: string;
        };
        /**
         * SurveySubmitRequest
         * @description The alum's submitted values, keyed by survey field keys (`table.column`).
         *     Only recognized survey fields are kept; anything else is ignored.
         */
        SurveySubmitRequest: {
            /** Fields */
            fields: {
                [key: string]: string;
            };
            /**
             * Has Photo
             * @default false
             */
            has_photo: boolean;
        };
        /**
         * SurveySubmitResult
         * @description Outcome of a submit — how many changes were staged for review.
         *
         *     `survey_response_id` is the id of the staged row (None when nothing was
         *     staged); the public survey page uses it to attach an optional profile photo
         *     via `POST /survey/respond/{token}/photo`.
         */
        SurveySubmitResult: {
            /** Staged */
            staged: boolean;
            /** Change Count */
            change_count: number;
            /** Survey Response Id */
            survey_response_id: number | null;
        };
        /**
         * SurveyUnreachableAlum
         * @description One alumnus this campaign cannot email (#392).
         *
         *     The count made actionable, mirroring `SurveyNonResponder`: staff need names
         *     and the offending values, not a number. The reason separates "we have never
         *     had an address" from "the address we hold is unusable" — the second is often
         *     a typo fixable straight from this list.
         *
         *     Never contains a suppressed (Deceased / Do Not Contact) alumnus.
         */
        SurveyUnreachableAlum: {
            /** Alumni Id */
            alumni_id: number;
            /** Name */
            name: string;
            /** Reason */
            reason: string;
            /** Reason Label */
            reason_label: string;
            /** Personal Email */
            personal_email: string | null;
            /** Work Email */
            work_email: string | null;
        };
        /**
         * SurveyUsage
         * @description Real Resend send usage for the console's daily/monthly tallies — emails
         *     actually sent today and this calendar month, counted from `survey_send_log`.
         *     NOT from the audit trail: an engineer actor's audit row is rerouted to
         *     `engineer_action_log`, which left the meter reading zero. UTC day/month
         *     boundaries, matching the rest of the app's date filtering.
         */
        SurveyUsage: {
            /** Sent Today */
            sent_today: number;
            /** Sent This Month */
            sent_this_month: number;
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
             * Capabilities
             * @default []
             */
            capabilities: string[];
            /**
             * Must Change Password
             * @default false
             */
            must_change_password: boolean;
            /** Session Id */
            session_id: string | null;
            /** Active Session Id */
            active_session_id: string | null;
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
         * LeadershipCreate
         * @description A student finance-society leadership role -> one
         *     ``finance_society_leadership`` row. ``leadership_role`` is required on that
         *     model; ``role_year`` is optional.
         */
        app__schemas__alumni__LeadershipCreate: {
            /** Leadership Role */
            leadership_role?: string | null;
            /** Role Year */
            role_year?: number | null;
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
        /**
         * LeadershipCreate
         * @description Add a Finance Society leadership entry to an alumnus's record.
         */
        app__schemas__profile__LeadershipCreate: {
            /** Leadership Role */
            leadership_role: string;
            /** Role Year */
            role_year?: number | null;
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
    maintenance_status_maintenance_status_get: {
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
                    "application/json": components["schemas"]["MaintenanceStatus"];
                };
            };
        };
    };
    get_maintenance_state_maintenance_get: {
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
                    "application/json": components["schemas"]["MaintenanceState"];
                };
            };
        };
    };
    enable_maintenance_maintenance_enable_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["MaintenanceEnableRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MaintenanceEnableResult"];
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
    disable_maintenance_maintenance_disable_post: {
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
                    "application/json": components["schemas"]["MaintenanceState"];
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
    session_active_auth_session_active_get: {
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
                    "application/json": components["schemas"]["SessionActiveResponse"];
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
                /** @description Free-text search over names, external ids, designations, current employer / title / city / state / country / industry and past employers. Tolerant of case, accents, punctuation, spacing ('newyork' finds New York) and misspellings ('goldman schs' finds Goldman Sachs). Filler words are ignored; 'at <x>' narrows to employers and 'in <x>' to places/industries. */
                q?: string | null;
                /** @description Net ID — case-insensitive partial match. */
                net_id?: string | null;
                /** @description First name — case-insensitive partial match. */
                first_name?: string | null;
                /** @description Last name — case-insensitive partial match. */
                last_name?: string | null;
                /** @description Preferred first name — case-insensitive partial match. */
                preferred_name?: string | null;
                /** @description Email (personal or work) — case-insensitive partial match. */
                email?: string | null;
                graduation_year?: number | null;
                grad_year_min?: number | null;
                grad_year_max?: number | null;
                /** @description Filter by deceased flag. */
                deceased?: boolean | null;
                /** @description Gender facet (#360): 'M' or 'F'. Combinable with the industry filter (and every other filter). Matches on the first letter of the stored gender value, so 'Male'/'M' and 'Female'/'F' both match. */
                gender?: ("M" | "F") | null;
                /** @description Industry-bucket facet (#351/#352) for the dashboard drill-downs: 'unknown' — alumni with a blank/missing primary industry; 'other' — alumni whose primary industry is NOT one of the canonical finance industries (the 'Other' bucket). Distinct from the exact 'industry' facet, which matches a specific industry name. */
                industry_group?: ("unknown" | "other") | null;
                /** @description Current employer(s) — repeatable (OR), exact match. */
                employer?: string[] | null;
                /** @description Prior employer(s) from employment history — repeatable. */
                past_employer?: string[] | null;
                /** @description PRIMARY industry / work area — repeatable (OR), exact match. Narrowed to the primary column (#584): it no longer also matches the secondary industry — use 'secondary_industry' for that. */
                industry?: string[] | null;
                /** @description SECONDARY industry / work area (#584) — repeatable (OR), exact match. Combined with 'industry' it AND-s: primary is X AND secondary is Y. */
                secondary_industry?: string[] | null;
                /** @description Current job title(s) — repeatable, exact match. */
                title?: string[] | null;
                /** @description Seniority level(s) — repeatable, exact match. */
                seniority?: string[] | null;
                /** @description Employment status(es) (#584) — repeatable (OR), exact match. Canonical values: Full-time, Part-time, Self-Employed, Graduate Student, Military, Not in the Labor Force, Unemployed, Unknown. The column is free text and also holds off-list legacy values, so anything on file is accepted; 'filter-options.employment_statuses' lists what actually exists in the data. */
                employment_status?: string[] | null;
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
                /** @description 'Needs surveying' view (admin tier and up only): alumni DUE for the biennial survey — never completed one, or whose most-recent completion is older than 2 years. The 2-year threshold is computed server-side. Forbidden for student / view_only roles (403). */
                needs_survey?: boolean;
                /** @description Only alumni with an interaction on/after this date. */
                contacted_after?: string | null;
                /** @description Only alumni NOT contacted since this date (stale). */
                contacted_before?: string | null;
                /** @description Only alumni with no logged interactions. */
                never_contacted?: boolean;
                /** @description Only alumni who attended at least one event. */
                attended_event?: boolean;
                /** @description Only alumni who served as a guest speaker at an event held on/after this date (matches the dashboard 'Guest speakers this month' KPI). */
                spoke_after?: string | null;
                /** @description Only alumni who served as a guest speaker at an event held on/before this date. */
                spoke_before?: string | null;
                /** @description Only PIFF donors. */
                donor?: boolean;
                /** @description Only alumni willing to mentor. */
                mentor_willing?: boolean;
                /** @description Only alumni willing to guest speak. */
                guest_speaker_willing?: boolean;
                /** @description Only alumni holding the CFP designation. */
                cfp?: boolean;
                /** @description Only alumni holding the CFA designation. */
                cfa?: boolean;
                /** @description Only alumni holding the CPA designation. */
                cpa?: boolean;
                /** @description Professional-designation filter (#404): repeatable or comma-separated, values among CFP, CFA, CPA (case-insensitive). Returns alumni holding ANY of the requested designations (OR). An unknown value is a 422. */
                designations?: string[] | null;
                /** @description Only alumni with a graduate degree recorded. */
                graduate_degree?: boolean;
                /** @description Only alumni with no contact-info email on file. */
                missing_email?: boolean;
                /** @description Only alumni with no current employer on file. */
                missing_employer?: boolean;
                /** @description Only alumni with no phone number on file. */
                missing_phone?: boolean;
                /** @description Only alumni flagged as duplicate candidates. */
                duplicate?: boolean;
                include_archived?: boolean;
                /** @description Which records to return (#218): 'alumni' (default) — only graduates (is_alumni=true); 'friend' — only friends of the program (is_alumni=false); 'all' — both. Defaults to 'alumni' so the Alumni page is unchanged. */
                kind?: "alumni" | "friend" | "all";
                /** @description Natural-language location search (#358): a place phrase such as 'near Los Angeles, CA', 'within 50 miles of Provo', or a region alias like 'Bay Area'. Resolved to a set of nearby cities via the geocoding module; results are restricted to alumni located there. An unresolvable phrase falls back to the normal (non-location) search and the response's 'location.resolved' is false. */
                near?: string | null;
                /** @description Optional radius override (miles) for the 'near' location search. When provided it overrides the radius inferred from the phrase. */
                radius?: number | null;
                /** @description Sort order: relevance | name | grad_desc | grad_asc | industry | city | state | employer | gender | updated. Omitted means relevance when a free-text 'q' is given (best match first) and name otherwise. */
                sort?: ("relevance" | "name" | "grad_desc" | "grad_asc" | "industry" | "city" | "state" | "employer" | "gender" | "updated") | null;
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
    get_headshot_alumni__alumni_id__headshot_get: {
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
    upload_headshot_alumni__alumni_id__headshot_put: {
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
                "multipart/form-data": components["schemas"]["Body_upload_headshot_alumni__alumni_id__headshot_put"];
            };
        };
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
    delete_headshot_alumni__alumni_id__headshot_delete: {
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
    create_headshot_upload_url_alumni__alumni_id__headshot_upload_url_post: {
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
    confirm_headshot_upload_alumni__alumni_id__headshot_confirm_post: {
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
    get_headshot_urls_alumni_headshots_urls_get: {
        parameters: {
            query: {
                alumni_ids: number[];
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
                    "application/json": components["schemas"]["HeadshotUrls"];
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
    create_bulk_headshot_upload_urls_alumni_headshots_bulk_upload_urls_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HeadshotBulkUploadRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HeadshotBulkUploadUrls"];
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
    confirm_bulk_headshot_upload_alumni_headshots_bulk_confirm_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HeadshotBulkConfirmRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HeadshotBulkResult"];
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
    alumni_import_template_alumni_import_template_get: {
        parameters: {
            query?: {
                kind?: "alumni" | "friend";
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
    preview_import_alumni_alumni_import_preview_post: {
        parameters: {
            query?: {
                kind?: "alumni" | "friend";
            };
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
                    "application/json": components["schemas"]["AlumniImportPreview"];
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
            query?: {
                kind?: "alumni" | "friend";
            };
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
                    "application/json": components["schemas"]["AlumniImportResult"];
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
    preview_update_import_alumni_alumni_import_update_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_preview_update_import_alumni_alumni_import_update_preview_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniUpdatePreview"];
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
    update_import_alumni_alumni_import_update_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_update_import_alumni_alumni_import_update_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlumniUpdateResult"];
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
    export_cohort_update_template_alumni_import_update_export_get: {
        parameters: {
            query?: {
                grad_year?: number | null;
                class_year?: number | null;
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
    alumni_export_columns_alumni_export_columns_get: {
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
                    "application/json": components["schemas"]["ExportColumnCatalog"];
                };
            };
        };
    };
    export_alumni_alumni_export_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AlumniExportRequest"];
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
    delete_interaction_alumni__alumni_id__interactions__interaction_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                interaction_id: number;
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
    update_interaction_alumni__alumni_id__interactions__interaction_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alumni_id: number;
                interaction_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InteractionUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
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
                "application/json": components["schemas"]["app__schemas__profile__LeadershipCreate"];
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
                    "application/json": components["schemas"]["AlumniHygienePreview"];
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
                    "application/json": components["schemas"]["AlumniHygienePreview"];
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
                    "application/json": components["schemas"]["DashboardSummary"];
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
                    "application/json": components["schemas"]["BirthdayRow"][];
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
                    "application/json": components["schemas"]["EventParticipationRow"][];
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
                /** @description When true, restrict to interactions logged by the current authenticated user (the actor / 'interacted by me'). */
                mine?: boolean;
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
                    "application/json": components["schemas"]["ActivityFeed"];
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
                    "application/json": components["schemas"]["DataQuality"];
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
                    "application/json": components["schemas"]["InteractionActivity"][];
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
                    "application/json": components["schemas"]["FollowUpRow"][];
                };
            };
        };
    };
    list_dashboard_presets_dashboard_presets_get: {
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
                    "application/json": components["schemas"]["DashboardPresetRead"][];
                };
            };
        };
    };
    list_dashboard_presets_admin_admin_dashboard_presets_get: {
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
                    "application/json": components["schemas"]["DashboardPresetRead"][];
                };
            };
        };
    };
    create_dashboard_preset_admin_dashboard_presets_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DashboardPresetCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardPresetRead"];
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
    delete_dashboard_preset_admin_dashboard_presets__preset_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                preset_id: number;
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
                    "application/json": components["schemas"]["DashboardPresetRead"];
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
    update_dashboard_preset_admin_dashboard_presets__preset_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                preset_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DashboardPresetUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardPresetRead"];
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
    purge_logins_admin_logins_delete: {
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
                    "application/json": components["schemas"]["LoginPurgeResult"];
                };
            };
        };
    };
    list_login_failures_admin_login_failures_get: {
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
                    "application/json": components["schemas"]["LoginFailurePage"];
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
    list_engineer_actions_admin_engineer_actions_get: {
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
                    "application/json": components["schemas"]["EngineerActionPage"];
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
    get_permissions_engineer_permissions_get: {
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
                    "application/json": components["schemas"]["PermissionMatrix"];
                };
            };
        };
    };
    toggle_permission_engineer_permissions_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PermissionToggleRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PermissionMatrix"];
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
    log_preview_engineer_preview_log_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreviewLogRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreviewLogResponse"];
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
    get_role_capabilities_admin_role_capabilities_get: {
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
                    "application/json": components["schemas"]["PermissionMatrix"];
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
    events_import_template_events_import_template_get: {
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
    attendee_match_template_events_attendees_match_template_get: {
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
    preview_import_events_events_import_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_preview_import_events_events_import_preview_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventImportPreview"];
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
    import_events_commit_events_import_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_import_events_commit_events_import_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventImportResult"];
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
    delete_event_events__event_id__delete: {
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
                    "application/json": components["schemas"]["AttendeeRead"][];
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
    export_event_attendees_events__event_id__attendees_export_get: {
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
    preview_attendee_match_events__event_id__attendees_match_preview_post: {
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
                "multipart/form-data": components["schemas"]["Body_preview_attendee_match_events__event_id__attendees_match_preview_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttendeeMatchPreview"];
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
    approve_attendee_matches_events__event_id__attendees_match_approve_post: {
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
                "application/json": components["schemas"]["AttendeeApprovalRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttendeeApplyResult"];
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
    create_attendee_friends_events__event_id__attendees_match_friends_post: {
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
                "multipart/form-data": components["schemas"]["Body_create_attendee_friends_events__event_id__attendees_match_friends_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttendeeFriendResult"];
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
    list_donors_donations_donors_get: {
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
    donations_summary_donations_summary_get: {
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
    list_alumni_donations_donations_alumni__alumni_id__get: {
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
    add_donation_donations_alumni__alumni_id__post: {
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
                "application/json": components["schemas"]["DonationCreate"];
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
    delete_donation_donations__donation_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
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
    update_donation_donations__donation_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                donation_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DonationUpdate"];
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
    donations_import_template_donations_import_template_get: {
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
    preview_import_donations_donations_import_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_preview_import_donations_donations_import_preview_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DonationImportPreview"];
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
    import_donations_commit_donations_import_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_import_donations_commit_donations_import_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DonationImportResult"];
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
    counties_geography_counties_get: {
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
                    "application/json": components["schemas"]["CountyCount"][];
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
    countries_geography_countries_get: {
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
                    "application/json": components["schemas"]["CountryCount"][];
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
    country_detail_geography_countries__country__get: {
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
                country: string;
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
                    "application/json": components["schemas"]["CountryDetail"];
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
    country_alumni_geography_countries__country__alumni_get: {
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
                country: string;
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
    radius_alumni_geography_radius_get: {
        parameters: {
            query: {
                lat: number;
                lng: number;
                miles: number;
                limit?: number;
                offset?: number;
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
                    "application/json": components["schemas"]["RadiusPage"];
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
    list_notes_notes_get: {
        parameters: {
            query: {
                /** @description Which level the notes are attached to. */
                entity_type: components["schemas"]["NoteEntityType"];
                /** @description Id of the alumni / interaction / event. */
                entity_id: number;
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
                    "application/json": components["schemas"]["NoteRead"][];
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
    create_note_notes_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NoteCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoteRead"];
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
    delete_note_notes__note_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                note_id: number;
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
    update_note_notes__note_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                note_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NoteUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoteRead"];
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
    get_state_regions_vocabulary_state_regions_get: {
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
                    "application/json": components["schemas"]["StateRegionMap"];
                };
            };
        };
    };
    get_vocabulary_vocabulary__category__get: {
        parameters: {
            query?: {
                /** @description 'all' (default) returns every active term. 'primary' additionally hides the industries that may only be used as a SECONDARY industry (Law, Corporate Banking, Sales and Trading, Credit Risk) — pass it when rendering the PRIMARY industry dropdown. No effect on other categories. */
                scope?: "all" | "primary";
            };
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
    delete_vocabulary_term_admin_vocabulary__term_id__permanent_delete: {
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
    survey_respond_info_survey_respond__token__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
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
                    "application/json": components["schemas"]["SurveyRespondInfo"];
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
    survey_submit_survey_respond__token__post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SurveySubmitRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SurveySubmitResult"];
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
    survey_submit_photo_survey_respond__token__photo_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_survey_submit_photo_survey_respond__token__photo_post"];
            };
        };
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
    survey_pending_responses_survey_campaigns__grad_year__responses_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyResponseItem"][];
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
    survey_apply_response_survey_responses__response_id__apply_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                response_id: number;
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
    survey_reject_response_survey_responses__response_id__reject_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                response_id: number;
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
    survey_graduation_years_survey_graduation_years_get: {
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
                    "application/json": components["schemas"]["GraduationYearCount"][];
                };
            };
        };
    };
    survey_send_usage_survey_usage_get: {
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
                    "application/json": components["schemas"]["SurveyUsage"];
                };
            };
        };
    };
    get_survey_send_config_survey_send_config_get: {
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
                    "application/json": components["schemas"]["SurveySendConfigItem"];
                };
            };
        };
    };
    update_survey_send_config_survey_send_config_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SurveySendConfigUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SurveySendConfigItem"];
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
    send_survey_campaign_survey_campaigns__grad_year__send_post: {
        parameters: {
            query?: {
                dry_run?: boolean;
                limit?: number | null;
            };
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveySendResult"];
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
    survey_recipient_breakdown_survey_campaigns__grad_year__recipients_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyRecipientBreakdown"];
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
    list_survey_unreachable_survey_campaigns__grad_year__unreachable_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyUnreachableAlum"][];
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
    list_survey_schedules_survey_schedules_get: {
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
                    "application/json": components["schemas"]["SurveyScheduleItem"][];
                };
            };
        };
    };
    create_survey_schedule_survey_schedules_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SurveyScheduleCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SurveyScheduleItem"];
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
    preview_survey_new_cycle_survey_schedules__grad_year__new_cycle_preview_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyNewCyclePreview"];
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
    start_survey_new_cycle_survey_schedules__grad_year__new_cycle_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SurveyNewCycleRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SurveyScheduleItem"];
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
    create_survey_schedules_bulk_survey_schedules_bulk_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SurveyScheduleBulkRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SurveyScheduleItem"][];
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
    list_survey_non_responders_survey_schedules__grad_year__non_responders_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyNonResponder"][];
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
    pause_survey_schedule_survey_schedules__grad_year__pause_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyScheduleItem"];
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
    resume_survey_schedule_survey_schedules__grad_year__resume_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyScheduleItem"];
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
    pause_all_survey_schedules_survey_schedules_pause_all_post: {
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
                    "application/json": components["schemas"]["SurveySchedulePauseAllResult"];
                };
            };
        };
    };
    cancel_survey_schedule_survey_schedules__grad_year__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyScheduleItem"];
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
    delete_survey_schedule_survey_schedules__grad_year__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grad_year: number;
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
                    "application/json": components["schemas"]["SurveyScheduleDeleteResult"];
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
    cancel_all_survey_schedules_survey_schedules_cancel_all_post: {
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
                    "application/json": components["schemas"]["SurveyScheduleCancelAllResult"];
                };
            };
        };
    };
    survey_alumnus_state_survey_alumni__alumni_id__state_get: {
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
                    "application/json": components["schemas"]["SurveyAlumniState"];
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
    survey_reset_alumnus_survey_alumni__alumni_id__reset_post: {
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
                    "application/json": components["schemas"]["SurveyResetResult"];
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
    survey_cron_run_survey_cron_run_post: {
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
                    "application/json": components["schemas"]["SurveyScheduleRunSummary"];
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
