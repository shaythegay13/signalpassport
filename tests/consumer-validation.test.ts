import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateImportedBundle } from "../apps/consumer/app/lib/validate-bundle.js";
import { computePayloadDigest } from "../packages/verification/src/digest.js";
import type { PassportBundle } from "../packages/schema/src/index.js";

describe("App Two: Consumer bundle validation (PRD §9 / M3 Task 4)", () => {
  const validBundle: PassportBundle = JSON.parse(
    readFileSync("fixtures/real/passport-bundle.json", "utf8")
  );

  it("validates a genuine real-fixture bundle cleanly through all four steps", () => {
    const result = validateImportedBundle(validBundle);

    assert.equal(result.isValid, true);
    assert.equal(result.steps.length, 4);

    // Step 1: Schema
    assert.equal(result.steps[0].step, "schema");
    assert.equal(result.steps[0].passed, true);

    // Step 2: Address
    assert.equal(result.steps[1].step, "address");
    assert.equal(result.steps[1].passed, true);

    // Step 3: Evidence resolution
    assert.equal(result.steps[2].step, "evidence");
    assert.equal(result.steps[2].passed, true);

    // Step 4: Integrity
    assert.equal(result.steps[3].step, "integrity");
    assert.equal(result.steps[3].passed, true);

    // Labels and explanations per PRD §8
    assert.equal(result.integrityLabel, "Bundle integrity matched");
    assert.ok(
      result.integrityExplanation.includes("does NOT establish wallet ownership"),
      "Explanation must contain PRD §8 caveat"
    );
    assert.equal(result.publicationLabel, "Not published");
  });

  it("rejects unsupported schema_version with a usable error message", () => {
    const bundleUnsupportedVersion = {
      ...validBundle,
      schema_version: "2.0.0"
    };

    const result = validateImportedBundle(bundleUnsupportedVersion);
    assert.equal(result.isValid, false);
    assert.equal(result.steps[0].passed, false);
    assert.ok(result.steps[0].message.includes("Unsupported schema version: '2.0.0'"));
  });

  it("rejects malformed bundle missing required envelope properties without crashing", () => {
    const malformed = {
      schema_version: "1.0.0",
      // missing payload and integrity
      foo: "bar"
    };

    const result = validateImportedBundle(malformed);
    assert.equal(result.isValid, false);
    assert.equal(result.steps[0].passed, false);
    assert.ok(result.steps[0].message.includes("Bundle failed schema validation"));
  });

  it("rejects bundle with invalid subject address format", () => {
    const badAddressBundle: PassportBundle = JSON.parse(JSON.stringify(validBundle));
    badAddressBundle.payload.subjectAddress = "not-an-eth-address";
    // Also recompute digest so integrity step wouldn't be the only failure
    badAddressBundle.integrity.digest = computePayloadDigest(badAddressBundle.payload);

    const result = validateImportedBundle(badAddressBundle);
    assert.equal(result.isValid, false);
    assert.equal(result.steps[0].passed, false, "Schema should reject invalid address regex");
  });

  it("rejects bundle containing dangling evidence references", () => {
    const danglingBundle: PassportBundle = JSON.parse(JSON.stringify(validBundle));
    // Append a non-existent evidence ID to the first claim
    const phantomId = "1:0x9999999999999999999999999999999999999999999999999999999999999999";
    danglingBundle.payload.claims[0].evidenceIds.push(phantomId);

    const result = validateImportedBundle(danglingBundle);
    assert.equal(result.isValid, false);
    const evidenceStep = result.steps.find((s) => s.step === "evidence");
    assert.ok(evidenceStep);
    assert.equal(evidenceStep.passed, false);
    assert.ok(evidenceStep.message.includes("Dangling reference"));
    assert.ok(evidenceStep.message.includes(phantomId));
  });

  it("catches payload-only tampering: displays Bundle integrity mismatch and rejects validity", () => {
    const tamperedBundle: PassportBundle = JSON.parse(JSON.stringify(validBundle));
    // Mutate claim value from 28 to 1000 without updating integrity.digest
    tamperedBundle.payload.claims[0].value = 1000;

    const result = validateImportedBundle(tamperedBundle);
    assert.equal(result.isValid, false);

    const integrityStep = result.steps.find((s) => s.step === "integrity");
    assert.ok(integrityStep);
    assert.equal(integrityStep.passed, false);
    assert.equal(result.integrityLabel, "Bundle integrity mismatch");
    assert.ok(result.integrityExplanation.includes("Payload digest does not match"));
  });

  it("allows tamper-and-rehash to pass local digest check per PRD §8 (demonstrating digest is not authentication)", () => {
    const tamperedAndRehashed: PassportBundle = JSON.parse(JSON.stringify(validBundle));
    tamperedAndRehashed.payload.claims[0].value = 999;
    tamperedAndRehashed.integrity.digest = computePayloadDigest(tamperedAndRehashed.payload);

    const result = validateImportedBundle(tamperedAndRehashed);
    assert.equal(result.isValid, true);
    assert.equal(result.integrityLabel, "Bundle integrity matched");
    assert.ok(result.integrityExplanation.includes("does NOT establish wallet ownership"));
  });

  it("separately reflects publication metadata when present", () => {
    const publishedBundle: PassportBundle = {
      ...validBundle,
      publication: {
        network: "monad-testnet",
        registryAddress: "0x1111222233334444555566667777888899990000",
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
      }
    };

    const result = validateImportedBundle(publishedBundle);
    assert.ok(result.publicationLabel.includes("Published on monad-testnet"));
    assert.ok(result.publicationExplanation.includes("0x1111222233334444555566667777888899990000"));
  });
});
