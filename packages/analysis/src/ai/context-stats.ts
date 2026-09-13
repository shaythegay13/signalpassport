import type { PassportPayload } from "@signal-passport/schema";

export interface RecipientConcentration {
  maxRecipientTxCount: number;
  totalQualifyingTxCount: number;
  recipientAddress?: string;
}

export interface ContextStats {
  daysSinceLastActivity?: number;
  recipientConcentration?: RecipientConcentration | null;
}

/**
 * Computes deterministic context statistics (recency and recipient concentration) per PRD §10 and M10.
 *
 * 1. Recency:
 *    daysSinceLastActivity = Math.max(0, Math.round((generationTimestamp - latestEvidenceTimestamp) / (1000*60*60*24)))
 *    where latestEvidenceTimestamp is the maximum timestamp across payload.evidence.
 *    If payload.evidence is empty (zero-activity Passport), this stat is omitted (undefined).
 *
 * 2. Recipient concentration:
 *    Groups payload.evidence by recipient (skipping null recipients, e.g. contract creations).
 *    Finds recipient with the most transactions.
 *    If there are zero or one unique recipients among qualifying transactions, or if maxCount equals 1
 *    (every recipient received exactly one transaction — no concentration at all), treated as no concentration (null).
 *    Otherwise returns { maxRecipientTxCount, totalQualifyingTxCount, recipientAddress }.
 */
export function computeContextStats(payload: PassportPayload): ContextStats {
  const stats: ContextStats = {};

  // 1. Recency
  if (payload.evidence && payload.evidence.length > 0) {
    const genMs = new Date(payload.generationTimestamp).getTime();
    let latestEvidenceTimestamp = -Infinity;

    for (const ev of payload.evidence) {
      const t = new Date(ev.timestamp).getTime();
      if (!isNaN(t) && t > latestEvidenceTimestamp) {
        latestEvidenceTimestamp = t;
      }
    }

    if (latestEvidenceTimestamp !== -Infinity && !isNaN(genMs)) {
      stats.daysSinceLastActivity = Math.max(
        0,
        Math.round((genMs - latestEvidenceTimestamp) / (1000 * 60 * 60 * 24))
      );
    }
  }

  // 2. Recipient concentration
  if (payload.evidence && payload.evidence.length > 0) {
    const recipientCounts = new Map<string, number>();
    for (const ev of payload.evidence) {
      if (ev.recipient) {
        recipientCounts.set(ev.recipient, (recipientCounts.get(ev.recipient) || 0) + 1);
      }
    }

    const uniqueRecipientCount = recipientCounts.size;
    let maxCount = 0;
    let maxRecipient: string | undefined;

    for (const [recipient, count] of recipientCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxRecipient = recipient;
      }
    }

    // Only report concentration if > 1 unique recipient AND maxCount > 1
    // If <= 1 unique recipient or maxCount <= 1, treat as no concentration (null)
    if (uniqueRecipientCount > 1 && maxCount > 1 && maxRecipient) {
      stats.recipientConcentration = {
        maxRecipientTxCount: maxCount,
        totalQualifyingTxCount: payload.evidence.length,
        recipientAddress: maxRecipient
      };
    } else {
      stats.recipientConcentration = null;
    }
  } else {
    stats.recipientConcentration = null;
  }

  return stats;
}
