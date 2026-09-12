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
  // Allowed numbers: claim values, chain ID, evidence counts, and observation window dates/tokens
  const allowedNumbers = new Set<string>();
  allowedNumbers.add(String(payload.sourceChainId)); // e.g. 1
  for (const claim of payload.claims) {
    allowedNumbers.add(String(claim.value));
  }
  allowedNumbers.add(String(payload.evidence.length));

  // Extract observation window dates and components
  const startDate = new Date(payload.observationWindow.startUtc);
  const endDate = new Date(payload.observationWindow.endUtc);

  // Window duration in days (e.g. 30)
  const windowDurationDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  allowedNumbers.add(String(windowDurationDays));
  allowedNumbers.add("30"); // standard fallback for 30-day window

  const startYear = startDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth() + 1;
  const startDay = startDate.getUTCDate();
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth() + 1;
  const endDay = endDate.getUTCDate();

  // Strip declared observation window date substrings from a working copy of summary before number extraction
  let sanitizedSummary = summary;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const shortMonthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Strip exact ISO strings and YYYY-MM-DD
  sanitizedSummary = sanitizedSummary
    .replaceAll(payload.observationWindow.startUtc, " ")
    .replaceAll(payload.observationWindow.endUtc, " ")
    .replaceAll(payload.observationWindow.startUtc.slice(0, 10), " ")
    .replaceAll(payload.observationWindow.endUtc.slice(0, 10), " ");

  // Strip human-readable date formats (e.g., "August 13, 2026", "13 August 2026", "Aug 13, 2026")
  const datePatterns = [
    new RegExp(`\\b${monthNames[startMonth - 1]}\\s+${startDay}(?:st|nd|rd|th)?,?\\s+${startYear}\\b`, "gi"),
    new RegExp(`\\b${shortMonthNames[startMonth - 1]}\\s+${startDay}(?:st|nd|rd|th)?,?\\s+${startYear}\\b`, "gi"),
    new RegExp(`\\b${startDay}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthNames[startMonth - 1]},?\\s+${startYear}\\b`, "gi"),
    new RegExp(`\\b${monthNames[endMonth - 1]}\\s+${endDay}(?:st|nd|rd|th)?,?\\s+${endYear}\\b`, "gi"),
    new RegExp(`\\b${shortMonthNames[endMonth - 1]}\\s+${endDay}(?:st|nd|rd|th)?,?\\s+${endYear}\\b`, "gi"),
    new RegExp(`\\b${endDay}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthNames[endMonth - 1]},?\\s+${endYear}\\b`, "gi")
  ];
  for (const pat of datePatterns) {
    sanitizedSummary = sanitizedSummary.replace(pat, " ");
  }

  // Extract standalone numbers from sanitized text
  const foundNumbers = sanitizedSummary.match(/\b\d+(?:\.\d+)?\b/g) || [];
  for (const num of foundNumbers) {
    if (!allowedNumbers.has(num)) {
      return {
        valid: false,
        error: `The explanation contains an unverified numerical claim "${num}". Only verified claim values are permitted.`
      };
    }
  }

  // (d) No coverage status upgrade (cannot claim completeness if coverage is partial or unknown)
  if (payload.coverage.coverageStatus !== "complete_for_query") {
    const upgradeMatch = summary.match(
      /\b(complete|completely|all transactions|full history|entire history|exhaustive|comprehensively)\b/i
    );
    if (upgradeMatch) {
      return {
        valid: false,
        error: `The explanation improperly claims complete coverage ("${upgradeMatch[0]}") when coverage is ${payload.coverage.coverageStatus}.`
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
