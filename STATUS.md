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
| D6 | Data-source selection is deferred to the M0 feasibility gate and frozen there. Envio is time-boxed, not assumed. | PRD §6 forbids assuming indexed history from a generic endpoint. | Open until M0 |
| D7 | AI explanation (P0b) is gated behind a fully verified P0 flow. Monad/P1 is gated behind PRD §13. | PRD §4, §13. | Fixed |
| D8 | No numerical confidence scores. Coverage status, evidence counts, and stated limitations only. | PRD §7. | Fixed |

### Environment facts (verified 2026-09-12)

- Node **v24.19.0**, npm **11.17.0**, both resolvable in Git Bash. In PowerShell the
  `npm.ps1` shim is blocked by execution policy — use `& "C:\Program Files\nodejs\npm.cmd"`.
- **No blockchain data-provider credential exists on this machine.** `ledgerlens/.env.local`
  holds only `AI_PROVIDER`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, two `NEXT_PUBLIC_SUPABASE_*`
  values, and three `PRISMTRACE_*` values. There is no Envio, Alchemy, or Etherscan key.
  M0 must therefore favour a source that needs no credential, or obtain one inside the hour.
- `GROQ_API_KEY` and `ANTHROPIC_API_KEY` are both populated, so P0b has a working model path
  if it is reached. Signal Passport must use its own `.env.local`; do not read LedgerLens's.

---

## Milestones

Acceptance criteria are binding. The evidence column states what the reviewer must be shown.

| M | Scope | Acceptance criteria | Required evidence | State |
| --- | --- | --- | --- | --- |
| **M0** | First-hour feasibility gate: confirm reuse inventory, establish repo, retrieve one real bounded wallet dataset, freeze the source. | Repo initialized with an initial commit recording pre-implementation state; `docs/REUSE.md` confirmed or corrected against the real files; one provider and chain chosen with the endpoint's *actual* history and pagination capability demonstrated; real response saved as a fixture with full retrieval metadata; source frozen in `STATUS.md`. | The exact request issued; the raw saved response; the metadata record; transaction hashes, timestamps and direction fields identified in the real payload; pagination behaviour observed, not assumed. | Not started |
| **M1** | Evidence foundation: address validation, adapter to normalized evidence, three deterministic metrics, dedup, UTC bucketing, coverage status. | Metrics match hand-checked expected values on a small fixture; duplicate `(chainId, txHash)` records do not inflate counts; UTC calendar-date boundaries correct at both edges; a provider error surfaces as an error and never as zero activity; coverage is one of `complete_for_query` / `partial` / `unknown` with truncation and pagination recorded. | Passing test run output; the hand-checked expected values and how they were derived; a test proving error is not zero. | Not started |
| **M2** | Passport bundle and integrity: shared schema, canonical serialization, SHA-256 payload digest. | Bundle carries `schema_version`, `payload`, `integrity`; canonical JSON sorts object keys recursively, defines stable array ordering, encodes large chain integers as decimal strings, and rejects non-finite or ambiguous numbers; the digest covers `payload` only and excludes its own digest and transport fields; identical payload gives identical bytes and digest **in a separate process**; payload-only tampering fails the check. | Test output including the cross-process digest match, the tamper-mismatch case, and rejection of non-finite values. | Not started |
| **M3** | Both interfaces: App One (input, analysis, Passport, evidence drill-down, export) and App Two (independent import, validation, display). | App Two is a separate runnable application, not a second route; it imports and displays a bundle **while App One is stopped**, with no provider key, no network fetch and no AI; every claim's evidence IDs resolve within the bundle; unsupported schema versions and malformed or missing evidence references are rejected with usable messages; integrity and publication status are shown separately; integrity is labelled "Bundle integrity matched" with its explanation, never "verified reputation." | Screenshots or a terminal transcript of App Two running with App One stopped; the exported bundle file; a reload-after-download check showing no field loss and an unchanged digest. | Not started |
| **M4** | Reliability and edge states. | Zero qualifying activity yields a valid empty Passport stating the exact query scope; invalid address, unavailable provider and partial coverage each have distinct states; partial coverage is visible in App One, App Two and the export; README setup works from a clean clone with documented sample data. | Each state exercised and shown; a clean-clone README walkthrough. | Not started |
| **M5** | P0b AI explanation. **Gate: M0–M4 all accepted.** | The model receives only immutable claims and evidence IDs; output is validated for evidence references and quantitative claims before display; invalid output is discarded and replaced by a deterministic summary; a model failure cannot block Passport generation or export; the explanation is excluded from the canonical payload. | A test proving invented numbers and invented evidence IDs are both rejected; a demonstrated fallback path. | Blocked by gate |
| **M6** | Submission package: README, reuse disclosure, demo video, social copy. | Reserve the final two hours. Never trade away evidence visibility, coverage labels or App Two. | — | Not started |
| **P1** | Monad testnet registry. **Gate: P0 accepted AND at least 4 discretionary hours before the submission buffer.** Stop after 45 minutes if infrastructure blocks. | Per PRD §13. A localhost-only reference must not be presented as publicly retrievable. | Blocked by gate |

---

## Working

_(Nothing yet. Entries appear here only after reviewer acceptance, each with its evidence.)_

## In Progress

- **M0** — first prompt issued to Antigravity 2026-09-12. Awaiting deliverables and evidence.

## Not Started

- M1 through M6. P0b and P1 remain gated.

## Known Issues

- No blockchain provider credential on this machine (see Environment facts). This is the
  principal M0 risk and the reason the source choice is deferred to the gate.
- The PRD §6 fallback is available if no live history source works: an import adapter for a
  real exported public-wallet dataset, labelled "imported historical snapshot," with the
  live-adapter shortfall disclosed. Synthetic data is for tests only and must be labelled.

## Review log

| Date | Milestone | Reviewer verdict | Notes |
| --- | --- | --- | --- |
| 2026-09-12 | Pre-M0 | — | PRD read. LedgerLens inspected directly (`master` @ `bd9b41c`, clean tree): 543 lines of application source, no wallet, chain, hashing, schema or bundle code of any kind. `docs/REUSE.md` seeded from verified inspection rather than from the PRD's candidate list. The milestones and gates above are binding on the implementer. |
