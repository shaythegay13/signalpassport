import type { ContextStats } from "./context-stats.js";

export type ModelInput = {
  subjectAddress: string;
  chainId: number;
  observationWindow: {
    startUtc: string;
    endUtc: string;
  };
  coverageStatus: string;
  claims: Array<{
    metricType: string;
    label: string;
    value: number;
    units: string;
  }>;
  evidence: Array<{
    evidenceId: string;
    transactionHash: string;
    timestamp: string;
    recipient: string | null;
  }>;
  contextStats: ContextStats;
};

export type ProviderId = "groq" | "anthropic";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  modelId: string;
  apiKeyVariable: string;
};
