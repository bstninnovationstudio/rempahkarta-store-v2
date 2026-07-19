import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const N = 16_384;
const r = 8;
const p = 1;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

export async function hashAdminPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error("Password admin harus 12–256 karakter");
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyAdminPasswordHash(password: string, encoded: string) {
  const parts = encoded.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt") return false;
  const [encodedN, encodedR, encodedP] = parts.slice(1, 4).map(Number);
  if (encodedN !== N || encodedR !== r || encodedP !== p) return false;
  try {
    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");
    // Parts has a reserved version slot for forward-compatible parameter upgrades.
    const version = parts[6];
    if (version !== "v1" || salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createAdminPasswordHash(password: string) {
  return `${await hashAdminPassword(password)}$v1`;
}
