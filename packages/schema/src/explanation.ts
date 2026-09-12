import { z } from "zod";

/**
 * AI Explanation schema per PRD §10:
 * Structured output for qualitative description of measured activity.
 * Display layer only; strictly excluded from canonical factual payload.
 */
export const aiExplanationSchema = z.object({
  summary: z.string().min(1).max(1000),
  evidenceIds: z.array(z.string()).max(50),
  model: z.string(),
  generatedAt: z.string(),
  isFallback: z.boolean().default(false)
});

export type AiExplanation = z.infer<typeof aiExplanationSchema>;
