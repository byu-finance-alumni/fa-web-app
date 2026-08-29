# Vercel Firewall — Configuration Record

> **Last verified against the Vercel dashboard: NEVER.**
> No entry in the inventory below has been read off a live Vercel project. Every
> row is **UNVERIFIED** until someone opens the dashboard and fills it in with a
> date and their name.

Vercel Firewall rules — custom WAF rules, IP blocks, system bypasses, Attack
Challenge Mode, managed bot rulesets — are **dashboard state**. They live in
Vercel's control plane, not in this repository. Nothing in `fa-web-app` or
`fa-web-api` declares them:

- `fa-web-app` has **no** `vercel.json` and **no** `.vercel/` directory checked in.
- `fa-web-api/vercel.json` exists but contains **only** `crons` (the survey run and
  the headshot sweep). No firewall block.
- Grepping both repos for firewall/WAF configuration returns only application code
  (`app/services/login_abuse.py` and its tests — that is our *own* in-app login
  lockout, a different control entirely) and third-party vendor files.

Verified 2026-08-29. **There is zero firewall configuration in git.**

**This file is the repository's record of what is configured.** It is maintained
**by hand**. It can be wrong the moment someone clicks something in the dashboard,
which is exactly why every row carries its own "last verified" date.

---

## 1. Why this file exists

Because a ticket was closed as done while its own last recorded evidence said it
was not done, and nobody could tell from the repo which was true.

**`fa-web-api#43` — "WAF rate-limit on `/auth/login/*`"** (opened 2026-06-16,
closed 2026-07-20).

Its verification comment, **2026-06-29**:

> Could **not** verify from code — the WAF rate rule is Vercel-dashboard config, not
> in the repo (no vercel.json / firewall definition). Platform WAF is live on all 4
> projects, but the **specific per-IP rule on /auth/login/precheck +
> /auth/login/record is unconfirmed** and likely still missing (which is why this
> issue exists). To close: check the prod `finance-alumni-database-api` project →
> Firewall tab, or query `/v1/security/firewall/config/active` with a Vercel token.

Its closing comment, **2026-07-20**:

> Closing as done (board cleanup 2026-07-20).

The check the first comment asked for was never performed and never recorded. The
issue moved to Done on housekeeping, not on evidence.

### ⚠️ The repo already contains a contradiction about this

Three places in the repo say different things about the same rules, and **none of
them is evidence**:

| Source | What it says | Status |
| --- | --- | --- |
| `docs/PRE-LAUNCH.md` §8 (Tier 0) | *Recommends* `100 req / 60s per IP → Deny or Challenge` on both prod projects. Checkboxes are **unticked**, with an explicit note that these are dashboard settings that "cannot be verified from the codebase". | A **recommendation**, correctly not claimed as done. |
| `fa-web-api/docs/SECURITY-MONITORING.md`, "Infrastructure facts" | *Asserts* "Vercel WAF rate-limit rules on all 4 projects (app projects 300/60s excluding `/_next/*`; api projects 100/60s)". | An **unsourced assertion**. Added 2026-06-18 in commit `20c9a89`, the commit that created the runbook — i.e. **before** the 2026-06-29 comment on #43 that said the rule was unconfirmed and likely missing. |
| `fa-web-api#43` comment, 2026-06-29 | The specific per-IP rule is **unconfirmed and likely still missing**. | The **most recent** recorded observation, and it is a negative one. |

> ⚠️ **A recommendation is not evidence of configuration. An assertion in a runbook
> is not evidence of configuration.** The `300/60s` and `100/60s` figures in
> `SECURITY-MONITORING.md` must be treated as **unverified** until someone reads
> them off the dashboard. They are reproduced in §3 only so that a future verifier
> can confirm or refute them — not as a starting assumption.

---

## 2. Projects in scope

Four Vercel projects. Names taken from repository documentation, **not** from the
Vercel dashboard.

