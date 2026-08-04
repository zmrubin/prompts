import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { env } from '@/env'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

function key(): Buffer {
  return Buffer.from(env().ENCRYPTION_KEY, 'base64')
}

/**
 * Encrypts a credential blob at rest. Format: iv:authTag:ciphertext, all
 * base64. Every call gets a fresh IV, so encrypting the same value twice
 * produces different output — that is intentional.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    enc.toString('base64'),
  ].join(':')
}

export function decrypt(blob: string): string {
  const [ivB64, tagB64, dataB64] = blob.split(':')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed ciphertext')
  }
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value))
}

export function decryptJson<T>(blob: string): T {
  return JSON.parse(decrypt(blob)) as T
}

// ---------------------------------------------------------------------------
// Password hashing for the single admin user.
// Format: scrypt:<saltB64>:<hashB64>
//
// The separator is ":" and not "$" deliberately. Next.js runs .env values
// through dotenv-expand, which treats "$" as the start of a variable
// reference — a "$"-separated hash silently loses everything after the first
// "$" when loaded from .env, and login then rejects the correct password with
// no error anywhere. ":" is not in the base64 alphabet and is not expanded.
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64)
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(':')
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length)
  // Length check first: timingSafeEqual throws on a length mismatch.
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
