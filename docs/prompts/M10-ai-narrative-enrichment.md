# Antigravity prompt — M10: AI narrative enrichment (recency and recipient concentration)

Issued 2026-09-12 by the technical lead, after the owner reviewed App Two's AI explanation
section and found it added nothing beyond restating the three headline numbers as a sentence.
Governing scope: `Signal-Passport-Weekend-PRD.md`.

---

The owner's ask: the AI narrative should tell the integrating app **something new**, not just
reword the three metric cards. The constraint that makes this hard is real and does not move:
PRD §10 still forbids inventing causes, inferring identity, upgrading coverage, or producing a
verdict. The fix is **not** to loosen the model's freedom — it's to give it two new,
**precomputed, deterministic facts** to describe, the same way the three metrics themselves are
precomputed and just described, not calculated by the model.

**This milestone touches `packages/analysis/src/ai/*` directly — the same code that had two
real bugs found and fixed during M5's review (the date-splitting number validator, and the
missing `unknown`-coverage check). Treat this with M5's level of rigor, not M7/M8/M9's
presentation-only rigor.** Full test suite, hand-checked math, and a real live model call are
all required, not optional.

## Task 0 — update the Anthropic model ID (verified live, do this first)

The reviewer tested both live: `claude-sonnet-4-5-20250929` (current config) still responds,
but it's one generation behind — `claude-sonnet-5` is the current Sonnet release and also
confirmed live via a real API call just now. Update `packages/analysis/src/ai/provider.ts`'s
Anthropic `modelId` to `claude-sonnet-5`.

Do not touch Groq's model (`openai/gpt-oss-120b`) — the reviewer queried Groq's live
`/v1/models` endpoint and confirmed it's still present in Groq's current catalog, not stale.
Leave it as is unless you have your own live evidence it's been deprecated.

