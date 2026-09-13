import type { ProviderConfig, ProviderId } from "./types.js";

const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  groq: {
    id: "groq",
    label: "Groq",
    modelId: "openai/gpt-oss-120b",
    apiKeyVariable: "GROQ_API_KEY"
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    modelId: "claude-sonnet-5",
    apiKeyVariable: "ANTHROPIC_API_KEY"
  }
};

export const DEFAULT_PROVIDER_ID: ProviderId = "groq";

export function getProviderConfig(raw?: string): ProviderConfig {
  const requested = (raw || process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (requested === "anthropic") return PROVIDERS.anthropic;
  return PROVIDERS.groq;
}

/**
 * Executes chat completion against configured provider.
 */
export async function callLlm(
  prompt: string,
  systemPrompt: string,
  config: ProviderConfig,
  apiKeyOverride?: string
): Promise<{ content: string; model: string }> {
  const apiKey = apiKeyOverride || process.env[config.apiKeyVariable];
  if (!apiKey) {
    throw new Error(`AI provider "${config.label}" requires ${config.apiKeyVariable} which is not configured.`);
  }

  if (config.id === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Groq API responded with status ${res.status}: ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq API returned empty message content");
    return { content, model: config.modelId };
  }

  if (config.id === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelId,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }]
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Anthropic API responded with status ${res.status}: ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const textBlock = data.content?.find((c: any) => c.type === "text");
    if (!textBlock?.text) throw new Error("Anthropic API returned empty text content");
    return { content: textBlock.text, model: config.modelId };
  }

  throw new Error(`Unsupported provider: ${config.id}`);
}
