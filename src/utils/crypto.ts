/**
 * Encryption Utilities
 * Uses Web Crypto API for secure encryption of sensitive data (API keys)
 */

/**
 * Generate a key for encryption/decryption
 * Uses a combination of device-specific data as key material
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // In a real application, you might want to derive this from:
  // 1. Machine ID
  // 2. User-specific salt
  // 3. Or prompt user for a master password

  // For this desktop app, we'll use a device-specific identifier
  const keyMaterial = await getKeyMaterial()

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
 * Get key material from device-specific data
 */
async function getKeyMaterial(): Promise<CryptoKey> {
  // Use a combination of device data as password
  // In a real app, you might use hardware identifiers or user credentials
  const deviceInfo = [
    navigator.userAgent,
    navigator.language,
    window.electron?.platform || 'unknown',
  ].join('::')

  const enc = new TextEncoder()
  return await window.crypto.subtle.importKey(
    'raw',
    enc.encode(deviceInfo),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
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
