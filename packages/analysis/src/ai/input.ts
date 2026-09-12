import type { PassportPayload } from "@signal-passport/schema";
import { METRIC_LABELS } from "../metrics.js";
import type { ModelInput } from "./types.js";

/**
 * Creates minimal, explicit, immutable model input from a sealed PassportPayload per PRD §10.
 * Passes ONLY the computed claims, scope, and evidence summaries required to reference by ID.
 * Excludes raw provider responses and internal implementation details.
 */
export function createModelInput(payload: PassportPayload): ModelInput {
  const claims = payload.claims.map((c) => ({
    metricType: c.metricType,
    label: METRIC_LABELS[c.metricType as keyof typeof METRIC_LABELS] || c.metricType,
    value: c.value,
    units: c.units
  }));

  // Summarize evidence to essential ID and transaction metadata (capped at 15 records per PRD §10)
  const evidence = (payload.evidence || []).slice(0, 15).map((e) => ({
    evidenceId: e.evidenceId,
    transactionHash: e.transactionHash,
    timestamp: e.timestamp,
    recipient: e.recipient
  }));

  return {
    subjectAddress: payload.subjectAddress,
    chainId: payload.sourceChainId,
    observationWindow: payload.observationWindow,
    coverageStatus: payload.coverage.coverageStatus,
    claims,
    evidence
  };
}
