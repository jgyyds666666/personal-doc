import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from "@/lib/auth-core";

export type AdminPasswordMode = "plain" | "hash";

export interface AdminPasswordConfig {
  mode: AdminPasswordMode;
  source: "ADMIN_PASSWORD" | "ADMIN_PASSWORD_HASH";
  value: string;
}

interface AdminPasswordEnvironment {
  [key: string]: string | undefined;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PASSWORD_MODE?: string;
}

let cachedPasswordHash: Promise<string> | undefined;

export function readAdminPasswordConfig(
  environment: AdminPasswordEnvironment = process.env,
): AdminPasswordConfig {
  const password = environment.ADMIN_PASSWORD;
  const legacyHash = environment.ADMIN_PASSWORD_HASH;
  const rawMode = environment.ADMIN_PASSWORD_MODE?.trim().toLowerCase();

  if (password) {
    const mode = rawMode || "plain";
    if (mode !== "plain" && mode !== "hash") {
      throw new Error("ADMIN_PASSWORD_MODE 只能是 plain 或 hash");
    }
    return {
      mode,
      source: "ADMIN_PASSWORD",
      value: password,
    };
  }

  if (legacyHash) {
    if (rawMode && rawMode !== "hash") {
      throw new Error(
        "使用 ADMIN_PASSWORD_HASH 时，ADMIN_PASSWORD_MODE 必须是 hash 或留空",
      );
    }
    return {
      mode: "hash",
      source: "ADMIN_PASSWORD_HASH",
      value: legacyHash,
    };
  }

  throw new Error("缺少 ADMIN_PASSWORD");
}

export async function prepareAdminPasswordHash(
  config: AdminPasswordConfig,
): Promise<string> {
  if (config.mode === "plain") {
    return hashPassword(config.value);
  }

  if (!isPasswordHash(config.value)) {
    throw new Error("ADMIN_PASSWORD 不是有效的 scrypt 哈希");
  }
  return config.value;
}

function getCachedPasswordHash(): Promise<string> {
  if (!cachedPasswordHash) {
    const config = readAdminPasswordConfig();

    // 这里只清理当前 Node 进程中的引用；部署平台或 EnvironmentFile 中的值不会被修改。
    if (config.source === "ADMIN_PASSWORD" && config.mode === "plain") {
      delete process.env.ADMIN_PASSWORD;
    }

    cachedPasswordHash = prepareAdminPasswordHash(config);
  }
  return cachedPasswordHash;
}

export async function verifyConfiguredAdminPassword(
  password: string,
): Promise<boolean> {
  const expectedHash = await getCachedPasswordHash();
  return verifyPassword(password, expectedHash);
}
