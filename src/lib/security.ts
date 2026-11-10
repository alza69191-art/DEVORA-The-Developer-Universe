import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, digest] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !digest || !/^[a-f0-9]{128}$/i.test(digest)) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validUsername(value: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(value);
}

export function safeFileName(value: string): string {
  return value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120) || "upload.bin";
}
