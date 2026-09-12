# Antigravity prompt — M7: Presentation and narrative polish

Issued 2026-09-12 by the technical lead, after M6 acceptance and owner review of the live app.
Governing scope: `Signal-Passport-Weekend-PRD.md`.

---

M0–M6 are all accepted. Every claim on screen is real — live Blockscout data, a genuinely
sealed SHA-256 bundle, honest AI synthesis. The owner looked at the running app and could not
explain what it does or defend it as submittable, and they're right: the UI currently reads
like an internal verification console, not a product a judge watches once and understands.
This milestone is presentation only. **No change to any logic, calculation, schema, validation,
digest, or API contract.** If a fix here requires touching `packages/` or route logic beyond
what's needed to stop over-fetching for a demo (Task 3), stop and flag it instead of doing it
quietly.

## What's actually wrong, specifically

Screenshots of the live app show:
- Internal spec jargon used as UI copy: "APP ONE: GENERATOR", "P0B STRETCH SCOPE", "DISPLAY
  ONLY", "Audit Note: ... does not alter or participate in the SHA-256 payload digest",
  "COMPLETE_FOR_QUERY". These are correct facts, written in PRD/engineering language instead of
  language a viewer has ever seen before.
- The fetching/normalizing/calculating progress log stays on screen, in full, after completion,
  with raw counters ("273 items evaluated") — debug telemetry left visible after its purpose
  (showing real progress, not a fake spinner) is served.
- The Subject Overview section and the AI section's evidence references are formatted as plain
  label/value pairs and raw `1:0xfa528e0a...` ID strings — accurate, but with no visual
  hierarchy pointing at what matters most.
- The full evidence table renders all qualifying transactions unpaginated and uncollapsed —
  correct and honest, but a long raw-hash scroll during a recorded demo.

## Task 1 — rewrite user-facing copy for a first-time viewer

Go through every visible string in `apps/passport` and `apps/consumer` and ask: would someone
who has never read the PRD understand this in the three seconds they'll spend reading it during
a demo? Replace spec/engineering jargon with plain language, without changing what's true:

- "APP ONE: GENERATOR" → something that says what it *does* (e.g. a short line explaining you
  enter a wallet and get a portable, verifiable activity record), not its internal codename.
- "P0B STRETCH SCOPE" / "DISPLAY ONLY" → explain plainly that this is an optional AI summary of
  the same facts shown above, and that it's not part of what gets cryptographically verified —
  say that in one clear sentence, not two acronyms.
- "Audit Note: ... does not alter or participate in the SHA-256 payload digest" → the underlying
  fact (this text isn't part of what integrity-checking covers) stated in one plain sentence.
- `coverageStatus` values (`complete_for_query`, `partial`, `unknown`) → keep the literal value
  visible somewhere (a judge or technical reviewer may want the exact term), but lead with a
  plain-language sentence above/beside it — e.g. "All qualifying transactions in this window
  were retrieved" vs. the raw enum as the only thing shown.
- Do **not** soften or hide the real limitations (partial coverage, "does not prove wallet
  control," the fallback/verification caveats) — PRD §7/§8/§9 require these to stay visible and
  precisely worded. The fix is translating them into plain sentences, not removing them.

## Task 2 — give the page a narrative structure, not a log

Right now the page reads top-to-bottom as: form → raw progress log → raw data dump. Restructure
around the actual story:
- A short, above-the-fold explanation of what this is and the problem it solves — a sentence or
  two, not a paragraph, not spec language.
- The input step, visually distinct from what comes after.
- Progress: keep it (it's honestly showing real work, not a fake loading bar — don't remove
  that honesty), but collapse it to a compact completed-state summary once done (e.g. one line:
  "Fetched 273 transactions across 6 pages, 28 qualified" as a caption, not four persistent
  log-style cards) rather than leaving four raw stage cards on screen indefinitely.
- The Passport result: metrics as the visual focus, evidence and technical detail (digest,
  coverage enum, chain ID) available but visually secondary — e.g. grouped under a clear
  "technical details" heading or collapsed by default, expandable.
- Evidence table: keep it complete and honest (do not remove or fake-truncate real records), but
  make it presentable for a demo — a sensible default row count with a clear "show all N" control,
  or a scrollable panel with a fixed height, rather than an unbounded page-length dump.

Apply the same treatment to `apps/consumer` — it likely has the same jargon-forward,
log-dump presentation issue; check it, don't assume it's fine because nobody looked yet.

## Task 3 — do not change what's being verified, only how fast/clean the demo shows it

The M6 rehearsal fetched 273 raw items across 6 pages before finding 28 qualifying transactions
for the frozen wallet — that's real and correct, but it's slower and noisier for a live demo
than it needs to be. You may add a bounded, clearly-labeled "fast demo mode" that requests fewer
pages via the existing `maxPages` parameter for demo purposes — **only if it is visibly labeled
as such and does not change the default, full-accuracy behavior**. Do not silently cap
production behavior to make the demo look faster. If you're unsure this stays within scope,
don't do it — Task 1 and Task 2 alone address most of the actual complaint.

## Task 4 — verify the fix didn't regress anything

- Full test suite, real output — this milestone should not change test count or behavior at all
  since no logic changes; if any test fails, you've touched something out of scope.
- Rerun the cross-app proof once more (same as every prior milestone): App One generates and
  exports, App One stops, App Two imports and displays correctly, tamper detection still works.
- Confirm every fact still shown is still accurate — a rewritten sentence must not drift from
  what the underlying data actually says (e.g. don't write "fully verified" where the real
  guarantee is narrower).
- Byte-cleanliness scan, same as every prior milestone.
- `ledgerlens/` still unmodified.

## Acceptance criteria for M7

1. No change to any file under `packages/`, to schema/validation/digest logic, or to API
   response shapes — verified by diff, not by description.
2. A first-time viewer with no PRD context could look at the running App One for 30 seconds and
   correctly state what it does, in the reviewer's judgment when shown a fresh screenshot.
3. No raw spec/engineering jargon (P0b, "stretch scope", internal stage names, enum values with
   no plain-language lead-in) appears as the *only* representation of a fact on screen.
4. The progress log and evidence table no longer produce an unbounded, log-like page; both have
   a clear default state and a way to see full detail without it being the default view.
5. `apps/consumer` received the same review and fix where it had the same problem.
6. Every rewritten string is still factually accurate against the real underlying data — spot
   checked by the reviewer against a live run, not assumed from the diff.
7. Full test suite passes unchanged; cross-app proof still passes live.
8. `ledgerlens/` unmodified; no corruption in any file touched.

## How to report back

Same structure as before, plus: a short before/after description of the actual page structure
(not just a list of copy changes), and the real test/cross-app-proof output. Flag anything you
were unsure was in scope rather than guessing.
