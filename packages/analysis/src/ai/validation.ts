import { z } from "zod";
import type { PassportPayload, AiExplanation } from "@signal-passport/schema";
import { aiExplanationSchema } from "@signal-passport/schema";
import type { ModelInput } from "./types.js";

const rawAiOutputSchema = z.object({
  summary: z.string().min(1).max(1000),
  evidenceIds: z.array(z.string()).max(50)
});

/**
 * Validates model output against PRD §10 rules in strict order:
 * (a) Schema conformance
 * (b) Evidence ID membership (reject dangling references)
 * (c) No invented numbers (all numbers must match claim values or declared chain ID/window)
 * (d) No coverage status upgrade (cannot claim complete if partial)
 * (e) No wallet identity / ownership claims
 * (f) No causal speculation phrases
 */
export function validateAiExplanation(
  raw: unknown,
  input: ModelInput,
  payload: PassportPayload,
  modelName: string
): { valid: true; explanation: AiExplanation } | { valid: false; error: string } {
  // (a) Schema parse
  const parsed = rawAiOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      error: `Schema validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`
    };
  }

  const { summary, evidenceIds } = parsed.data;

  // (b) Evidence ID reference resolution (reject dangling references)
  const validEvidenceSet = new Set(payload.evidence.map((e) => e.evidenceId));
  for (const id of evidenceIds) {
    if (!validEvidenceSet.has(id)) {
      return {
        valid: false,
        error: `Unknown evidence reference "${id}". All cited evidence IDs must exist in the payload.`
      };
    }
  }

  // (c) No invented numbers
  // Allowed numbers: claim values, chain ID, and start/end window dates if mentioned
  const allowedNumbers = new Set<string>();
  allowedNumbers.add(String(payload.sourceChainId)); // e.g. 1
  for (const claim of payload.claims) {
    allowedNumbers.add(String(claim.value));
  }
  // Allow year numbers if in window (e.g. 2026, 30 for 30-day)
  allowedNumbers.add("30");
  const startYear = new Date(payload.observationWindow.startUtc).getUTCFullYear();
  const endYear = new Date(payload.observationWindow.endUtc).getUTCFullYear();
  allowedNumbers.add(String(startYear));
  allowedNumbers.add(String(endYear));

  // Extract standalone numbers from text
  const foundNumbers = summary.match(/\b\d+(?:\.\d+)?\b/g) || [];
  for (const num of foundNumbers) {
    if (!allowedNumbers.has(num)) {
      return {
        valid: false,
        error: `The explanation contains an unverified numerical claim "${num}". Only verified claim values are permitted.`
      };
    }
  }

  // (d) No coverage status upgrade
  if (payload.coverage.coverageStatus === "partial") {
    const upgradeMatch = summary.match(/\b(complete|completely|all transactions|full history|entire history|exhaustive|comprehensively)\b/i);
    if (upgradeMatch) {
      return {
        valid: false,
        error: `The explanation improperly claims complete coverage ("${upgradeMatch[0]}") when coverage is partial.`
      };
    }
  }

  // (e) No wallet identity / ownership claims
  const identityMatch = summary.match(/\b(owned by|belong(?:s)? to|trader's identity|trader is|individual who|real-world identity|wallet owner is|kyc)\b/i);
  if (identityMatch) {
    return {
      valid: false,
      error: `The explanation asserts unsupported identity or ownership claims ("${identityMatch[0]}").`
    };
  }

  // (f) No causal speculation phrases
  const causalMatch = summary.match(/\b(because|caused by|due to|driven by|resulting from|as a result of|thanks to|owing to|attributable to|fuelled by|fueled by|boosted by|investment strategy|expansion plan)\b/i);
  if (causalMatch) {
    return {
      valid: false,
      error: `The explanation asserts unsupported causal claims ("${causalMatch[0]}"). Write descriptively, not causally.`
    };
  }

  return {
    valid: true,
    explanation: {
      summary,
      evidenceIds,
      model: modelName,
      generatedAt: new Date().toISOString(),
      isFallback: false
    }
  };
}
