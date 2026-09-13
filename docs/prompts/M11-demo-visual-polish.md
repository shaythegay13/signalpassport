# M11 — Demo Visual Polish Pass

**Status:** Drafted, not yet sent to Antigravity
**Scope:** Frontend layout/hierarchy/spacing only. No changes to analysis, hashing, schema, validation, or export/import behavior.

## Context you should read before touching anything

1. `Google Stitch Frontend Development.txt` at the repo root (`C:\Users\shayb\Downloads\Signal Passport\Google Stitch Frontend Development.txt`, **outside** `signal-passport/` — one level up). It contains four Google Stitch HTML/Tailwind exports, in this order: Offline Verifier Result, Generator In-Progress, Generator Landing, Generator Result & Export. These are styling/layout references only — see "What to take and what to reject" below before using anything from them.
2. The two Stitch screenshots the user shared this round (same four screens, rendered). Purple browser chrome in the screenshots is not part of the app — ignore it.
3. `apps/passport/app/page.tsx`, `apps/passport/app/globals.css`
4. `apps/consumer/app/page.tsx`, `apps/consumer/app/globals.css`
5. `apps/consumer/app/lib/validate-bundle.ts` — this already contains carefully-worded, accurate verification copy. Do not rewrite this copy; the wording task below is about surfacing it better, not rephrasing it.

## Important: our design tokens already mostly match the target

Both apps already share an identical token set (verified identical in both `globals.css` files):

```css
--bg: #131316;            /* near-black page background */
--surface: #1f1f22;       /* charcoal surface */
--surface-raised: #2a2a2d;
--border: #3c4a42;
--border-active: #4edea3;
--text: #e4e1e6;          /* off-white primary text */
--text-muted: #bbcabf;
--text-dim: #86948a;
--accent: #4edea3;        /* mint accent */
--accent-hover: #6ffbbe;
--success: #10b981;
--success-text: #4edea3;
--warning: #ffb95f;
--danger: #ffb4ab;
--font-mono: 'JetBrains Mono', ...
--font-sans: 'Hanken Grotesk', ...
```

Body text has no explicit font-size override, so it inherits the 16px browser default. Corner radii are already `0.5rem` (8px) consistently. **Do not introduce a new palette, new fonts, or new radii.** This pass is about restructuring layout, hierarchy, and information density — not reskinning colors. The Stitch exports happen to use this same mint-on-near-black system (their `primary: #4edea3`, `background: #131316`), which is a useful sanity check that we're aligned, not a reason to import their CSS wholesale.

## What to take from the Stitch exports, and what to reject

