import { NextRequest, NextResponse } from "next/server";
import { uploadFileToStorage } from "@/lib/storage";
import { requireAuthenticatedMutation } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const securityError = await requireAuthenticatedMutation(request);
  if (securityError) {
    return securityError;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || !file.name || file.name.length > 255) {
      return NextResponse.json(
        { error: "Invalid file" },
        { status: 400 }
      );
    }

    // Limit file size to 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFileToStorage(buffer, file.name, file.type);

    return NextResponse.json(
      {
        success: true,
        data: {
          key: result.key,
          originalName: result.originalName,
          size: file.size,
          uploadTime: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
