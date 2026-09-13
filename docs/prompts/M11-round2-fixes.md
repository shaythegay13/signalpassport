# M11 Round 2 — Fix Regression, Revert Scope Violations

Your M11 round 1 report claimed "accepted" and included a first-person "Reviewer independently
verified every layer" section written directly into `STATUS.md`. **You do not have authority to
mark milestones Accepted, or to write reviewer-voice verification narrative, in `STATUS.md`.**
That section has been replaced with the actual review, which found one real regression and two
scope violations. Fix all three below, then report back — do not touch the Accepted/rejected
status language in `STATUS.md` again; that's the reviewer's call, not yours.

## 1. Fix: Verifier failure-path checklist no longer renders (real regression)

File: `apps/consumer/app/page.tsx`

The per-check list ("Deterministic Verification Checks (4/4 evaluated locally)", the
`.checklist-compact-grid` block you added) is currently nested inside `{result.bundle && (...)}`
(around line 246 onward). `validate-bundle.ts` only populates `bundle` on a fully successful
parse — every failure path (bad schema, bad address, dangling evidence reference, digest
mismatch) returns with `bundle` left `undefined`. That means on any real validation failure, the
entire block — including the one piece of UI that shows *which* check failed and why — never
renders. This is visible in your own `docs/screenshots/verifier-result-invalid.png`: it says
"See audit log for specific failure details" directly above empty space.

Fix: move the checklist rendering out from under `{result.bundle && (...)}` so it renders
whenever `result.steps.length > 0`, independent of whether `bundle` is present. `result.steps`
is always populated (it's built incrementally as each check runs, before any early return), so
this is safe on both the success and failure paths. Everything else currently inside that
`{result.bundle && (...)}` block that genuinely depends on bundle data (the metrics grid, the
verdict note, coverage/zero-activity notices, the verifiability box) should stay gated on
`result.bundle` as before — only the checklist itself needs to move out.

After fixing, re-verify by hand: import a corrupted/invalid JSON file (you can mutate
`fixtures/real/passport-bundle.json`'s `integrity.digest` field, or use whatever invalid-file
test you used originally) and confirm the checklist is visible and correctly shows which
specific check failed. Recapture `docs/screenshots/verifier-result-invalid.png`.

## 2. Revert: unauthorized `concurrently` dependency and `dev` script

File: `package.json`

Remove the `"concurrently": "^10.0.5"` devDependency and the
`"dev": "concurrently -n GENERATOR,VERIFIER ..."` script you added. The M11 prompt explicitly
said "No new npm dependencies (no Tailwind, no icon fonts, no animation libraries)." This
wasn't asked for, and separately, the owner previously and explicitly decided to keep the two
apps as separate pages/processes rather than merge their dev workflow — don't reintroduce that
direction without being asked.

## 3. Remove: debug hooks left in shipped components

Files: `apps/consumer/app/page.tsx`, `apps/passport/app/page.tsx`

Remove the `React.useEffect` blocks that assign `(window as any).__loadPassportFile` (consumer)
and `(window as any).__runAnalyze` (passport). These were added to let your own screenshot-
capture script drive the UI without working synthetic DOM events, but they're now permanent
globals exposed in the production components that every real user's browser runs. They were
never part of the M11 scope. Delete both `useEffect` blocks entirely — don't replace them with
anything.

If you still want a screenshot-verification script for your own use, it can live entirely in
`scripts/` and interact with the page the way a real user would (actual DOM events dispatched
correctly, or a proper browser-automation library) rather than the app exposing internal
functions on `window` for it to call.

## Re-verification after all three fixes

1. `npm test` — confirm still 68/68 passing.
2. `git diff` against the M11 commit — confirm `package.json` no longer shows the `concurrently`
   addition, and both `page.tsx` files no longer contain any `window as any` assignment.
3. Re-run the invalid-file import case in-browser (or via your capture script) and confirm the
   checklist showing which check failed is visible in the recaptured screenshot.
4. Re-run the full M11 acceptance criteria list from `docs/prompts/M11-demo-visual-polish.md`
   one more time given these changes didn't touch layout — a quick sanity pass is enough, you
   don't need to redo the above-the-fold measurement work.

## Report back

State plainly, for each of the three items above: what you changed (file + line range) and how
you confirmed the fix. Do not write any acceptance/rejection status into `STATUS.md` — report
directly in your response instead, and the reviewer will update `STATUS.md`.
