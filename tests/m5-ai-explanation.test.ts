import test from "node:test";
import assert from "node:assert/strict";
import type { PassportPayload, PassportBundle } from "@signal-passport/schema";
import {
  createModelInput,
  validateAiExplanation,
  generateDeterministicExplanation,
  generateExplanation
} from "../packages/analysis/src/ai/index.js";
import { computePayloadDigest, createPassportBundle } from "../packages/verification/src/index.js";

// Sample fixture payload for testing
const testPayload: PassportPayload = {
  passportId: "1:0xc82f8b79cd34bd98b1abec72475f2a73eb15cfa8:1.0.0",
  subjectAddress: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
  sourceChainId: 1,
  snapshotVersion: "1.0.0",
  generationTimestamp: "2026-09-12T16:08:11.000Z",
  observationWindow: {
    startUtc: "2026-08-13T00:00:00.000Z",
    endUtc: "2026-09-12T16:08:11.000Z"
  },
  coverage: {
    coverageStatus: "complete_for_query",
    pageCount: 2,
    isTruncated: false,
    totalRowsRetrieved: 100,
    matchingRowsCount: 28
  },
  claims: [
    {
      claimId: "claim-observed-tx-count-1",
      metricType: "observed_transaction_count",
      value: 28,
      units: "transactions",
      evidenceIds: ["ev-tx-1", "ev-tx-2"],
      calculationVersion: "1.0.0",
      declaredObservationScope: {
        subjectAddress: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
        chainId: 1,
        window: {
          startUtc: "2026-08-13T00:00:00.000Z",
          endUtc: "2026-09-12T16:08:11.000Z"
        },
        direction: "outgoing",
        status: "ok"
      }
    },
    {
      claimId: "claim-active-days-1",
      metricType: "active_days",
      value: 19,
      units: "days",
      evidenceIds: ["ev-tx-1", "ev-tx-2"],
      calculationVersion: "1.0.0",
      declaredObservationScope: {
        subjectAddress: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
        chainId: 1,
        window: {
          startUtc: "2026-08-13T00:00:00.000Z",
          endUtc: "2026-09-12T16:08:11.000Z"
        },
        direction: "outgoing",
        status: "ok"
      }
    },
    {
      claimId: "claim-unique-recipients-1",
      metricType: "unique_recipients",
      value: 16,
      units: "addresses",
      evidenceIds: ["ev-tx-1", "ev-tx-2"],
      calculationVersion: "1.0.0",
      declaredObservationScope: {
        subjectAddress: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
        chainId: 1,
        window: {
          startUtc: "2026-08-13T00:00:00.000Z",
          endUtc: "2026-09-12T16:08:11.000Z"
        },
        direction: "outgoing",
        status: "ok"
      }
    }
  ],
  evidence: [
    {
      evidenceId: "ev-tx-1",
      chainId: 1,
      transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      timestamp: "2026-08-15T12:00:00.000Z",
      sender: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
      recipient: "0x2222222222222222222222222222222222222222",
      status: "ok",
      provider: "blockscout",
      sourceReference: "https://eth.blockscout.com/tx/0x1111111111111111111111111111111111111111111111111111111111111111"
    },
    {
      evidenceId: "ev-tx-2",
      chainId: 1,
      transactionHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
      timestamp: "2026-08-20T14:30:00.000Z",
      sender: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
      recipient: "0x4444444444444444444444444444444444444444",
      status: "ok",
      provider: "blockscout",
      sourceReference: "https://eth.blockscout.com/tx/0x3333333333333333333333333333333333333333333333333333333333333333"
    }
  ],
  methodologyVersion: "1.0.0"
};

const modelInput = createModelInput(testPayload);

test("AC 1: A test proves an explanation containing an invented number is rejected", () => {
  const invalidOutput = {
    summary: "The wallet completed 28 transactions across 19 active days with 16 recipients, generating 5000 dollars in volume.",
    evidenceIds: ["ev-tx-1"]
  };

  const validation = validateAiExplanation(invalidOutput, modelInput, testPayload, "test-model");
  assert.equal(validation.valid, false, "Output with invented number must be rejected");
  assert.match(validation.error, /unverified numerical claim "5000"/i);
});

