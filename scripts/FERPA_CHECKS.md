# FERPA compliance check (fa-web-app)

`scripts/ferpa_check.py` is a **deterministic** static analysis of the client
codebase — no LLM, no network, no API key. It enforces FERPA / data-governance
controls on the frontend so a missing one blocks the merge. CI runs it on
push/PR to `dev` and `prod` via `.github/workflows/ferpa-audit.yml`, and it is
safe to require as a branch-protection status check.

## Run it locally

```bash
python scripts/ferpa_check.py
```

Exit code `1` means a **hard** control is missing; `0` means OK (warnings may
still print). The script ends with:

```
FERPA check: N hard failures, M warnings
```

## Hard checks (exit 1 if violated)

1. **No client-side record export.** A full alumni record/profile must not be
   serialized to a downloadable file purely client-side — the export has to go
   through the audited server endpoint (`GET /alumni/{id}/export`) so the
   disclosure is logged. The check **fails** a `src/**/*.ts(x)` file that both
   (a) calls `JSON.stringify(...)` on something named like
   `profile`/`record`/`alumni`, and (b) builds a `new Blob([...])` or an anchor
   download (`createElement("a")` / `.download =` / `createObjectURL`) — **with
   no server hop in the same file** (`apiGet*` / `fetch(` / `"/export"` / a
   `"use server"` action import). Fetching the data from the server first and
   only turning the returned payload into a Blob is the compliant pattern and
   passes.

2. **No secrets in client code.** Fails if any secret-looking, **non-`NEXT_PUBLIC_`**
   env var (`SERVICE_ROLE`, `SECRET`, `PRIVATE_KEY`, `ANTHROPIC`) is read via
   `process.env` anywhere under `src/`. Only `NEXT_PUBLIC_*` values are safe in
   the browser bundle.

## Warnings (printed, never fail the build)

3. **`process.env` in client components.** Warns when a `"use client"` file
   reads `process.env` directly (only `NEXT_PUBLIC_*` values actually exist in
   the browser bundle).

## Note

The compliant export lives in `src/components/alumni/ExportProfileButton.tsx`,
which calls the `exportProfile` server action (hitting the audited
`GET /alumni/{id}/export`) and only turns the **returned** payload into a Blob.
The check is written to catch the bad pattern (client-side serialization of a
profile with no server hop).
