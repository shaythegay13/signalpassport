import { NextRequest } from "next/server";
import {
  validateEthereumAddress,
  fetchBlockscoutHistory,
  normalizeAndDeduplicateBlockscoutItems,
  computeDeterministicMetrics,
  evaluateCoverage
} from "@signal-passport/analysis";
import type { ObservationScope, PassportPayload } from "@signal-passport/schema";
import { createPassportBundle } from "@signal-passport/verification";

export const dynamic = "force-dynamic";

const FROZEN_EXAMPLE_SUBJECT = "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8";
const FROZEN_START_UTC = "2026-08-13T00:00:00.000Z";
const FROZEN_END_UTC = "2026-09-12T16:08:11.000Z";

// M12 follow-up: a second, explicitly-opt-in frozen window over the SAME real example
// wallet's real history, only used when the client explicitly requests it (never inferred
// from the address alone). Does not change the default 30-day window for any other request.
// See scripts/generate-extended-fixture.ts for how this exact boundary was derived (100 real,
// successful, outgoing transactions, verified live against Blockscout).
const FROZEN_EXTENDED_START_UTC = "2024-12-19T20:32:00.000Z";
const FROZEN_EXTENDED_END_UTC = "2026-09-12T16:08:11.000Z";

export async function POST(request: NextRequest) {
  let body: {
    address?: string;
    maxPages?: number;
    simulateProviderError?: boolean;
    simulateEmptyActivity?: boolean;
    useExtendedWindow?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { address, maxPages, simulateProviderError, simulateEmptyActivity, useExtendedWindow } = body;
  if (!address || typeof address !== "string") {
    return Response.json(
      { error: "Missing required 'address' string in request body" },
      { status: 400 }
    );
  }

  // 1. Validate Ethereum address using M1's address validator
  const validation = validateEthereumAddress(address);
  if (!validation.isValid) {
    return Response.json(
      {
        error: validation.error || "Invalid Ethereum address format",
        address
      },
      { status: 400 }
    );
  }

  const subjectAddress = validation.checksummed || validation.normalized || address;
  const chainId = 1; // Ethereum Mainnet

  // Observation window: fixed 30-day window per PRD §7
  let startUtc: string;
  let endUtc: string;

  if (subjectAddress.toLowerCase() === FROZEN_EXAMPLE_SUBJECT.toLowerCase() && useExtendedWindow) {
    startUtc = FROZEN_EXTENDED_START_UTC;
    endUtc = FROZEN_EXTENDED_END_UTC;
  } else if (subjectAddress.toLowerCase() === FROZEN_EXAMPLE_SUBJECT.toLowerCase()) {
    startUtc = FROZEN_START_UTC;
    endUtc = FROZEN_END_UTC;
  } else {
    const now = new Date();
    endUtc = now.toISOString();
    startUtc = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const scope: ObservationScope = {
    subjectAddress,
    chainId,
    window: {
      startUtc,
      endUtc
    },
    direction: "outgoing",
    status: "ok"
  };

  // Support streaming SSE / NDJSON for real progress visibility
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  async function sendEvent(data: Record<string, unknown>) {
    await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
  }

  // Run pipeline asynchronously while streaming stages
  (async () => {
    try {
      // Simulation of provider failure (Task 3)
      if (simulateProviderError) {
        throw new Error("Upstream data provider unavailable: Blockscout REST v2 connection refused (HTTP 503). Service temporarily unreachable.");
      }

      // Stage 1: Fetching
      await sendEvent({
        stage: "fetching",
        message: `Querying Blockscout REST v2 for outgoing transactions on Chain ID 1...`,
        subjectAddress,
        chainId,
        window: { startUtc, endUtc }
      });

      let historyResult;
      if (simulateEmptyActivity) {
        historyResult = {
          items: [],
          pageCount: 1,
          reachedEnd: true,
          hitPageLimit: false
        };
      } else {
        historyResult = await fetchBlockscoutHistory(subjectAddress, {
          maxPages: maxPages && maxPages > 0 ? maxPages : 10
        });
      }

      // Stage 2: Normalizing
      await sendEvent({
        stage: "normalizing",
        message: `Retrieved ${historyResult.items.length} raw transaction items across ${historyResult.pageCount} pages. Applying qualifying scope and deduplication...`,
        rawCount: historyResult.items.length,
        pageCount: historyResult.pageCount
      });

      const { qualifyingEvidence, totalEvaluated, qualifyingCount, duplicateCount } =
        normalizeAndDeduplicateBlockscoutItems(historyResult.items, {
          subjectAddress: scope.subjectAddress,
          chainId: scope.chainId,
          window: scope.window
        });

      // Stage 3: Calculating
      await sendEvent({
        stage: "calculating",
        message: `Identified ${qualifyingCount} qualifying transactions (status=ok, outgoing, within 30-day UTC window). Computing deterministic metrics, coverage, and canonical digest...`,
        qualifyingCount,
        duplicateCount
      });

      const { claims, metrics } = computeDeterministicMetrics(qualifyingEvidence, scope);

      const coverage = evaluateCoverage({
        reachedEnd: historyResult.reachedEnd,
        hitPageLimit: historyResult.hitPageLimit,
        pageCount: historyResult.pageCount,
        totalRowsRetrieved: totalEvaluated,
        matchingRowsCount: qualifyingCount
      });

      const payload: PassportPayload = {
        passportId: `${chainId}:${subjectAddress.toLowerCase()}:1.0.0`,
        subjectAddress,
        sourceChainId: chainId,
        snapshotVersion: "1.0.0",
        generationTimestamp: endUtc,
        observationWindow: {
          startUtc,
          endUtc
        },
        coverage,
        claims,
        evidence: qualifyingEvidence,
        methodologyVersion: "1.0.0"
      };

      const bundle = createPassportBundle(payload, "1.0.0");

      // Stage 4: Complete
      await sendEvent({
        stage: "complete",
        message: "Passport bundle generated and cryptographically sealed.",
        bundle,
        metrics,
        claimsCount: claims.length,
        evidenceCount: qualifyingEvidence.length
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      let statusCode = 500;
      if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit")) {
        statusCode = 429;
      } else if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("fetch failed") || errorMessage.toLowerCase().includes("unavailable")) {
        statusCode = 503;
      } else if (errorMessage.includes("502") || errorMessage.toLowerCase().includes("json")) {
        statusCode = 502;
      }

      const isProviderError =
        statusCode === 503 ||
        statusCode === 502 ||
        statusCode === 429 ||
        errorMessage.toLowerCase().includes("provider") ||
        errorMessage.toLowerCase().includes("blockscout") ||
        errorMessage.toLowerCase().includes("fetch failed") ||
        errorMessage.toLowerCase().includes("connection refused");

      await sendEvent({
        stage: "error",
        error: errorMessage,
        statusCode,
        isProviderError
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform"
    }
  });
}
