import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing via Node's built-in scrypt — no external dependency,
 * same "use what the platform gives you" reasoning as CSV export
 * (src/lib/csv.ts) and the timing-safe compare src/proxy.ts already hand-
 * rolled for the same class of problem. scrypt is a deliberately slow,
 * memory-hard KDF, which is what makes it suitable for passwords (unlike a
 * plain hash).
 *
 * Stored format: "salt:hash", both hex — self-contained, no separate salt
 * column needed.
 */

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false

  const hashBuffer = Buffer.from(hash, 'hex')
  const candidateBuffer = scryptSync(password, salt, KEY_LENGTH)

  // Lengths must match before timingSafeEqual — it throws on a mismatch
  // rather than returning false, and the length itself isn't secret here.
  if (hashBuffer.length !== candidateBuffer.length) return false

  return timingSafeEqual(hashBuffer, candidateBuffer)
}
