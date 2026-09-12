import { NextRequest, NextResponse } from "next/server";
import { passportPayloadSchema, type PassportPayload } from "@signal-passport/schema";
import { generateExplanation, generateDeterministicExplanation } from "@signal-passport/analysis";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  if (!body.payload) {
    return NextResponse.json({ error: "Missing required 'payload' in request body" }, { status: 400 });
  }

  const parsed = passportPayloadSchema.safeParse(body.payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid PassportPayload structure", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const payload: PassportPayload = parsed.data;

  try {
    // Generate explanation with automatic 1-attempt repair and deterministic fallback
    const explanation = await generateExplanation(payload, {
      allowFallback: true
    });
    return NextResponse.json({ explanation });
  } catch {
    // Ultimate resilience fallback: return deterministic summary rather than failing
    const fallback = generateDeterministicExplanation(payload);
    return NextResponse.json({ explanation: fallback });
  }
}
