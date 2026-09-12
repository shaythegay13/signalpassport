import { buildEvidenceId, evidenceRecordSchema } from "@signal-passport/schema";
import type { EvidenceRecord } from "@signal-passport/schema";
import type { BlockscoutTransactionItem } from "./blockscout.js";

export type NormalizationOptions = {
  subjectAddress: string;
  chainId: number;
  window: {
    startUtc: string;
    endUtc: string;
  };
  providerName?: string;
  explorerBaseUrl?: string;
};

export type ItemQualificationResult = {
  qualifies: boolean;
  record?: EvidenceRecord;
  reason?: string;
};

/**
 * Normalizes a raw Blockscout transaction item into a validated EvidenceRecord
 * if it meets the qualifying scope defined in PRD ?7:
 * - Direction: Outgoing transaction initiated by the subject wallet
 * - Status: Successful (status === "ok" / result === "success")
 * - Window: Timestamp falls within the declared [startUtc, endUtc] observation window
 */
export function normalizeBlockscoutItem(
  item: BlockscoutTransactionItem,
  options: NormalizationOptions
): ItemQualificationResult {
  const subjectLower = options.subjectAddress.toLowerCase();
  const senderHash = item.from?.hash?.toLowerCase();

  // 1. Direction check: Must be sent by the subject wallet
  if (!senderHash || senderHash !== subjectLower) {
    return {
      qualifies: false,
      reason: `Transaction from ${item.from?.hash} does not match subject ${options.subjectAddress}`
    };
  }

  // 2. Status check: Must be successful
  const statusOk = item.status === "ok" || item.result === "success";
  if (!statusOk) {
    return {
      qualifies: false,
      reason: `Transaction status is not ok (status=${item.status}, result=${item.result})`
    };
  }

  // 3. Window check: Must fall inside declared UTC observation window
  const txTime = new Date(item.timestamp).getTime();
  const startTime = new Date(options.window.startUtc).getTime();
  const endTime = new Date(options.window.endUtc).getTime();

  if (isNaN(txTime)) {
    return {
      qualifies: false,
      reason: `Invalid transaction timestamp: ${item.timestamp}`
    };
  }

  if (txTime < startTime || txTime > endTime) {
    return {
      qualifies: false,
      reason: `Timestamp ${item.timestamp} falls outside observation window [${options.window.startUtc}, ${options.window.endUtc}]`
    };
  }

  // Build and validate normalized EvidenceRecord
  const explorerBase = (options.explorerBaseUrl || "https://eth.blockscout.com").replace(/\/+$/, "");
  const evidenceId = buildEvidenceId(options.chainId, item.hash);

  const rawRecord = {
    evidenceId,
    chainId: options.chainId,
    transactionHash: item.hash,
    logIndex: null,
    timestamp: new Date(item.timestamp).toISOString(),
    sender: item.from.hash,
    recipient: item.to?.hash ?? null,
    status: item.status,
    provider: options.providerName || "Blockscout",
    sourceReference: `${explorerBase}/tx/${item.hash}`
  };

  const parsed = evidenceRecordSchema.safeParse(rawRecord);
  if (!parsed.success) {
    return {
      qualifies: false,
      reason: `EvidenceRecord schema validation failed: ${parsed.error.message}`
    };
  }

  return {
    qualifies: true,
    record: parsed.data
  };
}

/**
 * Deduplicates EvidenceRecords by chain ID + transaction hash.
 * PRD ?7: "Deduplicate transactions by chain ID plus transaction hash."
 */
export function deduplicateEvidence(records: EvidenceRecord[]): EvidenceRecord[] {
  const seen = new Set<string>();
  const unique: EvidenceRecord[] = [];

  for (const record of records) {
    const key = `${record.chainId}:${record.transactionHash.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(record);
    }
  }

  return unique;
}

/**
 * Normalizes a list of Blockscout items, filters by qualification criteria,
 * and deduplicates the resulting EvidenceRecords.
 */
export function normalizeAndDeduplicateBlockscoutItems(
  items: BlockscoutTransactionItem[],
  options: NormalizationOptions
): {
  qualifyingEvidence: EvidenceRecord[];
  totalEvaluated: number;
  qualifyingCount: number;
  dedupedCount: number;
  duplicateCount: number;
} {
  const qualifying: EvidenceRecord[] = [];

  for (const item of items) {
    const result = normalizeBlockscoutItem(item, options);
    if (result.qualifies && result.record) {
      qualifying.push(result.record);
    }
  }

  const deduped = deduplicateEvidence(qualifying);

  return {
    qualifyingEvidence: deduped,
    totalEvaluated: items.length,
    qualifyingCount: qualifying.length,
    dedupedCount: deduped.length,
    duplicateCount: qualifying.length - deduped.length
  };
}