| Purpose | Vercel project name | Source of the name | Confidence |
| --- | --- | --- | --- |
| Prod app (frontend) | `finance-alumni-database` | `README.md`, `NEXT-STEPS.md`, `CLAUDE.md`, `docs/PRE-LAUNCH.md` §8 | **Confirmed in repo docs** (multiple independent files) |
| Prod API (backend) | `finance-alumni-database-api` | `docs/PRE-LAUNCH.md` §1 and §8, `fa-web-api/docs/SECURITY-MONITORING.md` | **Confirmed in repo docs** (multiple independent files) |
| Dev app | `dev-fa-web-app` | `README.md`, `NEXT-STEPS.md`, `fa-web-api/docs/SECURITY-MONITORING.md` | **Confirmed in repo docs** |
| Dev API | `dev-fa-web-api` | `fa-web-api/docs/SECURITY-MONITORING.md` | **Confirmed in repo docs** (single source) |
| Team / scope slug | `byu-finance-db` | GitHub Actions Vercel check URLs on `fa-web-app` PR #797, 2026-08-29 | **CONFIRMED** — read off live deployment URLs. Note `fa-web-api/docs/SECURITY-MONITORING.md` documents `gunnjakes-projects`, which is **stale/wrong** and should be corrected. |

> ⚠️ **Vercel project names do not match repository names.** The prod API project is
> `finance-alumni-database-api`, *not* `fa-web-api`. Any script or poll that filters
> deployments on the repo name will wait forever on a deploy that already succeeded.

> ⚠️ None of the above has been confirmed against the live Vercel dashboard as part
> of writing this file. They are confirmed *as what the repo says*. Step 0 of the
> checklist in §6 exists to close that gap.

---

## 3. Rule inventory — **UNVERIFIED / EMPTY**

Nothing here is filled in, because nothing has been read off the dashboard. Do not
populate these tables from `PRE-LAUNCH.md`, from `SECURITY-MONITORING.md`, or from
memory. Populate them **only** from the Firewall tab or `vercel firewall` CLI
output, and date each row.

### 3.1 `finance-alumni-database` (prod app)

| Rule name | Condition | Action | Threshold / window | Scope (path, env, host) | Enabled? | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| _UNKNOWN — not yet read from dashboard_ | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | never |

| Setting | Value | Last verified |
| --- | --- | --- |
| Attack Challenge Mode | UNKNOWN | never |
| IP blocks | UNKNOWN | never |
| System bypass entries | UNKNOWN | never |
| Managed rulesets (Bot Protection / AI Bots) | UNKNOWN | never |
| Unpublished draft rules | UNKNOWN | never |

### 3.2 `finance-alumni-database-api` (prod API)

| Rule name | Condition | Action | Threshold / window | Scope (path, env, host) | Enabled? | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| _UNKNOWN — not yet read from dashboard_ | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | never |

| Setting | Value | Last verified |
| --- | --- | --- |
| Attack Challenge Mode | UNKNOWN | never |
| IP blocks | UNKNOWN | never |
| System bypass entries | UNKNOWN | never |
| Managed rulesets (Bot Protection / AI Bots) | UNKNOWN | never |
| Unpublished draft rules | UNKNOWN | never |

### 3.3 Dev projects (`dev-fa-web-app`, `dev-fa-web-api`)

Not in scope for issue #796 (the incident was on production), but record them the
same way when convenient — a dev/prod difference is itself a useful signal.

| Project | Rules | Attack Challenge Mode | Last verified |
| --- | --- | --- | --- |
| `dev-fa-web-app` | UNKNOWN | UNKNOWN | never |
| `dev-fa-web-api` | UNKNOWN | UNKNOWN | never |

### 3.4 Claims awaiting confirmation or refutation

Carry these into §6 step 2 and mark each **CONFIRMED** or **REFUTED** with a date.
They are hypotheses, not inventory.

| Claim | Where it comes from | Verdict |
| --- | --- | --- |
| App projects have a rate-limit rule at `300 req / 60s`, excluding `/_next/*` | `SECURITY-MONITORING.md` assertion, 2026-06-18 | **UNVERIFIED** |
| API projects have a rate-limit rule at `100 req / 60s` | `SECURITY-MONITORING.md` assertion, 2026-06-18 | **UNVERIFIED** |
| A per-IP rule exists on `/auth/login/precheck` + `/auth/login/record` | `fa-web-api#43`; last evidence (2026-06-29) says **likely missing** | **UNVERIFIED** |
| Attack Challenge Mode is OFF on all four projects | `SECURITY-MONITORING.md` monitoring step | **UNVERIFIED** |
| Automatic DDoS mitigation is on | Vercel platform default on every plan | Platform behaviour, no per-project config to record |

