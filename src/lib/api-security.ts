import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function requireAuthentication(): Promise<NextResponse | null> {
  if (await isAuthenticated()) {
    return null;
  }

  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function requireSameOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ?? new URL(request.url).protocol.slice(0, -1);

  if (!origin || !host || origin !== `${protocol}://${host}`) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  return null;
}

export async function requireAuthenticatedMutation(
  request: NextRequest,
): Promise<NextResponse | null> {
  return (await requireAuthentication()) ?? requireSameOrigin(request);
}
