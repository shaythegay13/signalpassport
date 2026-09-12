# Antigravity prompt — M4: Reliability and edge states

Issued 2026-09-12 by the technical lead, after M3 acceptance. Governing scope:
`Signal-Passport-Weekend-PRD.md`.

---

M3 is accepted — both apps are real, independently runnable, and the cross-app integrity proof
was reproduced by the reviewer directly against the live running server. Do not modify the
core pipeline, canonical serialization, or digest logic in this milestone except where Task 0
requires it.

## Task 0 — required before anything else: fix the zero-evidence throw

The reviewer ran this directly against your own code and it throws:

```
computeDeterministicMetrics([], scope)
→ throws: evidenceIds must be non-empty (path: evidenceIds)
```

This is the exact gap flagged after M1 and structurally accommodated (but not actually fixed)
in M2: `PassportPayload.claims` was made `z.array(claimSchema)` with no array-level `.min(1)`
specifically so a Passport with **zero claims** is valid — but `computeDeterministicMetrics`
still unconditionally builds all three claims and calls `claimSchema.parse()` on each, which
throws the moment `evidenceIds` is empty. Every qualifying-zero-activity request through the
real pipeline crashes today.

Fix, matching the design intent already recorded in `STATUS.md`'s M1 review: when there is zero
qualifying evidence for a given metric, **do not produce a claim for it** — return an empty
`claims` array rather than three claims with empty `evidenceIds`. This is a metric-by-metric
decision, not all-or-nothing: it is possible (if unlikely with real data) for one metric to have
evidence while another doesn't in some future scope change, so implement it per-metric, not as
a single `if (evidence.length === 0) return { claims: [] }` shortcut — though for this weekend's
three metrics, which all currently derive from the same evidence set, that shortcut happens to
be correct too; use whichever is clearer in the code, but document which you chose and why.

Write a test: `computeDeterministicMetrics([], scope)` does not throw, returns `claims: []`, and
`metrics.observedTransactionCount === 0` / `activeDays === 0` / `uniqueRecipients === 0`. Then
confirm the full pipeline — adapter → normalize → metrics → bundle — produces a valid,
schema-passing bundle end to end for a wallet/window with zero qualifying transactions, not just
that the metrics function alone doesn't throw.

Commit this fix on its own before starting Task 1.

## Context you must load first

- `Signal-Passport-Weekend-PRD.md` §9 (User experience) and §14 (Acceptance and meaningful
  verification) govern this milestone.
- `STATUS.md` — read the M1 review log entry recording this exact gap, and the M3 entry for
  what's already proven to work.
- `ledgerlens/` remains **read-only**.

## This milestone is M4 only

Scope: the four edge states PRD §14 requires, plus a working README for a clean clone.
**Out of scope:** AI explanation (M5), Monad (P1), new metrics, new UI screens beyond what's
needed to show these states clearly within the existing Passport/Consumer screens.

## Task 1 — zero qualifying activity, end to end

Using Task 0's fix, produce and verify a real zero-activity Passport. You don't need a real
wallet with zero activity in the window if one isn't convenient — a synthetic evidence set of
`[]` fed through the real bundle-building code is acceptable here, since the point is proving
the *pipeline* doesn't crash and the *UI* renders it sensibly, not re-proving live data access.

- App One: entering an address that returns zero qualifying transactions in the window produces
  a valid Passport screen stating the exact query scope (address, window, chain) and the three
  metrics as zero — not an error screen, not a blank screen.
- Export it, import into App Two: displays correctly, integrity still matches.
- This is explicitly distinct from an error state — do not conflate "zero activity" with
  "invalid address" or "provider unavailable." A judge reading PRD §14 will check this
  distinction specifically.

## Task 2 — invalid address

- App One: an invalid address (use M1's `validateEthereumAddress` — malformed shape or bad
  checksum) is rejected **before any network request**, with a clear, specific message (reuse
  the actual error string from `validateEthereumAddress`, don't write a generic "invalid input").
- This state must be visibly different from both Task 1's zero-activity state and Task 3's
  provider-unavailable state.

## Task 3 — provider unavailable

- App One: simulate Blockscout being unreachable or erroring (you can do this by pointing at an
  invalid `BLOCKSCOUT_API_BASE_URL` for a test run, or by mocking the fetch in a way you can
  demonstrate) and confirm the UI shows a distinct "provider unavailable" state — not a generic
  crash, not a blank Passport, and critically: **not zero activity**. PRD §14 is explicit that a
  failed query is an error, not zero activity — the same rule M1's adapter tests already proved
  at the function level; this task proves the UI actually surfaces that distinction to a person,
  not just that the underlying function throws correctly.

## Task 4 — partial coverage, visible in both apps and the export

- Construct a scenario where coverage is `partial` (e.g., cap `maxPages` low enough that a real
  or realistic pagination run hits the limit before reaching the end of the window — M1's
  `fetchBlockscoutHistory` already supports `maxPages`).
- Confirm `partial` coverage is visibly shown, not silently treated as `complete_for_query`, in:
  App One's Passport screen, the exported bundle's `payload.coverage`, and App Two's display of
  an imported bundle with `partial` coverage.

## Task 5 — README for a clean clone

Write (or finish) `signal-passport/README.md` covering: prerequisites (Node version), install
steps for the root and both apps, how to run each app (ports), where the sample/fixture data
lives and how to use it without hitting live Blockscout if someone wants a fast demo, how to run
`npm test`, and a short "try the full flow" walkthrough (generate → export → stop App One →
import in App Two).

Then actually verify it: clone the repository to a fresh directory (`git clone` the local repo
to a sibling temp path, not just reuse your working copy) and follow your own README literally,
noting any step that didn't work as written. Fix the README or the setup until it works from
that clean clone. This is not optional — PRD §14 requires "README setup works from the submitted
repository," and the only way to know that is true is to have actually done it once, not to have
written steps that seem right.

## Acceptance criteria for M4

Checked against actual running apps, actual code, and an actual clean-clone attempt:

1. `computeDeterministicMetrics([], scope)` does not throw; a test proves it.
2. Zero-activity Passport works end to end (App One → export → App Two) and is visibly distinct
   from both other error states.
3. Invalid address is rejected before any network call, with a specific message, visibly
   distinct from the other two states.
4. Provider-unavailable is a distinct visible state in App One, never rendered as zero activity.
5. Partial coverage is visible in App One, the export, and App Two — not silently upgraded to
   `complete_for_query` anywhere in that chain.
6. README literally followed from a fresh clone by the implementer, with any discrepancy fixed,
   not just written and assumed correct.
7. `npm test` passes, real output pasted, including the new Task 0/1 tests.
8. Nothing out of scope was built.
9. `ledgerlens/` still unmodified.
10. No BOM, control-byte, or `?`-substitution corruption in any file you write.

## How to report back

Same structure as before. For the README check specifically: show the actual commands you ran
against the fresh clone and what happened, not just "README verified." For each of the four
states, show what triggered it and what was displayed — a screenshot or the rendered
text/JSON, not just "state X works."