test("AC 2: A test proves an explanation citing a nonexistent evidence ID is rejected", () => {
  const invalidOutput = {
    summary: "The wallet recorded 28 transactions across 19 active days to 16 recipients.",
    evidenceIds: ["ev-tx-1", "nonexistent-evidence-id-999"]
  };

  const validation = validateAiExplanation(invalidOutput, modelInput, testPayload, "test-model");
  assert.equal(validation.valid, false, "Output with unknown evidence reference must be rejected");
  assert.match(validation.error, /Unknown evidence reference "nonexistent-evidence-id-999"/i);
});

test("AC 3: A test proves an explanation upgrading partial coverage to sound complete is rejected", () => {
  const partialPayload: PassportPayload = {
    ...testPayload,
    coverage: {
      ...testPayload.coverage,
      coverageStatus: "partial",
      isTruncated: true
    }
  };
  const partialInput = createModelInput(partialPayload);

  const invalidOutput = {
    summary: "Observed 28 transactions across 19 active days, reflecting the complete and exhaustive history of the wallet.",
    evidenceIds: ["ev-tx-1"]
  };

  const validation = validateAiExplanation(invalidOutput, partialInput, partialPayload, "test-model");
  assert.equal(validation.valid, false, "Coverage upgrade on partial data must be rejected");
  assert.match(validation.error, /improperly claims complete coverage/i);
});

test("AC 4: A test proves simulated model failure falls back to deterministic summary without throwing", async () => {
  // Call generateExplanation with an unconfigured / broken provider key override
  const result = await generateExplanation(testPayload, {
    apiKey: "invalid_mock_api_key_that_fails",
    allowFallback: true
  });

  assert.equal(result.isFallback, true, "Must fall back to deterministic summary on failure");
  assert.equal(result.model, "deterministic-fallback");
  assert.match(result.summary, /Observed 28 successful outgoing transactions across 19 active (?:UTC )?days/i);
  assert.equal(result.evidenceIds.length, 2);
  assert.equal(result.evidenceIds[0], "ev-tx-1");
  assert.equal(result.evidenceIds[1], "ev-tx-2");
});

test("AC 5: computePayloadDigest is proven unaffected by the presence or absence of explanation field", () => {
  // 1. Create a bundle without explanation
  const bundleWithoutExplanation = createPassportBundle(testPayload, "1.0.0");
  const digestWithout = computePayloadDigest(bundleWithoutExplanation.payload);

  // 2. Create a bundle with explanation attached as top-level sibling
  const explanation = generateDeterministicExplanation(testPayload);
  const bundleWithExplanation: PassportBundle = {
    ...bundleWithoutExplanation,
    explanation
  };
  const digestWith = computePayloadDigest(bundleWithExplanation.payload);

  assert.equal(
    digestWith,
    digestWithout,
    "computePayloadDigest covers ONLY payload; adding explanation must not alter digest"
  );
  assert.equal(bundleWithExplanation.integrity.digest, bundleWithoutExplanation.integrity.digest);
});

test("M5 Banned Causal and Identity Phrases: rejected by validator", () => {
  // Causal claim
  const causalOutput = {
    summary: "The wallet executed 28 transactions because the trader reacted to market shifts.",
    evidenceIds: ["ev-tx-1"]
  };
  const causalVal = validateAiExplanation(causalOutput, modelInput, testPayload, "test-model");
  assert.equal(causalVal.valid, false);
  assert.match(causalVal.error, /unsupported causal claims \("because"\)/i);

  // Identity claim
  const identityOutput = {
    summary: "The 28 transactions belong to a single high-frequency algorithmic trader.",
    evidenceIds: ["ev-tx-1"]
  };
  const identityVal = validateAiExplanation(identityOutput, modelInput, testPayload, "test-model");
  assert.equal(identityVal.valid, false);
  assert.match(identityVal.error, /unsupported identity or ownership claims \("belong to"\)/i);
});

