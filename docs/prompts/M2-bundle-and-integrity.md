# Antigravity prompt — M2: Passport bundle and integrity

Issued 2026-09-12 by the technical lead, after M1 acceptance. Governing scope:
`Signal-Passport-Weekend-PRD.md`.

---

M1 is accepted. The schemas, adapter, normalization, metrics, dedup, coverage, and their tests
in `packages/schema` and `packages/analysis` are correct and verified — do not modify their
logic in this milestone except where Task 0 below requires it.

## Task 0 — required before anything else: fix the remaining write-path corruption

Two prose files (`docs/METHODOLOGY.md`, `docs/verification/M1.md`) and part of `STATUS.md`'s
M1 section (already rewritten by the reviewer) contain a literal `?` byte (`0x3F`) wherever a
real Unicode character — `§` or `—` — should be. Confirmed at the byte level, not a rendering
issue: e.g. `PRD ?7` should read `PRD §7`. This is a **different** failure mode than M0's BOM/
backtick-escape corruption: this one looks like UTF-8 content passing through a non-UTF-8
codepage at write time (classic `cmd.exe`/legacy-codepage `?` substitution for unmappable
characters).

1. Fix `docs/METHODOLOGY.md` and `docs/verification/M1.md`: restore every `§` and `—` that was
   replaced with `?`. Do not just replace `?` with a plain hyphen or the word "section" — use
   the actual character, and verify it round-trips.