---

## 4. Incident: 2026-08-29 — staff 403 while paging the alumni list (#796)

| Field | Value |
| --- | --- |
| Reported by | Jake |
| Environment | **Production** (`https://finance.alumni.byu.edu`) |
| Action being performed | Clicking "next" through the alumni list, signed in as staff |
| Error shown | `Error: Forbidden / 403: Forbidden` |
| Request ID | `sfo1::6v84k-1787975045568-a4078d8a1bb8` |
| Time | **2026-08-29 03:44:05 UTC** |
| Issue | `fa-web-app#796` (opened 2026-08-29 18:44:47 UTC) |
| Status | **Root cause not identified.** Dashboard lookup outstanding. |

**The request ID corroborates the timestamp.** Its middle segment,
`1787975045568`, read as epoch milliseconds is `2026-08-29T03:44:05.568Z` — an
exact match for the reported time. `sfo1` is the San Francisco edge region. Use
`03:44:05–03:44:06 UTC` as the search window; the ID is the join key.

### Ruled out

| Hypothesis | Evidence it was ruled out on |
| --- | --- |
| **The application returned the 403** | No runtime log line from either prod project across that window contains a 403. Edge blocks produce **no runtime logs at all**, so the absence is itself consistent with an edge block. The `sfo1::` prefix is Vercel's edge error page — it is not our error envelope, which the API generates and which would have been logged. |
| **Deployment Protection / SSO** | SSO is set to `all_except_custom_domains` and `finance.alumni.byu.edu` is exempt. Both hostnames were observed to redirect normally rather than 403. |

### Still suspected

The **Vercel Firewall** — one of: a custom rule with a `deny` action, an IP block, a
rate-limit rule configured to deny on breach, Attack Challenge Mode, or a managed
bot ruleset.

**Leading candidate: a rate-limit rule.** Paging the alumni list fires several
requests in quick succession — the document, the API call for the page of records,
and static assets — all from one IP. `docs/PRE-LAUNCH.md` §8 recommends precisely
`100 req / 60s per IP → Deny or Challenge`. A staff member paging briskly crosses
that without doing anything unusual. Whether such a rule exists is exactly what
§3 does not know.

### ⚠️ Reasoning that narrows the field — inference, not evidence

Recorded so the dashboard check can confirm or kill it. **Do not treat as fact.**

- A plain **403** is the signature of a `deny` action. Vercel's `rate_limit` action
  returns **429** by default; it returns 403 only when explicitly configured with a
  deny action on breach. So either a `deny` custom rule / IP block fired, or a rate
  limit was deliberately set to deny.
- **Attack Challenge Mode serves a challenge page, not a bare 403.** That makes ACM
  a weaker fit for this symptom — but check its state anyway, since a challenge that
  fails can present unhelpfully and the toggle's state is worth knowing regardless.
- **Rate-limit counters are per edge region.** A limit can be breached in one region
  while global request volume looks well under the configured threshold. `sfo1`
  alone counted this request. Do not dismiss a rate limit because "he can't have
  made 100 requests".

### Done means (from #796)

- [ ] The rule that fired is identified **by name**
- [ ] Ordinary paging by a signed-in staff member cannot trigger it
- [ ] What is configured is written down in this file, with a date

---

## 5. Standing hazards

- ⚠️ **A `deny`-action rate limit that catches ordinary staff paging is
  indistinguishable from an outage.** The user sees "Forbidden" on a site they are
  legitimately signed in to. They report a broken site, not a security control. If a
  rate limit must exist on a staff-facing path, prefer **`challenge`** over `deny`,
  or scope the rule to unauthenticated paths.
- ⚠️ **Edge blocks produce no runtime logs.** Searching the Logs tab for a
  firewall-blocked request finds nothing, and that silence looks exactly like
  "nothing happened". The **Firewall traffic view is the only place** such a request
  is visible. Not finding a 403 in runtime logs is evidence *for* an edge block, not
  against one.
