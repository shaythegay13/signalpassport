# Antigravity prompt — M0: First-hour feasibility gate

Issued 2026-09-12 by the technical lead. Governing scope: `Signal-Passport-Weekend-PRD.md`.

---

You are implementing **Signal Passport** for the LOCK IN Hack fintech track. I am the
technical lead and reviewer. I will read your actual diffs and verification evidence, not
your summary, before accepting anything.

## Context you must load first

- **Governing document:** `C:\Users\shayb\Downloads\Signal Passport\Signal-Passport-Weekend-PRD.md`.
  Read it in full before editing anything. It is the authoritative scope for the weekend.
  Where anything below appears to conflict with the PRD, the PRD wins — flag the conflict.
- **Reference repository:** `C:\Users\shayb\Downloads\Signal Passport\ledgerlens`.
  **READ-ONLY.** Do not modify, move, reformat, reinstall, build or commit anything inside it.
  It must be byte-identical when you finish. Do not read `ledgerlens/.env.local`.
- **Your working directory:** `C:\Users\shayb\Downloads\Signal Passport\signal-passport`.
  It already contains `STATUS.md` and `docs/REUSE.md`, written by me from a direct inspection
  of LedgerLens. **Update those two files — never recreate or overwrite them wholesale.**
  `STATUS.md` holds the binding milestone acceptance criteria. Read it before you start.

## This milestone is M0 only

Scope is PRD §6, the first-hour feasibility gate. **Stop at 60 minutes of implementation
time** whether or not you are finished, and report. Do not run ahead into M1.

**Out of scope for M0 — do not start any of these:** metric implementation, canonical JSON,
hashing, the Passport bundle, either UI, AI explanation, smart contracts, wallet connection,
Monad, sponsor integrations, a monorepo orchestration framework, a database, or provisioning
your own indexer. Creating an indexer is an explicit PRD anti-goal for this hour.

---

## Task 1 — Confirm the reuse inventory (target 15 min, hard cap 20)

`docs/REUSE.md` states what I found in LedgerLens. **Verify it; do not trust it.** Read at
minimum: `README.md`, `docs/STATUS.md`, `package.json`, `lib/ai-provider.ts`,
`lib/ai-analysis.ts`, `lib/ai-report.ts`, `lib/csv.ts`, `lib/types.ts`, `lib/analysis.ts`,
`app/api/interpret/route.ts`, `tests/ai-provider.test.ts`, `tests/demo-data.test.ts`.

Then edit `docs/REUSE.md` in place:

- Correct any row that misdescribes the real code, and say what was wrong.
- Add any reusable artifact I missed, with its file and line count.
- Confirm or refute this specific claim, which matters to the originality disclosure:
  **LedgerLens contains no wallet, chain, RPC, indexer, SHA-256, hashing, canonical-JSON,
  shared-schema, or bundle export/import code, and has no reusable evidence-ID utility.**
  Show the search you ran.
- Do not copy any code yet. M0 produces the inventory; copying happens when a milestone
  actually needs the component.

Do not claim LedgerLens has wallet or Passport functionality. It does not. Do not port
`lib/analysis.ts`, `lib/types.ts`, `lib/memory.ts`, `lib/business-memory.ts`, the AWS
reclassification behaviour, or anything Business Memory related — PRD §5 forbids it.

## Task 2 — Establish the project (target 10 min)

In `signal-passport/`:

1. `git init`. Write `.gitignore` **before** the first commit: `node_modules`, `.next`,
   `.env.local`, `.env*.local`, `coverage`, `*.tsbuildinfo`.
2. Commit the current pre-implementation state first, so the repo records what existed before
   weekend work began (PRD §5). Message: `Record pre-implementation state: PRD review, reuse inventory, milestone plan`.
3. Create only the skeleton this milestone needs — do not scaffold apps yet:
   `packages/`, `fixtures/`, `docs/`, `scripts/`.
4. `package.json` at the root with TypeScript and a test script. Node is **v24.19.0**,
   npm **11.17.0**. Choose currently supported versions by checking the registry; do not copy
   LedgerLens's pinned versions. `node:test` plus `node:assert/strict` is the test convention.
5. `.env.example` documenting whatever variables your chosen source needs, values empty.
   Never commit a real key. Signal Passport gets its own `.env.local`, git-ignored.
6. Keep commits incremental and descriptive throughout the hour.

There is **no blockchain provider credential on this machine** — I checked. Plan for that.

## Task 3 — Prove real data access (the core of this hour, target 25 min)

You must demonstrate that one endpoint actually returns **indexed historical transaction
activity for an address**, with pagination. PRD §6 is explicit: do not assume a generic RPC
endpoint provides indexed address history. Verify the real capability with a real request
before committing to it.

Work this decision rule in order and **record the outcome of each step you attempt**:

1. **Envio** (the previously planned route, PRD §6 prefers it). Time-box **15 minutes**. It
   qualifies only if documented historical address-history access works immediately without
   provisioning an indexer and without a credential we do not have. If it needs an indexer
   deployment or a paid/queued key, abandon it and say so.