Verify your change with one real live Anthropic call (force the provider explicitly, same
technique as M5's fix) showing a real response from `claude-sonnet-5`, not just a claim that
the string was changed. This is the same lesson from M5's round 1 — a plausible-looking model
ID string is not verification; a real response is.

## The two new facts to add — precise definitions

Both must be computed **once**, in a single shared pure function used by *both* the model-input
builder and the validator, so there is no possibility of the two computing different numbers
from the same data (that exact kind of divergence is what caused the M5 date bug). Put this
function in `packages/analysis/src/ai/context-stats.ts` (new file) and import it in both
`input.ts` and `validation.ts`.

1. **Recency**: `daysSinceLastActivity = Math.max(0, Math.round((generationTimestamp -
   latestEvidenceTimestamp) / (1000*60*60*24)))`, where `latestEvidenceTimestamp` is the maximum
   `timestamp` across `payload.evidence`. If `payload.evidence` is empty (zero-activity
   Passport), this stat does not apply — omit it, don't compute a nonsensical value.
2. **Recipient concentration**: group `payload.evidence` by `recipient` (skip null recipients),
   find the recipient with the most transactions, and express as
   `{maxRecipientTxCount} of {totalQualifyingTxCount} transactions went to a single recipient`.
   If there are zero or one unique recipients among qualifying transactions, or if the max count
   equals 1 (every recipient received exactly one transaction — no concentration at all), treat
   this as "no concentration" and either omit the stat or state it plainly as "each recipient
   received one transaction" — do not force a sentence that implies significance where none
   exists.

Both values must be plain numbers/counts — no percentages framed as significance judgments, no
words like "concentrated", "frequent", "heavy", "notable", "recurring", or "significant". State
the count and let the reader decide what it means. This is the same discipline as M8's
arithmetic context lines — describe, don't editorialize.

## Update the model input (`packages/analysis/src/ai/input.ts`)

Add a `contextStats` object to `ModelInput` containing the two computed values (or their
absence, per the guards above). Update `types.ts`'s `ModelInput` type accordingly.

## Update the system prompt and user prompt (`packages/analysis/src/ai/prompt.ts`)

- Explicitly tell the model it may now describe `contextStats.daysSinceLastActivity` and
  `contextStats.recipientConcentration` (or your equivalent field names) **in addition to** the
  three metrics, using the exact same "no causal words, no invented numbers beyond what's given,
  no identity claims" constraints already in place.
- Update rule 3 ("DO NOT INVENT NUMBERS") to say numbers must come from the claims **or the
  supplied context stats** — not "claims verbatim" as it currently says, which would otherwise
  make the new stats themselves count as invented.
- Add an explicit instruction: describe these two facts neutrally: state what was observed
  (recency, concentration), never what it implies about trust, risk, or intent. If tempted to
  write words like "this suggests," "this indicates," "this may mean" — don't; that's exactly
  the causal-inference line PRD §10 draws.

## Update the validator (`packages/analysis/src/ai/validation.ts`)

- Extend the `allowedNumbers` set to include the two new context-stat values (via the shared
  function from `context-stats.ts` — do not recompute them separately here, import the same
  function used by `input.ts`).
- Add a check for evaluative language creeping in via the new stats: reject if the summary
  contains "suggests", "indicates", "implies", "means that", "likely", "probably" — these are
  inference words distinct from the already-banned causal words, and this feature is exactly
  where a model might reach for them to explain *why* recency/concentration matters. Add this
  as its own validation step, separate from the existing causal-word check, so the two are
  independently testable.
- Every existing M5 validator behavior (evidence membership, coverage-upgrade check for both
  `partial` and `unknown`, identity-claim rejection, the corrected date-substring handling) must
  remain unchanged and must still pass all its existing tests unmodified.

## Update the deterministic fallback (`packages/analysis/src/ai/fallback.ts`)

The fallback should be enriched too, using the same shared `context-stats.ts` function, so a
model failure doesn't silently produce a less useful result than before. Template sentence
along these lines (adapt to fit the existing fallback's style): append one clause describing
recency and one describing recipient concentration, using the exact same neutral, non-inferring
language rules as above. This is pure string templating from already-computed numbers — no risk
here, but it must use the *same* shared function, not a third independent calculation.

## Tests required

1. **Hand-checked correctness**: compute both new stats by hand against the real fixture
   (`fixtures/real/live-exported-passport.json` or `passport-bundle.json`) independently of your
   own code, and add a test asserting the shared function produces those exact values. Show your
   hand-check method in the report, the same standard as M1.
2. **Divergence-proofing**: a test proving `input.ts` and `validation.ts` both derive from the
   same function (e.g., assert they produce identical numbers for the same payload — this is
   easy to prove by construction if you actually share the function, so this test mostly guards
   against someone accidentally duplicating the logic later).
3. **Evaluative-language rejection**: a test proving a summary containing "suggests," "likely,"
   or "indicates" attached to the new stats is rejected, distinct from the existing causal-word
   test.
4. **Zero-recipient-concentration edge case**: a test proving the validator/fallback handle the
   "every recipient received exactly one transaction" case without a nonsensical sentence.
5. **Zero-evidence edge case**: a test proving a zero-activity Passport doesn't try to compute
   `daysSinceLastActivity` against an empty evidence array (no crash, no NaN, stat omitted).
6. All existing M5 tests still pass unmodified — paste the full real `npm test` output, not a
   filtered subset.

## Real live verification required

- At least one real request against a live provider (Groq, using the shared context-stats
  function) showing the model actually incorporating both new facts into its summary in neutral
  language — paste the real request/response, not a mocked test case.
- Confirm the enriched explanation displays correctly in both App One's and App Two's existing
  AI-section UI (no new UI components required for this milestone — the existing card just
  shows richer text now).

## What NOT to do

- No new data source, no new field beyond what's already in `EvidenceRecord`/`PassportPayload` —
  everything must derive from data already in the sealed bundle.
- No verdict, score, or trust/risk language — same standing rule as always.
- No change to `packages/schema`'s bundle envelope, canonical serialization, or digest logic.
- No UI restructuring — this is a content-quality milestone, not another presentation pass.

## Acceptance criteria

1. Anthropic model ID updated to `claude-sonnet-5`, verified with a real live call, not just a
   string change. Groq's model left untouched.
2. Both new context stats are computed by one shared function, used identically by the input
   builder, the validator, and the fallback — verified by the reviewer reading the code, not
   just the report's claim.
3. Hand-checked values match a real fixture, shown with method.
3. A real live model call demonstrates the richer narrative, in neutral (non-evaluative)
   language.
4. Evaluative-language rejection test passes, distinct from the existing causal-word test.
5. Zero-recipient-concentration and zero-evidence edge cases handled without crash or
   nonsensical output.
6. All prior M5 tests pass unmodified. Full suite output pasted, not filtered.
7. No change to `packages/schema`, canonical serialization, digest logic, or UI structure.
8. `ledgerlens/` unmodified; no corruption in any file touched.

## How to report back

Same structure and rigor as M5's report. Show the shared function's code, the hand-check
method and result, the real live model call output, and the full test suite output.
