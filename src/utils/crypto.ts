/**
 * Encryption Utilities
 * Uses Web Crypto API for secure encryption of sensitive data (API keys)
 *
 * Strategy: Uses a persistent randomly-generated key stored in IndexedDB
 * This ensures the key remains stable across sessions, browser updates, and OS changes
 */

import { db } from '@/lib/db'

const ENCRYPTION_KEY_ID = 1

/**
 * Get or create a persistent encryption key
 * The key is stored in IndexedDB and reused across sessions
 */
async function getPersistentEncryptionKey(): Promise<CryptoKey> {
  try {
    // Try to get existing key from database
    const existingKey = await db.encryptionKeys.get(ENCRYPTION_KEY_ID)

    if (existingKey) {
      // Decode and import existing key
      const keyData = base64ToArrayBuffer(existingKey.key)
      // Convert Uint8Array to ArrayBuffer
      const keyBuffer = keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength) as ArrayBuffer
      return await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    }

    // No existing key - generate a new one
    const newKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable (so we can store it)
      ['encrypt', 'decrypt']
    )

    // Export and store the key
    const exportedKey = await window.crypto.subtle.exportKey('raw', newKey)
    const keyBase64 = arrayBufferToBase64(new Uint8Array(exportedKey))

    await db.encryptionKeys.put({
      id: ENCRYPTION_KEY_ID,
      key: keyBase64,
      createdAt: new Date(),
    })

    // Re-import as non-extractable for security
    return await window.crypto.subtle.importKey(
      'raw',
      exportedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    console.error('Failed to get persistent encryption key:', error)
    // Fallback to device-based key for backward compatibility
    return await getFallbackEncryptionKey()
  }
}

/**
 * Fallback encryption key based on device data (for backward compatibility)
 * This was the original implementation - kept for migration purposes
 */
async function getFallbackEncryptionKey(): Promise<CryptoKey> {
  const deviceInfo = [
    navigator.userAgent,
    navigator.language,
    window.electron?.platform || 'unknown',
  ].join('::')

  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(deviceInfo),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('apilot-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Get encryption key (uses persistent key)
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  return await getPersistentEncryptionKey()
}

/**
 * Encrypt sensitive data (e.g., API keys)
 */
export async function encryptData(plaintext: string): Promise<string> {
  try {
    const key = await getEncryptionKey()
    const enc = new TextEncoder()
    const data = enc.encode(plaintext)

    // Generate a random IV (Initialization Vector)
    const iv = window.crypto.getRandomValues(new Uint8Array(12))

    // Encrypt the data
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    )

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), iv.length)

    // Convert to base64 for storage
    return arrayBufferToBase64(combined)
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data
 */
export async function decryptData(encryptedBase64: string): Promise<string> {
  try {
    const key = await getEncryptionKey()

    // Convert from base64
    const combined = base64ToArrayBuffer(encryptedBase64)

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)

    // Decrypt the data
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    )

    // Convert back to string
    const dec = new TextDecoder()
    return dec.decode(decrypted)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Attempt decryption with fallback to device-based key
 * Used for migrating old encrypted data
 */
export async function decryptDataWithFallback(encryptedBase64: string): Promise<string> {
  // Try with persistent key first
  try {
    return await decryptData(encryptedBase64)
  } catch (firstError) {
    console.warn('Persistent key decryption failed, trying fallback key...')

    // Try with device-based fallback key
    try {
      const fallbackKey = await getFallbackEncryptionKey()
      const combined = base64ToArrayBuffer(encryptedBase64)
      const iv = combined.slice(0, 12)
      const encrypted = combined.slice(12)

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        fallbackKey,
        encrypted
      )

      const dec = new TextDecoder()
      const result = dec.decode(decrypted)

      console.log('Successfully decrypted with fallback key - data may need re-encryption')
      return result
    } catch (secondError) {
      console.error('Both decryption methods failed:', { firstError, secondError })
      throw new Error('Failed to decrypt data - key may be corrupted')
    }
  }
}

/**
 * Reset the persistent encryption key
 * WARNING: This will invalidate all encrypted data
 */
export async function resetEncryptionKey(): Promise<void> {
  try {
    await db.encryptionKeys.delete(ENCRYPTION_KEY_ID)
    console.log('Encryption key reset successfully')
  } catch (error) {
    console.error('Failed to reset encryption key:', error)
    throw new Error('Failed to reset encryption key')
  }
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Generate a random UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}

/**
 * Hash a string (for comparison, not encryption)
 */
export async function hashString(input: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(input)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  return arrayBufferToBase64(new Uint8Array(hashBuffer))
}

/**
 * Validate if a string is properly encrypted
 */
export function isEncrypted(value: string): boolean {
  // Basic check: encrypted values should be base64 strings of certain length
  try {
    const decoded = atob(value)
    return decoded.length >= 12 // At least IV length
  } catch {
    return false
  }
}

/**
 * Mask sensitive data for display (e.g., API keys)
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) {
    return '****'
  }
  return data.slice(0, visibleChars) + '****' + data.slice(-visibleChars)
}
