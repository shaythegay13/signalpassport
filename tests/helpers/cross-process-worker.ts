import { canonicalJsonStringify, computePayloadDigest } from "../../packages/verification/src/index.js";

/**
 * Standalone worker process for cross-process determinism testing per PRD §8.
 * Reads a JSON payload from stdin, canonicalizes it, computes its SHA-256 digest,
 * and writes the result to stdout as JSON.
 */
let rawInput = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk: string) => {
  rawInput += chunk;
});

process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(rawInput);
    const canonical = canonicalJsonStringify(payload);
    const digest = computePayloadDigest(payload);
    process.stdout.write(JSON.stringify({ canonical, digest }));
    process.exit(0);
  } catch (err) {
    process.stderr.write(String(err));
    process.exit(1);
  }
});
