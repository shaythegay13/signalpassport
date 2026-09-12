import type { CoverageRecord, CoverageStatus } from "@signal-passport/schema";
import { coverageRecordSchema } from "@signal-passport/schema";

export type DetermineCoverageOptions = {
  reachedEnd: boolean;
  hitPageLimit: boolean;
  isTruncated?: boolean;
  pageCount: number;
  totalRowsRetrieved: number;
  matchingRowsCount: number;
  fetchErrorAfterPages?: boolean;
  isInconclusive?: boolean;
};

/**
 * Computes the coverage status and associated pagination metadata per PRD ?7:
 * - "complete_for_query": paginated to next_page_params: null within declared window without truncation
 * - "partial": provider indicated more data exists beyond what was fetched, or query hit page limit / mid-fetch error
 * - "unknown": coverage could not be conclusively determined
 */
export function evaluateCoverage(options: DetermineCoverageOptions): CoverageRecord {
  let status: CoverageStatus;
  let details: string;

  if (options.isInconclusive) {
    status = "unknown";
    details = "Coverage could not be determined due to inconclusive query metadata";
  } else if (options.fetchErrorAfterPages) {
    status = "partial";
    details = "Partial history retrieved; an error occurred while fetching subsequent pages";
  } else if (options.hitPageLimit || options.isTruncated) {
    status = "partial";
    details = "Query reached maximum pagination limit before retrieving complete history";
  } else if (options.reachedEnd) {
    status = "complete_for_query";
    details = "Complete transaction history retrieved for the declared observation query";
  } else {
    status = "unknown";
    details = "Inconclusive pagination state";
  }

  return coverageRecordSchema.parse({
    coverageStatus: status,
    pageCount: options.pageCount,
    isTruncated: status === "partial",
    totalRowsRetrieved: options.totalRowsRetrieved,
    matchingRowsCount: options.matchingRowsCount,
    details
  });
}
