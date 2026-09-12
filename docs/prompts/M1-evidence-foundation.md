# Antigravity prompt — M1: Evidence foundation

Issued 2026-09-12 by the technical lead, after M0 acceptance. Governing scope:
`Signal-Passport-Weekend-PRD.md`.

---

M0 is accepted — Blockscout REST v2 is frozen as the source (D6 in STATUS.md), and the file
write corruption from M0 is fixed with a stated going-forward policy. Keep using that policy:
no `Set-Content -Encoding utf8` / double-quoted PowerShell here-strings for text, JSON, or
code. If you write files through PowerShell at all this milestone, use `fs.writeFileSync` from
Node, or single-quoted here-strings (`@'...'@`) with explicit no-BOM UTF-8, for every text file
you create — including the `.ts` source files in this milestone, not just docs.

## Context you must load first

- `Signal-Passport-Weekend-PRD.md` — §7 (Evidence and metrics) and §8 (Data contract) govern
  this milestone specifically. Re-read both before writing types.
- `signal-passport/STATUS.md` — read the full M0 review log before starting; it records what
  was verified and why, and the acceptance-criteria format your work will be judged against.
- `signal-passport/fixtures/real/` — your M0 fixture. `page-1.json` + `page-2.json` (100 raw
  Blockscout items, unauthenticated `filter=from` query) and `metadata.json` (frozen subject,
  window, end block). This is real, verified data — use it as-is, do not re-fetch or reshape it.
- `signal-passport/docs/REUSE.md` — no LedgerLens component is being adapted in this milestone.
  Nothing here requires a new REUSE.md entry unless you find a reason to use one; if you do,
  add the entry and say why in your report.
- `ledgerlens/` remains **read-only**. Same rule as M0.

## This milestone is M1 only

Scope: address validation, the Blockscout adapter, normalized evidence records, the three PRD
metrics, deduplication, UTC-day bucketing, and coverage status. This is `packages/schema` (the
evidence/claim types) and `packages/analysis` (adapter, normalization, deterministic metrics).

**Out of scope — do not start:** canonical JSON serialization, SHA-256 hashing, the Passport
bundle envelope (`schema_version`/`payload`/`integrity`), either UI app, AI explanation, Monad,
a database. Those come later. If you find yourself writing a `digest` field or a `hash()`
function, stop — that's M2.

## Task 1 — `packages/schema`: evidence and claim types

Define, with zod runtime validation (per PRD §8's minimum fields — do not add fields it doesn't
list):

- **EvidenceRecord**: evidence ID, chain ID, transaction hash, optional log index, UTC
  timestamp, sender, recipient (nullable — PRD says "if available"), relevant status/action
  fields, provider, source reference (a real URL to the transaction on a block explorer).
- **Claim**: claim ID, metric type, value, units, evidence IDs (array, non-empty), calculation
  version, declared observation scope.
- **CoverageStatus**: exactly `"complete_for_query" | "partial" | "unknown"`.

Evidence IDs must be stable and chain-scoped — PRD §7 says dedupe by chain ID + transaction
hash, and preserve log index in the evidence ID only if log-based evidence is used while still
counting unique transactions separately. Since Blockscout's `filter=from` endpoint returns one
row per transaction (no log index in the payload you saved), your evidence ID scheme for this
milestone is transaction-level: derive it from chain ID + transaction hash, not from array
position. Document the exact scheme in code comments and in `docs/METHODOLOGY.md` (create it).

## Task 2 — `packages/analysis`: address validation

A function that validates an Ethereum address: correct `0x` + 40 hex-character shape, and EIP-55
mixed-case checksum validation when the input is mixed-case (reject a mixed-case address with an
invalid checksum; accept all-lowercase or all-uppercase as unchecksummed but well-formed, per
common practice — state your rule explicitly in the code comment, since the PRD does not spell
out the exact checksum policy). This does not prove wallet control — PRD §4 P0 item 2 — say so
in the function's doc comment, not just in your report.

Write tests covering: a valid checksummed address, a valid all-lowercase address, a malformed
address (wrong length, missing `0x`, non-hex characters), and a mixed-case address with a
corrupted checksum.

## Task 3 — `packages/analysis`: Blockscout adapter and normalization

- A typed client function wrapping `GET /api/v2/addresses/{address}/transactions?filter=from`
  against `https://eth.blockscout.com/api/v2` (base URL from `.env.local`/`.env.example`,
  not hardcoded), including the cursor pagination you proved in M0 (`next_page_params`
  passthrough, terminate at `null`).
- A normalization function converting a raw Blockscout item into an `EvidenceRecord`. Map
  exactly the fields you verified in M0's `docs/verification/M0.md`: `hash`, `timestamp`,
  `from.hash`, `to.hash`, `status`/`result`, `block_number`. Qualifying scope per PRD §7:
  successful (`status === "ok"`) outgoing (`from.hash` equals the queried subject,
  case-insensitive) transactions within the declared UTC window.
