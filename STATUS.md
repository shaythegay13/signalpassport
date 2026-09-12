# Signal Passport — STATUS

Governing scope: `../Signal-Passport-Weekend-PRD.md` (Weekend Build PRD v1.0).
Submission target: Sunday 2026-09-13, 12:00 noon New York. Feature freeze 09:00, final
verification by 10:00, packaged before noon.

Roles: **Shay Bouchles** — owner. **Claude (this session)** — technical lead and reviewer;
writes milestone prompts, reviews actual diffs and verification evidence, maintains this file
and `docs/REUSE.md`. **Antigravity** — implementer.

Review rule: a milestone is accepted only after the reviewer has read the code changes and
reproduced or inspected the verification evidence. An implementer summary is never sufficient
on its own. Claims in this file must carry their evidence.

---

## Decisions

| # | Decision | Rationale | Status |
| --- | --- | --- | --- |
| D1 | New repository at `signal-passport/`, sibling of `ledgerlens/`. LedgerLens is read-only reference. | PRD §5 requires preserving LedgerLens and a separate repo. | Fixed |
| D2 | Reuse is limited to AI plumbing patterns and test/STATUS conventions. No LedgerLens financial logic, business schema, or Business Memory. | PRD §5 prohibitions; verified inventory in `docs/REUSE.md`. | Fixed |
| D3 | `packages/verification`, `packages/schema`, `packages/analysis`, the evidence model, both apps, and all hashing are new work. | Repo-wide search of LedgerLens found no wallet, chain, hashing, canonical-JSON, schema, or bundle code. | Fixed |
| D4 | No monorepo orchestration framework. Plain TypeScript path aliases and two independently runnable apps. | PRD §11 "keep setup simple." | Fixed |
| D5 | No database in P0. The downloaded bundle is the portable artifact. | PRD §11. | Fixed |
| D6 | Blockscout REST v2 on Ethereum Mainnet (Chain ID 1). Endpoint: `GET /api/v2/addresses/{address}/transactions?filter=from`. Frozen subject: `0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8`, window: `2026-08-13T00:00:00.000000Z` to `2026-09-12T16:08:11.000000Z` (30 days), frozen end block: `25962430`, frozen end timestamp: `2026-09-12T16:08:11.000000Z`. Alternatives rejected: Envio (requires `ENVIO_API_TOKEN` via GitHub login and custom indexer deployment; abandoned under 15-min cap); Etherscan (requires account key registration). | PRD §6 zero-credential live data access requirement met with verified cursor pagination and `filter=from`. Evidence recorded in `docs/verification/M0.md`. | Fixed |
| D7 | AI explanation (P0b) is gated behind a fully verified P0 flow. Monad/P1 is gated behind PRD §13. | PRD §4, §13. | Fixed |
| D8 | No numerical confidence scores. Coverage status, evidence counts, and stated limitations only. | PRD §7. | Fixed |

### Environment facts (verified 2026-09-12)

- Node **v24.19.0**, npm **11.17.0**, both resolvable in Git Bash. In PowerShell the
  `npm.ps1` shim is blocked by execution policy — use `& "C:\Program Files\nodejs\npm.cmd"`.
- **No blockchain data-provider credential exists on this machine.** `ledgerlens/.env.local`
  holds only `AI_PROVIDER`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, two `NEXT_PUBLIC_SUPABASE_*`
  values, and three `PRISMTRACE_*` values. There is no Envio, Alchemy, or Etherscan key.
  Blockscout REST v2 requires zero credentials, resolving this constraint for P0.
- `GROQ_API_KEY` and `ANTHROPIC_API_KEY` are both populated, so P0b has a working model path
  if it is reached. Signal Passport must use its own `.env.local`; do not read LedgerLens's.

---

## Milestones

Acceptance criteria are binding. The evidence column states what the reviewer must be shown.

