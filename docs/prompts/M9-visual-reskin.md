# Antigravity prompt — M9: Visual reskin (style only — no new claims)

Issued 2026-09-12 by the technical lead, after M8 acceptance. Governing scope:
`Signal-Passport-Weekend-PRD.md`.

---

The owner had Google Stitch generate some visual concepts for the app. The color system,
typography, and layout rhythm are genuinely good and worth adopting. **The content Stitch
invented alongside that visual system is not** — it describes a completely different, more
elaborate, and entirely fictional technical architecture (Ed25519 signatures, EIP-712,
Merkle trees, raw JSON-RPC archive nodes, block-range windows, fake telemetry) that has
nothing to do with what this system actually does. If any of that fictional content ends up
in the shipped app, the app would be making false claims about its own architecture — which is
precisely the failure mode this entire project exists to prevent (PRD §5, §15: "do not invent
usage, customers, time savings... demonstrate measured functionality").

**This milestone is visual restyling only.** Take the design system (colors, type, spacing,
card layout patterns) from the Stitch mockups and apply it to the app's *existing, accurate*
content and structure from M7/M8. Do not adopt any sentence, label, or claim from the Stitch
HTML — only its look. **No change to any logic, calculation, schema, validation, digest, or
API contract**, same as every prior presentation milestone.

## What is real vs. what Stitch invented — do not mix these up

| Stitch's mockup says | The actual system does |
| --- | --- |
| "Ed25519 signature," "EIP-712 notary," an "attestation key" | SHA-256 hash of canonical JSON. No signing key exists anywhere. Never describe this as a signature or attestation — it's a tamper-evidence digest. |
| "Merkle tree," "Keccak256 receipt leaves," "unroll Merkle branches" | No Merkle tree exists anywhere in this system. **Exception**: Keccak-256 is genuinely used, but only for computing an EIP-55 address checksum (`packages/analysis/src/ai/../address.ts`) — that one real, narrow use is fine to mention if relevant; do not generalize it into "Merkle" or "attestation" language. |
| "JSON-RPC batch caller," "Alchemy Archive Node," fake IPs, "PARALLEL WORKERS: 4," "41.2 TX/SEC," "HEAP ALLOC" | The real adapter makes plain HTTP GET requests to Blockscout's public REST v2 API. No archive node, no IP address, no worker pool, no per-second rate — remove all of this invented telemetry. |
| Block-range window ("#19400000 to #19620000") | The real observation window is a UTC calendar date range (e.g. "2026-08-13 to 2026-09-12"), not a block range. Use the real dates from `bundle.payload.observationWindow`. |
| "Batch" and "Spec" nav items | Don't exist. App One has one flow: input → analyze → Passport. Do not add navigation to features that were never built. |
| "SPEC v1.0.4 · ATTESTATION SUITE," "EXEC_CYCLE #0491-A," "COMPLIANCE SUITE: DETERMINISTIC" | Meaningless invented version/build labels. Remove entirely — this is exactly the kind of jargon-as-decoration that M7 already removed once; don't let it back in through a different door. |

If you're ever unsure whether a piece of Stitch's copy describes something real, **assume it
doesn't and check `STATUS.md`/the actual code before using it.** When in doubt, keep M7/M8's
existing, reviewer-verified copy and only change its visual presentation.

## Task 1 — extract the design system as reusable tokens

From the Stitch mockup's Tailwind config, pull the color palette, type scale, spacing scale,
and border-radius scale. Map them onto the app's **existing** CSS variable names in
`apps/passport/app/globals.css` and `apps/consumer/app/globals.css` (both apps must end up
visually consistent with each other — check both files, they currently share the same
variable names):

| Existing variable | New value (from Stitch) |
| --- | --- |
| `--bg` | `#131316` |
| `--surface` | `#1f1f22` |
| `--surface-raised` | `#2a2a2d` |
| `--border` | `#3c4a42` |
| `--border-active` | `#4edea3` |
| `--text` | `#e4e1e6` |
| `--text-muted` | `#bbcabf` |
| `--text-dim` | `#86948a` |
| `--accent` | `#4edea3` |
| `--accent-hover` | `#6ffbbe` |
| `--success` | `#10b981` |
| `--success-text` | `#4edea3` |
| `--warning` | `#ffb95f` |
| `--danger` | `#ffb4ab` |
| `--danger-bg` | `rgba(255, 180, 171, 0.1)` |
| `--font-mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace` |

Add one new variable, `--font-sans`, set to `'Hanken Grotesk', -apple-system, BlinkMacSystemFont,
"Segoe UI", Roboto, sans-serif`, and apply it to `body` in place of the current system-font
stack. Load both Google Fonts (Hanken Grotesk, JetBrains Mono) via the same `<link>` pattern
Stitch used, added to each app's `layout.tsx`.

Standardize border-radius: cards/sections at `0.5rem` (`lg`), buttons/inputs at `0.25rem`
(`DEFAULT`), badges/pills at full round — matching Stitch's scale.

Verify the result is still readable/accessible: check text/background contrast for the new
palette (particularly `--text-dim` on `--bg`, and `--success-text`/`--warning`/`--danger` on
their respective backgrounds) — Stitch's palette was generated for a different layout and may
need minor contrast adjustment; don't sacrifice legibility for aesthetics.

## Task 2 — apply the new visual system to the real page structure

Restyle `apps/passport/app/page.tsx` and `apps/consumer/app/page.tsx` using the new tokens and
Stitch's card/section layout ideas (the header status bar, the sectioned card rhythm, the
sidebar-style technical metadata panel) — but every string of content stays exactly what M7/M8
already established and verified, just re-themed. Concretely:

