import test from "node:test";
import assert from "node:assert/strict";
import { fetchBlockscoutPage, fetchBlockscoutHistory } from "../packages/analysis/src/blockscout.js";

test("provider error: network failure surfaces as thrown error, never zero activity", async () => {
  const mockFetch = async () => {
    throw new Error("ENOTFOUND eth.blockscout.com");
  };

  await assert.rejects(
    async () => {
      await fetchBlockscoutPage("0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8", {
        fetchFn: mockFetch as unknown as typeof fetch
      });
    },
    (err: Error) => {
      assert.match(err.message, /Blockscout network request failed/);
      assert.match(err.message, /ENOTFOUND/);
      return true;
    },
    "Network error must surface as a thrown error"
  );
});

test("provider error: HTTP 500 error surfaces as thrown error, never zero activity", async () => {
  const mockFetch = async () => {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      statusText: "Internal Server Error"
    });
  };

  await assert.rejects(
    async () => {
      await fetchBlockscoutPage("0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8", {
        fetchFn: mockFetch as unknown as typeof fetch
      });
    },
    /Blockscout API error: HTTP 500/,
    "HTTP 500 must throw an actionable error"
  );
});

test("provider error: malformed JSON response surfaces as thrown error, never zero activity", async () => {
  const mockFetch = async () => {
    return new Response("<html><head><title>Bad Gateway</title></head></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
  };

  await assert.rejects(
    async () => {
      await fetchBlockscoutPage("0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8", {
        fetchFn: mockFetch as unknown as typeof fetch
      });
    },
    /Blockscout returned malformed JSON/,
    "Malformed JSON must throw an error"
  );
});

test("provider error: history pagination surfaces error if intermediate page fails", async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      return new Response(JSON.stringify({
        items: [{
          hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          timestamp: "2026-08-20T12:00:00.000000Z",
          status: "ok",
          block_number: 25800000,
          from: { hash: "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8" },
          to: { hash: "0x66a3c2Fa3E467Aa586e90912f977e648589CaBaf" }
        }],
        next_page_params: {
          block_number: 25799999,
          index: 10,
          items_count: 50,
          fee: "1000",
          hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          inserted_at: "2026-08-20T12:00:00Z",
          value: "0"
        }
      }));
    }
    return new Response("Gateway timeout", { status: 504, statusText: "Gateway Timeout" });
  };

  await assert.rejects(
    async () => {
      await fetchBlockscoutHistory("0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8", {
        fetchFn: mockFetch as unknown as typeof fetch,
        maxPages: 3
      });
    },
    /Blockscout API error: HTTP 504/,
    "Intermediate failure must throw, not return truncated results silently as complete"
  );
});