| M | Scope | Acceptance criteria | Required evidence | State |
| --- | --- | --- | --- | --- |
| **M0** | First-hour feasibility gate: confirm reuse inventory, establish repo, retrieve one real bounded wallet dataset, freeze the source. | Repo initialized with an initial commit recording pre-implementation state; `docs/REUSE.md` confirmed or corrected against the real files; one provider and chain chosen with the endpoint's *actual* history and pagination capability demonstrated; real response saved as a fixture with full retrieval metadata; source frozen in `STATUS.md`. | The exact request issued; the raw saved response; the metadata record; transaction hashes, timestamps and direction fields identified in the real payload; pagination behaviour observed, not assumed. | **Accepted** |
| **M1** | Evidence foundation: address validation, adapter to normalized evidence, three deterministic metrics, dedup, UTC bucketing, coverage status. | Metrics match hand-checked expected values on a small fixture; duplicate `(chainId, txHash)` records do not inflate counts; UTC calendar-date boundaries correct at both edges; a provider error surfaces as an error and never as zero activity; coverage is one of `complete_for_query` / `partial` / `unknown` with truncation and pagination recorded. | Passing test run output; the hand-checked expected values and how they were derived; a test proving error is not zero. | **Accepted** |
| **M2** | Passport bundle and integrity: shared schema, canonical serialization, SHA-256 payload digest. | Bundle carries `schema_version`, `payload`, `integrity`; canonical JSON sorts object keys recursively, defines stable array ordering, encodes large chain integers as decimal strings, and rejects non-finite or ambiguous numbers; the digest covers `payload` only and excludes its own digest and transport fields; identical payload gives identical bytes and digest **in a separate process**; payload-only tampering fails the check. | Test output including the cross-process digest match, the tamper-mismatch case, and rejection of non-finite values. | Not started |
| **M3** | Both interfaces: App One (input, analysis, Passport, evidence drill-down, export) and App Two (independent import, validation, display). | App Two is a separate runnable application, not a second route; it imports and displays a bundle **while App One is stopped**, with no provider key, no network fetch and no AI; every claim's evidence IDs resolve within the bundle; unsupported schema versions and malformed or missing evidence references are rejected with usable messages; integrity and publication status are shown separately; integrity is labelled "Bundle integrity matched" with its explanation, never "verified reputation." | Screenshots or a terminal transcript of App Two running with App One stopped; the exported bundle file; a reload-after-download check showing no field loss and an unchanged digest. | Not started |
| **M4** | Reliability and edge states. | Zero qualifying activity yields a valid empty Passport stating the exact query scope; invalid address, unavailable provider and partial coverage each have distinct states; partial coverage is visible in App One, App Two and the export; README setup works from a clean clone with documented sample data. | Each state exercised and shown; a clean-clone README walkthrough. | Not started |
| **M5** | P0b AI explanation. **Gate: M0–M4 all accepted.** | The model receives only immutable claims and evidence IDs; output is validated for evidence references and quantitative claims before display; invalid output is discarded and replaced by a deterministic summary; a model failure cannot block Passport generation or export; the explanation is excluded from the canonical payload. | A test proving invented numbers and invented evidence IDs are both rejected; a demonstrated fallback path. | Blocked by gate |
| **M6** | Submission package: README, reuse disclosure, demo video, social copy. | Reserve the final two hours. Never trade away evidence visibility, coverage labels or App Two. | — | Not started |
| **P1** | Monad testnet registry. **Gate: P0 accepted AND at least 4 discretionary hours before the submission buffer.** Stop after 45 minutes if infrastructure blocks. | Per PRD §13. A localhost-only reference must not be presented as publicly retrievable. | Blocked by gate |

---

## Working

