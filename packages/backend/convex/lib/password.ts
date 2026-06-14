/**
 * Password hashing for the phone + password auth flow (replaces the demo OTP).
 *
 * Uses Web Crypto PBKDF2-SHA256 — available in the Convex action runtime where
 * the `phone-password` provider's `authorize` and the `accounts.changePassword`
 * action run. Stored form is `pbkdf2$<iterations>$<saltHex>$<hashHex>` so the
 * iteration count + salt travel with the hash (future-proof if we raise cost).
 *
 * NOTE: `newSaltHex()` calls `crypto.getRandomValues`, which is only allowed in
 * ACTIONS (it is non-deterministic). Never call it from a query/mutation — hash
 * there only via `verifyPassword` / `hashPassword`, which are deterministic.
 */

const ITERATIONS = 100_000;
const KEY_BITS = 256;

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Derive the PBKDF2 hash (hex) of `password` with the given salt. Deterministic. */
async function deriveHashHex(
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex) as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    key,
    KEY_BITS,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** A fresh 16-byte salt (hex). ACTION-ONLY — uses getRandomValues. */
export function newSaltHex(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

/** Hash a new password into its stored form. ACTION-ONLY (generates a salt). */
export async function hashPassword(password: string): Promise<string> {
  const saltHex = newSaltHex();
  const hashHex = await deriveHashHex(password, saltHex, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${saltHex}$${hashHex}`;
}

/** Constant-time-ish compare of two equal-length hex strings. */
function hexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify `password` against a stored `pbkdf2$...` value. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const candidate = await deriveHashHex(password, parts[2], iterations);
  return hexEquals(candidate, parts[3]);
}

/** Minimum password rule shared by set/change paths. */
export function assertPasswordStrength(password: string): void {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}