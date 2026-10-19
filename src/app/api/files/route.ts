import { NextRequest, NextResponse } from "next/server";
import { listFilesFromStorage } from "@/lib/storage";
import { requireAuthentication } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authenticationError = await requireAuthentication();
  if (authenticationError) {
    return authenticationError;
  }

  try {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    if (cursor && cursor.length > 4096) {
      return NextResponse.json(
        { error: "Invalid pagination cursor" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
    const result = await listFilesFromStorage({ cursor, maxKeys: limit });

    return NextResponse.json(
      {
        success: true,
        data: result.files,
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.isTruncated,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