- **M0 — accepted.** Reviewer independently re-derived, not just read, the load-bearing
  claims before accepting:
  - **Git pre-implementation state:** Initial commit `fb9de99` records `.gitignore`, seed
    `STATUS.md`, `docs/REUSE.md`, and the M0 prompt, before any implementation.
  - **LedgerLens reuse inventory verified:** `docs/REUSE.md` corrected line counts — reviewer
    recounted `lib/` (343 L / 9 files), `app/` ts+tsx (60 L), `components/` (38 L), `tests/`
    (162 L), `scripts/` (18 L) directly against the LedgerLens files and every number matched.
    Originality claim ("no wallet/chain/RPC/hashing/canonical-JSON/schema/bundle code, no
    reusable evidence-ID utility") confirmed via `git -C "../ledgerlens" grep` returning zero
    matches for both search sets.
  - **Data provider frozen (D6):** Blockscout public REST v2, Ethereum Mainnet, chain ID 1,
    zero credentials. `GET /api/v2/addresses/{address}/transactions?filter=from` verified live.
    Envio rejected (needs `ENVIO_API_TOKEN` via GitHub login + indexer setup, over the 15-min
    cap); Etherscan rejected (unnecessary key-registration friction given Blockscout worked).
  - **Real fixture, independently reproduced:** Subject `0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8`,
    frozen end block `25962430`, end timestamp `2026-09-12T16:08:11.000000Z`, 30-day UTC window.
    Reviewer recomputed the window filter directly from the raw `page-1.json`/`page-2.json`
    timestamps and got the same **28 qualifying transactions** the report claimed; confirmed
    100% of the 100 raw items have `from.hash` equal to the subject address; confirmed no
    duplicate hashes; confirmed the subject is an EOA (`is_contract: false`), not an exchange
    or contract. Pagination is real cursor pagination via `next_page_params`
    (`block_number`/`index`/`items_count`/`fee`/`hash`/`inserted_at`/`value`/`filter`),
    page size fixed at 50 regardless of requested `items_count`, terminates at `null`.
  - **File-integrity defect found and fixed across two review rounds:** round 1 found
    `docs/verification/M0.md` and `fixtures/README.md` corrupted (UTF-8 BOM plus PowerShell
    backtick-escape damage — 17 lines with literal control bytes, addresses missing leading
    characters). Round 2 found the same defect, unscoped by the first fix, still present in
    `fixtures/real/metadata.json`, `package.json`, `tsconfig.json`, `.env.example`,
    `.gitignore` — and confirmed `metadata.json`'s BOM actually broke `JSON.parse`, not just
    cosmetic. Both rounds verified by the reviewer directly (byte-level BOM/control-char scan,
    a real `JSON.parse` of every JSON file, a real `npm install`/`npm test` run), not by
    trusting the implementer's report. All clean as of commit `276144c`. Root cause (PowerShell
    `Set-Content -Encoding utf8` / double-quoted here-strings) identified; write policy changed
    for M1+ to avoid corrupting real TypeScript source.
  - Full reproduction steps: `docs/verification/M0.md`.