2. Before writing **any** file this milestone — prose or code — confirm your write path
   preserves non-ASCII UTF-8 correctly. Write a throwaway test file containing `§`, `—`, and a
   backtick-adjacent word (e.g. `` `no `` ), read it back, and diff byte-for-byte against what
   you intended. Only proceed once that round-trips clean.
3. Extend whatever check you used in M1 (BOM + control bytes) to also scan for literal `?`
   bytes in prose `.md` files and flag any that look like a replaced non-ASCII character
   (distinguish this from legitimate literal `?` usage, which should be rare in this project's
   docs). Do not apply this scan to `.ts`/`.tsx` files — `?` is normal there (optional chaining,
   optional properties, ternaries); don't waste time chasing false positives.
4. Commit this fix on its own before starting Task 1.

## Context you must load first

- `Signal-Passport-Weekend-PRD.md` §8 (Data contract and integrity) governs this milestone.
  Read it fully, including the exact minimum bundle structure and hashing rules, before writing
  any code.
- `signal-passport/STATUS.md` — read the M1 review log entry in full, especially the **known
  design gap**: `claimSchema.evidenceIds` is currently unconditionally non-empty (`.min(1)`),
  which will throw on a genuinely empty Passport (zero qualifying transactions). PRD §9 requires
  a valid empty Passport to be possible. You do not have to build the empty-Passport *flow* this
  milestone (that's M4), but your bundle schema and hashing design must not make the eventual
  fix structurally awkward — see Task 2.
- `ledgerlens/` remains **read-only**.

## This milestone is M2 only

Scope: `packages/schema`'s bundle envelope, `packages/verification`'s canonical serialization
and SHA-256 hashing. **Out of scope:** either UI app, the AI explanation, Monad, a database. If
you find yourself building a React component or an Express/Next.js route, stop — that's M3.

## Task 1 — canonical JSON serialization (`packages/verification`)

Implement one documented canonical serialization function. Per PRD §8, it must:

- Sort object keys **recursively** (nested objects too, not just the top level).
- Define stable array ordering — arrays are serialized in their given order; do not sort array
  *contents* (that would change meaning for e.g. `evidenceIds` where order may matter for
  claim-to-evidence traceability). State this explicitly in a code comment: keys are sorted,
  array elements are not reordered.
- Represent large chain integers as decimal strings, not JSON numbers (chain IDs, block
  numbers, and any wei-scale value must not silently become a JS floating-point number if they
  pass through this path — check whether your schema already stores them as strings from M1, and
  if metric values are JS `number`, confirm they never reach a magnitude where this matters, or
  convert them too).
- Reject ambiguous/non-finite numeric values: `NaN`, `Infinity`, `-Infinity`, and `-0` should
  either be rejected outright (throw) or normalized deterministically — pick one, document
  which, and test it.
- Produce byte-identical output for the same logical payload regardless of key insertion order
  in the source object.

Write tests: two objects with the same keys inserted in different orders serialize identically;
a nested object's keys are sorted at every level; an array's element order is preserved even
though object keys inside those elements are sorted; a payload containing `NaN`/`Infinity`
is handled per your documented policy; a large integer round-trips as a decimal string, not
scientific notation or a truncated float.

## Task 2 — the bundle envelope (`packages/schema`)

Define the bundle type per PRD §8's minimum structure:

- `schema_version`
- `payload`: Passport ID, subject wallet, source chain ID, snapshot version, generation
  timestamp, observation window, source/coverage metadata, metrics/claims (from M1's `Claim[]`),
  evidence records (from M1's `EvidenceRecord[]`), methodology version.
- `integrity`: hash algorithm name and the payload digest.
- `publication`: optional, absent in P0 — type it as optional/undefined, do not populate it.

Design `payload.metrics`/`claims` so that an empty array is structurally valid at the schema
level even though `Claim.evidenceIds` itself stays non-empty per claim (a claim that exists
still needs evidence; the fix for the zero-activity case is "produce zero claims when there are
zero qualifying transactions," not "produce a claim with no evidence" — confirm this is
possible with your current M1 types without changing `claimSchema`, and say so explicitly in
your report; if it requires a change to M1 types, make the minimal change and flag it clearly
as touching M1-accepted code, with the reason).

## Task 3 — SHA-256 payload digest

- Hash **only** `payload`, run through your Task 1 canonical serializer first. Do not include
  `integrity` itself, `schema_version`, or `publication` in the hash input — PRD §8 is explicit:
  "do not include its own digest, mutable transport fields, or later registry transaction
  metadata in the hash input."
- Use SHA-256. Store the digest as a hex string in `integrity`, alongside the algorithm name.

Write tests, and this is the most important set in the milestone:

1. **Cross-process determinism**: construct the same logical payload in two genuinely separate
   Node processes (not just two calls in the same test file — actually spawn a second process,
   e.g. via `node:child_process`, or write the payload to disk and reload it in a fresh script)
   and confirm both produce byte-identical canonical bytes and the identical digest. A single
   in-process comparison does not prove this; PRD §8 requires it to hold "in a separate
   process."
2. **Tamper detection**: take a valid bundle, mutate one field inside `payload` only (leave
   `integrity.digest` untouched), recompute the digest, and assert it no longer matches the
   stored one.
3. **Tamper-and-rehash is not authentication**: take a valid bundle, mutate `payload`, then
   recompute and overwrite `integrity.digest` to match. Assert that this bundle passes a
   structural integrity check — and add a test or explicit code comment confirming this is
   expected and *why*: a bundled digest detects accidental modification, not authenticity. This
   is PRD §8's explicit warning; make sure your own test suite doesn't accidentally treat
   "digest matches" as "trustworthy."
4. **Non-finite rejection**: a payload containing `NaN`/`Infinity` in a numeric field fails
   before producing a digest, per whatever policy you documented in Task 1.
5. **New-timestamp-new-hash**: two payloads identical except for `generationTimestamp` produce
   different digests — confirm you are not accidentally excluding the timestamp from the hash
   input in a way that would let two different generations collide.

## Task 4 — wire it together, still no UI

Write one small integration test that takes M1's real fixture pipeline output (the actual
`Claim[]`/`EvidenceRecord[]` from `fixtures/real/`, not synthetic data) and produces one
complete, valid bundle: canonicalized, hashed, schema-validated. Save the resulting bundle JSON
under `fixtures/real/` (a new file, don't overwrite the raw response fixtures) so it exists as a
concrete artifact for M3's App One/App Two work to import.

## Acceptance criteria for M2

Checked against actual code and test output, not your summary:

1. Task 0 is complete and verified: no `?`-substitution corruption remains in any prose file,
   and your write path has been proven to round-trip `§`/`—`/backticks correctly.
2. Canonical serialization is deterministic regardless of source key order, sorts keys
   recursively, preserves array element order, and has a documented, tested non-finite-number
   policy.
3. The digest covers `payload` only, verified by a test that changing `integrity`,
   `schema_version`, or `publication` does not change the digest, and that changing anything
   inside `payload` does.
4. Cross-process digest determinism is proven by an actual separate-process test, not an
   in-process comparison presented as if it were one.
5. Payload-only tampering is caught; tamper-and-rehash is proven to "pass" and is explicitly
   documented as not authentication, per PRD §8.
6. `npm test` passes, real output pasted.
7. Nothing out of scope was built.
8. `ledgerlens/` is still unmodified.
9. A real bundle exists in `fixtures/real/`, built from M1's real fixture data, not synthetic
   data, ready for M3.

## How to report back

Same structure as M0/M1: what you built and how you verified it, with special attention to how
you proved cross-process digest determinism (show the actual mechanism, not just "it passed");
each acceptance criterion with pass/fail and its evidence line; real test output; commit list;
elapsed time; anything incomplete. If Task 2's empty-claims question required touching M1's
`claimSchema`, say exactly what changed and why, separately from the rest of the report.
