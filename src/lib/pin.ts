/**
 * PIN hashing for local profile locks (PBKDF2-SHA-256 via WebCrypto).
 *
 * This keeps a profile private from casual use of a shared phone; it is not
 * encryption — the library data itself sits unencrypted in browser storage.
 */

const ITERATIONS = 150_000;

const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));

export function pinSupported(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

export async function hashPin(pin: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const { hash: candidate } = await hashPin(pin, salt);
  // Constant-time-ish comparison.
  let diff = candidate.length ^ hash.length;
  for (let i = 0; i < Math.min(candidate.length, hash.length); i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
