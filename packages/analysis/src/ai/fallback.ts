import type { PassportPayload, AiExplanation } from "@signal-passport/schema";

/**
 * Deterministic explanation fallback per PRD §4 and §10.
 * Generates an immutable, grounded descriptive summary entirely from claims and coverage.
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
  } else if (payload.coverage.coverageStatus === "partial") {
    summary = `Observed ${txCount} successful outgoing transactions across ${activeDays} active UTC days to ${uniqueRecipients} unique recipient addresses on Ethereum Mainnet (${startUtc} to ${endUtc}). Note: Data coverage is partial due to pagination limits; metrics reflect available pages only.`;
  } else {
    summary = `Observed ${txCount} successful outgoing transactions across ${activeDays} active UTC days to ${uniqueRecipients} unique recipient addresses on Ethereum Mainnet during the declared 30-day UTC window (${startUtc} to ${endUtc}). Coverage is complete for the declared query scope.`;
  }

  return {
    summary,
    evidenceIds,
    model: "deterministic-fallback",
    generatedAt: new Date().toISOString(),
    isFallback: true
  };
}
