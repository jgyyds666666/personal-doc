import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "File key is required" },
        { status: 400 }
      );
    }

    const downloadUrl = await getDownloadUrl(key, 3600);

    return NextResponse.json({
      success: true,
      data: { downloadUrl },
    });
  } catch (error) {
    console.error("Download URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
