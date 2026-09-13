# Antigravity prompt — M9 round 2: this needs to be a structural reskin, not a color swap

Issued 2026-09-12 by the technical lead, after the owner reviewed round 1 live and correctly
called it out. Governing scope: `Signal-Passport-Weekend-PRD.md`.

---

Round 1 changed the CSS variable *values* and added one small status-strip element, but
`page.tsx` in each app only changed by ~34 lines out of ~670. The extensive new CSS you wrote
in `globals.css` (300-470 new lines) is mostly unused, because the components still lay
everything out with the same inline `style={{...}}` attributes they had before. The result:
colors changed, but the actual page — card arrangement, hierarchy, header design, spacing
rhythm — looks the same as before M9. That is not what "apply the design system" meant, and
it's why the owner said it doesn't look different.

**Everything from round 1 that was verified correct stays**: the color/font token values, the
absence of fabricated technical claims (Ed25519/Merkle/RPC/archive-node/block-range/fake
telemetry — still banned, still must return zero grep matches), and every word of M7/M8's
content (still must appear verbatim). This round is specifically about *structure*.

## What "structural" actually means here — concrete, checkable moves

Look at the Stitch mockup again for these specific patterns and actually build them:

1. **A real hero treatment for the opening statement.** Not a paragraph inside a plain card —
   a distinct section with a larger headline treatment and the explanatory paragraph beneath
   it, visually separated from the input form below it, similar to Stitch's "editorial
   statement" section (large headline, generous whitespace, a subtle background accent).
2. **A document-style card header pattern** for the input card and the result card — a small
   icon + label row at the top of the card (Stitch used this for "Target Wallet Address"),
   not just a plain `<h2>`.
3. **A grid-based result layout, not one long stacked column.** Split the Passport result into
   a main column (metrics, evidence, AI summary — the primary content) and a narrower side
   column (technical details, digest, coverage, snapshot version — secondary/reference
   content), similar to Stitch's 8-column/4-column split. This is the single biggest visual
   change that will make it look genuinely different, and it also reinforces M8's point that
   the technical/cryptographic detail is secondary to the facts.
4. **The "factual record, not a verdict" box gets real card treatment** — icon, bold title
   line, description — matching the visual weight Stitch gave its "Zero Subjective Grading"
   panel, not a thin inline notice.
5. **Use the CSS classes you already wrote.** If `globals.css` has 300+ new lines defining
   card/grid/badge classes, the components need to actually use `className` with those classes
   instead of one-off inline `style={{...}}` objects for the same visual purpose. Either wire
   the new CSS up for real, or remove what isn't used — don't leave dead CSS sitting next to
   inline styles doing the same job.
6. Apply the same restructuring to `apps/consumer` for consistency.

## What must NOT change

- No new fabricated technical claims. Re-run the same banned-term grep from round 1
  (`Ed25519|EIP-712|Merkle|RPC|archive node|block range|fake telemetry|invented version
  labels`) against your new diff and get zero matches again.
- No word of M7/M8's content changes — the "why this exists" paragraph, the "not a verdict"
  statement, the three arithmetic context lines, the independent-verifiability sentence all
  stay exactly as written, just given better visual treatment/placement.
- No change to `packages/`, schemas, digest logic, or API contracts.
- Every number displayed must still trace to real `bundle.payload` data — moving things into a
  grid doesn't change that requirement.

## A sanity check on the diff itself

A structural change of this kind should show up as a real diff, not a small one. If
`git diff HEAD~2 --stat` on `page.tsx` (comparing against the state *before* round 1, i.e. the
end of M8) comes back under roughly 150 changed lines per app, you have not actually
restructured the layout — go back and do the grid/hero/card-header changes above for real.

## Verify

- Full test suite, real output — unchanged in count, no logic touched.
- Rerun the cross-app proof once more, live: App One generates and exports, stops, App Two
  imports and displays correctly with the new structural layout, tamper detection still works.
- Re-run the round-1 banned-term grep and paste the real, empty output.
- Re-confirm the exact M7/M8 strings are still present verbatim (grep for a few of them
  yourself and show it).
- Byte-cleanliness scan. `ledgerlens/` unmodified.

## Acceptance criteria for M9 round 2

1. `page.tsx` in both apps shows a real structural diff (grid-based result layout, hero
   treatment, document-style card headers) — not just color/token changes.
2. The new CSS classes written for this milestone are actually applied via `className`, not
   left unused alongside old inline styles.
3. Zero fabricated technical terms anywhere in the diff — reviewer will grep independently.
4. All M7/M8 content present verbatim — reviewer will grep independently.
5. Full test suite passes unchanged; cross-app proof passes live.
6. No change to `packages/`, schemas, digest logic, or API contracts — verified by diff.
7. `ledgerlens/` unmodified.

## How to report back

Same structure as before, plus: paste the actual `git diff --stat` for `page.tsx` in both apps
so the reviewer can see the change is substantial before doing anything else. Describe the
before/after layout structure in words, not just "restyled" — say what moved where.
