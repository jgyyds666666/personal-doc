import { NextResponse } from "next/server";
import { listFilesFromStorage } from "@/lib/storage";

export async function GET() {
  try {
    const files = await listFilesFromStorage();

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
