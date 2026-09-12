# Antigravity prompt — M3: Both interfaces

Issued 2026-09-12 by the technical lead, after M2 acceptance. Governing scope:
`Signal-Passport-Weekend-PRD.md`.

---

M2 is accepted. `packages/schema`, `packages/analysis`, and `packages/verification` are correct
and tested. Do not modify their logic in this milestone — import and use them.

This is the largest milestone so far and the one the whole demo hinges on: PRD §15's suggested
demo sequence is "analyze a real wallet → open evidence → export → **switch to the independent
consumer and import it** → show matching metrics and integrity." If App Two isn't genuinely
independent, there is no demo. Read PRD §9 in full before starting.

## The one non-negotiable structural rule

**App Two must be a separate runnable application/process, not a second route in App One.**
PRD §9 says this explicitly: "A second route in the same app is not sufficient for this
acceptance test." Concretely: two directories under `apps/` (`apps/passport`, `apps/consumer`),
each with its own `package.json`, its own dev script, its own port. `apps/consumer` must have
**zero dependency on `packages/analysis`** and must never import `@signal-passport/analysis` or
call Blockscout — check your own `package.json`/imports for this before reporting. It may depend
on `packages/schema` and `packages/verification` only (schema validation + digest checking).
This is checkable mechanically: `grep -r "packages/analysis\|@signal-passport/analysis" apps/consumer`
should return nothing, and neither should any Blockscout URL.

## Task 1 — `apps/passport`: entry and fetch/analyze pipeline

Build the input screen and wire it to M1/M2's pipeline:

