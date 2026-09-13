# M12 — Typography, Iconography & Real Data Visualization

**Status:** Drafted, not yet sent to Antigravity
**Context:** M11 fixed layout/hierarchy (collapsed input, above-the-fold metrics, non-duplicated
checklist, raw JSON view) and that work is confirmed working in-browser. But the owner reviewed
both apps live and found they still read as a plain internal tool next to the Google Stitch
mockups — not because the structure is wrong, but because two things were explicitly left alone
in M11 and shouldn't have been: **typography weight/scale**, **iconography**, and — raised
directly by the owner just now — **what information we show and how** ("graphs would be
preferred here as tables can get as wordy as just using paragraphs of text"). This prompt covers
all three, scoped to real data only.

## Ground truth: what data actually exists (checked directly against the schema)

`packages/schema/src/evidence.ts` — an `EvidenceRecord` has exactly these fields, nothing else:
`evidenceId`, `transactionHash`, `timestamp` (ISO 8601 UTC), `recipient` (nullable 0x address —
null means contract creation), `status`, `sourceReference` (explorer URL). **There is no
transaction value/amount field, no direction field (every evidence record represents a
successful outgoing transaction by construction — see M1), and no contract-vs-EOA
classification anywhere in the codebase.** Any chart must be built only from `timestamp` and
`recipient` across `bundle.payload.evidence`, computed client-side in the page component itself.
Do not add new fields to the schema or new computation to `packages/analysis` for this — this
stays a frontend-only pass, same as M11.

That leaves exactly two things worth visualizing, both real and already implied by the existing
claims:

1. **Daily activity across the observation window** — bucket `evidence[].timestamp` into UTC
   calendar days across `observationWindow.startUtc`..`endUtc`. This is the same data backing
   the `active_days` claim; a chart just shows *which* days, not only the count.
2. **Recipient frequency** — group `evidence[].recipient` and count occurrences. This is the
   same underlying concept as `packages/analysis/src/ai/context-stats.ts`'s
   `recipientConcentration` (already computed for the AI narrative, proving this is real,
   established data), just surfaced visually instead of only being fed to the model.

Nothing else is chartable without fabricating a field. Do not invent one.

## Scope split between the two apps (preserve the existing differentiation)

Earlier in this project we deliberately differentiated the two apps so they don't show the same
information the same way: **Generator = discovery** (patterns, "does this look right"),
**Verifier = audit** (integrity checks, "is this what it claims to be"). Keep that split here:

- **Generator (`apps/passport`)**: gets both new charts described below.
- **Verifier (`apps/consumer`)**: gets the typography/icon treatment only. Do **not** add the
  activity or recipient charts here — the Verifier's job is confirming the bundle is intact and
  showing what's in it, not re-analyzing patterns. Keep its visual focus on the checklist and
  status cards.

## 1. Typography scale (both apps)

Right now headings are ad hoc inline styles (`style={{ fontSize: "1.6rem" }}` for the app title,
etc.) with no designed scale, which is a real reason both apps read as flatter/smaller than the
Stitch reference despite using the same fonts. Add a real type scale as CSS classes in both
`globals.css` files (keep them identical between apps, same as every other token):

```css
.text-headline-xl  { font-size: 2.25rem; line-height: 1.15; font-weight: 600; letter-spacing: -0.02em; }
.text-headline-lg   { font-size: 1.5rem;  line-height: 1.25; font-weight: 600; letter-spacing: -0.015em; }
.text-headline-md   { font-size: 1.125rem; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; }
.text-label-uppercase { font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; color: var(--text-dim); }
```

(Adjust exact numbers if needed for fit, but keep the *relationship* — one clear jump from body
text up to a real hero size, not a single flat scale.) Apply `.text-headline-xl` to the app title
("Signal Passport"), `.text-headline-lg` to primary section headings ("Verified Activity
Metrics," "Offline Verification & Verified Claims"), `.text-headline-md` to card-level headings,
`.text-label-uppercase` to the existing uppercase mono kicker tags (`card-header-tag`,
`status-strip` labels) that are currently plain text. Replace the inline `style={{ fontSize:
... }}` heading styles in both `page.tsx` files with these classes.

## 2. Icon system (both apps)

Replace emoji icons (⚙️📊🔍⚖️🔐📦🛡️📥📄✨🔍✔❌⏳) with **Material Symbols Outlined**, the
same icon font the Stitch reference actually uses (it's a real Google Fonts webfont, loaded the
same way as the existing Hanken Grotesk/JetBrains Mono `<link>` tags — this is a font asset, not
an npm dependency, so it doesn't conflict with the "no new npm dependencies" guardrail from M11).

Add to both `layout.tsx` files' `<head>` (or wherever the existing Google Fonts links live):
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0&display=swap" />
```
Use it via `<span className="material-symbols-outlined">icon_name</span>` (add a small
`.material-symbols-outlined { font-variation-settings: 'opsz' 20; font-size: 1.1em; vertical-align: middle; }`
helper class). Map the existing emoji to real icon names 1:1 — e.g. ⚙️→`settings`, 📊→`bar_chart`,
🔍→`search`, ⚖️→`balance`, 🔐→`lock`, 📦→`inventory_2`, 🛡️→`shield`, 📥→`download`,
📄→`description`, ✨→`auto_awesome`, ✔→`check_circle`, ❌→`cancel`, ⏳→`hourglass_empty`. Keep the
same semantic meaning at each usage site; this is a like-for-like icon swap, not new UI.

## 3. Real data visualization (Generator only)

Add a new section in `apps/passport/app/page.tsx`, placed between the 3 metric cards and the
"Supporting Evidence" table (the table stays — it's the accessible detail/fallback view the
charts summarize, not something to remove).

### Chart A — Activity timeline
**Form**: a calendar-heatmap strip, one cell per UTC calendar day across
`observationWindow.startUtc`..`endUtc` (per `choosing-a-form.md`: "compare magnitude, grid →
heatmap"). Compute a per-day transaction count client-side from `evidence[].timestamp`. Fill each
cell using a **sequential single-hue ramp built from the existing mint accent**, not a new hue —
define 4-5 CSS steps as tints of `--accent` against the surface, e.g.:
```css
--activity-0: var(--surface-raised);                                  /* zero transactions that day */
--activity-1: color-mix(in srgb, var(--accent) 25%, var(--surface-raised));
--activity-2: color-mix(in srgb, var(--accent) 50%, var(--surface-raised));
--activity-3: color-mix(in srgb, var(--accent) 75%, var(--surface-raised));
--activity-4: var(--accent);                                          /* max transactions in a single day */
```
Bucket each day's count into one of the 5 steps (0 txs → step 0, then quartile the rest). Each
cell: small square/rounded-square, `2px` gap between cells (per mark spec: never touching), hover
shows a tooltip with the exact date and count. Below the strip, a one-line caption stating the
real window dates and the real active-day count/percentage (reuse the existing "12 of 31 days in
this window (39%)" line — don't duplicate it awkwardly, the chart illustrates it, the line still
states it precisely). No legend needed (single sequential series — per the skill, one hue needs
no legend box, just the caption).

### Chart B — Recipient frequency
**Form**: horizontal bar chart, one bar per recipient, ranked by transaction count descending
(per `choosing-a-form.md`: "compare magnitude" → bar). Cap at the top 5 recipients; if there are
more, fold the rest into a final "Other (N recipients)" bar (per the skill's series-count ladder
— don't just truncate silently). Bars: `<=24px` thick, `4px` rounded at the data end, square at
the baseline, same sequential mint fill as Chart A (`--accent` at full opacity for the bar fill,
track/background at `--surface-raised`). Direct-label the value at the bar's end (the count),
truncate/checksum-shorten the recipient address as the row label (reuse the existing
`0x1234...5678` truncation pattern already used in the evidence table). This is the same
underlying computation as `computeContextStats.recipientConcentration` — you're welcome to
factor a small shared client-side helper in `page.tsx` itself, but do not modify
`packages/analysis` to share the actual function; this is a display-only computation and must
stay frontend-only per the M11/M12 scope guardrail.

### Placement and sizing
Both charts should sit above the fold alongside or just below the metric cards where reasonable,
but don't fight the M11 acceptance criteria — if adding both charts pushes the result screen's
"heading + metrics + Export button" below the fold at 1440×900, keep metrics + Export as the
top-of-fold priority (per M11) and let the charts sit just below that, still above the evidence
table. Re-verify the M11 acceptance criteria still hold after this change.

## Guardrails (same as M11, still binding)

- No changes to `packages/analysis`, `packages/schema`, `packages/verification`, or any `api/`
  route logic. Chart data is computed in `apps/passport/app/page.tsx` from
  `bundle.payload.evidence`, nothing else.
- No new npm dependencies. The Material Symbols webfont is a `<link>` tag, same category as the
  existing Google Fonts links — not an npm package.
- No fabricated fields: no transaction value/amount, no inbound/outbound split, no
  contract-vs-EOA classification, no percentages or ratios that aren't directly computed from
  `timestamp`/`recipient` on real evidence records.
- Verifier (`apps/consumer`) gets typography + icons only — no new charts. Don't re-introduce the
  "both apps show the same information" problem this project already fixed once.
- Do not write acceptance/rejection status into `STATUS.md` — report results directly in your
  response; the reviewer updates `STATUS.md`.

## Acceptance criteria

1. Both apps' headings visibly follow the new type scale (compare `generator-result.png`-style
   screenshot before/after — the app title and section headings should be noticeably larger/
   bolder, not just recolored).
2. Zero emoji remain in either app's UI; all icons render via Material Symbols Outlined.
3. Generator result screen shows a real activity-timeline heatmap and a real recipient-frequency
   bar chart, both computed from actual evidence data in the loaded bundle (verify by hand against
   the fixture: `fixtures/real/passport-bundle.json`, 28 evidence records, 12 active days, top
   recipient `0x0439e60F02a8900a951603950d8D4527f400C3f1` with 11 of 28 — the chart's tallest bar
   and darkest/most-active heatmap cells should reflect these exact real numbers).
4. Verifier shows no new charts — typography/icon changes only.
5. M11's 1440×900 above-the-fold acceptance criteria still pass after this change (recheck, don't
   assume).
6. `npm test` still 68/68. No diff outside `apps/passport/app/{page.tsx,globals.css}`,
   `apps/consumer/app/{page.tsx,globals.css}`, and both `layout.tsx` files (for the font link).
7. Screenshot both apps' result states again at 1440×900 and save to `docs/screenshots/`,
   overwriting the M11 ones.