- **M1 — accepted.** Reviewer independently reran the test suite, read every source file in
  `packages/schema` and `packages/analysis`, and re-derived the metric numbers before accepting:
  - **Metrics verified against the reviewer's own private hand-check**, computed before seeing
    Antigravity's report: observed transactions 28, active days 12, unique recipients 10 —
    all three matched exactly, and the reviewer reran `npm test` directly (18/18 pass, real
    output captured, not summarized).
  - **EIP-55 checksum implementation read line-by-line** (`address.ts`): correct canonical
    algorithm — keccak256 of the lowercase hex, per-nibble `>= 8` → uppercase — with a stated,
    sensible policy for all-lower/all-upper vs. mixed-case input, and a wallet-control
    disclaimer in the doc comment per PRD §4.
  - **Qualifying-scope, dedup, and metrics logic read and traced**: direction check
    (`from.hash === subject`), status check, UTC window check (inclusive bounds, matching the
    reviewer's own M0 window math), dedup by `chainId:txHash` applied *before* metrics
    (confirmed via `normalizeAndDeduplicateBlockscoutItems` → `computeDeterministicMetrics`
    wiring in `real-fixture.test.ts`), UTC calendar-day bucketing via `getUTCFullYear`/
    `getUTCMonth`/`getUTCDate` (not local time). No dangling evidence references — every claim's
    `evidenceIds` checked against `evidenceMap` in the real-fixture test and confirmed by
    reading the assertion, not just its pass/fail line.
  - **Provider-error tests read and confirmed real**: network failure, HTTP 500, malformed
    JSON, and — notably — a genuine mid-pagination failure test (page 1 succeeds, page 2
    returns 504) proving `fetchBlockscoutHistory` propagates the error rather than returning a
    silently-truncated result as if it were complete.
  - **Repo-wide BOM/control-byte scan rerun independently**: clean across all tracked files.
  - **New defect found, not blocking:** `docs/METHODOLOGY.md`, `docs/verification/M1.md`, and
    this file's own M1 section (now rewritten) contained a *different* corruption mode than
    M0's — a literal `?` byte (`0x3F`) written where a real Unicode character (`§`, `—`) should
    be, confirmed at the byte level, not a terminal rendering issue. Consistent with UTF-8
    content passing through a non-UTF-8 codepage at write time. Confined entirely to prose;
    zero instances in any `.ts` source or test file (the `?` byte counts there are legitimate
    TypeScript syntax — optional chaining, optional properties — confirmed by reading the
    actual file content, not just counting bytes). Does not touch any M1 acceptance criterion,
    so M1 is accepted with this noted rather than sent back for a third round. **Required as
    the first step of the M2 prompt**, given M2 is exactly the milestone where byte-exact
    serialization matters most.
  - **Known design gap surfaced during review, not yet a defect:** `claimSchema.evidenceIds`
    is `.min(1)` (non-empty) unconditionally. If a query genuinely returns zero qualifying
    transactions, `computeDeterministicMetrics` would call `claimSchema.parse()` with an empty
    `evidenceIds` array for the transaction-count and active-days claims, which would throw —
    yet PRD §9 requires "zero qualifying activity returns a valid empty Passport." M1's own
    acceptance criteria never required zero-activity handling (that's M4's job), so this is not
    a blocker now, but it must be resolved before M4 and should be kept in mind during M2's
    schema work so the fix doesn't have to unwind a hardened bundle schema later.
  - Full reproduction steps: `docs/verification/M1.md`.

## In Progress

- **M2** — prompt not yet issued.

## Not Started

- M3 through M6. P0b and P1 remain gated.

## Known Issues

- **No blockchain provider credential on this machine:** Resolved for P0 by selecting Blockscout REST v2 public instance, which requires no credential.
- **Envio time-box hit during M0:** Stalled on Envio; abandoned per PRD §6 15-minute cap because hosted HyperSync/indexer access requires `ENVIO_API_TOKEN` (via GitHub login at `envio.dev/app/api-tokens`) and HyperIndex requires deploying custom contract indexers. Redirected to Blockscout REST v2, which verified cleanly.
- **Blockscout page-size limit:** Server returns fixed 50-item pages regardless of query parameters (`items_count` or `limit`). M1 adapter will handle pagination in 50-item chunks and slice to observation window.
- The PRD §6 fallback is available if no live history source works: an import adapter for a
  real exported public-wallet dataset, labelled "imported historical snapshot," with the
  live-adapter shortfall disclosed. Synthetic data is for tests only and must be labelled.

## Review log

| Date | Milestone | Reviewer verdict | Notes |
| --- | --- | --- | --- |
| 2026-09-12 | Pre-M0 | — | PRD read. LedgerLens inspected directly (`master` @ `bd9b41c`, clean tree): 543 lines of application source, no wallet, chain, hashing, schema or bundle code of any kind. `docs/REUSE.md` seeded from verified inspection rather than from the PRD's candidate list. The milestones and gates above are binding on the implementer. |
| 2026-09-12 | M0 | **Fixes requested** | Reviewed the actual commits (`fb9de99`..`6acdac9`), not the implementer summary. Substantive work verified independently and confirmed solid: `ledgerlens/` untouched (`HEAD bd9b41c`, clean); first commit genuinely precedes implementation; REUSE.md's corrected line counts recounted and match exactly (`lib/` 343, `app/` ts/tsx 60, `components/` 38, `tests/` 162, `scripts/` 18); the Blockscout fixture is real — recomputing the 30-day window from raw `page-1.json`/`page-2.json` timestamps independently reproduces the reported 28-transaction count, and 100% of items have `from.hash` equal to the subject address; `typescript@^7.0.2` verified against the npm registry as genuinely `latest`, not a hallucinated version. **Defect blocking acceptance:** `docs/verification/M0.md` and `fixtures/README.md` are corrupted — UTF-8 BOM plus 17 lines of literal control bytes (backspace/bell/form-feed/null) and multiple strings missing their leading character (`0xc82f8B79...` renders as `` xc82f8B79...``, `app/api/interpret/route.ts` as `pp/api/interpret/route.ts`, code fences broken). Pattern matches PowerShell backtick-escape interpretation during file write. This fails acceptance criterion 6 (the doc must let the reviewer reproduce the requests) and is flagged as a process risk for every later milestone, since template-literal backticks are everywhere in the TypeScript still to be written. Fix requested: regenerate both files through a write path that does not pass markdown/code content through PowerShell string interpolation, with no BOM and no control bytes, then have Antigravity confirm clean via the same check the reviewer used (`grep -cP '[\x00\x07\x08\x0b\x0c]'`). M0 otherwise ready to accept once this is fixed. |
| 2026-09-12 | M0 re-review | **Fixes requested (round 2)** | Independently re-verified the round-1 fix: `docs/verification/M0.md` and `fixtures/README.md` are genuinely clean (no BOM, 0 control-byte lines, every `0x...` address and code fence intact) — confirmed by byte inspection, not by trusting the implementer's report. However the original audit request was scoped too narrowly. A repo-wide BOM scan found the identical defect still present in files the fix commit did not touch: `fixtures/real/metadata.json`, `package.json`, and `tsconfig.json` all carry the BOM, and — this is the material part — `JSON.parse(fs.readFileSync('fixtures/real/metadata.json','utf8'))` **throws** right now (`Unexpected token '﻿'`). That is precisely how M1's fixture-loading code is expected to read this file, so this is a live blocker, not a hygiene note. `.env.example` and `.gitignore` also carry the BOM (lower severity, same root cause). Fix requested: clean every file the M0 work touched, not just the two named in round 1, and prove it functionally — `node -e` a real `JSON.parse` of all three JSON files, and an actual `npm install` / `npm test` run — not just a byte-level BOM/control-char check. |
| 2026-09-12 | M0 | **ACCEPTED** | Round-2 fix independently re-verified, not taken on the implementer's report: a full scan of all 13 git-tracked files for BOM and control bytes came back clean; `JSON.parse` on all five JSON files (`metadata.json`, `page-1.json`, `page-2.json`, `package.json`, `tsconfig.json`) succeeded when run by the reviewer directly; `git log` matches the reported history (`fb9de99`..`276144c`); working tree clean; `ledgerlens/` still untouched (`HEAD bd9b41c`, clean status); `npm test` rerun by the reviewer, 0 tests / 0 failures, correct for a milestone that wrote no code. Root cause (PowerShell `Set-Content -Encoding utf8` / double-quoted here-strings interpreting backticks) identified and a going-forward write policy stated. All seven M0 acceptance criteria in the milestone table now hold with reviewer-verified evidence, not implementer summary. **D6 is final: Blockscout REST v2, Ethereum Mainnet (chain ID 1), `filter=from`, subject `0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8`, frozen end block `25962430`.** Cleared to send the M1 prompt. |
