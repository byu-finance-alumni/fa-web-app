#!/usr/bin/env python3
"""Deterministic FERPA-compliance static check for fa-web-app.

No LLM, no network, no API key — pure stdlib static analysis of the client
codebase so it can run as a required CI status check. Exits non-zero (1) only
when a HARD requirement is missing; heuristic findings are printed as warnings
and never fail the build.

Run locally from the repo root:

    python scripts/ferpa_check.py

What it enforces is documented in scripts/FERPA_CHECKS.md.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src"

hard_failures: list[str] = []
warnings: list[str] = []


def fail(msg: str) -> None:
    hard_failures.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def src_files() -> list[Path]:
    if not SRC_DIR.exists():
        return []
    files: list[Path] = []
    for ext in ("*.ts", "*.tsx"):
        files.extend(SRC_DIR.rglob(ext))
    return sorted(files)


# -----------------------------------------------------------------------------
# Check 1 (HARD): no client-side record export.
# A full alumni record/profile must NOT be serialized to a downloadable file
# purely client-side — the export has to go through the audited server endpoint
# (GET /alumni/{id}/export) so the disclosure is logged (FERPA record of
# disclosure). FAIL a component that BOTH:
#   (a) JSON.stringify(...) on something named like profile/record/alumni, AND
#   (b) creates a Blob/anchor download,
# WITHOUT any server hop in the same file (apiGet*/fetch/"/export"/a server
# action import). When the data is fetched from the server first and only the
# returned payload is turned into a Blob, that is the compliant pattern.
# -----------------------------------------------------------------------------
def check_no_client_export() -> None:
    # JSON.stringify on a profile/record/alumni-named identifier.
    stringify_re = re.compile(
        r"JSON\.stringify\(\s*[A-Za-z0-9_.\[\]'\"]*\b"
        r"(profile|record|alumni)\b",
        re.IGNORECASE,
    )
    blob_re = re.compile(r"new\s+Blob\s*\(\s*\[")
    anchor_dl_re = re.compile(
        r"createElement\(\s*['\"]a['\"]\s*\)|\.download\s*=|createObjectURL\("
    )
    # Any sign the payload came from the server in this file.
    server_hop_re = re.compile(
        r"apiGet\w*|apiPost\w*|/export\b|\bfetch\s*\(|"
        r"['\"]use server['\"]|export\w*\s*\(\s*\w+Id|from\s+['\"][^'\"]*actions['\"]",
        re.IGNORECASE,
    )

    for path in src_files():
        text = read(path)
        has_stringify = bool(stringify_re.search(text))
        has_blob = bool(blob_re.search(text))
        has_anchor = bool(anchor_dl_re.search(text))
        if not (has_stringify and (has_blob or has_anchor)):
            continue
        # It builds a record/profile download client-side. Compliant only if a
        # server hop is present in the same file.
        if server_hop_re.search(text):
            continue
        rel = path.relative_to(REPO_ROOT).as_posix()
        fail(
            f"Client export: {rel} serializes a profile/record/alumni object "
            "with JSON.stringify AND builds a Blob/anchor download with no "
            "server fetch (apiGet/fetch//export/server action) in the file. "
            "Route the export through the audited server endpoint "
            "(GET /alumni/{id}/export) so the disclosure is logged."
        )


# -----------------------------------------------------------------------------
# Check 2 (HARD): no secrets in client code.
# Any env var that looks secret (SERVICE_ROLE, SECRET, PRIVATE_KEY, ANTHROPIC)
# must never be read from client (src/) code, and only NEXT_PUBLIC_* vars are
# safe to reference at all. FAIL on a non-NEXT_PUBLIC_ secret-looking env read.
# -----------------------------------------------------------------------------
def check_no_client_secrets() -> None:
    # process.env.SOMETHING  or  process.env["SOMETHING"]
    env_ref_re = re.compile(
        r"process\.env\.([A-Za-z_][A-Za-z0-9_]*)"
        r"|process\.env\[\s*['\"]([A-Za-z_][A-Za-z0-9_]*)['\"]\s*\]"
    )
    secret_token_re = re.compile(
        r"SERVICE_ROLE|SECRET|PRIVATE_KEY|ANTHROPIC", re.IGNORECASE
    )

    offenders: list[str] = []
    for path in src_files():
        text = read(path)
        for line_no, line in enumerate(text.splitlines(), 1):
            for m in env_ref_re.finditer(line):
                name = m.group(1) or m.group(2) or ""
                if name.startswith("NEXT_PUBLIC_"):
                    continue
                if secret_token_re.search(name):
                    rel = path.relative_to(REPO_ROOT).as_posix()
                    offenders.append(f"{rel}:{line_no} ({name})")

    if offenders:
        fail(
            "Client secrets: secret-looking, non-NEXT_PUBLIC_ env var(s) "
            "referenced in client code: " + ", ".join(offenders[:10])
        )
    else:
        print(
            "  [ok] Client secrets: no secret-looking non-NEXT_PUBLIC_ env "
            "vars referenced in src/."
        )


# -----------------------------------------------------------------------------
# Check 3 (WARN): process.env usage in client components.
# Heuristic — a "use client" file reading process.env directly is worth a look
# (only NEXT_PUBLIC_* values actually exist in the browser bundle). Does not
# fail the build.
# -----------------------------------------------------------------------------
def check_process_env_in_client() -> None:
    for path in src_files():
        text = read(path)
        if "process.env" not in text:
            continue
        head = "\n".join(text.splitlines()[:5])
        if re.search(r"['\"]use client['\"]", head):
            rel = path.relative_to(REPO_ROOT).as_posix()
            warn(
                f"process.env: {rel} is a client component that reads "
                "process.env directly (only NEXT_PUBLIC_* values exist in the "
                "browser bundle)."
            )


def main() -> int:
    print("FERPA check (fa-web-app) - deterministic static analysis")
    print("-" * 60)
    if not SRC_DIR.exists():
        warn(f"src/ directory not found at {SRC_DIR} — nothing to scan.")
    check_no_client_export()
    check_no_client_secrets()
    check_process_env_in_client()

    print("-" * 60)
    for w in warnings:
        print(f"  [warn] {w}")
    for f in hard_failures:
        print(f"  [FAIL] {f}")

    print("-" * 60)
    print(
        f"FERPA check: {len(hard_failures)} hard failures, "
        f"{len(warnings)} warnings"
    )
    return 1 if hard_failures else 0


if __name__ == "__main__":
    sys.exit(main())
