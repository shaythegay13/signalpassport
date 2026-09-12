import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAndDeduplicateBlockscoutItems } from "../packages/analysis/src/normalize.js";
import { computeDeterministicMetrics } from "../packages/analysis/src/metrics.js";
import type { ObservationScope } from "@signal-passport/schema";

test("UTC boundary: transactions near midnight UTC count as two distinct active days", () => {
  const fixture = JSON.parse(readFileSync("fixtures/synthetic/utc-boundary-transactions.json", "utf8"));
  assert.equal(fixture.items.length, 2);

  const tx1Time = fixture.items[0].timestamp;
  const tx2Time = fixture.items[1].timestamp;
  assert.equal(tx1Time.slice(0, 10), "2026-08-20");
  assert.equal(tx2Time.slice(0, 10), "2026-08-21");

  const scope: ObservationScope = {
    subjectAddress: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
    chainId: 1,
    window: {
      startUtc: "2026-08-20T00:00:00.000Z",
      endUtc: "2026-08-22T00:00:00.000Z"
    },
    direction: "outgoing",
    status: "ok"
  };

  const { qualifyingEvidence } = normalizeAndDeduplicateBlockscoutItems(fixture.items, {
    subjectAddress: scope.subjectAddress,
    chainId: scope.chainId,
    window: scope.window
  });

  assert.equal(qualifyingEvidence.length, 2);

  const metricsResult = computeDeterministicMetrics(qualifyingEvidence, scope);
  const activeDaysClaim = metricsResult.claims.find(c => c.metricType === "active_days");

  assert.ok(activeDaysClaim);
  assert.equal(activeDaysClaim.value, 2, "23:59:59Z and 00:00:01Z next day must count as 2 distinct active days");
  assert.deepEqual(metricsResult.activeDaysDates, ["2026-08-20", "2026-08-21"]);
});
