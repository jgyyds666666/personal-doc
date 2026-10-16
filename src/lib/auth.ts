import { cookies } from "next/headers";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth-core";

export const SESSION_COOKIE_NAME = "personal_doc_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("缺少至少 32 个字符的 SESSION_SECRET");
  }
  return secret;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }

  try {
    return verifySessionToken(token, getSessionSecret());
  } catch {
    return false;
  }
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  // 兼容两种配置方式（二选一）：
  //   1) ADMIN_PASSWORD_HASH —— 填入 scrypt$... 格式的哈希（最安全）
  //   2) ADMIN_PASSWORD     —— 直接填明文密码，运行时自动转换为哈希（更易用）
  const configured =
    process.env.ADMIN_PASSWORD_HASH ?? process.env.ADMIN_PASSWORD ?? "";
  if (!configured) {
    throw new Error("缺少 ADMIN_PASSWORD_HASH 或 ADMIN_PASSWORD");
  }

  if (configured.startsWith("scrypt$")) {
    return verifyPassword(password, configured);
  }

  // 明文密码分支：先把配置的明文实时哈希，再与用户输入比较
  const expectedHash = await hashPassword(configured);
  return verifyPassword(password, expectedHash);
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const token = createSessionToken(getSessionSecret(), expiresAt);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}