- Header: keep the real name, the real one-line purpose statement, the real
  "Blockscout REST v2 Live" status badge — restyle their appearance, don't rewrite their words.
- The "why this exists" paragraph, the "factual record, not a verdict" box, the three metric
  cards with their honest arithmetic context lines, the evidence table, the independent-
  verifiability sentence, the technical details section — all stay as M8 left them, restyled
  only.
- You may adopt Stitch's idea of a persistent top status strip (e.g. showing the live
  Blockscout connection state) **if** every value in it is real — no fake block numbers, no
  fake latency, no fake IP. If you can't populate a piece of Stitch's layout with something
  real, drop that piece rather than inventing a value to fill it.
- Apply the same treatment to `apps/consumer` for visual consistency between the two apps.

## Task 3 — verify nothing fictional survived

- Grep your own diff for: `Ed25519`, `EIP-712`, `Merkle`, `attestation` (as a signature concept,
  not as a general English word if you happen to use it elsewhere), `RPC` (should not appear —
  this system talks to a REST API, not raw RPC), `archive node`, any IP-address-shaped string,
  any invented version/build label ("SPEC v", "EXEC_CYCLE", "COMPLIANCE SUITE"), and any block
  range standing in for the real UTC window. All of these should return zero matches in your
  changes.
- Confirm every number displayed traces to a real value in `bundle.payload` — same standard as
  M8.

## Verify

- Full test suite, real output — unchanged in count, since no logic changed.
- Rerun the cross-app proof once more, same as every prior presentation milestone: App One
  generates and exports, stops, App Two imports and displays correctly with the new visual
  system, tamper detection still works.
- Byte-cleanliness scan, same as every prior milestone.
- `ledgerlens/` unmodified.

## Acceptance criteria for M9

1. None of the fabricated technical terms from the table above appear anywhere in the diff —
   checked by the reviewer via grep, not by description.
2. Every color/type/spacing token change traces to the mapping table above or a clearly
   justified minor contrast fix — not arbitrary new values.
3. All M7/M8 content (the four narrative-clarity additions, the plain-language framing) is
   still present and unchanged in wording — only its visual presentation changed.
4. Both apps look visually consistent with each other.
5. Full test suite passes unchanged; cross-app proof still passes live.
6. No change to `packages/`, schemas, digest logic, or API contracts — verified by diff.
7. `ledgerlens/` unmodified; no corruption in any file touched.

## How to report back

Same structure as before. Include the exact grep commands you ran for Task 3 and their empty
output, not just a claim that you checked. If you dropped any piece of Stitch's layout because
you couldn't populate it with a real value, say which piece and why.
