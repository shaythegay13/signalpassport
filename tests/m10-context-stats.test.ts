import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { PassportPayload, PassportBundle } from "@signal-passport/schema";
import {
  computeContextStats,
  createModelInput,
  validateAiExplanation,
  generateDeterministicExplanation
} from "../packages/analysis/src/ai/index.js";

// Load real fixture bundle
const fixturePath = path.resolve(process.cwd(), "fixtures/real/passport-bundle.json");
const realBundle: PassportBundle = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const realPayload = realBundle.payload;

test("M10 Test 1: Hand-checked correctness against real fixture", () => {
  // Hand-check method:
  // 1. generationTimestamp is 2026-09-12T16:08:11.000000Z (1789229291000 ms)
  // 2. Latest evidence timestamp is transaction 1:0xfa528e0a... at 2026-09-12T16:08:11.000Z (1789229291000 ms)
  // 3. Difference = 0 ms -> daysSinceLastActivity = Math.max(0, Math.round(0 / 86400000)) = 0 days.
  // 4. Grouping 28 qualifying transactions by recipient:
  //    - 0x0439e60F02a8900a951603950d8D4527f400C3f1: 11 txs
  //    - 0x881D40237659C251811CEC9c364ef91dC08D300C: 8 txs
  //    - 0x111111111117dC0aa78b770fA6A738034120C302: 2 txs
  //    - 7 other recipients: 1 tx each
  //    Total unique recipients = 10. Max recipient has 11 txs.
  //    -> maxRecipientTxCount = 11, totalQualifyingTxCount = 28.

  const stats = computeContextStats(realPayload);

  assert.equal(stats.daysSinceLastActivity, 0, "Hand-checked daysSinceLastActivity must be 0");
  assert.notEqual(stats.recipientConcentration, null, "Must detect recipient concentration");
  assert.equal(stats.recipientConcentration?.maxRecipientTxCount, 11, "Hand-checked maxRecipientTxCount must be 11");
  assert.equal(stats.recipientConcentration?.totalQualifyingTxCount, 28, "Hand-checked totalQualifyingTxCount must be 28");
  assert.equal(
    stats.recipientConcentration?.recipientAddress?.toLowerCase(),
    "0x0439e60F02a8900a951603950d8D4527f400C3f1".toLowerCase(),
    "Top recipient must match hand-checked address"
  );
});

test("M10 Test 2: Divergence-proofing between input.ts and validation.ts", () => {
  // Prove that createModelInput and validateAiExplanation both derive context stats
  // from the exact same shared pure function computeContextStats
  const input = createModelInput(realPayload);
  const directStats = computeContextStats(realPayload);

  assert.deepEqual(
    input.contextStats,
    directStats,
    "ModelInput.contextStats must be strictly identical to computeContextStats(payload)"
  );

  // A summary referencing the exact numbers from computeContextStats validates cleanly
  const validOutput = {
    summary: `Observed 28 transactions across 12 active days to 10 recipients during the window (2026-08-13 to 2026-09-12). The most recent transaction occurred 0 days prior to generation, and 11 of 28 transactions went to a single recipient.`,
    evidenceIds: ["1:0xfa528e0a3f8eafb1adcbec940bd5897d2269b63fd02fbc53c0b3cd105f30c283"]
  };

  const validation = validateAiExplanation(validOutput, input, realPayload, "test-model");
  assert.equal(validation.valid, true, `Expected valid explanation but got: ${!validation.valid ? (validation as any).error : ""}`);

  // Tampering with the number (e.g. claiming 15 transactions went to a single recipient) is rejected by validator
  const tamperedOutput = {
    summary: `Observed 28 transactions across 12 active days to 10 recipients during the window (2026-08-13 to 2026-09-12). Exactly 15 of 28 transactions went to a single recipient.`,
    evidenceIds: ["1:0xfa528e0a3f8eafb1adcbec940bd5897d2269b63fd02fbc53c0b3cd105f30c283"]
  };
  const tamperedVal = validateAiExplanation(tamperedOutput, input, realPayload, "test-model");
  assert.equal(tamperedVal.valid, false, "Invented concentration number must be rejected");
  assert.match(tamperedVal.error, /unverified numerical claim "15"/i);
});

