import { NextRequest, NextResponse } from "next/server";
import { validateImportedBundle } from "../../lib/validate-bundle.js";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const result = validateImportedBundle(json);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        isValid: false,
        errorSummary: `Failed to parse payload: ${msg}`,
        steps: [
          {
            step: "schema",
            name: "1. Bundle Envelope Schema",
            passed: false,
            message: `Malformed JSON payload: ${msg}`
          }
        ],
        integrityLabel: "Integrity not verified",
        integrityExplanation: "Could not parse JSON payload.",
        publicationLabel: "Publication status unknown",
        publicationExplanation: "Could not inspect publication metadata."
      },
      { status: 400 }
    );
  }
}
