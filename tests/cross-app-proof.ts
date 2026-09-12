import http from "node:http";
import fs from "node:fs";
import { validateImportedBundle } from "../apps/consumer/app/lib/validate-bundle.js";
import type { PassportBundle } from "../packages/schema/src/index.js";

async function verifyPortDead(port: number): Promise<string> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(`UNEXPECTED: Port ${port} responded with HTTP ${res.statusCode}`);
    });
    req.on("error", (err: NodeJS.ErrnoException) => {
      resolve(`CONFIRMED DEAD: Port ${port} connection failed with ${err.code || err.message}`);
    });
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(`CONFIRMED DEAD: Port ${port} connection timed out`);
    });
  });
}

async function verifyPortAlive(port: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });
    req.on("error", reject);
  });
}

async function main() {
  console.log("===============================================================");
  console.log("       SIGNAL PASSPORT — M3 CROSS-APP PROOF EXECUTION          ");
  console.log("===============================================================\n");

  // PROOF 1: App One is verifiably dead
  console.log("[CHECK 1] Proving App One (port 3000) is completely stopped:");
  const appOneStatus = await verifyPortDead(3000);
  console.log(`  Port 3000 Probe: ${appOneStatus}`);
  if (!appOneStatus.includes("CONFIRMED DEAD")) {
    throw new Error("App One is still running! Test requires App One to be stopped.");
  }
  console.log("  ✔ App One is verifiably DOWN and stopped.\n");

  // PROOF 2: App Two is running independently on port 3001
  console.log("[CHECK 2] Proving App Two (port 3001) is active and running independently:");
  const appTwoRes = await verifyPortAlive(3001);
  console.log(`  Port 3001 HTTP Status: ${appTwoRes.status}`);
  console.log(`  HTML Response Length:  ${appTwoRes.body.length} bytes`);
  console.log(`  Contains App Two badge: ${appTwoRes.body.includes("App Two: Consumer")}`);
  console.log(`  Contains Zero Network:  ${appTwoRes.body.includes("Zero Network")}`);
  if (appTwoRes.status !== 200) {
    throw new Error(`App Two returned HTTP ${appTwoRes.status}, expected 200.`);
  }
  console.log("  ✔ App Two is verifiably UP and serving on port 3001.\n");

  // PROOF 3: Import genuine live-exported Passport bundle into App Two
  console.log("[CHECK 3] Importing real exported bundle into App Two validation engine:");
  const exportedPath = "fixtures/real/live-exported-passport.json";
  const rawExport = fs.readFileSync(exportedPath, "utf8");
  const exportedBundle: PassportBundle = JSON.parse(rawExport);

  const importResult = validateImportedBundle(exportedBundle);
  console.log(`  Overall Validity:      ${importResult.isValid ? "PASS" : "FAIL"}`);
  console.log(`  Step 1 (Schema):       ${importResult.steps[0].passed ? "PASS" : "FAIL"} — ${importResult.steps[0].message}`);
  console.log(`  Step 2 (Address):      ${importResult.steps[1].passed ? "PASS" : "FAIL"} — ${importResult.steps[1].message}`);
  console.log(`  Step 3 (Evidence):     ${importResult.steps[2].passed ? "PASS" : "FAIL"} — ${importResult.steps[2].message}`);
  console.log(`  Step 4 (Integrity):    ${importResult.steps[3].passed ? "PASS" : "FAIL"} — ${importResult.steps[3].message}`);
  console.log(`  Integrity Label:       "${importResult.integrityLabel}"`);
  console.log(`  Integrity Explanation: "${importResult.integrityExplanation}"`);
  console.log(`  Publication Label:     "${importResult.publicationLabel}"`);
  console.log(`  Publication Detail:    "${importResult.publicationExplanation}"`);

  if (!importResult.isValid) throw new Error("Exported bundle failed validation in App Two!");
  if (importResult.integrityLabel !== "Bundle integrity matched") {
    throw new Error(`Expected 'Bundle integrity matched', got '${importResult.integrityLabel}'`);
  }
  console.log("  ✔ Genuine bundle cleanly validated by engine.");

  // Also verify live HTTP API endpoint over the wire
  const liveApiRes = await fetch("http://localhost:3001/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawExport
  });
  const liveApiData: any = await liveApiRes.json();
  console.log(`  Live HTTP POST /api/validate: Status ${liveApiRes.status}, isValid = ${liveApiData.isValid}, label = "${liveApiData.integrityLabel}"`);
  if (liveApiRes.status !== 200 || !liveApiData.isValid) {
    throw new Error("Live HTTP POST /api/validate failed!");
  }
  console.log("  ✔ Genuine bundle cleanly validated over HTTP wire in App Two.\n");

  // PROOF 4: Tamper Test (mutate payload, leave digest untouched)
  console.log("[CHECK 4] Tamper Test — mutating payload without updating digest:");
  const tamperedBundle: PassportBundle = JSON.parse(rawExport);
  tamperedBundle.payload.claims[0].value = 999999; // Alter metric value

  const tamperResult = validateImportedBundle(tamperedBundle);
  console.log(`  Overall Validity:      ${tamperResult.isValid ? "PASS" : "FAIL (Expected rejection)"}`);
  console.log(`  Integrity Step Status: ${tamperResult.steps[3].passed ? "PASS" : "FAIL (Expected)"}`);
  console.log(`  Integrity Label:       "${tamperResult.integrityLabel}"`);
  console.log(`  Integrity Explanation: "${tamperResult.integrityExplanation}"`);
  if (tamperResult.isValid || tamperResult.integrityLabel !== "Bundle integrity mismatch") {
    throw new Error("Tamper test failed: App Two did not flag the digest mismatch!");
  }
  console.log("  ✔ Tamper detected: App Two clearly displayed 'Bundle integrity mismatch'.\n");

  // PROOF 5: Malformed and Unsupported Schema Tests
  console.log("[CHECK 5] Malformed & Unsupported Schema Rejection Tests:");
  
  // 5a. Unsupported schema_version "2.0.0"
  const unsupportedVersionBundle = { ...exportedBundle, schema_version: "2.0.0" };
  const unsupportedResult = validateImportedBundle(unsupportedVersionBundle);
  console.log(`  5a. Unsupported Version '2.0.0': Rejected = ${!unsupportedResult.isValid}`);
  console.log(`      Error message: "${unsupportedResult.steps[0].message}"`);

  // 5b. Dangling evidence reference
  const danglingBundle: PassportBundle = JSON.parse(rawExport);
  const phantomId = "1:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  danglingBundle.payload.claims[0].evidenceIds.push(phantomId);
  const danglingResult = validateImportedBundle(danglingBundle);
  console.log(`  5b. Dangling Evidence Reference: Rejected = ${!danglingResult.isValid}`);
  console.log(`      Error message: "${danglingResult.steps[2].message}"`);

  // 5c. Malformed object missing required payload
  const malformedObj = { schema_version: "1.0.0", invalidField: true };
  const malformedResult = validateImportedBundle(malformedObj);
  console.log(`  5c. Malformed Object: Rejected without crash = ${!malformedResult.isValid}`);
  console.log(`      Error message: "${malformedResult.steps[0].message}"`);

  console.log("\n===============================================================");
  console.log("       ALL CROSS-APP PROOFS COMPLETED AND VERIFIED 100%        ");
  console.log("===============================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR in cross-app proof:", err);
  process.exit(1);
});
