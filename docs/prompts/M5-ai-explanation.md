# Antigravity prompt — M5: AI explanation (P0b)

Issued 2026-09-12 by the technical lead. Gate condition met: M0–M4 are all accepted per
`STATUS.md`. Governing scope: `Signal-Passport-Weekend-PRD.md`.

---

This is optional stretch scope (P0b). The gate is met, so it's authorized, but the same rule
applies as everywhere else: **a broken or half-working AI layer must never be able to degrade
what's already accepted.** PRD §4 is explicit — "Failure of a model call must not block the
Passport or export." Treat that as the actual acceptance bar, not a nice-to-have.

## Context you must load first

- `Signal-Passport-Weekend-PRD.md` §10 (AI explanation requirements) governs this milestone
  completely. Read it twice. Every rule in it is a hard constraint, not a suggestion.
- `docs/REUSE.md` already identifies the relevant LedgerLens components: `lib/ai-provider.ts`
  (the provider registry — copy this pattern closely, it's a clean fit) and the **validation
  pipeline shape** in `lib/ai-analysis.ts`'s `validateAiAnalysis` (zod parse → reference-set
  membership check → banned-content regex checks → loud rejection). Reuse the *shape* of that
  pipeline. Do not reuse its content — LedgerLens's banned-phrase list and prompt are about
  financial variance causality; Signal Passport's rules are different (see Task 2).
- `ledgerlens/` remains **read-only**. You need working API keys — `ledgerlens/.env.local` has
  populated `GROQ_API_KEY` and `ANTHROPIC_API_KEY` (confirmed in `STATUS.md`'s environment
  facts). Copy those two key **values** into `signal-passport/.env.local` (create it, already
  gitignored) as a one-time manual step. Signal Passport's code must never read
  `ledgerlens/.env.local` at runtime — this is a one-time copy during your setup, not a
  dependency between the two projects.

## This milestone is M5 only

Scope: one API route that generates a grounded explanation from an existing Passport payload,
validates it, and falls back deterministically on any failure. **Out of scope:** changing any
metric, claim, or evidence logic; ElevenLabs, Tavily, or any other sponsor integration (PRD §10
explicitly excludes these); Monad.

## Task 1 — the model input contract

