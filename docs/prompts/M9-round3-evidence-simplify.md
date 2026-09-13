# Antigravity prompt — M9 round 3: drop per-metric evidence filtering (small, targeted)

Issued 2026-09-12 by the technical lead, after the owner clicked the metric cards and found
nothing visibly happened. Governing scope: `Signal-Passport-Weekend-PRD.md`.

---

This is a small, scoped fix, not another full restyle. Diagnosis, already confirmed: in
`apps/passport/app/page.tsx`, the three metric cards are clickable and set
`selectedMetricType`, which filters the evidence table below to that metric's `evidenceIds`.
The problem is structural, not a bug: `observed_transaction_count` and `active_days` are
*always* built from the exact same evidence array in `packages/analysis/src/metrics.ts` (both
are literally `evidence.map(e => e.evidenceId)`), and `unique_recipients` only differs from
them when a transaction has a null recipient (a contract-creation transaction) — which doesn't
happen for the real fixture wallet. So clicking between cards changes React state correctly,
but the visible evidence table never changes. The interaction currently promises a distinction
that mostly isn't real.

**Fix (owner's decision): remove the per-card filtering. Show one always-visible evidence
table**, since the three metrics share the same underlying evidence in the overwhelming
majority of real cases anyway.

## What to change in `apps/passport/app/page.tsx`

- Remove `selectedMetricType` state, the `onClick`/`isSelected` logic on the metric cards
  (lines around 22, 209, 217-223, 506 in the current file — re-locate exactly, don't assume
  line numbers are still accurate after your own edits), and the per-metric filtering of
  `selectedEvidenceRecords`.
- The metric cards become plain, non-clickable display cards (still show value + the M8
  arithmetic context line — none of that changes).
- Replace the evidence section's dynamic heading ("Supporting Evidence: {METRIC_LABELS[...]}")
  with a single static heading, something like **"Supporting Evidence"**, with a one-line
  sub-caption stating plainly that the same qualifying transactions back all three metrics
  above — e.g. "All three metrics above are computed from the same {evidence.length} qualifying
  transactions shown below." Use the real count, not a hardcoded number.
- The evidence table itself keeps its existing bounded/expandable behavior (8-row default,
  "show all N" toggle) — that part already works correctly and doesn't need to change, just now
  it always shows the full evidence set (`bundle.payload.evidence`) rather than a
  claim-filtered subset.
- If, for some future dataset, the three claims' evidence genuinely diverge (a real
  contract-creation transaction with a null recipient), this simplified table still shows every
  qualifying transaction correctly — that's fine and expected; you're removing the false
  promise of per-metric separation, not the underlying data.

## Apply the same check to `apps/consumer`

Confirm whether `apps/consumer/app/page.tsx` has the same per-metric filtering pattern. If it
does, apply the identical fix there for consistency. If its metric cards were already
non-interactive display-only (no click/selection state), leave it as is and say so in your
report.

## What NOT to change

- No change to `packages/`, schemas, digest logic, or API contracts — this is presentation only.
- No change to the M7/M8 wording already established, except the one heading/sub-caption
  described above.
- No change to the M9 round 2 hero/grid/card-header structural layout — this fix lives inside
  the existing `result-main` evidence section, it doesn't restructure the page again.

## Verify

- Full test suite, real output — unchanged in count.
- Confirm live: click a metric card (if you kept them clickable for hover/visual feedback
  without the selection logic, that's fine — just confirm nothing broken) and confirm the
  evidence table shows the real full evidence set with the correct real count in the caption.
- Byte-cleanliness scan. `ledgerlens/` unmodified.

## Acceptance criteria

1. Metric cards no longer imply a per-metric evidence distinction that isn't real.
2. One evidence table, always visible, captioned with the real evidence count and a plain
   statement that all three metrics share it.
3. Existing bounded/expandable table behavior (8-row default, "show all N") unchanged.
4. `apps/consumer` checked for the same issue and fixed or confirmed unaffected.
5. Full test suite passes unchanged. `packages/`/API/schema untouched — verified by diff.
6. `ledgerlens/` unmodified.

## How to report back

Short report is fine for this one — what you removed, what the new heading/caption says
exactly (quote it), whether `apps/consumer` needed the same fix, and real test output.
