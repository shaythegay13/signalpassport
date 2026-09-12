# Antigravity prompt — M8: Narrative clarity (what the numbers mean, and don't mean)

Issued 2026-09-12 by the technical lead, after M7 acceptance and a second owner review.
Governing scope: `Signal-Passport-Weekend-PRD.md`.

---

M7 fixed jargon and page structure. The owner looked again and said, plainly: the numbers
still feel meaningless, there's no sense of who this is for or why it matters, the evidence
doesn't feel trustworthy to a non-technical viewer, and — critically — they kept expecting a
verdict (is this wallet good, bad, risky) and found none.

That last one is the trap in this milestone. **The fix is not a score.** PRD §7 explicitly
forbids "expert trader," profitability, or any reputation/trust judgment — the product's whole
design is descriptive facts with evidence, not a verdict. The real fix is: **say that
explicitly**, give the three numbers honest context through arithmetic (not opinion), and
frame why this exists at all. Read PRD §2, §7, and §10 again before starting — this milestone
sits exactly on the line those sections draw, and it is easy to cross it by trying to make the
user happy.

**No change to any calculation, claim, schema, or evidence logic.** Everything you add must be
computed from data already in the payload (the three claim values, the window length) — no new
metrics, no new API calls, no new data sources.

## The four gaps, and what to do about each

### 1. "The numbers feel meaningless on their own"

Add one honest, derived sub-line under each metric card — pure arithmetic on numbers already in
the payload, never a new judgment:

- **Observed Transactions**: add something like "an average of one transaction every
  {windowDays / txCount, rounded to 1 decimal} days" (guard division by zero — if `txCount` is
  0, show nothing extra here, the zero-activity banner already covers it).
- **Active Days**: add "{activeDays} of {windowDays} days in this window ({percentage}%)" —
  computed as `Math.round(activeDays / windowDays * 100)`.
- **Unique Recipients**: add "an average of {(txCount / uniqueRecipients).toFixed(1)}
  transactions per recipient" (guard division by zero the same way).

These are neutral arithmetic facts, not judgments. **Do not use words like** healthy, good,
concerning, risky, suspicious, normal, unusual, active (as a value judgment), or anything that
implies an assessment. If you're unsure whether a word crosses that line, don't use it — write
the number and stop.

### 2. "I don't know what I'm supposed to do with this"

Add one short paragraph above the wallet-address input, before anyone has analyzed anything,
explaining the actual problem this solves. Use language close to this (adapt only as needed for
tone, don't invent new claims):

> Every fintech app that wants to understand a wallet's activity currently has to build its own
> pipeline to fetch and interpret blockchain history — over and over, for every app. Signal
> Passport does that work once: enter a wallet, get a portable record of its verified activity,
> and any other application can check that record for itself, without re-scanning the
> blockchain or taking your word for it.

### 3. "I don't trust/understand where the numbers came from"

Add one sentence near the evidence table (not buried in the technical-details section) making
independent verifiability explicit and concrete for a non-technical reader:

> Every transaction below is public. Click any row to confirm it yourself on Blockscout, a
> public blockchain explorer — you don't have to take Signal Passport's word for any of it.

### 4. "I expected a verdict and there isn't one" — the important one

Add an explicit, visible statement of what this is **not**, placed near the three metric cards
(not hidden in fine print), something close to:

> This is not a credit score, a trust rating, or a risk assessment. It does not identify who
> owns this wallet or say whether it can be trusted — it shows only what actually happened,
> with the evidence to check it yourself.

This has to read as a deliberate design choice, not an apology or a missing feature. Do not
hedge it or make it sound like a limitation you'd fix later — PRD §7 and §9 are explicit that
this product must never produce a reputation/trust/credit judgment; state that as the point,
not as a caveat.

## What NOT to do

- Do not add a score, rating, tier, badge ("Low Risk", "Established Wallet", etc.), or any
  computed value beyond the three existing metrics and their pure arithmetic derivatives above.
- Do not let the AI explanation (M5) start producing verdict-adjacent language either — if you
  touch its prompt at all, re-verify it still passes M5's validator tests (evidence membership,
  no invented numbers, no coverage upgrade, no identity claims) and don't loosen any of those
  checks to accommodate a more "satisfying" summary.
- Do not touch `packages/`, schemas, digest logic, or API contracts. If a derived-stat
  computation belongs in a shared place rather than duplicated in both apps' components, that's
  fine, but it must be pure display-layer arithmetic, not a new claim type or evidence field.

## Verify

- Full test suite, real output — should be unchanged in count, since no logic changed.
- If you touched the AI prompt/validation at all, rerun the M5 AI test suite specifically and
  paste that output, plus one real live model call showing the explanation still reads as
  descriptive, not evaluative.
- Byte-cleanliness scan, same as every prior milestone.
- `ledgerlens/` unmodified.

## Acceptance criteria for M8

1. Each metric card shows one honest, arithmetic-only derived context line; none contains a
   judgment word (spot-checked by the reviewer against the list above).
2. The "why this exists" paragraph appears before analysis, in plain language, without inventing
   claims beyond what's already true of the system.
3. The independent-verifiability sentence appears visibly near the evidence table, not only in
   the technical-details section.
4. The "what this is not" statement is visible near the metrics, reads as an intentional design
   choice, and matches PRD §7/§9's actual constraints — not softened, not apologetic.
5. No new metric, score, badge, or judgment was added anywhere in either app.
6. If the AI prompt was touched, all M5 tests still pass and a real live call is shown.
7. Full test suite passes, real output. `packages/` and API contracts unchanged — verified by
   diff.
8. `ledgerlens/` unmodified; no corruption in any file touched.

## How to report back

Same structure as before. Quote the exact new copy you added for each of the four gaps, in
full, not summarized — the reviewer needs to check the exact wording against the "no judgment
words" rule directly.
