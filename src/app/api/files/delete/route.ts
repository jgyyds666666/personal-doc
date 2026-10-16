import { NextRequest, NextResponse } from "next/server";
import { deleteFileFromStorage, isAllowedStorageKey } from "@/lib/storage";
import { requireAuthenticatedMutation } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const securityError = await requireAuthenticatedMutation(request);
  if (securityError) {
    return securityError;
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
