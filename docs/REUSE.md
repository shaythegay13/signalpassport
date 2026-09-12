# Reuse Disclosure

Governing scope: `../Signal-Passport-Weekend-PRD.md` (Weekend Build PRD v1.0).
Reference repository: `../ledgerlens` (read-only; preserved, never modified).

This file is the hackathon originality disclosure. It is maintained as a record of
**verified** reuse, not intended reuse. Every row was checked against the actual
LedgerLens source, not against the PRD's candidate list or the pitch deck.

## Baseline: what LedgerLens actually contains

Verified by direct inspection on 2026-09-12, before any Signal Passport implementation.
LedgerLens `master` @ `bd9b41c`, clean working tree.

Total application source: **441 lines** (excluding tests) across `lib/` (9 files, 343 L),
`app/` (4 ts/tsx files, 60 L — 61 L with `globals.css`), `components/` (1 file, 38 L).
(Note: the initial draft recorded 403 L for `lib/` and 543 L total; direct file-by-file count
reveals `lib/` is 343 lines, with the previous 403 resulting from double-counting `app/`'s 60 lines).
`tests/` contains 5 files, 162 L. `scripts/` contains 1 file, 18 L (`scripts/verify-uploadable-demo.ts`).
Total codebase source including tests and scripts is 621 lines.
Stack: Next.js 15.5.2, React 19.1.1, zod 4, `ai` 7 + `@ai-sdk/anthropic` + `@ai-sdk/groq`,
TypeScript 5.9, tests via `node:test` run by `tsx --test`.

### Subsystems the PRD requires that DO NOT exist in LedgerLens

Verified by direct repository searches:
1. `git -C "../ledgerlens" grep -inE "wallet|ethereum|chain|sha-?256|createHash|canonical|passport|envio|alchemy|etherscan|viem|ethers|indexer|rpc" -- "*.ts" "*.tsx"`
   -> **Zero matches** (exit code 1). (Repo-wide across docs returned only mentions of LangChain in `AGENTS.md` and "The canonical demo" in `README.md`).
2. `git -C "../ledgerlens" grep -inE "bundle|digest|crypto" -- "*.ts" "*.tsx"`
   -> Only `crypto.randomUUID()` in `app/api/interpret/route.ts` and `components/LedgerLens.tsx` for ephemeral session IDs.
3. Evidence-ID inspection in `lib/ai-analysis.ts`: IDs are created as ad-hoc template literals (`` `change-${index + 1}` ``, `` `transaction-${transaction.transactionId}` ``) with no standalone module or namespace utility.

**Claim CONFIRMED:** LedgerLens contains no wallet, chain, RPC, indexer, SHA-256, hashing, canonical-JSON, shared-schema, or bundle export/import code, and has no reusable evidence-ID utility.

The following are therefore 100% new work:

- Wallet-address validation, chain selection, any RPC/indexer/provider adapter.
- Normalized onchain evidence records; stable chain-scoped evidence identifiers.
- Any reusable evidence-ID utility. LedgerLens builds IDs as inline template literals
  (`` `transaction-${transaction.transactionId}` ``, `` `change-${index + 1}` ``) at the two
  call sites in `lib/ai-analysis.ts`. There is no ID or namespace module to reuse.
- Canonical JSON serialization, recursive key sorting, stable array ordering.
- SHA-256 digests, integrity checking, tamper detection — no hashing of any kind exists.
- A shared schema package. zod is used only inside `lib/ai-analysis.ts` for model output.
- Bundle export or import of any kind.
- A second/consumer application, or any multi-app layout. `tsconfig.json` is a
  single-app Next.js config.
- The three PRD metrics (observed transactions, active days, unique recipients),
  UTC date bucketing, deduplication, coverage status, pagination/truncation tracking.

### Subsystems that DO exist and are candidates

| LedgerLens artifact | What is actually there | Verdict |
| --- | --- | --- |
| `lib/ai-provider.ts` (54 L) | Provider registry keyed by id; `getProviderConfig` returns selection without requiring a credential; `requireAnalysisModel` throws an actionable error naming the missing variable; unknown `AI_PROVIDER` throws rather than guessing; no silent fallback. | **Copy, adapted.** Structurally reusable near-verbatim. Disclose as an adapted copy; new work is limited to naming and provider list. Only needed at P0b. |
| `lib/ai-analysis.ts` → `validateAiAnalysis` (part of 66 L) | Validation pipeline shape: zod `.parse` → reference-set membership check against the immutable input → regex ban on digits/currency/percent in any text field → regex ban on causal phrasing. | **Adapt the pattern; rewrite the content.** The pipeline order is the valuable reuse. Passport-specific schema fields, allowed-claim rules, evidence-ID universe, and banned lexicon are new. |
| `lib/ai-report.ts` (36 L) | `generateText` + `Output.object`, single repair attempt that feeds the specific rejection reason back to the model, token-usage accumulation across attempts, loud failure after two rejections. | **Adapt.** Reusable control flow; new prompt, new input type, and a deterministic fallback (PRD §10 requires the fallback; LedgerLens has none — it throws). |
| `lib/csv.ts` → `rows()` (18 L of 38) | Dependency-free CSV tokenizer handling quoted fields, escaped `""`, and CRLF. | **Copy `rows()` only, conditionally.** Relevant only if the §6 snapshot fallback ingests a block-explorer CSV export. `parseSummary`/`parseTransactions` are business-finance specific — do not port. |
| `app/api/interpret/route.ts` (31 L) | Error taxonomy: unconfigured provider → 503 with the actionable message; upstream 429 → 429; validation failure → 502; credentials never echoed. | **Reuse the pattern.** Maps directly onto PRD §9's requirement for distinct states. |
| `tests/ai-provider.test.ts` `withEnv` helper (6 L) | Save/restore `process.env` around a test body. | **Copy.** |
| Testing convention | `node:test` + `node:assert/strict`; fixture-reconciliation tests that assert hand-checked expected totals (`tests/demo-data.test.ts`). | **Reuse convention.** Matches PRD §14's "metrics match manually checked expected values." |
| `docs/STATUS.md` convention | Sections `Working` / `In Progress` / `Not Started` / `Known Issues`, each claim carrying its verification evidence inline. | **Reuse convention.** Adopted by `../STATUS.md`. |
| `scripts/verify-uploadable-demo.ts` (18 L) | Offline smoke-test runner invoking provider + prompt + validation offline via `--env-file=.env.local` without launching the UI. | **Reuse pattern.** Useful template for non-interactive smoke testing of pipelines and providers. |
| Stack selection | Next.js + React + TypeScript + zod + `node:test`. | **Reuse the choice**, install at currently supported versions per PRD §11 rather than copying version numbers. |

### Explicitly NOT ported (PRD §5 prohibitions, confirmed present in LedgerLens)

- `lib/analysis.ts` (43 L) — period-A/B category variance, counterparty drivers, contribution
  percentages, currency formatting, `answerQuestion`. Financial variance logic. Not ported.
- `lib/types.ts` (29 L) — `Transaction`/`Variance`/`Insight`/`Driver`/`MemoryFact`.
  Business-specific transaction schema. Not ported.
- `lib/memory.ts`, `lib/business-memory.ts` (41 L) — user-editable Business Memory and its
  Supabase persistence. Explicitly forbidden as reputation input. Not ported.
- AWS/vendor reclassification demo behavior. Not ported.
- `lib/prism.ts` (36 L) — PRISM trace emission. Out of weekend scope; deferred, not ported.
- `components/LedgerLens.tsx` (38 L) — the evidence drawer concept informs App One's
  drill-down, but the code is dense single-file JSX bound to variance/driver types.
  **Concept reuse only; no code copied.** Do not claim code reuse here.
- `docs/prd.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `supabase/schema.sql`,
  `public/demo-data/*` — LedgerLens business content. Not ported.

## Originality summary (final verified state)

Following completion of all milestones (M0–M5), the Signal Passport codebase comprises
**4,881 lines of TypeScript/TSX** (1,510 lines in `packages/`, 1,475 lines in `apps/`, and
1,896 lines in `tests/`).

Actual reuse from LedgerLens is restricted strictly to approximately **90 lines of AI plumbing
and configuration patterns** in optional P0b stretch scope:
- `packages/analysis/src/ai/provider.ts`: Provider registry configuration pattern adapted from
  `ledgerlens/lib/ai-provider.ts` (~50 lines).
- `packages/analysis/src/ai/validation.ts`: Sequential validation pipeline control flow adapted
  from `ledgerlens/lib/ai-analysis.ts` (~40 lines).

Zero lines of P0 functionality were reused. Every core P0 subsystem — public wallet address
validation, Blockscout REST v2 adapter, normalized onchain evidence records, UTC day bucketing,
deterministic metrics, coverage evaluation, canonical JSON serialization, SHA-256 payload digest
integrity, bundle envelope schema, App One generator, and independent App Two consumer — was
designed, implemented, and verified from scratch this weekend.

Do not state a percentage of new code. Eligibility is the hosts' decision.

## Log of reuse decisions as implemented

| Date | Target file in Signal Passport | Origin | Nature | New work | Reviewed |
| --- | --- | --- | --- | --- | --- |
| 2026-09-12 | `STATUS.md` | `ledgerlens/STATUS.md` | Convention reuse | Section structure (`Working`, `In Progress`, `Not Started`, `Known Issues`, `Review log`) adopted for tracking. | Verified M0 |
| 2026-09-12 | `packages/analysis/src/ai/provider.ts` | `ledgerlens/lib/ai-provider.ts` (54 L) | Adapted pattern | Provider registry structure (`getProviderConfig`, `requireAnalysisModel`) adapted for Groq and Anthropic using native fetch without SDK dependencies. | Verified M5 |
| 2026-09-12 | `packages/analysis/src/ai/validation.ts` | `ledgerlens/lib/ai-analysis.ts` (part of 66 L) | Adapted pipeline shape | 5-stage sequential validation pipeline shape (zod parse → reference check → number check → coverage check → banned phrases). All schemas, checks, regexes, and domain rules newly authored. | Verified M5 |
| 2026-09-12 | `tests/` | `ledgerlens/tests/` | Convention reuse | Node test runner (`node:test` + `node:assert/strict`) and hand-checked fixture reconciliation pattern used across 63 tests. | Verified M1–M5 |
