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

/** 提取并规范化一个 origin/host 字符串的可比较 host 部分（去协议、路径、端口）。 */
function extractCompareHost(value: string): string {
  let s = value.trim();
  const schemeIndex = s.indexOf("://");
  if (schemeIndex !== -1) {
    s = s.slice(schemeIndex + 3);
  }
  const slashIndex = s.indexOf("/");
  if (slashIndex !== -1) {
    s = s.slice(0, slashIndex);
  }
  // 去掉端口（含 :80 / :443 等），避免 https://host:443 ≠ https://host 的误判
  s = s.replace(/:\d+$/, "");
  return s.toLowerCase();
}

/** 取反向代理多级转发链上的第一个（最接近客户端的）host。 */
function firstForwardedHost(value: string): string {
  const first = value.split(",")[0];
  return first ? first.trim() : value;
}

/**
 * 校验 Origin 是否命中 ALLOWED_ORIGINS 白名单（逗号分隔，可带协议/端口）。
 * 用于反向代理链无法正确透传 Host / X-Forwarded-Host 的生产网关场景。
 */
function isAllowlistedOrigin(rawOrigin: string): boolean {
  const allowed = process.env.ALLOWED_ORIGINS;
  if (!allowed) {
    return false;
  }
  const originHost = extractCompareHost(rawOrigin);
  if (!originHost) {
    return false;
  }
  return allowed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .some((item) => extractCompareHost(item) === originHost);
}

export function requireSameOrigin(request: NextRequest): NextResponse | null {
  const rawOrigin = request.headers.get("origin");

  // 无 Origin 的请求（同源导航、服务端 / curl 等）不拦截
  if (!rawOrigin) {
    return null;
  }

  // 命中显式白名单（生产网关场景的可靠出口）
  if (isAllowlistedOrigin(rawOrigin)) {
    return null;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const rawHost = forwardedHost
    ? firstForwardedHost(forwardedHost)
    : (request.headers.get("host") ?? "");

  if (!rawHost) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const originHost = extractCompareHost(rawOrigin);
  const hostHost = extractCompareHost(rawHost);

  if (originHost && originHost === hostHost) {
    return null;
  }

  return NextResponse.json(
    { error: "Invalid request origin" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function requireAuthenticatedMutation(
  request: NextRequest,
): Promise<NextResponse | null> {
  return (await requireAuthentication()) ?? requireSameOrigin(request);
}