2. **A zero-credential documented history API.** My leading candidate is the Blockscout public
   REST v2 instance for a supported chain (address transactions endpoint with a direction
   filter and cursor pagination). **I have not verified its contract — you must.** Confirm by
   real request: does it return per-transaction hash, timestamp, from, to, and status? How
   does pagination actually work, and what is the page size?
3. **Etherscan V2 multichain API** (`module=account&action=txlist`, with block range and
   page/offset). Requires a free key. Only take this route if a key can be obtained inside
   the hour; otherwise ask me rather than stalling.

Whichever you use, establish empirically and write down:

- Per-transaction **hash**, **UTC timestamp**, **from**, **to**, and **success/status** field
  names as they actually appear in the payload. Quote the real field names.
- The **direction/subject relationship** — how you identify transactions *sent by* the subject
  wallet, since PRD §7's default scope is successful **outgoing** transactions.
- **Pagination behaviour** observed, not assumed: parameter names, page size, how you detect
  the last page, and whether results are stable across pages.
- Whether the endpoint supports a **bounded query** by time or block range. Freeze an **end
  block and end timestamp** for this dataset; PRD §7 requires a frozen end.

Wallet choice: one **public** address with modest, real activity — not an exchange, bridge, or
whale address, and nothing that returns tens of thousands of rows. Bounded means bounded. If a
recent 30-day window returns too little to be useful, say so and either widen the frozen
window or choose a different public address — but then label the **exact** scope you actually
queried. Never describe a narrow query as complete wallet history.

If **nothing** works: do not invent data and do not keep grinding. Follow the PRD §6 fallback —
build toward an import adapter for a genuine exported public-wallet dataset with source
references, label it "imported historical snapshot," and state plainly that the live-adapter
acceptance criterion is not met. Surface this to me immediately, not at minute 59. Synthetic
data is for tests only and must be visibly labelled as synthetic.

## Task 4 — Save the fixture and its retrieval metadata (target 10 min)

1. Save the **raw, unmodified** response(s) under `fixtures/real/`. Do not reshape, prettify
   into a different structure, or hand-edit the payload. If you paginated, save each page.
2. Save a sibling metadata record (JSON) containing: provider name and base URL, chain and
   numeric chain ID, subject address, query filters used, observation window as explicit UTC
   start/end, frozen end block, limits and page size, page count, row count returned, whether
   results were truncated, the retrieval timestamp in UTC, and the exact request URL(s) with
   any key redacted.
3. Keep `fixtures/real/` and `fixtures/synthetic/` separate directories. Add a short README in
   `fixtures/` stating which is which and that synthetic data never appears in a demo.
4. Redact credentials everywhere, including in the saved URLs and your report.

## Task 5 — Freeze the source and report

1. Add the frozen source decision to the **Decisions** table in `STATUS.md` as **D6**
   (it is currently "Open until M0"): provider, chain, chain ID, scope, window, end block, and
   why the alternatives were rejected. Move D6 to `Fixed`.
2. Update `STATUS.md` `Working` / `In Progress` / `Known Issues`. Every claim must carry its
   verification evidence inline, following the LedgerLens STATUS convention. A claim without
   evidence will be rejected in review.
3. Write `docs/verification/M0.md` containing:
   - The **exact commands and request URLs** you ran, credentials redacted, and their real
     output or a faithful excerpt.
   - The real field names you found, mapped to the concepts in PRD §8's evidence record.
   - Observed pagination behaviour.
   - Row count, window, and frozen end block.
   - The reuse-inventory confirmations and corrections.
   - Anything that did **not** work, and what you concluded from it.
4. Note actual elapsed time per task, so we can re-plan the remaining time boxes honestly.

---

## Acceptance criteria for M0

I will accept M0 only when all of these hold:

1. `ledgerlens/` is unmodified — `git -C ../ledgerlens status --porcelain` is empty and `HEAD`
   is still `bd9b41c`.
2. `signal-passport/` is a git repo whose **first** commit records the pre-implementation
   state, with incremental commits after it and no secrets in history.
3. `docs/REUSE.md` has been verified against the real files, with corrections shown and the
   "no wallet/chain/hashing/schema/bundle code" claim explicitly confirmed or refuted,
   including the search used.
4. One provider and chain are frozen in `STATUS.md` D6, with the alternatives' rejection
   reasons recorded.
5. A real bounded dataset exists in `fixtures/real/` as an unmodified raw response, with a
   complete retrieval-metadata record, and **transaction hashes, UTC timestamps, the
   direction/subject relationship, and pagination behaviour are all demonstrated from the real
   payload** — not asserted.
6. `docs/verification/M0.md` lets me reproduce your requests myself.
7. Nothing out of scope was built.

## How to report back

Give me, in this order: what you verified and how; the frozen source decision and its
rejected alternatives; the fixture path and row count; each acceptance criterion with a
pass/fail and the evidence line that proves it; the commit list (`git log --oneline`); elapsed
time per task; and anything you were unable to do. Distinguish clearly between what you
**ran and observed** and what you **inferred from documentation**. If you hit the 60-minute
stop mid-task, report the partial state honestly rather than rushing a claim — I would rather
re-plan than review an unsupported assertion.