test("M10 Test 3: Evaluative-language rejection (distinct from causal words)", () => {
  const input = createModelInput(realPayload);

  // Case 3a: "suggests"
  const suggestsOutput = {
    summary: "Observed 28 transactions to 10 recipients. The 11 of 28 concentration suggests high centralization.",
    evidenceIds: ["1:0xfa528e0a3f8eafb1adcbec940bd5897d2269b63fd02fbc53c0b3cd105f30c283"]
  };
  const resSuggests = validateAiExplanation(suggestsOutput, input, realPayload, "test-model");
  assert.equal(resSuggests.valid, false);
  assert.match(resSuggests.error, /evaluative or inferential claims \("suggests"\)/i);

  // Case 3b: "likely"
  const likelyOutput = {
    summary: "The wallet completed 28 transactions, which is likely a bot or automated service.",
    evidenceIds: ["1:0xfa528e0a3f8eafb1adcbec940bd5897d2269b63fd02fbc53c0b3cd105f30c283"]
  };
  const resLikely = validateAiExplanation(likelyOutput, input, realPayload, "test-model");
  assert.equal(resLikely.valid, false);
  assert.match(resLikely.error, /evaluative or inferential claims \("likely"\)/i);

  // Case 3c: "indicates"
  const indicatesOutput = {
    summary: "Recent activity 0 days ago indicates an active active user.",
    evidenceIds: ["1:0xfa528e0a3f8eafb1adcbec940bd5897d2269b63fd02fbc53c0b3cd105f30c283"]
  };
  const resIndicates = validateAiExplanation(indicatesOutput, input, realPayload, "test-model");
  assert.equal(resIndicates.valid, false);
  assert.match(resIndicates.error, /evaluative or inferential claims \("indicates"\)/i);

  // Case 3d: "implies"
  const impliesOutput = {
    summary: "The 11 of 28 distribution implies routine payroll transfers.",
    evidenceIds: ["1:0xfa528e0a3f8eafb1adcbec940bd5897d2269b63fd02fbc53c0b3cd105f30c283"]
  };
  const resImplies = validateAiExplanation(impliesOutput, input, realPayload, "test-model");
  assert.equal(resImplies.valid, false);
  assert.match(resImplies.error, /evaluative or inferential claims \("implies"\)/i);
});

test("M10 Test 4: Zero-recipient-concentration edge case (every recipient received exactly one transaction)", () => {
  const uniformPayload: PassportPayload = {
    ...realPayload,
    claims: [
      {
        claimId: "c1",
        metricType: "observed_transaction_count",
        value: 3,
        units: "transactions",
        evidenceIds: ["ev-1", "ev-2", "ev-3"],
        calculationVersion: "1.0.0",
        declaredObservationScope: realPayload.claims[0].declaredObservationScope
      },
      {
        claimId: "c2",
        metricType: "active_days",
        value: 2,
        units: "days",
        evidenceIds: ["ev-1", "ev-2", "ev-3"],
        calculationVersion: "1.0.0",
        declaredObservationScope: realPayload.claims[0].declaredObservationScope
      },
      {
        claimId: "c3",
        metricType: "unique_recipients",
        value: 3,
        units: "addresses",
        evidenceIds: ["ev-1", "ev-2", "ev-3"],
        calculationVersion: "1.0.0",
        declaredObservationScope: realPayload.claims[0].declaredObservationScope
      }
    ],
    evidence: [
      {
        evidenceId: "ev-1",
        chainId: 1,
        transactionHash: "0x1111",
        logIndex: null,
        timestamp: "2026-09-10T12:00:00.000Z",
        sender: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
        recipient: "0xAAAA000000000000000000000000000000000001",
        status: "ok",
        provider: "Blockscout",
        sourceReference: "https://eth.blockscout.com/tx/0x1111"
      },
      {
        evidenceId: "ev-2",
        chainId: 1,
        transactionHash: "0x2222",
        logIndex: null,
        timestamp: "2026-09-11T12:00:00.000Z",
        sender: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
        recipient: "0xBBBB000000000000000000000000000000000002",
        status: "ok",
        provider: "Blockscout",
        sourceReference: "https://eth.blockscout.com/tx/0x2222"
      },
      {
        evidenceId: "ev-3",
        chainId: 1,
        transactionHash: "0x3333",
        logIndex: null,
        timestamp: "2026-09-12T12:00:00.000Z",
        sender: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
        recipient: "0xCCCC000000000000000000000000000000000003",
        status: "ok",
        provider: "Blockscout",
        sourceReference: "https://eth.blockscout.com/tx/0x3333"
      }
    ]
  };

  const stats = computeContextStats(uniformPayload);
  // Max count is 1 for all 3 recipients -> no concentration
  assert.equal(stats.recipientConcentration, null, "When max count is 1, recipientConcentration must be null");

  // Fallback does NOT emit nonsensical "1 of 3 transactions went to a single recipient"
  const fallback = generateDeterministicExplanation(uniformPayload);
  assert.doesNotMatch(fallback.summary, /1 of 3 transactions went to a single recipient/i);

  // Fallback validates cleanly
  const input = createModelInput(uniformPayload);
  const val = validateAiExplanation(fallback, input, uniformPayload, "fallback-model");
  assert.equal(val.valid, true);
});

test("M10 Test 5: Zero-evidence edge case (zero-activity Passport)", () => {
  const zeroPayload: PassportPayload = {
    ...realPayload,
    claims: [],
    evidence: []
  };

  const stats = computeContextStats(zeroPayload);
  assert.equal(stats.daysSinceLastActivity, undefined, "daysSinceLastActivity must be omitted for empty evidence");
  assert.equal(stats.recipientConcentration, null, "recipientConcentration must be null for empty evidence");

  // Fallback does not crash or produce NaN
  const fallback = generateDeterministicExplanation(zeroPayload);
  assert.doesNotMatch(fallback.summary, /NaN/i);
  assert.match(fallback.summary, /Zero qualifying outgoing transactions/i);

  const input = createModelInput(zeroPayload);
  assert.equal(input.contextStats.daysSinceLastActivity, undefined);
  assert.equal(input.contextStats.recipientConcentration, null);

  const val = validateAiExplanation(fallback, input, zeroPayload, "fallback-model");
  assert.equal(val.valid, true);
});
