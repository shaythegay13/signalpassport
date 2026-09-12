import type { PassportPayload, AiExplanation } from "@signal-passport/schema";
import { createModelInput } from "./input.js";
import { SIGNAL_PASSPORT_SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";
import { validateAiExplanation } from "./validation.js";
import { generateDeterministicExplanation } from "./fallback.js";
import { getProviderConfig, callLlm } from "./provider.js";
import type { ProviderId } from "./types.js";

export type GenerateExplanationOptions = {
  providerId?: ProviderId;
  apiKey?: string;
  allowFallback?: boolean;
};

/**
 * Generates and validates an AI explanation for a PassportPayload per PRD §10.
 *
 * Resilience guarantee:
 * - If model call fails (no key, rate limit, timeout, network error) -> falls back to deterministic summary.
 * - If model output fails validation -> executes 1 repair attempt feeding back the exact rejection reason.
 * - If repair fails validation -> falls back to deterministic summary.
 * - Never throws. Never blocks Passport generation or export.
 */
export async function generateExplanation(
  payload: PassportPayload,
  options: GenerateExplanationOptions = {}
): Promise<AiExplanation> {
  const allowFallback = options.allowFallback !== false;
  const provider = getProviderConfig(options.providerId);
  const input = createModelInput(payload);

  try {
    let rejection = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = buildUserPrompt(input, rejection);
      const { content, model } = await callLlm(prompt, SIGNAL_PASSPORT_SYSTEM_PROMPT, provider, options.apiKey);

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Try extracting JSON block if model included markdown backticks
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error("Model response was not valid JSON");
        }
      }

      const validation = validateAiExplanation(parsed, input, payload, model);
      if (validation.valid) {
        return validation.explanation;
      }

      rejection = validation.error;
    }

    // Validation failed twice
    if (!allowFallback) {
      throw new Error(`Model output failed validation after 2 attempts: ${rejection}`);
    }
    return generateDeterministicExplanation(payload);
  } catch (err: unknown) {
    if (!allowFallback) {
      throw err;
    }
    return generateDeterministicExplanation(payload);
  }
}
