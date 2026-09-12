import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAndDeduplicateBlockscoutItems } from "../packages/analysis/src/normalize.js";
import { computeDeterministicMetrics } from "../packages/analysis/src/metrics.js";
import type { ObservationScope } from "@signal-passport/schema";

test("deduplication: synthetic duplicate records do not inflate transaction count", () => {
  const fixture = JSON.parse(readFileSync("fixtures/synthetic/duplicate-transactions.json", "utf8"));
  assert.equal(fixture.items.length, 2, "Synthetic fixture should contain 2 raw items");
  assert.equal(fixture.items[0].hash, fixture.items[1].hash, "Both items must share identical hash");

  const scope: ObservationScope = {
    subjectAddress: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
    chainId: 1,
    window: {
      startUtc: "2026-08-01T00:00:00.000Z",
      endUtc: "2026-08-31T23:59:59.000Z"
    },
    direction: "outgoing",
    status: "ok"
  };

  const normalizationResult = normalizeAndDeduplicateBlockscoutItems(fixture.items, {
    subjectAddress: scope.subjectAddress,
    chainId: scope.chainId,
    window: scope.window
  });

  assert.equal(normalizationResult.qualifyingCount, 2, "Both items should initially qualify");
  assert.equal(normalizationResult.duplicateCount, 1, "Exactly 1 duplicate should be detected");
  assert.equal(normalizationResult.dedupedCount, 1, "Deduplicated count must equal 1");
  assert.equal(normalizationResult.qualifyingEvidence.length, 1);

  const metricsResult = computeDeterministicMetrics(normalizationResult.qualifyingEvidence, scope);
  const txClaim = metricsResult.claims.find(c => c.metricType === "observed_transaction_count");
  assert.ok(txClaim);
  assert.equal(txClaim.value, 1, "Observed transaction count must be 1, proving deduplication prevents inflation");
});
