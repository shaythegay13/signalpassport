import { z } from "zod";

/**
 * Derives a stable, chain-scoped evidence ID for transaction-level evidence.
 * Format: `${chainId}:${transactionHash.toLowerCase()}`
 * If a log index is present, it is appended: `${chainId}:${transactionHash.toLowerCase()}:${logIndex}`
 * Per PRD §7: "preserve log index in evidence IDs while counting unique transactions separately".
 */
export function buildEvidenceId(chainId: number, txHash: string, logIndex?: number | null): string {
  const normalizedHash = txHash.toLowerCase();
  if (logIndex !== undefined && logIndex !== null) {
    return `${chainId}:${normalizedHash}:${logIndex}`;
  }
  return `${chainId}:${normalizedHash}`;
}

export const evidenceRecordSchema = z.object({
  evidenceId: z.string().min(1),
  chainId: z.number().int().positive(),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash format"),
  logIndex: z.number().int().nonnegative().nullable().optional(),
  timestamp: z.string().datetime({ message: "Timestamp must be an ISO 8601 UTC string" }),
  sender: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid sender Ethereum address format"),
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid recipient Ethereum address format").nullable(),
  status: z.string().min(1),
  provider: z.string().min(1),
  sourceReference: z.string().url("sourceReference must be a valid explorer URL")
});

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