test("M5 Valid Grounded Output: accepted by validator", () => {
  const validOutput = {
    summary: "Recorded 28 outgoing transactions across 19 active UTC days to 16 recipient addresses on Ethereum Mainnet during the declared window (2026-08-13 to 2026-09-12).",
    evidenceIds: ["ev-tx-1", "ev-tx-2"]
  };
  const val = validateAiExplanation(validOutput, modelInput, testPayload, "gpt-oss-120b");
  assert.equal(val.valid, true);
  if (val.valid) {
    assert.equal(val.explanation.isFallback, false);
    assert.equal(val.explanation.model, "gpt-oss-120b");
    assert.deepEqual(val.explanation.evidenceIds, ["ev-tx-1", "ev-tx-2"]);
  }
});

test("AC 3b: An explanation upgrading unknown coverage to sound complete is rejected", () => {
  const unknownPayload: PassportPayload = {
    ...testPayload,
    coverage: {
      ...testPayload.coverage,
      coverageStatus: "unknown",
      isTruncated: false
    }
  };
  const unknownInput = createModelInput(unknownPayload);

  const invalidOutput = {
    summary: "Observed 28 transactions across 19 active days, capturing the complete transaction history.",
    evidenceIds: ["ev-tx-1"]
  };

  const validation = validateAiExplanation(invalidOutput, unknownInput, unknownPayload, "test-model");
  assert.equal(validation.valid, false, "Coverage upgrade on unknown data must be rejected");
  assert.match(validation.error, /improperly claims complete coverage \("complete"\) when coverage is unknown/i);
});

test("M5 Observation Window Dates: summary containing real window as ISO and formatted date strings validates cleanly", () => {
  // ISO date format (2026-08-13 to 2026-09-12)
  const isoOutput = {
    summary: "During the 30-day UTC observation window from 2026-08-13 to 2026-09-12, the address recorded 28 transactions across 19 active days to 16 recipients.",
    evidenceIds: ["ev-tx-1", "ev-tx-2"]
  };
  const isoVal = validateAiExplanation(isoOutput, modelInput, testPayload, "test-model");
  assert.equal(isoVal.valid, true, `ISO date summary should validate but failed: ${!isoVal.valid ? (isoVal as any).error : ""}`);

  // Human-readable date format (August 13, 2026 to September 12, 2026)
  const readableOutput = {
    summary: "From August 13, 2026 to September 12, 2026, the address completed 28 transactions across 19 active days to 16 recipients.",
    evidenceIds: ["ev-tx-1"]
  };
  const readableVal = validateAiExplanation(readableOutput, modelInput, testPayload, "test-model");
  assert.equal(readableVal.valid, true, `Readable date summary should validate but failed: ${!readableVal.valid ? (readableVal as any).error : ""}`);
});

test("M5 Date Component Isolation Regression: fabricated numbers matching window date components are rejected", () => {
  // Reviewer Example 1: 13 is the window start-day (August 13), but fabricated as contract count
  const fabricatedContracts = {
    summary: "The wallet also appears to have interacted with 13 separate smart contracts during this period.",
    evidenceIds: ["ev-tx-1"]
  };
  const val1 = validateAiExplanation(fabricatedContracts, modelInput, testPayload, "test-model");
  assert.equal(val1.valid, false, "Fabricated claim using date component 13 must be rejected");
  assert.match(val1.error, /unverified numerical claim "13"/i);

  // Reviewer Example 2: 9 is the window end-month (September), but fabricated as transfer count
  const fabricatedTransfers = {
    summary: "Roughly 9 of these transactions appear to be high-value transfers.",
    evidenceIds: ["ev-tx-1"]
  };
  const val2 = validateAiExplanation(fabricatedTransfers, modelInput, testPayload, "test-model");
  assert.equal(val2.valid, false, "Fabricated claim using date component 9 must be rejected");
  assert.match(val2.error, /unverified numerical claim "9"/i);
});
