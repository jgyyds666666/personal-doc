import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/api-security";
import { createSession, verifyAdminPassword } from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-rate-limit";

export const dynamic = "force-dynamic";

function getClientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const clientKey = getClientKey(request);
  const limit = checkLoginRateLimit(clientKey);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "尝试次数过多，请稍后再试" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请求格式不正确" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof body.password === "string"
      ? body.password
      : "";

  if (!password || password.length > 256) {
    recordLoginFailure(clientKey);
    return NextResponse.json(
      { error: "密码不正确" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (!(await verifyAdminPassword(password))) {
      recordLoginFailure(clientKey);
      return NextResponse.json(
        { error: "密码不正确" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    clearLoginFailures(clientKey);
    await createSession();
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Login configuration error:", error);
    return NextResponse.json(
      { error: "服务器尚未完成登录配置" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
