import fs from "node:fs";
import { verifyBundleIntegrity } from "../packages/verification/src/index.js";
import { passportBundleSchema, type PassportBundle } from "../packages/schema/src/index.js";

const raw = fs.readFileSync("fixtures/real/live-exported-passport.json", "utf8");
const bundle: PassportBundle = JSON.parse(raw);
const validated = passportBundleSchema.parse(bundle);
const check = verifyBundleIntegrity(validated);

console.log("=== RELOAD-AFTER-DOWNLOAD VERIFICATION ===");
console.log("Integrity check result isValid:", check.isValid);
console.log("Stored envelope digest:        ", check.expectedDigest);
console.log("Recomputed payload digest:     ", check.actualDigest);
console.log("Digests match exactly:         ", check.actualDigest === check.expectedDigest);
console.log("Schema version:                ", validated.schema_version);
console.log("Subject address:               ", validated.payload.subjectAddress);
console.log("Claims count:                  ", validated.payload.claims.length);
console.log("Evidence count:                ", validated.payload.evidence.length);
console.log("Coverage status:               ", validated.payload.coverage.coverageStatus);