**Take (layout/structure ideas worth adapting):**
- Verifier: two side-by-side status cards for integrity vs. publication (we already do this via `.status-duo` — tighten the visual treatment, don't rebuild it)
- Verifier: a compact numbered checklist for the 4 real checks, each showing name + one-line result (we already compute exactly these 4 checks in `validate-bundle.ts` — schema, subject address, evidence references, digest)
- Verifier: raw payload accessible via an expandable/modal view
- Generator: collapsing the input card into a compact summary bar after analysis completes, with a way to start a new analysis
- Generator: 3 metric cards presented as clear visual leads near the top of the result, export action prominent nearby
- Generator: evidence table with tx hash / timestamp / recipient / explorer link — we already have this

**Reject — do not implement, do not adapt, do not soften into "inspired by":**
- Any signature scheme (Ed25519, Secp256k1, `r`/`s`/`v` components, "Attestation Key", "did:pkh"). We do not sign anything.
- Any Merkle tree / Merkle root / "Merkle Inclusion Geometry" / leaf/branch visualization. We do not build a Merkle tree; integrity is a single SHA-256 digest over canonical JSON.
- EIP-712, ERC-4361, "PASSPORT" protocol/spec version numbers ("SPEC v1.0.4"), "Attestation Suite" branding, "EXEC_CYCLE #" labels.
- Fake RPC/node telemetry: block ranges ("#19400000–#19620000"), fake IPs ("104.18.29.11"), "Alchemy Archive Node", latency numbers, confirmation counts, "EPOCH #482910".
- ENS resolution UI ("RESOLVED ENS: vitalik.eth") — we don't resolve ENS names.
- The metric-card sub-breakdowns: outbound/inbound tx ratio, smart-contract-vs-EOA split, the 30-day "spark-matrix" activity bitmap. **Checked against `packages/analysis/src`: none of these are computed anywhere in our pipeline.** Do not add them to the UI even as a visual flourish — there is no data behind them.
- "Zero Subjective Heuristics Guarantee" / "Institutional Evidence vs. Subjective Scoring" marketing sections, "audit certificate" / "notarization" framing, fabricated progress percentages on the in-progress state (our SSE stream reports real named stages, not a percent complete).
- Any Material Symbols icon font or Tailwind runtime — we're a static CSS app already; don't add new dependencies for this.

If you're unsure whether a Stitch element is real or invented, check it against `packages/schema`, `packages/analysis`, and `packages/verification` before using it. If it's not backed by code, leave it out.

## GENERATOR — `apps/passport/app/page.tsx` + `apps/passport/app/globals.css`

### Before analysis (idle state)
Currently: `.hero-section` (intro) → `.card` (input form with example-wallet button) — this structure is fine. Tighten it:
- Keep the hero intro short (it already is — don't expand it).
- Input row + example wallet button + one primary "Analyze Wallet" button — already matches; just confirm visual weight (the Analyze button should be the clear primary action, current `.primary-btn` styling).

### During analysis (`currentStage !== "idle" && currentStage !== "complete"`)
Currently: `.progress-list` of real SSE stage events (`fetching`, `normalizing`, `calculating`), rendered as a flat list with `.step-indicator` emoji. There is no percentage anywhere in this code path, so there's no literal "fabricated progress bar" bug in this file — but load the app in-browser and check for any visual overflow (a step card, badge, or long detail string pushing past `.card`'s bounds) at 1440×900 and at ~768px. If you find an element overflowing its container during this state, fix it (contain within the card, wrap or truncate text) rather than inventing a new progress-bar widget. Do not add a percentage number — we don't have one to report honestly.

### After analysis (`bundle` present)
This is the highest-value part of the pass. Current structure order:
1. `.pipeline-compact-bar` (already a compact "Analysis complete" summary — good, keep)
2. `.result-grid` → `.result-main` (8 col) / `.result-sidebar` (4 col)
3. Inside `.result-main`: one large `.card` containing header bar → verdict-card → `.metrics-grid` (3 cards) — then, as **separate elements below**, `.ai-section` and `.evidence-section`.

Required changes:
- **Collapse the input card itself**, not just show a compact bar below it. Right now the full input form (`<form onSubmit={handleAnalyze}>` with the text input and Analyze button) stays visible and expanded even after `bundle` is set — only the pipeline step list collapses via `showPipelineDetails`. Change this: once `bundle` is set, collapse the input section into a compact wallet-summary row (address + "Analyze another wallet" action) similar to how `.pipeline-compact-bar` already summarizes the pipeline. The full input form should not compete for space with the results below it.
- **Move results above the fold.** At 1440×900, after collapsing the input, the result heading + 3 metric cards + Export button must be visible without scrolling. Reorder/resize as needed — this may mean the verdict-card (`"A factual record, not a verdict"`) becomes a smaller inline note rather than a full padded card, and the sidebar's "Export Passport" card should move up or the export button should also appear directly near the results heading (not only in the sidebar 4-col column, which can end up below the fold on shorter viewports).
- **Keep the 3 metric cards equal-width and near the top** — this already matches `.metrics-grid`; just make sure nothing above them (verdict card, coverage notices) pushes them down excessively. Reduce padding on wrapper cards where there's currently double-nesting (e.g., the outer `.card` plus the inner verdict-card plus the metrics grid — check for redundant borders/padding stacking three levels deep).
- **Observation window + coverage stay visible** near the metrics (already present as a paragraph above the metrics grid — keep it, just keep it concise).
- **Evidence table and AI summary move below the metrics**, which is already their position — confirm this holds after your reordering.
- **Move less-essential detail into expandable sections**: the sidebar's "Technical Details & Cryptographic Provenance" panel (`.sidebar-card` with `.meta-panel`) is a good candidate to become a collapsed `<details>`/toggle rather than always-rendered, especially subject address / chain ID / snapshot version / digest — keep the digest accessible but don't let it compete visually with the 3 metric cards.
- **AI summary stays secondary**: current `.ai-section` styling already treats it as a distinct block below the metrics — keep it visually quieter than the metrics (it already is; don't add emphasis to it).

## VERIFIER — `apps/consumer/app/page.tsx` + `apps/consumer/app/globals.css`

### Before import
Current dropzone (`.dropzone`) + hero intro is close to what's asked. Keep the existing sample-file hint text (`fixtures/real/passport-bundle.json`) — don't remove it.

### After import (`result` present)
Current structure: `.step-checklist` (4 real checks: schema, address, evidence, integrity) → `.status-duo` (2 cards: integrity vs. publication) → separate `.card` for `.metrics-grid` → sidebar `.sidebar-card` restating pass/fail for the same 4 checks a second time.

Required changes:
- **The 4-item `.step-checklist` is already the compact, accurate checklist** the spec asks for (names come straight from `validate-bundle.ts`: "1. Bundle Envelope Schema", "2. Subject Address Format", "3. Evidence Reference Integrity", "4. Cryptographic Digest Integrity" — these are already correctly worded, not inflated). Tighten its visual treatment (reduce padding, make pass/fail state readable at a glance via icon + color, not just a colored left border) rather than rebuilding it.
- **Don't duplicate the same 4 checks a second time** in the sidebar `.sidebar-card` "VERIFICATION STATUS" panel (lines ~392-437 of `page.tsx`) — right now the main column's checklist and the sidebar both separately render pass/fail for schema/subject/coverage-or-evidence/integrity. Consolidate: keep the detailed checklist in the main column, and let the sidebar carry only the single overall status (`VERIFIED` / `INVALID`) plus the one line of prose, not a second full breakdown.
- **Integrity vs. publication stay visually separate** — `.status-duo`'s two-card layout already does this correctly per the existing wording (`integrityLabel`/`integrityExplanation` vs. `publicationLabel`/`publicationExplanation` from `validate-bundle.ts`). Keep them separate; just tighten padding/sizing to match the rest of the pass.
- **Metrics prominent**: same treatment as the Generator — 3 equal metric cards near the top of the result, not buried below two other cards' worth of checklist/status content. Consider whether the checklist + status-duo can be visually condensed (e.g., checklist as a compact row of 4 small chips with a "details" expansion) so the metrics don't start below the fold at 1440×900.
- **Raw payload / evidence accessible via tabs or expandable section** — currently there's no raw-JSON view in the Verifier at all. Add a simple expandable "View raw payload" section (plain `<pre>` of `JSON.stringify(result.bundle, null, 2)` or similar, scrollable, monospace) near the evidence/metadata area. Keep it optional/collapsed by default so it doesn't compete with the verified metrics.
- **AI note stays secondary and separate** — `.ai-section` treatment for "Imported Narrative Explanation" already has a clear "Display Only" badge and a note that it's excluded from the integrity check (lines ~344-382). Keep that framing; just make sure its visual weight stays below the verified-checks section.

## Wording — mostly already correct, verify before touching

`apps/consumer/app/lib/validate-bundle.ts` already uses careful language:
- `"Bundle integrity matched"` with explanation: *"...confirms the bundle has not suffered accidental modification or corruption, but does NOT establish wallet ownership, authentic origin, truthful source data, or independent onchain verification."* — this already matches the spirit of "a digest match alone does not prove authenticity." Leave this wording as-is.
- Step 3 is already named `"Evidence Reference Integrity"` and its message is *"All N evidence references across M claims resolve within the bundle"* — this already matches "evidence references resolved," not a false claim of recalculation. Leave as-is.
- `"Not published"` is already a separate field (`publicationLabel`/`publicationExplanation`) from the integrity result. Leave as-is.
- Coverage status is already described from the actual query scope (`coverageStatus: "complete_for_query"` / `"partial"` with real page-count detail). Leave as-is.

Do not touch this file's strings. If, while restructuring the visible UI, you find yourself needing new label text anywhere (e.g. a new "View raw payload" toggle, a compact-checklist chip label), keep it as plain, accurate description of what the code does — no new claims about signatures, recalculation, or provenance beyond what's listed above.

## Scope guardrails

- No changes to `packages/analysis`, `packages/schema`, `packages/verification`, or any `api/` route logic.
- No new npm dependencies (no Tailwind, no icon fonts, no animation libraries).
- No new fabricated data fields, percentages, or sub-metrics anywhere in either app.
- If you find an actual functional bug while doing this (not a visual one), stop, report it separately with the smallest fix you'd recommend, and do not fix it as part of this pass without confirming first.

## Acceptance criteria (verify in-browser, both apps, 1440×900, 100% zoom)

1. Generator result screen: heading, 3 metric cards, and Export button all visible without scrolling once analysis completes for the example wallet.
2. Verifier result screen: heading, verification status, and 3 metric cards all visible without scrolling once `fixtures/real/passport-bundle.json` is imported.
3. No horizontal overflow, clipped text, or misaligned controls at 1440×900 or at ~768px width.
4. Typography, colors, spacing, border-radius, and button styles are visually consistent between the two apps (they should already share tokens — confirm nothing diverged).
5. Long addresses/hashes truncate or wrap, never overflow their container.
6. Functional flows still work: analyze the example wallet end-to-end, export the bundle, re-import the exported file into the Verifier, and also test importing an invalid/corrupted JSON file to confirm the error path still renders correctly.
7. Loading, empty/idle, success, and error states all still render sensibly.
8. Take screenshots of: Generator idle, Generator in-progress, Generator result, Verifier idle, Verifier result (valid file), Verifier result (invalid file) — at 1440×900. Report which of these you actually captured vs. couldn't.

## What to report back

For each app, a short list of what changed (file + one line each), the screenshots from the acceptance criteria, and explicitly: any acceptance-criteria item you could not verify in-browser and why, and any functional issue discovered but not fixed (per the scope guardrail above).
