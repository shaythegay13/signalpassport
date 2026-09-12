import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { normalizeAndDeduplicateBlockscoutItems } from "../packages/analysis/src/normalize.js";
import { computeDeterministicMetrics } from "../packages/analysis/src/metrics.js";
import { evaluateCoverage } from "../packages/analysis/src/coverage.js";
import {
  passportBundleSchema,
  type ObservationScope,
  type PassportPayload,
  type PassportBundle
} from "@signal-passport/schema";
import {
  createPassportBundle,
  verifyBundleIntegrity,
  computePayloadDigest
} from "@signal-passport/verification";

test("Task 4: generate, validate, and persist real fixture bundle to fixtures/real/passport-bundle.json", () => {
  const page1 = JSON.parse(readFileSync("fixtures/real/page-1.json", "utf8"));
  const page2 = JSON.parse(readFileSync("fixtures/real/page-2.json", "utf8"));
  const meta = JSON.parse(readFileSync("fixtures/real/metadata.json", "utf8"));

  const combinedItems = [...page1.items, ...page2.items];

  const scope: ObservationScope = {
    subjectAddress: meta.subject_address,
    chainId: meta.chain_id,
    window: {
      startUtc: meta.observation_window.start_utc,
      endUtc: meta.observation_window.end_utc
    },
    direction: "outgoing",
    status: "ok"
  };

  // 1. Ingest and normalize real fixture data
  const { qualifyingEvidence } = normalizeAndDeduplicateBlockscoutItems(combinedItems, {
    subjectAddress: scope.subjectAddress,
    chainId: scope.chainId,
    window: scope.window
  });
  assert.equal(qualifyingEvidence.length, 28);

  // 2. Compute deterministic claims and coverage
  const { claims, metrics, evidenceMap } = computeDeterministicMetrics(qualifyingEvidence, scope);
  assert.equal(claims.length, 3);
  assert.equal(metrics.observedTransactionCount, 28);
  assert.equal(metrics.activeDays, 12);
  assert.equal(metrics.uniqueRecipients, 10);

  const coverage = evaluateCoverage({
    reachedEnd: true,
    hitPageLimit: false,
    pageCount: 2,
    totalRowsRetrieved: 100,
    matchingRowsCount: 28
  });
  assert.equal(coverage.coverageStatus, "complete_for_query");

  // 3. Assemble PassportPayload per PRD §8
  const payload: PassportPayload = {
    passportId: `${meta.chain_id}:${meta.subject_address.toLowerCase()}:1.0.0`,
    subjectAddress: meta.subject_address,
    sourceChainId: meta.chain_id,
    snapshotVersion: "1.0.0",
    generationTimestamp: meta.observation_window.end_utc,
    observationWindow: {
      startUtc: meta.observation_window.start_utc,
      endUtc: meta.observation_window.end_utc
    },
    coverage,
    claims,
    evidence: qualifyingEvidence,
    methodologyVersion: "1.0.0"
  };

  // 4. Create PassportBundle envelope and compute SHA-256 payload digest
  const bundle: PassportBundle = createPassportBundle(payload, "1.0.0");

  // 5. Validate schema
  const parsedBundle = passportBundleSchema.parse(bundle);
  assert.equal(parsedBundle.schema_version, "1.0.0");
  assert.equal(parsedBundle.integrity.algorithm, "sha256");

  // 6. Verify integrity
  const verification = verifyBundleIntegrity(bundle);
  assert.equal(verification.isValid, true, "Generated bundle must pass integrity verification");
  assert.equal(verification.actualDigest, bundle.integrity.digest);

  // 7. Save real bundle under fixtures/real/passport-bundle.json
  const bundlePath = path.resolve("fixtures/real/passport-bundle.json");
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + "\n", { encoding: "utf8" });
  assert.ok(existsSync(bundlePath), "fixtures/real/passport-bundle.json must exist");

  // 8. Reload from disk to verify download/reload fidelity with zero field loss
  const reloadedRaw = readFileSync(bundlePath, "utf8");
  const reloadedBundle: PassportBundle = JSON.parse(reloadedRaw);

  const parsedReloaded = passportBundleSchema.parse(reloadedBundle);
  const reloadedVerification = verifyBundleIntegrity(parsedReloaded);

  assert.equal(
    reloadedVerification.isValid,
    true,
    "Reloaded bundle must retain exact payload integrity digest without field loss"
  );
  assert.equal(
    reloadedVerification.actualDigest,
    bundle.integrity.digest,
    "Reloaded bundle digest must match original digest"
  );
  assert.equal(parsedReloaded.payload.claims.length, 3);
  assert.equal(parsedReloaded.payload.evidence.length, 28);

  // 9. Verify every claim's evidence IDs resolve in the reloaded bundle's evidence array
  const reloadedEvidenceIds = new Set(parsedReloaded.payload.evidence.map((e) => e.evidenceId));
  for (const claim of parsedReloaded.payload.claims) {
    assert.ok(claim.evidenceIds.length > 0);
    for (const id of claim.evidenceIds) {
      assert.ok(
        reloadedEvidenceIds.has(id),
        `Dangling reference: claim ${claim.claimId} references ${id} not found in bundle evidence`
      );
    }
  }
});