- Deduplicate by chain ID + transaction hash before computing anything. Write a test using
  synthetic duplicate input (two records with the same hash) proving the duplicate does not
  inflate the transaction count — the real fixture has no duplicates, so this must be a
  synthetic test case, not derived from `fixtures/real/`. Save it under `fixtures/synthetic/`,
  clearly labeled, per the convention `fixtures/README.md` already states.
- A provider-error path: a failed fetch (network error, non-2xx, malformed JSON) must surface
  as a thrown/returned error, never as an empty evidence array. Write a test that mocks a
  provider failure and asserts the result is distinguishable from "zero qualifying activity."
  This is PRD §14's explicit acceptance check — do not skip it.

## Task 4 — the three deterministic metrics

Implement exactly the three PRD §7 metrics, each producing a `Claim`:

1. **Observed transaction count** — distinct qualifying transaction hashes.
2. **Active days** — distinct UTC calendar dates (`YYYY-MM-DD` in UTC, not local time) with at
   least one qualifying transaction.
3. **Unique recipients** — distinct non-null destination addresses among qualifying outgoing
   transactions.

Every claim's `evidenceIds` must reference real evidence records that exist in the same result
set — no claim may cite an evidence ID that isn't present. Use the PRD's required wording
("Observed transactions", "Active days within this dataset", "Unique recipient addresses") if
you render any label text; do not call this "protocols used" or infer trading behavior — PRD §7
is explicit that this must not be done.

Write a UTC calendar-boundary test: construct two synthetic transactions timestamped near
midnight UTC — one at `23:59:59.000Z` and one at `00:00:01.000Z` the next day — and assert they
count as two distinct active days, not one. This is exactly the kind of boundary bug PRD §14
calls out ("UTC date boundaries are correct").

## Task 5 — coverage status

Compute `complete_for_query` when the adapter paginated to `next_page_params: null` within the
declared window without hitting any provider-imposed truncation; `partial` when the provider
indicated more data exists beyond what was fetched or a page fetch failed after some pages
succeeded; `unknown` when coverage cannot be determined. Record pagination metadata (page count,
whether truncated) alongside the coverage status — PRD §7 requires this to be stored, not just
computed and discarded. Write a test for each of the three states using synthetic adapter
responses (you can fake the pagination cursor behavior; you do not need to hit Blockscout again
for this).

## Task 6 — hand-checked verification against the real fixture

Run your full pipeline (validate → fetch-or-load fixture → normalize → dedupe → compute metrics
→ coverage) against `fixtures/real/page-1.json` + `page-2.json`, using the exact frozen window
and subject from `fixtures/real/metadata.json` (do not re-derive the window differently than M0
froze it).

Then **hand-check** the three metric values against the raw fixture independently of your own
code — e.g. by grep/manual count against the raw JSON, not by re-running the same function you
just wrote and calling that "verification." Show your hand-check method and its result in
`docs/verification/M1.md`, next to your code's output, and confirm they match. If they don't
match, that is a bug in the code or in the hand-check — find out which before reporting.

## Acceptance criteria for M1

I will accept M1 only when all of these hold, and I will check each one against the actual code
and test output, not your summary:

1. Metrics computed from `fixtures/real/` match a hand-checked expected value you derived
   independently, with the hand-check method shown.
2. A synthetic-duplicate test proves deduplication actually prevents count inflation.
3. A synthetic UTC-boundary test proves calendar-day bucketing is correct at midnight.
4. A synthetic provider-failure test proves an error surfaces as an error, never as zero
   activity.
5. Coverage status has a test for each of `complete_for_query` / `partial` / `unknown`, with
   pagination/truncation metadata recorded alongside it.
6. Address validation has passing tests for a valid checksummed address, a valid unchecksummed
   address, and at least two invalid cases (malformed shape; corrupted checksum).
7. Every claim's evidence IDs resolve to real evidence records in the same result — no dangling
   references, and a test proves it.
8. `npm test` passes, with real output pasted in your report — not summarized as "all tests
   pass."
9. No file in your diff has a BOM or control-byte corruption — recheck this yourself before
   reporting; I will recheck it independently either way.
10. Nothing out of scope (listed above) was built.
11. `ledgerlens/` is still unmodified — `HEAD` still `bd9b41c`, clean status.

## How to report back

Same structure as M0: what you built and how you verified it; the hand-check method and result
for each metric; real `npm test` output; each acceptance criterion with pass/fail and its
evidence line; the commit list; elapsed time; anything you could not complete. Distinguish what
you ran and observed from what you inferred. If a metric's hand-check and code output disagree,
report the disagreement and your diagnosis — do not silently adjust one to match the other
without saying so.
