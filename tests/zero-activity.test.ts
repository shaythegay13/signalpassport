import test from "node:test";
import assert from "node:assert/strict";
import type { ObservationScope, PassportPayload } from "@signal-passport/schema";
import { passportBundleSchema } from "@signal-passport/schema";
import { computeDeterministicMetrics } from "../packages/analysis/src/metrics.js";
import { normalizeAndDeduplicateBlockscoutItems } from "../packages/analysis/src/normalize.js";
import { evaluateCoverage } from "../packages/analysis/src/coverage.js";
import { createPassportBundle, verifyBundleIntegrity } from "../packages/verification/src/index.js";
import { validateImportedBundle } from "../apps/consumer/app/lib/validate-bundle.js";

const testSubject = "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8";

const testScope: ObservationScope = {
  subjectAddress: testSubject,
  chainId: 1,
  window: {
    startUtc: "2026-08-13T00:00:00.000Z",
    endUtc: "2026-09-12T16:08:11.000Z"
  },
  direction: "outgoing",
  status: "ok"
};

test("Task 0: computeDeterministicMetrics([], scope) does not throw and returns zero metrics with empty claims", () => {
  // Must not throw when evidence array is empty
  const result = computeDeterministicMetrics([], testScope);

  assert.deepEqual(result.claims, [], "claims array must be strictly empty for zero evidence");
  assert.equal(result.metrics.observedTransactionCount, 0, "observedTransactionCount must be 0");
  assert.equal(result.metrics.activeDays, 0, "activeDays must be 0");
  assert.equal(result.metrics.uniqueRecipients, 0, "uniqueRecipients must be 0");
  assert.equal(result.evidenceMap.size, 0, "evidenceMap must be empty");
  assert.deepEqual(result.activeDaysDates, [], "activeDaysDates must be empty array");
  assert.deepEqual(result.uniqueRecipientAddresses, [], "uniqueRecipientAddresses must be empty array");
});

test("Task 0: full pipeline with zero qualifying activity produces valid, schema-passing, verifiable bundle", () => {
  // 1. Adapter / normalization on empty transaction set (or all out of window)
  const normResult = normalizeAndDeduplicateBlockscoutItems([], {
    subjectAddress: testSubject,
    chainId: testScope.chainId,
    window: testScope.window
  });

  assert.equal(normResult.qualifyingEvidence.length, 0, "qualifying evidence must be 0");
  assert.equal(normResult.totalEvaluated, 0, "total evaluated must be 0");

  // 2. Metrics calculation
  const metricsResult = computeDeterministicMetrics(normResult.qualifyingEvidence, testScope);
  assert.deepEqual(metricsResult.claims, []);
  assert.equal(metricsResult.metrics.observedTransactionCount, 0);
  assert.equal(metricsResult.metrics.activeDays, 0);
  assert.equal(metricsResult.metrics.uniqueRecipients, 0);

  // 3. Bundle creation
  const coverage = evaluateCoverage({
    reachedEnd: true,
    hitPageLimit: false,
    pageCount: 1,
    totalRowsRetrieved: 0,
    matchingRowsCount: 0
  });

  const payload: PassportPayload = {
    passportId: `${testScope.chainId}:${testSubject.toLowerCase()}:1.0.0`,
    subjectAddress: testSubject,
    sourceChainId: testScope.chainId,
    snapshotVersion: "1.0.0",
    generationTimestamp: "2026-09-12T17:00:00.000Z",
    observationWindow: testScope.window,
    coverage,
    claims: metricsResult.claims,
    evidence: normResult.qualifyingEvidence,
    methodologyVersion: "1.0.0"
  };
  const bundle = createPassportBundle(payload, "1.0.0");

  // 4. Validate schema
  const parsed = passportBundleSchema.safeParse(bundle);
  assert.equal(parsed.success, true, "zero-activity bundle must conform to passportBundleSchema");
  assert.equal(bundle.payload.claims.length, 0, "bundle claims must be empty array");
  assert.equal(bundle.payload.evidence.length, 0, "bundle evidence must be empty array");
  assert.equal(bundle.schema_version, "1.0.0");
  assert.equal(bundle.integrity.algorithm, "sha256");
  assert.match(bundle.integrity.digest, /^[0-9a-f]{64}$/);

  // 5. Verify integrity
  const integrityCheck = verifyBundleIntegrity(bundle);
  assert.equal(integrityCheck.isValid, true, "zero-activity bundle payload digest must verify");

  // 6. Consumer validation (App Two)
  const consumerResult = validateImportedBundle(bundle);
  assert.equal(consumerResult.isValid, true, "consumer must accept zero-activity bundle");
  assert.equal(consumerResult.integrityLabel, "Bundle integrity matched");
  assert.equal(consumerResult.publicationLabel, "Not published");
  assert.equal(consumerResult.steps.every(s => s.passed), true, "all 4 consumer validation steps must pass");
});
