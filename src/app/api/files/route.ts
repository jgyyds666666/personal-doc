import { NextResponse } from "next/server";
import { listFilesFromStorage } from "@/lib/storage";
import { requireAuthentication } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const authenticationError = await requireAuthentication();
  if (authenticationError) {
    return authenticationError;
  }

  try {
    const files = await listFilesFromStorage();

    return NextResponse.json(
      { success: true, data: files },
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
