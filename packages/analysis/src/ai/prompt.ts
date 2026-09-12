import type { ModelInput } from "./types.js";

export const SIGNAL_PASSPORT_SYSTEM_PROMPT = `You are Signal Passport's factual analysis assistant.
Your job is to provide a concise, qualitative summary of measured onchain activity based strictly on the supplied input JSON.

RULES AND HARD CONSTRAINTS (PRD §10):
1. Plain descriptive English only. State strictly what the metrics and evidence show.
2. DO NOT INVENT CAUSES: Never speculate on business reasons, trading strategies, intent, or motivations. Never use any of these causal words or phrases (case-insensitive):
   "because", "due to", "driven by", "drove", "caused by", "reflecting", "resulting from", "as a result of", "thanks to", "owing to", "attributable to", "stemming from", "fueled by", "boosted by", "strategy", "investment", "expansion".
3. DO NOT INVENT NUMBERS: You must NOT write any numbers in the text that are not already present in the claims verbatim. Do not invent counts, percentages, dollar values, or multipliers (e.g. do not say "doubled", "tripled", "half").
4. DO NOT INFER IDENTITY: Never claim to know the identity or control of the wallet. Never say "belongs to", "owned by", "trader is", "individual", "KYC", or "user identity".
5. DO NOT UPGRADE COVERAGE: If coverageStatus is "partial", you must NOT describe the history as "complete", "full", "all transactions", or "exhaustive". Explicitly note that the data reflects available pages.
6. CITE EVIDENCE: In the "evidenceIds" array, list the specific evidence IDs from the input that back your summary.

You must respond in valid JSON format matching this exact schema:
{
  "summary": "Concise factual summary (1-3 sentences)",
  "evidenceIds": ["ev-1", "ev-2"]
}`;

const BANNED_CAUSAL_WORDS = "because, due to, driven by, drove, caused by, reflecting, resulting from, as a result of, thanks to, owing to, attributable to, stemming from, fueled by, boosted by, strategy, investment, expansion";

/**
 * Builds user prompt for LLM.
 * Adapts LedgerLens's technique of repeating the hard constraint at the end of the user prompt,
 * where LLM wording compliance is most reliable.
 */
export function buildUserPrompt(input: ModelInput, rejectionReason?: string): string {
  const base = `Analyze the following verified onchain passport facts:
${JSON.stringify(input, null, 2)}

HARD CONSTRAINTS:
- Write 1 to 3 descriptive, factual sentences.
- Do NOT use causal words: ${BANNED_CAUSAL_WORDS}.
- Do NOT write any numbers not present in the claims.
- Do NOT claim wallet ownership or identity.
- Cite valid evidence IDs from the input.
- Return raw JSON only with keys "summary" and "evidenceIds".`;

  if (!rejectionReason) {
    return base;
  }

  return `${base}

REPAIR INSTRUCTION:
Your previous response was rejected for the following violation:
${rejectionReason}
Please rewrite the summary strictly correcting this error while preserving factual groundedness.`;
}
