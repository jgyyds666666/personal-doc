import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl, isAllowedStorageKey } from "@/lib/storage";
import { requireAuthentication } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authenticationError = await requireAuthentication();
  if (authenticationError) {
    return authenticationError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key || !isAllowedStorageKey(key)) {
      return NextResponse.json(
        { error: "Invalid file key" },
        { status: 400 }
      );
    }

    const downloadUrl = await getDownloadUrl(key, 300);

    return NextResponse.json(
      { success: true, data: { downloadUrl } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Download URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
