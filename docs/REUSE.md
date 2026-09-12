# Reuse Disclosure

Governing scope: `../Signal-Passport-Weekend-PRD.md` (Weekend Build PRD v1.0).
Reference repository: `../ledgerlens` (read-only; preserved, never modified).

This file is the hackathon originality disclosure. It is maintained as a record of
**verified** reuse, not intended reuse. Every row was checked against the actual
LedgerLens source, not against the PRD's candidate list or the pitch deck.

## Baseline: what LedgerLens actually contains

Verified by direct inspection on 2026-09-12, before any Signal Passport implementation.
LedgerLens `master` @ `bd9b41c`, clean working tree.

Total application source: **543 lines** across `lib/` (9 files, 403 L), `tests/` (5 files,
162 L — counted separately), `app/` (5 files, 60 L), `components/` (1 file, 38 L).
Stack: Next.js 15.5.2, React 19.1.1, zod 4, `ai` 7 + `@ai-sdk/anthropic` + `@ai-sdk/groq`,
TypeScript 5.9, tests via `node:test` run by `tsx --test`.

### Subsystems the PRD requires that DO NOT exist in LedgerLens

A repo-wide search for `wallet|ethereum|chain|sha-?256|createHash|canonical|passport|envio|alchemy|etherscan|viem|ethers`
across all `.ts`/`.tsx` returned **zero matches**. The following are therefore 100% new work:

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

## Originality summary (to be kept accurate as work lands)

Candidate reuse totals roughly 150 lines of AI-plumbing and test/status conventions out of
LedgerLens's 543-line application, and none of it touches a P0 requirement. Every P0
subsystem — source adapter, evidence normalization, the three metrics, coverage rules,
canonical serialization, digest integrity, the Passport bundle, App One, App Two, and
consumer verification — is new implementation.

Do not state a percentage of new code. Eligibility is the hosts' decision.

## Log of reuse decisions as implemented

| Date | Target file in Signal Passport | Origin | Nature | New work | Reviewed |
| --- | --- | --- | --- | --- | --- |
| _(append one row per copied or adapted component; reviewer signs the last column)_ | | | | | |
