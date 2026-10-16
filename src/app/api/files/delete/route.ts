import { NextRequest, NextResponse } from "next/server";
import { deleteFileFromStorage } from "@/lib/storage";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "File key is required" },
        { status: 400 }
      );
    }

    const result = await deleteFileFromStorage(key);

    if (!result) {
      return NextResponse.json(
        { error: "File not found or delete failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
