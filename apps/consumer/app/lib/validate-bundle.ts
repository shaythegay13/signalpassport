import { passportBundleSchema, type PassportBundle } from "@signal-passport/schema";
import { verifyBundleIntegrity } from "@signal-passport/verification";
import type { ValidationStepResult, BundleValidationResult } from "./types.js";

export type { ValidationStepResult, BundleValidationResult };

const SUPPORTED_SCHEMA_VERSION = "1.0.0";

/**
 * Validates an imported Passport bundle in four distinct sequential steps per PRD §9 & M3 Task 4:
 * 1. Schema validity & supported schema_version
 * 2. Subject address format
 * 3. Evidence reference resolution (zero dangling references)
 * 4. SHA-256 integrity verification
 *
 * NOTE: apps/consumer has ZERO dependency on the analysis engine and does not perform any network calls.
 */
export function validateImportedBundle(rawJson: unknown): BundleValidationResult {
  const steps: ValidationStepResult[] = [];

  let integrityLabel = "Integrity not verified";
  let integrityExplanation = "Integrity verification was not reached due to prior validation errors.";
  let publicationLabel = "Publication status unknown";
  let publicationExplanation = "Publication metadata could not be inspected.";

  // Step 1: Schema Validity & schema_version
  if (!rawJson || typeof rawJson !== "object") {
    steps.push({
      step: "schema",
      name: "1. Bundle Envelope Schema",
      passed: false,
      message: "Imported JSON is not an object."
    });
    return {
      isValid: false,
      steps,
      errorSummary: "Imported file does not contain a JSON object.",
      integrityLabel,
      integrityExplanation,
      publicationLabel,
      publicationExplanation
    };
  }

  const candidate = rawJson as Record<string, unknown>;

  if (candidate.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    steps.push({
      step: "schema",
      name: "1. Bundle Envelope Schema",
      passed: false,
      message: `Unsupported schema version: '${candidate.schema_version ?? "undefined"}'. This consumer supports version '${SUPPORTED_SCHEMA_VERSION}'.`,
      detail: `Supported schema versions: ['${SUPPORTED_SCHEMA_VERSION}']`
    });
    return {
      isValid: false,
      steps,
      errorSummary: `Unsupported schema version '${candidate.schema_version}'.`,
      integrityLabel,
      integrityExplanation,
      publicationLabel,
      publicationExplanation
    };
  }

  const parseResult = passportBundleSchema.safeParse(rawJson);
  if (!parseResult.success) {
    const issueMessages = parseResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .slice(0, 5)
      .join("; ");

    steps.push({
      step: "schema",
      name: "1. Bundle Envelope Schema",
      passed: false,
      message: `Bundle failed schema validation: ${issueMessages}`,
      detail: parseResult.error.message
    });
    return {
      isValid: false,
      steps,
      errorSummary: "Envelope structure does not conform to Passport bundle specification.",
      integrityLabel,
      integrityExplanation,
      publicationLabel,
      publicationExplanation
    };
  }

  const bundle = parseResult.data;
  steps.push({
    step: "schema",
    name: "1. Bundle Envelope Schema",
    passed: true,
    message: `Bundle conforms to schema version ${bundle.schema_version}.`,
    detail: `Validated envelope with payload and integrity sections.`
  });

  // Step 2: Subject Address Format
  const addressRegex = /^0x[0-9a-fA-F]{40}$/;
  if (!addressRegex.test(bundle.payload.subjectAddress)) {
    steps.push({
      step: "address",
      name: "2. Subject Address Format",
      passed: false,
      message: `Invalid subject Ethereum address: '${bundle.payload.subjectAddress}'. Must be 0x-prefixed 40 hex characters.`
    });
    return {
      isValid: false,
      steps,
      errorSummary: `Malformed subject address in bundle: ${bundle.payload.subjectAddress}`,
      integrityLabel,
      integrityExplanation,
      publicationLabel,
      publicationExplanation
    };
  }

  steps.push({
    step: "address",
    name: "2. Subject Address Format",
    passed: true,
    message: `Valid subject Ethereum address: ${bundle.payload.subjectAddress}`,
    detail: "Syntactic structure verified (0x + 40 hex digits)."
  });

  // Step 3: Evidence Reference Resolution (No Dangling References)
  const evidenceIdsInBundle = new Set(bundle.payload.evidence.map((e) => e.evidenceId));
  let danglingFound: { claimId: string; evidenceId: string } | null = null;
  let totalCitations = 0;

  for (const claim of bundle.payload.claims) {
    for (const id of claim.evidenceIds) {
      totalCitations++;
      if (!evidenceIdsInBundle.has(id)) {
        danglingFound = { claimId: claim.claimId, evidenceId: id };
        break;
      }
    }
    if (danglingFound) break;
  }

  if (danglingFound) {
    steps.push({
      step: "evidence",
      name: "3. Evidence Reference Integrity",
      passed: false,
      message: `Dangling reference: Claim '${danglingFound.claimId}' references evidence ID '${danglingFound.evidenceId}' which does not exist in the bundle.`,
      detail: `Evidence set contains ${bundle.payload.evidence.length} records, but cited record was not found.`
    });
    return {
      isValid: false,
      steps,
      errorSummary: `Bundle contains dangling evidence references that cannot be resolved locally.`,
      integrityLabel,
      integrityExplanation,
      publicationLabel,
      publicationExplanation
    };
  }

  steps.push({
    step: "evidence",
    name: "3. Evidence Reference Integrity",
    passed: true,
    message: `All ${totalCitations} evidence references across ${bundle.payload.claims.length} claims resolve within the bundle.`,
    detail: `Zero dangling references detected among ${bundle.payload.evidence.length} local evidence records.`
  });

  // Step 4: SHA-256 Integrity Verification
  const verification = verifyBundleIntegrity(bundle);

  if (verification.isValid) {
    integrityLabel = "Bundle integrity matched";
    integrityExplanation =
      "Payload digest matches the stored SHA-256 digest. This confirms the bundle has not suffered accidental modification or corruption, but does NOT establish wallet ownership, authentic origin, truthful source data, or independent onchain verification.";

    steps.push({
      step: "integrity",
      name: "4. Cryptographic Digest Integrity",
      passed: true,
      message: "Bundle integrity matched: Recomputed payload digest exactly matches envelope digest.",
      detail: `SHA-256: ${bundle.integrity.digest}`
    });
  } else {
    integrityLabel = "Bundle integrity mismatch";
    integrityExplanation =
      "Payload digest does not match the stored SHA-256 digest. The payload has been modified or corrupted relative to the digest in the envelope.";

    steps.push({
      step: "integrity",
      name: "4. Cryptographic Digest Integrity",
      passed: false,
      message: "Bundle integrity mismatch: Recomputed SHA-256 digest does not match envelope digest.",
      detail: `Expected (envelope): ${verification.expectedDigest}; Actual (payload): ${verification.actualDigest}`
    });
  }

  // Publication Status (Separated UI per PRD §8/§9)
  if (bundle.publication) {
    publicationLabel = `Published on ${bundle.publication.network || "registry"}`;
    publicationExplanation = `Recorded onchain at ${bundle.publication.registryAddress || "registry"} (Tx: ${bundle.publication.transactionHash || "unknown"})`;
  } else {
    publicationLabel = "Not published";
    publicationExplanation =
      "No onchain publication metadata recorded (P0 portable JSON bundle).";
  }

  const allPassed = steps.every((s) => s.passed);

  return {
    isValid: allPassed,
    steps,
    bundle,
    integrityLabel,
    integrityExplanation,
    publicationLabel,
    publicationExplanation
  };
}
