import type { PassportPayload, AiExplanation } from "@signal-passport/schema";
import { computeContextStats } from "./context-stats.js";

/**
 * Deterministic explanation fallback per PRD §4, §10, and M10.
 * Generates an immutable, grounded descriptive summary entirely from claims, coverage, and context stats.
 * Guaranteed to never fail, throw, invent numbers, or reference missing evidence.
 */
export function generateDeterministicExplanation(payload: PassportPayload): AiExplanation {
  const txCountClaim = payload.claims.find((c) => c.metricType === "observed_transaction_count");
  const activeDaysClaim = payload.claims.find((c) => c.metricType === "active_days");
  const uniqueRecipientsClaim = payload.claims.find((c) => c.metricType === "unique_recipients");

  const txCount = txCountClaim ? txCountClaim.value : 0;
  const activeDays = activeDaysClaim ? activeDaysClaim.value : 0;
  const uniqueRecipients = uniqueRecipientsClaim ? uniqueRecipientsClaim.value : 0;

  const startUtc = payload.observationWindow.startUtc.slice(0, 10);
  const endUtc = payload.observationWindow.endUtc.slice(0, 10);
  const subjectShort = `${payload.subjectAddress.slice(0, 6)}...${payload.subjectAddress.slice(-4)}`;

  // Supporting evidence IDs from payload (up to 10)
  const evidenceIds = payload.evidence.slice(0, 10).map((e) => e.evidenceId);

  let summary: string;
  if (txCount === 0) {
    summary = `Zero qualifying outgoing transactions observed for subject ${subjectShort} on Ethereum Mainnet during the declared 30-day UTC window (${startUtc} to ${endUtc}). All three deterministic metrics evaluate to 0.`;
  } else {
    const stats = computeContextStats(payload);
    const contextClauses: string[] = [];

    if (stats.daysSinceLastActivity !== undefined) {
      if (stats.daysSinceLastActivity === 0) {
        contextClauses.push("The most recent activity occurred 0 days prior to generation.");
      } else if (stats.daysSinceLastActivity === 1) {
        contextClauses.push("The most recent activity occurred 1 day prior to generation.");
      } else {
        contextClauses.push(`The most recent activity occurred ${stats.daysSinceLastActivity} days prior to generation.`);
      }
    }

    if (stats.recipientConcentration) {
      contextClauses.push(
        `${stats.recipientConcentration.maxRecipientTxCount} of ${stats.recipientConcentration.totalQualifyingTxCount} transactions went to a single recipient.`
      );
    }

    const contextSuffix = contextClauses.length > 0 ? ` ${contextClauses.join(" ")}` : "";

    if (payload.coverage.coverageStatus === "partial") {
      summary = `Observed ${txCount} successful outgoing transactions across ${activeDays} active UTC days to ${uniqueRecipients} unique recipient addresses on Ethereum Mainnet (${startUtc} to ${endUtc}).${contextSuffix} Note: Data coverage is partial due to pagination limits; metrics reflect available pages only.`;
    } else {
      summary = `Observed ${txCount} successful outgoing transactions across ${activeDays} active UTC days to ${uniqueRecipients} unique recipient addresses on Ethereum Mainnet during the declared 30-day UTC window (${startUtc} to ${endUtc}).${contextSuffix} Coverage is complete for the declared query scope.`;
    }
  }

  return {
    summary,
    evidenceIds,
    model: "deterministic-fallback",
    generatedAt: new Date().toISOString(),
    isFallback: true
  };
}
