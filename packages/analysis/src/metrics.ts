import type { Claim, EvidenceRecord, ObservationScope } from "@signal-passport/schema";
import { claimSchema } from "@signal-passport/schema";

export const METRIC_LABELS = {
  observed_transaction_count: "Observed transactions",
  active_days: "Active days within this dataset",
  unique_recipients: "Unique recipient addresses"
} as const;

export type MetricsComputationResult = {
  claims: Claim[];
  metrics: {
    observedTransactionCount: number;
    activeDays: number;
    uniqueRecipients: number;
  };
  evidenceMap: Map<string, EvidenceRecord>;
  activeDaysDates: string[];
  uniqueRecipientAddresses: string[];
};

/**
 * Computes the three deterministic descriptive metrics specified in PRD §7:
 * 1. Observed transaction count — distinct qualifying transaction hashes.
 * 2. Active days — distinct UTC calendar dates (YYYY-MM-DD in UTC).
 * 3. Unique recipients — distinct non-null destination addresses among qualifying outgoing transactions.
 *
 * Every produced Claim's evidenceIds array is strictly guaranteed to reference
 * only real EvidenceRecords present in the input evidence set.
 */
export function computeDeterministicMetrics(
  evidence: EvidenceRecord[],
  scope: ObservationScope,
  calculationVersion = "1.0.0"
): MetricsComputationResult {
  const evidenceMap = new Map<string, EvidenceRecord>();
  for (const record of evidence) {
    evidenceMap.set(record.evidenceId, record);
  }

  // 1. Observed transaction count: distinct qualifying transaction hashes
  const txHashToEvidenceIds = new Map<string, string[]>();
  for (const record of evidence) {
    const hash = record.transactionHash.toLowerCase();
    if (!txHashToEvidenceIds.has(hash)) {
      txHashToEvidenceIds.set(hash, []);
    }
    txHashToEvidenceIds.get(hash)!.push(record.evidenceId);
  }
  const observedTransactionCount = txHashToEvidenceIds.size;
  const observedTxEvidenceIds = evidence.map(e => e.evidenceId);

  // 2. Active days: distinct UTC calendar dates (YYYY-MM-DD in UTC)
  const activeDaysMap = new Map<string, string[]>();
  for (const record of evidence) {
    const d = new Date(record.timestamp);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const utcDate = `${year}-${month}-${day}`;
    if (!activeDaysMap.has(utcDate)) {
      activeDaysMap.set(utcDate, []);
    }
    activeDaysMap.get(utcDate)!.push(record.evidenceId);
  }
  const activeDays = activeDaysMap.size;
  const activeDaysDates = Array.from(activeDaysMap.keys()).sort();
  const activeDaysEvidenceIds = evidence.map(e => e.evidenceId);

  // 3. Unique recipients: distinct non-null destination addresses
  const recipientsMap = new Map<string, string[]>();
  for (const record of evidence) {
    if (record.recipient) {
      const normRecipient = record.recipient.toLowerCase();
      if (!recipientsMap.has(normRecipient)) {
        recipientsMap.set(normRecipient, []);
      }
      recipientsMap.get(normRecipient)!.push(record.evidenceId);
    }
  }
  const uniqueRecipients = recipientsMap.size;
  const uniqueRecipientAddresses = Array.from(recipientsMap.keys()).sort();

  // Reference evidence records that have non-null recipient; fallback to all evidence if none
  const recipientEvidenceIds = evidence.filter(e => e.recipient !== null).map(e => e.evidenceId);
  const finalRecipientEvidenceIds = recipientEvidenceIds.length > 0
    ? recipientEvidenceIds
    : evidence.map(e => e.evidenceId);

  // Produce Claims per-metric only when backing evidence exists.
  // Per PRD §7, §8, §9 & M4 Task 0: When there is zero qualifying evidence for a metric,
  // do not produce a claim for it, ensuring claim.evidenceIds is never empty.
  const claims: Claim[] = [];

  if (observedTxEvidenceIds.length > 0) {
    claims.push(
      claimSchema.parse({
        claimId: "claim-observed-transaction-count",
        metricType: "observed_transaction_count",
        value: observedTransactionCount,
        units: "transactions",
        evidenceIds: observedTxEvidenceIds,
        calculationVersion,
        declaredObservationScope: scope
      })
    );
  }

  if (activeDaysEvidenceIds.length > 0) {
    claims.push(
      claimSchema.parse({
        claimId: "claim-active-days",
        metricType: "active_days",
        value: activeDays,
        units: "days",
        evidenceIds: activeDaysEvidenceIds,
        calculationVersion,
        declaredObservationScope: scope
      })
    );
  }

  if (finalRecipientEvidenceIds.length > 0) {
    claims.push(
      claimSchema.parse({
        claimId: "claim-unique-recipients",
        metricType: "unique_recipients",
        value: uniqueRecipients,
        units: "addresses",
        evidenceIds: finalRecipientEvidenceIds,
        calculationVersion,
        declaredObservationScope: scope
      })
    );
  }

  return {
    claims,
    metrics: {
      observedTransactionCount,
      activeDays,
      uniqueRecipients
    },
    evidenceMap,
    activeDaysDates,
    uniqueRecipientAddresses
  };
}
