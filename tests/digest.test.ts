import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  computePayloadDigest,
  verifyBundleIntegrity,
  createPassportBundle,
  canonicalJsonStringify
} from "../packages/verification/src/index.js";
import type { PassportPayload, PassportBundle } from "../packages/schema/src/index.js";

describe("payload digest and integrity verification (PRD §8)", () => {
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
    claims: [
      {
        claimId: "claim-observed-txs",
        metricType: "observed_transaction_count",
        value: 28,
        units: "transactions",
        evidenceIds: ["1:0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"],
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
      }
    ],
    methodologyVersion: "1.0.0"
  };

  it("proves cross-process determinism: child process produces byte-identical canonical JSON and digest", () => {
    // 1. Compute in current (main) process
    const mainCanonical = canonicalJsonStringify(samplePayload);
    const mainDigest = computePayloadDigest(samplePayload);

    // 2. Spawn a separate Node process running tests/helpers/cross-process-worker.ts
    const rootDir = path.resolve(process.cwd());
    const tsxBin = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
    const workerPath = path.join(rootDir, "tests", "helpers", "cross-process-worker.ts");

    const result = spawnSync(process.execPath, [tsxBin, workerPath], {
      cwd: rootDir,
      input: JSON.stringify(samplePayload),
      encoding: "utf8"
    });

    assert.equal(result.status, 0, `Worker process exited with code ${result.status}. Stderr: ${result.stderr}`);
    assert.equal(result.stderr, "");

    const workerOutput = JSON.parse(result.stdout) as { canonical: string; digest: string };

    // 3. Assert exact byte/string equality across independent processes
    assert.equal(
      workerOutput.canonical,
      mainCanonical,
      "Canonical JSON output from child process must be byte-identical to parent process"
    );
    assert.equal(
      workerOutput.digest,
      mainDigest,
      "SHA-256 digest from child process must be identical to parent process"
    );
  });

  it("tamper detection: modifying a payload field causes verifyBundleIntegrity to fail", () => {
    const bundle = createPassportBundle(samplePayload);
    const verification = verifyBundleIntegrity(bundle);
    assert.equal(verification.isValid, true);
    assert.equal(verification.expectedDigest, verification.actualDigest);

    // Mutate one field inside payload: change claim value from 28 to 999
    const tamperedBundle: PassportBundle = JSON.parse(JSON.stringify(bundle));
    tamperedBundle.payload.claims[0].value = 999;

    const tamperedVerification = verifyBundleIntegrity(tamperedBundle);
    assert.equal(tamperedVerification.isValid, false, "Integrity check must fail when payload is altered");
    assert.notEqual(tamperedVerification.actualDigest, tamperedVerification.expectedDigest);
    assert.equal(tamperedVerification.expectedDigest, bundle.integrity.digest);
  });

  it("tamper-and-rehash passes structural check and is explicitly documented as NOT authentication (PRD §8)", () => {
    /**
     * CRITICAL SECURITY PRINCIPLE (Signal-Passport-Weekend-PRD.md §8):
     * "A bundled digest detects accidental modification relative to that digest.
     * Someone who changes both the payload and digest can pass this check.
     * It does not establish authenticity, wallet ownership, truthful source data,
     * or independent onchain verification. The consumer must label it
     * 'Bundle integrity matched' with an explanation, never simply 'Verified reputation.'"
     */
    const bundle = createPassportBundle(samplePayload);

    // Attacker tampers with the subject address and falsifies metrics
    const attackerBundle: PassportBundle = JSON.parse(JSON.stringify(bundle));
    attackerBundle.payload.subjectAddress = "0x0000000000000000000000000000000000000000";
    attackerBundle.payload.claims[0].value = 1000000;

    // Attacker recomputes and overwrites integrity.digest to match the tampered payload
    attackerBundle.integrity.digest = computePayloadDigest(attackerBundle.payload);

    // The structural digest check PASSES because the payload matches the overwritten digest!
    const result = verifyBundleIntegrity(attackerBundle);
    assert.equal(
      result.isValid,
      true,
      "Tamper-and-rehash intentionally passes local digest check: digest detects accidental corruption, not authenticity"
    );
    assert.equal(result.actualDigest, attackerBundle.integrity.digest);
  });

  it("hash covers payload ONLY: changing schema_version, integrity, or publication does NOT change payload digest", () => {
    const originalDigest = computePayloadDigest(samplePayload);

    const bundle: PassportBundle = {
      schema_version: "1.0.0",
      payload: samplePayload,
      integrity: {
        algorithm: "sha256",
        digest: originalDigest
      }
    };

    // Changing schema_version does not change the digest of the payload
    const modifiedSchemaVersionBundle: PassportBundle = {
      ...bundle,
      schema_version: "2.0.0"
    };
    assert.equal(computePayloadDigest(modifiedSchemaVersionBundle.payload), originalDigest);

    // Adding publication metadata does not change the digest of the payload
    const bundleWithPublication: PassportBundle = {
      ...bundle,
      publication: {
        registryAddress: "0x1234567890123456789012345678901234567890",
        network: "monad-testnet"
      }
    };
    assert.equal(computePayloadDigest(bundleWithPublication.payload), originalDigest);
  });

  it("non-finite rejection: payload containing NaN or Infinity throws TypeError before hashing", () => {
    const payloadWithNan: any = JSON.parse(JSON.stringify(samplePayload));
    payloadWithNan.claims[0].value = NaN;

    assert.throws(
      () => computePayloadDigest(payloadWithNan),
      { name: "TypeError", message: /Canonical JSON rejects NaN/ }
    );

    const payloadWithInf: any = JSON.parse(JSON.stringify(samplePayload));
    payloadWithInf.claims[0].value = Infinity;

    assert.throws(
      () => computePayloadDigest(payloadWithInf),
      { name: "TypeError", message: /Canonical JSON rejects non-finite number/ }
    );
  });

  it("new-timestamp-new-hash: two payloads differing only in generationTimestamp yield different digests (PRD §8)", () => {
    const payload1 = samplePayload;
    const payload2: PassportPayload = {
      ...samplePayload,
      generationTimestamp: "2026-09-12T16:08:12.000Z" // 1 second later
    };

    const digest1 = computePayloadDigest(payload1);
    const digest2 = computePayloadDigest(payload2);

    assert.notEqual(
      digest1,
      digest2,
      "Generation timestamp is part of the canonical payload and must yield a distinct digest"
    );
  });
});
