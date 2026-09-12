import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAndDeduplicateBlockscoutItems } from "../packages/analysis/src/normalize.js";
import { computeDeterministicMetrics } from "../packages/analysis/src/metrics.js";
import { evaluateCoverage } from "../packages/analysis/src/coverage.js";
import type { ObservationScope } from "@signal-passport/schema";

test("real fixture pipeline matches hand-checked values and verifies evidence integrity", () => {
  const page1 = JSON.parse(readFileSync("fixtures/real/page-1.json", "utf8"));
  const page2 = JSON.parse(readFileSync("fixtures/real/page-2.json", "utf8"));
  const meta = JSON.parse(readFileSync("fixtures/real/metadata.json", "utf8"));

  assert.equal(page1.items.length, 50, "Page 1 must contain 50 raw items");
  assert.equal(page2.items.length, 50, "Page 2 must contain 50 raw items");

  const combinedItems = [...page1.items, ...page2.items];
  assert.equal(combinedItems.length, 100, "Combined fixture must contain 100 raw items");

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

  const { qualifyingEvidence, totalEvaluated, qualifyingCount, duplicateCount } =
    normalizeAndDeduplicateBlockscoutItems(combinedItems, {
      subjectAddress: scope.subjectAddress,
      chainId: scope.chainId,
      window: scope.window
    });

  assert.equal(totalEvaluated, 100);
  assert.equal(qualifyingCount, 28, "Exactly 28 qualifying transactions in the 30-day window");
  assert.equal(duplicateCount, 0, "No duplicate transactions exist in the real dataset");
  assert.equal(qualifyingEvidence.length, 28);

  const { claims, metrics, evidenceMap, activeDaysDates, uniqueRecipientAddresses } =
    computeDeterministicMetrics(qualifyingEvidence, scope);

  // 1. Observed transaction count matches hand-checked value: 28
  assert.equal(metrics.observedTransactionCount, 28);
  const txClaim = claims.find(c => c.metricType === "observed_transaction_count");
  assert.ok(txClaim);
  assert.equal(txClaim.value, 28);
  assert.equal(txClaim.units, "transactions");

  // 2. Active days matches hand-checked value: 12
  assert.equal(metrics.activeDays, 12);
  const activeDaysClaim = claims.find(c => c.metricType === "active_days");
  assert.ok(activeDaysClaim);
  assert.equal(activeDaysClaim.value, 12);
  assert.equal(activeDaysClaim.units, "days");
  assert.deepEqual(activeDaysDates, [
    "2026-08-18",
    "2026-08-20",
    "2026-08-21",
    "2026-08-24",
    "2026-08-25",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-05",
    "2026-09-07",
    "2026-09-09",
    "2026-09-12"
  ]);

  // 3. Unique recipients matches hand-checked value: 10
  assert.equal(metrics.uniqueRecipients, 10);
  const recipientClaim = claims.find(c => c.metricType === "unique_recipients");
  assert.ok(recipientClaim);
  assert.equal(recipientClaim.value, 10);
  assert.equal(recipientClaim.units, "addresses");
  assert.deepEqual(uniqueRecipientAddresses, [
    "0x0439e60f02a8900a951603950d8d4527f400c3f1",
    "0x111111111117dc0aa78b770fa6a738034120c302",
    "0x50327c6c5a14dcade707abad2e27eb517df87ab5",
    "0x66a3c2fa3e467aa586e90912f977e648589cabaf",
    "0x675bbc7514013e2073db7a919f6e4cbef576de37",
    "0x6bcccec90dfdcafb8da3f79c46f1023fccd2d423",
    "0x881d40237659c251811cec9c364ef91dc08d300c",
    "0xa0dd6dd7775e93eb842db0aa142c9c581031ed3b",
    "0xaca92e438df0b2401ff60da7e4337b687a2435da",
    "0xc82f8b79cd34bd98b1abec72475f2a73eb15cfa8"
  ]);

  // Acceptance Criterion 7: Every claim's evidence IDs MUST resolve within evidenceMap
  for (const claim of claims) {
    assert.ok(claim.evidenceIds.length > 0, `Claim ${claim.claimId} evidenceIds must not be empty`);
    for (const evidenceId of claim.evidenceIds) {
      assert.ok(
        evidenceMap.has(evidenceId),
        `Dangling reference detected: evidenceId ${evidenceId} cited in claim ${claim.claimId} does not exist in evidenceMap`
      );
    }
  }

  // Coverage evaluation
  const coverage = evaluateCoverage({
    reachedEnd: true,
    hitPageLimit: false,
    pageCount: 2,
    totalRowsRetrieved: 100,
    matchingRowsCount: 28
  });
  assert.equal(coverage.coverageStatus, "complete_for_query");
  assert.equal(coverage.isTruncated, false);
});
