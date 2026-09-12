import { z } from "zod";

export const coverageStatusSchema = z.enum([
  "complete_for_query",
  "partial",
  "unknown"
]);

export type CoverageStatus = z.infer<typeof coverageStatusSchema>;

export const coverageRecordSchema = z.object({
  coverageStatus: coverageStatusSchema,
  pageCount: z.number().int().nonnegative(),
  isTruncated: z.boolean(),
  totalRowsRetrieved: z.number().int().nonnegative(),
  matchingRowsCount: z.number().int().nonnegative(),
  details: z.string().optional()
});

export type CoverageRecord = z.infer<typeof coverageRecordSchema>;