- Wallet address input with validation (use M1's `validateEthereumAddress`), a labeled example
  wallet (use the frozen M0 subject `0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8` — real, already
  proven to work), and the fixed 30-day observation window (this is P0's declared default scope
  per PRD §7 — do not build a window picker, that's not in scope).
- Real loading states: fetching, normalizing, calculating — each a distinct visible state, not
  one spinner. Use M1's `fetchBlockscoutHistory`/`normalizeAndDeduplicateBlockscoutItems`.
- Server-side fetch (Next.js API route, matching LedgerLens's pattern from `docs/REUSE.md`'s
  reusable error-taxonomy note — 503/429/502 style distinct error responses), not a client-side
  fetch straight to Blockscout. Bound the request (the address + a fixed recent window; no
  open-ended user-controlled ranges).
- On success, run M2's `createPassportBundle` to produce the actual bundle in memory.

Do not build address-checksum edge cases, zero-activity handling, or provider-outage handling
here — those are M4. Build the real happy path against the real Blockscout endpoint (not the
fixture) plus basic invalid-address rejection (using M1's validator, which already exists and
is tested).

## Task 2 — `apps/passport`: Passport screen and evidence drill-down

- Show the three metric values with their exact required wording (`METRIC_LABELS` from M1's
  `metrics.ts` — do not re-type these strings, import the constant), the declared scope, the
  coverage status, the generation timestamp.
- Evidence drill-down: selecting a metric shows the transactions that back it (via the claim's
  `evidenceIds` → `EvidenceRecord`s) with a working link to each transaction's `sourceReference`
  (a real Blockscout URL — click one during your own verification and confirm it resolves).
- No AI explanation UI — that's M5, explicitly gated.

## Task 3 — `apps/passport`: export

- A working download of the complete bundle as JSON (`schema_version`/`payload`/`integrity`,
  the exact structure from M2).
- After building this, do the same reload-after-download check PRD §14 requires: download the
  file, reload/reopen it, confirm every field is present and `verifyBundleIntegrity` (from M2)
  still reports a match. Show this in your report, not just assert it.

## Task 4 — `apps/consumer`: independent import and validation

Build this as a genuinely separate app per the structural rule above.

- Import a Passport JSON file (file picker or drag-drop; keep it simple).
- Validate, in order, and produce a distinct visible result for each: (a) schema validity via
  M2's `passportBundleSchema` — reject unsupported `schema_version` values with a usable
  message; (b) subject address format; (c) every claim's `evidenceIds` resolves to a real
  evidence record in the same bundle — reject if any is missing/dangling; (d) integrity, via
  M2's `verifyBundleIntegrity`.
- Display: wallet, metrics, source window, coverage — read from the bundle only, never
  recomputed.
- **Integrity and publication status shown separately**, as two distinct pieces of UI, not
  merged into one "verified" badge. Publication will be absent in P0 (M2's schema types it
  optional) — show it as "not published" or equivalent, not hidden entirely.
- Integrity result labelled **exactly** "Bundle integrity matched" (or the clear negative
  equivalent) with a one-line explanation of what that does and does not mean, per PRD §8 —
  never "verified reputation" or similar. Pull this wording close to M2's `digest.ts` docstring
  language; don't invent softer or stronger language than the PRD's.
- A payload-only-tampered bundle (payload changed, `integrity.digest` left stale) must show a
  clear mismatch, not a silent pass and not a crash.

## Task 5 — the cross-app proof (this is the actual acceptance test, not a formality)

1. Start `apps/passport`, generate a real Passport against the live Blockscout endpoint (not a
   fixture), export it.
2. **Stop `apps/passport` entirely** (kill the process/port).
3. Start `apps/consumer` (confirm it starts with no dependency on whatever was running for App
   One — different terminal, App One's process actually dead, verified by e.g. the port being
   free).
4. Import the exported file into the running `apps/consumer`. Confirm it displays correctly
   with App One not running.
5. Take a screenshot or terminal transcript proving App One's process is stopped (e.g. `curl`
   against its port failing, or the process list) at the same time App Two is shown working.
   "I did this" is not evidence; the transcript is.
6. Tamper test: take the exported file, hand-edit one payload field (e.g. change a metric
   value) without touching `integrity.digest`, re-import into App Two, confirm the mismatch is
   shown clearly.
7. Malformed-bundle test: import a file missing a required field or with a bogus
   `schema_version`, confirm App Two rejects it with a usable message instead of crashing.

## Acceptance criteria for M3

Checked against actual running apps and their code, not your summary:

1. `apps/consumer` has zero code-level dependency on `packages/analysis` — checked by grep, not
   assertion.
2. App Two runs and correctly displays a real bundle while App One's process is verifiably
   stopped — screenshot/transcript proving the process is down, not just a claim.
3. No provider key, network fetch to Blockscout, or AI call happens anywhere in App Two's code
   path for displaying an imported bundle.
4. Every claim's evidence IDs are checked to resolve within the imported bundle; a bundle with a
   dangling reference is rejected with a usable message.
5. Integrity and publication are shown as two separate pieces of UI, never merged.
6. The integrity label matches PRD §8's required wording and caveat, not a paraphrase that
   overclaims.
7. Payload-only tampering produces a visible, clear mismatch in App Two.
8. A malformed/unsupported-schema bundle is rejected with a usable message, not a crash.
9. Export → reload → re-verify shows no field loss and an unchanged digest.
10. `npm test` still passes for the existing suite (39 tests from M0–M2), plus whatever new
    tests you add for this milestone's logic (schema/integrity checks in App Two, if you factor
    them into testable functions rather than only UI).
11. Nothing out of scope was built (no AI explanation, no Monad, no database).
12. `ledgerlens/` is still unmodified.
13. No BOM, control-byte, or `?`-substitution corruption in any file you write — check this
    yourself before reporting, using the same scans as M1/M2.

## How to report back

Same structure as before, with Task 5's cross-app proof given its own clearly separated section
with the actual transcript/screenshots, not folded into general narrative. Each acceptance
criterion with pass/fail and its evidence line. Real test output. Commit list. Elapsed time.
Anything incomplete — if you run out of time, a working App One with export and a stub App Two
that at least validates+displays is more valuable to report honestly than a claim that
everything works when the cross-app proof wasn't actually run.