- ⚠️ **Persistent actions outlive the rule.** A mitigation configured with a duration
  (`deny --duration 30m`) keeps blocking a client for the full duration **even after
  the rule is deleted**. Deleting a bad rule does not immediately unblock the person
  it caught. Check for a duration on any rule you change.
- ⚠️ **Rule changes are staged as drafts and do nothing until published.** Custom
  rules and IP blocks require an explicit publish step. A rule can sit in draft and
  be invisible in effect while looking present in the UI — and conversely, a "fix"
  can be made and never take effect. Attack Challenge Mode and system bypass, by
  contrast, take effect immediately.
- ⚠️ **Rate-limit counters are per region**, so N regions can collectively exceed the
  configured limit by roughly N×. A per-IP threshold is not a global one.
- ⚠️ **This file drifts silently.** It has no CI check and cannot have one — there is
  nothing in git to compare against. Its only defence is the maintenance rule in §7.

---

## 6. How to verify — dashboard checklist

Run this in the Vercel dashboard. **Read-only: change nothing during steps 0–4.**
Record every answer in §3 with today's date, including the answers that are "none"
or "off" — a confirmed absence is as valuable as a confirmed rule.

> Where a UI label below is uncertain, it is marked **(label uncertain)**. If what
> you see is named differently, write down the name you actually saw — that
> correction is worth more than the guess.

### Step 0 — Confirm you are looking at the right projects

1. Go to <https://vercel.com> and sign in.
2. Confirm the **team/scope** selector at the top left. It should read
   `byu-finance-db` — confirmed 2026-08-29 from the live Vercel deployment URLs on
   PR #797. (`fa-web-api/docs/SECURITY-MONITORING.md` says `gunnjakes-projects`;
   that is stale.) **If what you see differs, write it down — that is a finding.**
3. Confirm both prod projects exist and note their exact names:
   - the app project, expected `finance-alumni-database`
   - the API project, expected `finance-alumni-database-api`
   If either name differs from the above, that is a finding — record it.

### Step 1 — Find the request that was blocked

Do this on the **app project first** (`finance-alumni-database`).

1. Open the project → the **Firewall** tab in the top project nav.
2. Within Firewall, open the traffic / log view. Direct URL, substituting your
   scope name:
   `https://vercel.com/byu-finance-db/finance-alumni-database/firewall/traffic`
3. Set the time range to cover **2026-08-29 03:44 UTC**. Check whether the view is
   showing times in **UTC or your local time** and adjust — 03:44 UTC is 21:44 on
   2026-08-28 in Mountain Daylight Time. Widen to the full hour if the minute
   window shows nothing.
4. Look for the request `sfo1::6v84k-1787975045568-a4078d8a1bb8`.
   - **(label uncertain)** I do not know whether this view offers a free-text search
     by request ID. If there is a search or filter box, paste the full ID there.
     If there is not, sort or filter by time to 03:44:05 UTC and find it by
     timestamp, region (`sfo1`) and path (an alumni list page or its API call).
   - If the view has a **retention limit** shorter than the elapsed time, the record
     may be gone. **If so, say that explicitly** — "the log no longer covers
     2026-08-29" is a real answer and not a failure.
5. When you find it, record: **the rule name that fired**, the **action** it took
   (deny / challenge / rate limit), the **path**, and the **IP**.

**If nothing appears in the app project's firewall traffic for that window, repeat
step 1 against `finance-alumni-database-api` before concluding anything.** The
alumni list's data comes from the API project, so the block may have landed there.

### Step 2 — Inventory the rules on **both** prod projects

For **each** of `finance-alumni-database` and `finance-alumni-database-api`, on the
**Firewall** tab, record:

1. **Custom rules** — the rule list. For every rule: name, condition, action
   (deny / challenge / log / rate limit / bypass / redirect), whether it is
   **enabled**, and — for rate limits — the **request count, window, and the action
   taken on breach**. Also note whether any rule carries a **duration**.
2. **Unpublished changes** — whether the UI shows staged/draft rule changes that
   have not been published. **(label uncertain)** — it may be presented as a
   "Publish" or "Review changes" banner.
3. **IP blocking** — every blocked IP or CIDR, and any note attached.
4. **System bypass** — every bypassed IP/CIDR and its scope.
5. **Attack Challenge Mode** — the toggle's state, ON or OFF. **(label uncertain)**
   — Vercel documentation also calls this "Attack Mode"; it is the one-switch
   "under attack" control that challenges every unverified visitor.
