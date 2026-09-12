import { z } from "zod";

export const observationScopeSchema = z.object({
  subjectAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int().positive(),
  window: z.object({
    startUtc: z.string().datetime(),
    endUtc: z.string().datetime()
  }),
  direction: z.literal("outgoing"),
  status: z.literal("ok")
});

export type ObservationScope = z.infer<typeof observationScopeSchema>;

export const metricTypeSchema = z.enum([
  "observed_transaction_count",
  "active_days",
  "unique_recipients"
]);

export type MetricType = z.infer<typeof metricTypeSchema>;

export const claimSchema = z.object({
  claimId: z.string().min(1),
  metricType: metricTypeSchema,
  value: z.number().nonnegative(),
  units: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1, "evidenceIds must be non-empty"),
  calculationVersion: z.string().min(1),
  declaredObservationScope: observationScopeSchema
});

export type Claim = z.infer<typeof claimSchema>;
