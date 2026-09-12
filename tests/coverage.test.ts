import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCoverage } from "../packages/analysis/src/coverage.js";

test("coverage status: complete_for_query when pagination ends cleanly without truncation", () => {
  const result = evaluateCoverage({
    reachedEnd: true,
    hitPageLimit: false,
    pageCount: 2,
    totalRowsRetrieved: 100,
    matchingRowsCount: 28
  });

  assert.equal(result.coverageStatus, "complete_for_query");
  assert.equal(result.isTruncated, false);
  assert.equal(result.pageCount, 2);
  assert.equal(result.totalRowsRetrieved, 100);
  assert.equal(result.matchingRowsCount, 28);
  assert.match(result.details ?? "", /Complete transaction history/);
});

test("coverage status: partial when pagination hits page limit with more data pending", () => {
  const result = evaluateCoverage({
    reachedEnd: false,
    hitPageLimit: true,
    pageCount: 5,
    totalRowsRetrieved: 250,
    matchingRowsCount: 45
  });

  assert.equal(result.coverageStatus, "partial");
  assert.equal(result.isTruncated, true);
  assert.equal(result.pageCount, 5);
  assert.equal(result.totalRowsRetrieved, 250);
  assert.equal(result.matchingRowsCount, 45);
  assert.match(result.details ?? "", /reached maximum pagination limit/);
});

test("coverage status: partial when an error occurred after initial pages", () => {
  const result = evaluateCoverage({
    reachedEnd: false,
    hitPageLimit: false,
    fetchErrorAfterPages: true,
    pageCount: 2,
    totalRowsRetrieved: 100,
    matchingRowsCount: 28
  });

  assert.equal(result.coverageStatus, "partial");
  assert.equal(result.isTruncated, true);
  assert.match(result.details ?? "", /error occurred while fetching subsequent pages/);
});

test("coverage status: unknown when metadata is inconclusive or unverified", () => {
  const result = evaluateCoverage({
    reachedEnd: false,
    hitPageLimit: false,
    isInconclusive: true,
    pageCount: 0,
    totalRowsRetrieved: 0,
    matchingRowsCount: 0
  });

  assert.equal(result.coverageStatus, "unknown");
  assert.equal(result.isTruncated, false);
  assert.match(result.details ?? "", /could not be determined/);
});