6. **Managed rulesets / bot management** — whether **Bot Protection** and/or
   **AI Bots** are enabled, and in what mode (log vs block). **(label uncertain)**
   — availability and exact naming vary by plan; if you cannot find this section,
   record "not present on this plan/UI" rather than leaving it blank.

Explicitly confirm or refute each row of §3.4 while you are there — particularly
whether the app project really has `300 req / 60s excluding /_next/*` and the API
project really has `100 req / 60s`.

### Step 3 — Optional cross-check from the CLI

Faster than clicking, and it produces text you can paste straight into §3. Use a
throwaway directory so the repo's Vercel link is never touched:

```bash
tmp="$TEMP/wf-check"; mkdir -p "$tmp"
vercel link --yes --project finance-alumni-database --scope byu-finance-db --cwd "$tmp"
vercel firewall overview --cwd "$tmp"
vercel firewall rules list --expand --cwd "$tmp"
vercel firewall ip-blocks list --cwd "$tmp"
vercel firewall system-bypass list --cwd "$tmp"
vercel firewall diff --cwd "$tmp"          # shows unpublished drafts
```

Then repeat with `--project finance-alumni-database-api`.

`vercel firewall diff` is the reliable way to see whether anything is staged but
unpublished. Run `vercel firewall --help` if a subcommand name has moved.

> ⚠️ **Read-only only.** Do not run `rules add`, `rules edit`, `publish`,
> `attack-mode`, or `system-mitigations pause` as part of this checklist.
> `system-mitigations pause` removes platform DDoS protection and must never be run
> casually.

### Step 4 — Report back

Send back, for **each** of the two prod projects:

1. The **scope name** you saw in step 0, and whether both project names matched.
2. **The rule that fired at 03:44:05 UTC on 2026-08-29 — by name** — plus its action
   and the path it matched. If the firewall log does not go back that far, say so.
3. The **full rule list**: name, condition, action, threshold/window, enabled.
4. **Attack Challenge Mode**: on or off.
5. **IP blocks** and **system bypass** entries, or "none".
6. **Bot Protection / AI Bots**: enabled or not, or "not present in the UI".
7. Whether there are any **unpublished draft** rule changes.
8. Whether the `300/60s` (app) and `100/60s` (API) claims from
   `SECURITY-MONITORING.md` are **true, false, or different numbers**.

### Step 5 — Only after reporting: the fix

Do not change anything until steps 0–4 are recorded, so we know what the state was
before we touched it. Once the offending rule is named, the options from #796 are:

- switch the action from **Deny → Challenge**, or
- raise the threshold above what ordinary staff paging produces, or
- scope the rule to unauthenticated paths so a signed-in staff session cannot trip it.

Then verify by paging briskly through the alumni list on production as a signed-in
staff member, and confirm the request no longer appears in the firewall traffic
view. **Update §3 and §4 of this file in the same change.**

---

## 7. Maintenance rule

**Any change to Vercel Firewall configuration must be written into this file, in
the same working session, with a date and the name of whoever made it.**

- Update the affected table in §3 and bump its **Last verified** cell.
- Update the "Last verified against the Vercel dashboard" line at the top.
- A *verification with no changes* is also a change to record — set the date and
  note "verified, no changes".
- Record deletions as well as additions. A rule that used to exist and no longer
  does is exactly the kind of fact that goes missing.
- ⚠️ **Never tick a box or fill a cell here from a recommendation, a runbook, or
  memory.** Only from the dashboard or from `vercel firewall` CLI output. §1 is what
  happens otherwise.

## 8. Related

- `docs/PRE-LAUNCH.md` §8 — the original Tier 0 firewall *recommendations*
  (unticked, correctly).
- `fa-web-api/docs/SECURITY-MONITORING.md` — the monitoring runbook. Its
  "Infrastructure facts" firewall line is an **unverified assertion**; see §1.
  Once §3 is filled in, that line should be corrected to match or to point here.
- `fa-web-api#43` — the closed-without-evidence WAF rate-limit ticket.
- `fa-web-app#796` — the 2026-08-29 prod 403 incident this file was written for.