Per PRD §10: "provide the model only the immutable claim/evidence input." Build a function that
takes a `PassportPayload` (already computed, already sealed — this runs *after* the bundle
exists, never before) and produces a minimal, explicit input object for the model: the three
claims (metric type, value, units, scope), and evidence summarized only as much as needed for
the model to reference it by ID (evidence ID, counterparty address, timestamp — not full raw
records if that's excessive). Do **not** pass the model anything outside the sealed payload: no
raw Blockscout responses, no internal implementation details.

## Task 2 — the system prompt and allowed-claim rules

Per PRD §10, the model:
- **May** describe measured activity in plain language.
- **May not** change metric values, invent causes, add evidence, upgrade coverage, or infer
  human identity.

Write a system prompt that states these rules explicitly (adapt LedgerLens's technique of
repeating the hard constraint at the end of the user-facing prompt too, since that's where
LedgerLens found compliance was most reliable — cite this as the reason if you use it, don't
just copy it silently). Decide and document your own banned-content policy for Signal
Passport — it will differ from LedgerLens's (which bans all digits/currency symbols because
LedgerLens renders every number itself). Your equivalent: the explanation must not contain any
number that isn't already one of the three claim values verbatim, must not name a coverage
status other than the one actually present, must not claim wallet ownership/identity/control,
and must not describe a cause for the observed activity (PRD's "invent causes" — adapt, don't
copy, LedgerLens's causal-phrase ban if you use a similar mechanism).

## Task 3 — structured output and validation

- Request structured output (a small schema: e.g. a short prose explanation plus the evidence
  IDs it references, similar in *shape* to LedgerLens's `aiAnalysisSchema` but with your own
  fields matching Signal Passport's claim/evidence model).
- Validate before display, in this order: (a) schema parse; (b) every evidence ID referenced
  actually exists in the payload's evidence set — reject on any dangling reference; (c) no
  invented numbers — every number in the text must exactly match a real claim value; (d) no
  coverage-status upgrade — if the payload's coverage is `partial`, the explanation must not
  describe the data as complete; (e) no identity/ownership claims.
- On any validation failure, **do not retry silently and show a possibly-still-wrong result** —
  either repair once with the specific rejection reason fed back (LedgerLens's pattern), or fall
  straight to Task 4's deterministic fallback. Your choice; document which and why.

## Task 4 — deterministic fallback

A model call can fail (no key, rate limit, network error, validation failure after retry) and
Passport generation/export must be unaffected. Build a deterministic, template-based summary
generated entirely from the claims/coverage — no model call — that is used whenever the AI path
doesn't produce a validated result. This is not a lesser feature to skip if time is short: PRD §4
explicitly requires "Preserve a deterministic explanation fallback," and PRD §14 requires
proving optional AI cannot add unsupported numbers or evidence references. The fallback is part
of the acceptance bar, not an afterthought.

## Task 5 — wire it in without touching the sealed payload

- Add the explanation as **display-only**, never part of `payload`. Per PRD §10: "Explanation
  text is a display layer and is excluded from the canonical factual payload for this weekend."
  If you include it in the exported bundle JSON at all, it must be a new top-level field
  sibling to `payload`/`integrity`/`publication` (e.g. `bundle.explanation`), never inside
  `payload` — adding it inside `payload` would change every future digest for a cosmetic text
  field, which is exactly what PRD §8 says the hash must not be sensitive to. If you touch
  `packages/schema/src/bundle.ts` (an M2-accepted file) to add this field, make it additive and
  optional, and flag exactly what changed and why, separately in your report — don't bury it.
  Confirm with a test that adding/omitting `explanation` does not change `computePayloadDigest`.
- App One: a button to generate the explanation after the Passport exists (matching LedgerLens's
  UX pattern — explanation is requested, not automatic, so a failed/slow model call never blocks
  the base flow that already works). Loading and error states, using the fallback on failure —
  never a visible crash, and the deterministic fallback must actually render, not just exist in
  code.
- App Two does **not** need to display this — it's optional and App Two's job is verifying the
  sealed payload, not re-running or displaying an AI layer. If you do show it when present in an
  imported bundle, label it clearly as unverified display text, not part of the integrity check.

## Acceptance criteria for M5

Checked against actual code, actual test output, and — since this involves a real model call —
at least one real request, not only mocked ones:

1. A test proves an explanation containing an invented number (not matching any real claim
   value) is rejected.
2. A test proves an explanation citing a nonexistent evidence ID is rejected.
3. A test proves an explanation that upgrades `partial` coverage to sound complete is rejected
   (or your policy explicitly prevents the model from ever seeing/discussing coverage status at
   all — either is acceptable, document which).
4. A test proves a simulated model failure (thrown error, or a mocked provider like M1's
   provider-error tests) falls back to the deterministic summary without throwing, and Passport
   generation/export succeed unaffected.
5. `computePayloadDigest` is proven unaffected by the presence or absence of the explanation
   field, via a real test — not just an assertion in prose.
6. At least one real request against a real provider (Groq or Anthropic, whichever key you
   copied) is shown in your report with real output, not only mocked test runs.
7. `npm test` passes, real output pasted.
8. Nothing out of scope was built (no ElevenLabs/Tavily/Monad).
9. `ledgerlens/` still unmodified.
10. No BOM, control-byte, or `?`-substitution corruption in any file you write.

## How to report back

Same structure as before. Be explicit about which validation-failure policy you chose (repair
attempt vs. straight-to-fallback) and why. If you touched `packages/schema/src/bundle.ts`, give
that its own clearly separated section explaining exactly what changed. Show the real model
request/response, not just the test suite's mocked cases.
