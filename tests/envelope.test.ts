import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  passportBundleSchema,
  passportPayloadSchema,
  claimSchema,
  type PassportPayload,
  type PassportBundle
} from "../packages/schema/src/index.js";

describe("bundle envelope schema (PRD §8)", () => {
  const sampleObservationScope = {
    subjectAddress: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
    chainId: 1,
    window: {
      startUtc: "2026-08-13T00:00:00.000Z",
      endUtc: "2026-09-12T16:08:11.000Z"
    },
    direction: "outgoing" as const,
    status: "ok" as const
  };

  const sampleClaim = {
    claimId: "claim-1",
    metricType: "observed_transaction_count" as const,
    value: 28,
    units: "transactions",
    evidenceIds: ["1:0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"],
    calculationVersion: "1.0.0",
    declaredObservationScope: sampleObservationScope
  };

  const sampleEvidence = {
    evidenceId: "1:0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    chainId: 1,
    transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    logIndex: null,
    timestamp: "2026-09-12T16:08:11.000Z",
    sender: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8",
    recipient: "0x111111111117dc0aa78b770fa6a738034120c302",
    status: "ok",
    provider: "blockscout",
    sourceReference: "https://eth.blockscout.com/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  };

  const samplePayload: PassportPayload = {
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
      matchingRowsCount: 28,
      details: "Complete query history"
    },
    claims: [sampleClaim],
    evidence: [sampleEvidence],
    methodologyVersion: "1.0.0"
  };

  const sampleBundle: PassportBundle = {
    schema_version: "1.0.0",
    payload: samplePayload,
    integrity: {
      algorithm: "sha256",
      digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  };

  it("validates a compliant PassportBundle successfully", () => {
    const parsed = passportBundleSchema.parse(sampleBundle);
    assert.equal(parsed.schema_version, "1.0.0");
    assert.equal(parsed.payload.subjectAddress, "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8");
    assert.equal(parsed.integrity.algorithm, "sha256");
    assert.equal(parsed.publication, undefined);
  });

  it("allows empty claims array for zero-activity Passports (PRD §9 / Task 2)", () => {
    // Crucial design requirement: zero qualifying transactions emits zero claims (claims = [])
    // without requiring individual claims to have empty evidenceIds.
    const emptyPayload: PassportPayload = {
      ...samplePayload,
      claims: [],
      evidence: []
    };

    const emptyBundle: PassportBundle = {
      ...sampleBundle,
      payload: emptyPayload
    };

    const parsed = passportBundleSchema.parse(emptyBundle);
    assert.equal(parsed.payload.claims.length, 0);
    assert.equal(parsed.payload.evidence.length, 0);
  });

  it("still enforces claimSchema.evidenceIds non-empty when a claim is present", () => {
    const invalidClaim = {
      ...sampleClaim,
      evidenceIds: [] // Violates .min(1)
    };

    assert.throws(
      () => claimSchema.parse(invalidClaim),
      { name: "ZodError" }
    );
  });

  it("rejects invalid subject address format in payload", () => {
    const invalidPayload = {
      ...samplePayload,
      subjectAddress: "not-a-valid-address"
    };

    assert.throws(
      () => passportPayloadSchema.parse(invalidPayload),
      { name: "ZodError" }
    );
  });

  it("rejects non-64-hex integrity digest", () => {
    const invalidBundle = {
      ...sampleBundle,
      integrity: {
        algorithm: "sha256" as const,
        digest: "invalid-short-digest"
      }
    };

    assert.throws(
      () => passportBundleSchema.parse(invalidBundle),
      { name: "ZodError" }
    );
  });

  it("accepts valid optional publication metadata when present", () => {
    const bundleWithPublication: PassportBundle = {
      ...sampleBundle,
      publication: {
        registryAddress: "0x1234567890123456789012345678901234567890",
        network: "monad-testnet",
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        blockNumber: 123456,
        publishedAt: "2026-09-12T17:00:00.000Z"
      }
    };

    const parsed = passportBundleSchema.parse(bundleWithPublication);
    assert.equal(parsed.publication?.network, "monad-testnet");
    assert.equal(parsed.publication?.blockNumber, 123456);
  });
});
