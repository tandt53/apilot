/**
 * Settings API
 * CRUD operations for application settings (singleton)
 */

import {db} from '@/lib/db'
import type {Settings} from '@/types/database'
import {decryptDataWithFallback, encryptData} from '@/utils/crypto'

const SETTINGS_ID = 1

/**
 * Get settings (creates default if not exists)
 */
export async function getSettings(): Promise<Settings> {
  const settings = await db.settings.get(SETTINGS_ID)

  if (!settings) {
    // Create default settings
    const defaultSettings: Settings = {
      id: SETTINGS_ID,
      aiProvider: 'openai',
      aiSettings: {
        openai: {
          apiKey: '', // Empty by default - user must configure
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 16000,
        },
      },
      defaultTimeout: 30000,
      defaultHeaders: {
        'Content-Type': 'application/json',
      },
      environments: [
        {
          id: crypto.randomUUID(),
          name: 'Development',
          baseUrl: 'http://localhost:3000',
          description: 'Local development environment',
        },
      ],
      theme: 'system',
      updatedAt: new Date(),
    }

    await db.settings.put(defaultSettings)
    return defaultSettings
  }

  return settings
}

/**
 * Update settings
 */
export async function updateSettings(data: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.settings.update(SETTINGS_ID, {
    ...data,
    updatedAt: new Date(),
  })
}

/**
 * Update AI provider
 */
export async function updateAIProvider(
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama'
): Promise<void> {
  await updateSettings({ aiProvider: provider })
}

/**
 * Update OpenAI settings
 */
export async function updateOpenAISettings(config: {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<void> {
  const settings = await getSettings()

  // Encrypt API key
  const encryptedKey = await encryptData(config.apiKey)

  await updateSettings({
    aiSettings: {
      ...settings.aiSettings,
      openai: {
        apiKey: encryptedKey,
        model: config.model || 'gpt-4o-mini',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens || 4096,
      },
    },
  })
}

/**
 * Update Anthropic settings
 */
export async function updateAnthropicSettings(config: {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<void> {
  const settings = await getSettings()

  // Encrypt API key
  const encryptedKey = await encryptData(config.apiKey)

  await updateSettings({
    aiSettings: {
      ...settings.aiSettings,
      anthropic: {
        apiKey: encryptedKey,
        model: config.model || 'claude-3-5-sonnet-20241022',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens || 4096,
      },
    },
  })
}

/**
 * Update Gemini settings
 */
export async function updateGeminiSettings(config: {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<void> {
  const settings = await getSettings()

  // Encrypt API key
  const encryptedKey = await encryptData(config.apiKey)

  await updateSettings({
    aiSettings: {
      ...settings.aiSettings,
      gemini: {
        apiKey: encryptedKey,
        model: config.model || 'gemini-2.0-flash-exp',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens || 8192,
      },
    },
  })
}

/**
 * Update Ollama settings
 */
export async function updateOllamaSettings(config: {
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<void> {
  const settings = await getSettings()

  await updateSettings({
    aiSettings: {
      ...settings.aiSettings,
      ollama: {
        baseUrl: config.baseUrl || 'http://localhost:11434',
        model: config.model || 'llama3.1:8b',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens || 4096,
      },
    },
  })
}

/**
 * Get decrypted API key for provider
 * @throws Error with specific message if decryption fails
 */
export async function getDecryptedAPIKey(
  provider: 'openai' | 'anthropic' | 'gemini'
): Promise<string | null> {
  const settings = await getSettings()
  const providerSettings = settings.aiSettings[provider]

  if (!providerSettings || !providerSettings.apiKey) {
    return null // Key not set - this is normal
  }

  try {
    // Try decryption with fallback for migration
    const decrypted = await decryptDataWithFallback(providerSettings.apiKey)

    // If decrypted with fallback key, re-encrypt with persistent key for future use
    if (decrypted) {
      console.log(`Re-encrypting ${provider} API key with persistent key...`)
      const reEncrypted = await encryptData(decrypted)

      // Update settings with re-encrypted key
      await updateSettings({
        aiSettings: {
          ...settings.aiSettings,
          [provider]: {
            ...providerSettings,
            apiKey: reEncrypted,
          },
        },
      })
    }

    return decrypted
  } catch (error) {
    console.error(`Failed to decrypt ${provider} API key:`, error)
    throw new Error(
      `Failed to decrypt ${provider} API key. The key may be corrupted. ` +
      `Please go to Settings and re-enter your API key.`
    )
  }
}

/**
 * Clear a corrupted API key for a provider
 */
export async function clearCorruptedAPIKey(
  provider: 'openai' | 'anthropic' | 'gemini'
): Promise<void> {
  const settings = await getSettings()

  await updateSettings({
    aiSettings: {
      ...settings.aiSettings,
      [provider]: {
        ...settings.aiSettings[provider],
        apiKey: '',
      },
    },
  })
}

/**
 * Update default headers
 */
export async function updateDefaultHeaders(headers: Record<string, string>): Promise<void> {
  await updateSettings({ defaultHeaders: headers })
}

/**
 * Update default timeout
 */
export async function updateDefaultTimeout(timeout: number): Promise<void> {
  await updateSettings({ defaultTimeout: timeout })
}

/**
 * Update theme
 */
export async function updateTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
  await updateSettings({ theme })
}

/**
 * Reset settings to default
 */
export async function resetSettings(): Promise<void> {
  await db.settings.delete(SETTINGS_ID)
  await getSettings() // This will create default settings
}
