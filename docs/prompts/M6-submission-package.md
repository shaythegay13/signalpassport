# Antigravity prompt — M6: Submission package

Issued 2026-09-12 by the technical lead, after M5 acceptance. Governing scope:
`Signal-Passport-Weekend-PRD.md`.

---

M0–M5 are all accepted. P0 and P0b are both complete and independently verified, including live
against the real running apps. This milestone does not add features — it makes the project
presentable, honest about what it is, and ready to submit. Per the milestone plan: **never trade
away evidence visibility, coverage labels, or App Two to make room for anything in this
milestone.** Nothing here should touch `packages/`, the metric logic, the bundle schema, or the
AI validation logic. If you find a real bug while doing this work, stop and report it separately
rather than quietly patching core logic inside a "polish" commit.

## Context you must load first

- `Signal-Passport-Weekend-PRD.md` §5 (originality), §14 (acceptance), and §15 (demo and
  submission) govern this milestone specifically.
- `STATUS.md` in full — it is the record of every decision and every verified fact about this
  project. Task 2 below asks you to draw from it, not re-derive it.
- `docs/REUSE.md` — the living reuse disclosure. Confirm it, don't rewrite its structure.
- `ledgerlens/` remains **read-only**.

## Task 1 — remove the demo-testing toggles from the live UI

`STATUS.md`'s M4 review log flagged this: the "Simulate Zero Activity / Partial Coverage /
Provider Outage" checkboxes in App One are currently visible in the default, production UI.
That was fine for verification; it is not fine for a judge watching the demo, who would
reasonably wonder whether anything they're seeing is real.

Do one of the following, your choice, but pick one and be consistent: (a) remove the toggles
from the default UI entirely and gate them behind a query parameter or environment flag that
isn't on by default, or (b) remove them outright now that the edge states have been verified and
accepted, relying on the underlying code paths (which are tested) rather than a live UI control.
Either way: confirm afterward that loading App One with no special flag shows a clean interface
with **no visible reference to simulation/testing controls**, and that removing/gating them did
not remove the actual edge-state handling in the code — the tests from M4/M5 must still pass
unchanged.

## Task 2 — finalize `README.md`

The README must let a judge, from a fresh clone, understand and run the whole thing without
asking you anything. Include, at minimum:
- What Signal Passport is, in the PRD's own framing (one paragraph, no invented claims).
- Prerequisites (Node version) and setup for the root package and both apps.
- How to run each app (ports) and how to run `npm test`.
- Where the real fixture data lives (`fixtures/real/`) and how someone can try the flow with it
  directly instead of a live wallet, if they want a fast, no-network demo path.
- The full walkthrough: generate a Passport → inspect evidence → export → stop App One → start
  App Two → import → see matching metrics and integrity status → (optional) tamper a field and
  see the mismatch.
- A short, honest statement of what's new this weekend versus reused from LedgerLens, pointing
  to `docs/REUSE.md` rather than duplicating it. Do not invent a percentage of original code.
- What is *not* implemented (Monad/P1, unless it gets built separately) and why — PRD §4 says to
  describe the demo accordingly if stretch scope is unfinished; do the same here.

Verify this the same way M4 required: actually clone the repo fresh and follow it literally.
Note any discrepancy and fix it, don't assume it's still accurate just because it was accurate
after M4 — three milestones of changes have happened since.

## Task 3 — finalize `docs/REUSE.md`

Add the log entries for what M5 actually reused (the `ai-provider.ts` pattern and the
`validateAiAnalysis` pipeline shape — check the "Log of reuse decisions" table at the bottom of
the file; it may still have only its original empty template row). Do not touch the earlier,
already-reviewed rows. Confirm the originality summary at the top of the file still accurately
reflects the finished project — it was written when only the reuse *candidates* were known; now
that everything is built, confirm the actual reused line count and where it landed relative to
the total.

## Task 4 — demo script and rehearsal (not the recorded video itself)

Recording the actual demo video and publishing the social post are Shay's actions, not yours —
PRD §15 says to prepare the social copy but have Shay publish it. Your job here is to make that
easy and to prove the sequence actually works end to end, live, one more time before anyone
records anything.

- Write a demo script under `docs/demo-script.md` following PRD §15's sequence: the problem in
  15 seconds, analyze a real wallet and state the source/window, open one claim's evidence,
  export, stop App One, start App Two, import, show matching metrics and the precisely-labeled
  integrity status, and — if it fits in three minutes — a tamper-rejection demonstration. Include
  the exact wallet address, exact clicks/commands, and approximate timing per step so the
  recording is a rehearsal of a known-good sequence, not an improvisation.
- **Actually run through the whole sequence live, start to finish, yourself**, timing it. If it
  doesn't fit in three minutes, cut the tamper-rejection step first (PRD explicitly marks it
  "if time allows"), not evidence drill-down or App Two.
- Draft the submission project description and the LinkedIn/X social copy per PRD §15's
  checklist. Do not invent usage, customers, time savings, or outcomes — PRD §15 is explicit
  about this. State plainly what was built, what's reused, and that Monad publication is either
  not implemented or implemented separately (check `STATUS.md` for the current P1 state before
  writing this).

## Task 5 — final full verification pass

- Full test suite, real output.
- Rerun the cross-app proof one more time after Task 1's UI changes: App One generates and
  exports, App One is stopped, App Two imports and displays correctly, tamper detection still
  works. This is the same proof from M3 — confirm Task 1 didn't quietly break anything in App
  One's flow.
- Byte-cleanliness scan across the whole repo, same as every prior milestone.
- Confirm `ledgerlens/` is still byte-for-byte untouched.

## Acceptance criteria for M6

1. App One's default UI shows no visible simulation/testing controls; the underlying edge-state
   code paths and their tests are unchanged and still pass.
2. README verified against an actual fresh clone, not assumed correct from memory of M4.
3. `docs/REUSE.md`'s reuse log includes M5's entries; the originality summary reflects the
   finished project.
4. A demo script exists with exact steps/timing, and the full sequence was actually run through
   live by you at least once, with the result (including timing) reported honestly.
5. Draft project description and social copy exist, contain no invented claims, and are
   explicitly marked as drafts for Shay to review and publish, not to publish yourself.
6. Full test suite passes, real output pasted.
7. The cross-app proof still passes after Task 1's changes.
8. No BOM, control-byte, or `?`-substitution corruption anywhere in the repo.
9. `ledgerlens/` still unmodified.
10. No core logic (metrics, schema, digest, AI validation) was touched.

## How to report back

Same structure as before. Be explicit about which option you chose for Task 1 and why. Report
the actual timing from your live rehearsal of the demo sequence, not an estimate. Flag clearly
that the recorded video and any public posting are Shay's to do, not yours.
