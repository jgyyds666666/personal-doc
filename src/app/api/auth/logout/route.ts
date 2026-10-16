import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/api-security";
import { clearSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  await clearSession();
  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
