import { createHash } from "node:crypto";
import { canonicalJsonBuffer, canonicalJsonStringify } from "./canonical.js";
import type { PassportBundle, PassportPayload } from "@signal-passport/schema";

export interface IntegrityVerificationResult {
  isValid: boolean;
  expectedDigest: string;
  actualDigest: string;
  error?: string;
}

/**
 * Computes the SHA-256 digest of a Passport payload using canonical JSON serialization.
 *
 * PRD §8 Requirement:
 * "Hash only payload; do not include its own digest, mutable transport fields, or later
 * registry transaction metadata in the hash input."
 */
export function computePayloadDigest(payload: PassportPayload | Record<string, unknown>): string {
  const canonicalBytes = canonicalJsonBuffer(payload);
  return createHash("sha256").update(canonicalBytes).digest("hex");
}

/**
 * Verifies the integrity of a Passport bundle by recomputing the SHA-256 digest of its payload
 * and comparing it against the stored digest in `bundle.integrity.digest`.
 *
 * IMPORTANT SECURITY AND TRUST NOTICE (PRD §8):
 * A bundled digest detects ACCIDENTAL modification relative to that digest.
 * Someone who deliberately alters the payload and recomputes the digest can pass this check.
 * This check does NOT establish authenticity, wallet ownership, truthful source data,
 * or independent onchain verification. It is strictly a tamper/corruption detector.
 */
export function verifyBundleIntegrity(bundle: PassportBundle): IntegrityVerificationResult {
  if (bundle.integrity.algorithm !== "sha256") {
    return {
      isValid: false,
      expectedDigest: bundle.integrity.digest,
      actualDigest: "",
      error: `Unsupported integrity algorithm: '${bundle.integrity.algorithm}'. Expected 'sha256'.`
    };
  }

  const actualDigest = computePayloadDigest(bundle.payload);
  const expectedDigest = bundle.integrity.digest;

  return {
    isValid: actualDigest.toLowerCase() === expectedDigest.toLowerCase(),
    expectedDigest,
    actualDigest
  };
}

/**
 * Helper to construct a complete PassportBundle envelope from a validated payload.
 */
export function createPassportBundle(
  payload: PassportPayload,
  schemaVersion: string = "1.0.0"
): PassportBundle {
  const digest = computePayloadDigest(payload);
  return {
    schema_version: schemaVersion,
    payload,
    integrity: {
      algorithm: "sha256",
      digest
    }
  };
}
