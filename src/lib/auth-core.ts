import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_OPTIONS: ScryptOptions = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const SESSION_VERSION = 1;

interface SessionPayload {
  exp: number;
  v: number;
}

function derivePasswordKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 6) {
    throw new Error("管理员密码至少需要 6 个字符");
  }

  const salt = randomBytes(16);
  const derivedKey = await derivePasswordKey(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_OPTIONS,
  );

  return [
    "scrypt",
    String(SCRYPT_OPTIONS.N),
    String(SCRYPT_OPTIONS.r),
    String(SCRYPT_OPTIONS.p),
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");

  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N < 2 ||
    r < 1 ||
    p < 1 ||
    salt.length < 16 ||
    expected.length < 32
  ) {
    return false;
  }

  try {
    const actual = await derivePasswordKey(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  secret: string,
  expiresAt: Date,
): string {
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET 至少需要 32 个字符");
  }

  const payload: SessionPayload = {
    exp: Math.floor(expiresAt.getTime() / 1000),
    v: SESSION_VERSION,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (secret.length < 32) {
    return false;
  }

  const [encodedPayload, providedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra.length > 0) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  if (
    !safeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature),
    )
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    return (
      payload.v === SESSION_VERSION &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(now.getTime() / 1000)
    );
  } catch {
    return false;
  }
}
