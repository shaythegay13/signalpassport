import { z } from "zod";
import { evidenceRecordSchema, type EvidenceRecord } from "./evidence.js";
import { claimSchema, type Claim } from "./claim.js";
import { coverageRecordSchema, type CoverageRecord } from "./coverage.js";
import { aiExplanationSchema, type AiExplanation } from "./explanation.js";

/**
 * Observation window schema for Passport payload.
 * Declares the UTC boundaries of analyzed activity.
 */
export const observationWindowSchema = z.object({
  startUtc: z.string().datetime({ message: "startUtc must be an ISO 8601 UTC string" }),
  endUtc: z.string().datetime({ message: "endUtc must be an ISO 8601 UTC string" })
});

export type ObservationWindow = z.infer<typeof observationWindowSchema>;

/**
 * Passport payload schema per PRD §8 minimum structure:
 * - Passport ID
 * - Subject wallet address
 * - Source chain ID
 * - Snapshot version
 * - Generation timestamp (ISO 8601 UTC)
 * - Observation window (start and end UTC)
 * - Source / coverage metadata
 * - Claims (deterministic metric statements)
 * - Evidence records (raw normalized events)
 * - Methodology version
 *
 * NOTE ON EMPTY PASSPORTS (PRD §9 / M2 Task 2):
 * `claims` uses `z.array(claimSchema)`. An empty array (`claims = []`) is structurally valid
 * at the schema level when a query returns zero qualifying transactions. `claimSchema.evidenceIds`
 * remains `.min(1)` so that any claim that DOES exist is strictly evidence-backed.
 */
export const passportPayloadSchema = z.object({
  passportId: z.string().min(1),
  subjectAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid subject Ethereum address format"),
  sourceChainId: z.number().int().positive(),
  snapshotVersion: z.string().min(1),
  generationTimestamp: z.string().datetime({ message: "generationTimestamp must be an ISO 8601 UTC string" }),
  observationWindow: observationWindowSchema,
  coverage: coverageRecordSchema,
  claims: z.array(claimSchema),
  evidence: z.array(evidenceRecordSchema),
  methodologyVersion: z.string().min(1)
});

export type PassportPayload = z.infer<typeof passportPayloadSchema>;

/**
 * Integrity metadata record per PRD §8:
 * Contains the hash algorithm (SHA-256 for P0) and the hex-encoded digest computed
 * over the canonical JSON serialization of `payload` only.
 */
export const integrityRecordSchema = z.object({
  algorithm: z.literal("sha256"),
  digest: z.string().regex(/^[0-9a-fA-F]{64}$/, "Digest must be a 64-character hexadecimal SHA-256 string")
});

export type IntegrityRecord = z.infer<typeof integrityRecordSchema>;

/**
 * Publication metadata record per PRD §8:
 * Optional registry / network / transaction information.
 * Absent in P0; typed as optional/undefined.
 */
export const publicationRecordSchema = z.object({
  registryAddress: z.string().optional(),
  network: z.string().optional(),
  transactionHash: z.string().optional(),
  blockNumber: z.number().int().positive().optional(),
  publishedAt: z.string().datetime().optional()
}).optional();

export type PublicationRecord = z.infer<typeof publicationRecordSchema>;

/**
 * Complete Signal Passport bundle envelope schema per PRD §8.
 */
export const passportBundleSchema = z.object({
  schema_version: z.string().min(1),
  payload: passportPayloadSchema,
  integrity: integrityRecordSchema,
  publication: publicationRecordSchema,
  explanation: aiExplanationSchema.optional()
});

export type PassportBundle = z.infer<typeof passportBundleSchema>;
