import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Lightweight per-player gate, not real auth — see plan section 8.
export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passcode, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const candidate = scryptSync(passcode, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;

  return timingSafeEqual(candidate, expected);
}
