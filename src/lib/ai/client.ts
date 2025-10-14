/**
 * AI Client - Lazy-loaded wrapper for AI services
 * This prevents Node.js modules from being bundled in the renderer
 */

import type {AIService} from './base'
import type {AIProvider} from '@/types/database'

// Lazy import to avoid bundling Node.js modules
async function loadAIService(provider: AIProvider, config: any): Promise<AIService> {
  switch (provider) {
    case 'openai': {
      const { OpenAIService } = await import('./openai')
      return new OpenAIService(config)
    }
    case 'anthropic': {
      const { AnthropicService } = await import('./anthropic')
      return new AnthropicService(config)
    }
    case 'gemini': {
      const { GeminiService } = await import('./gemini')
      return new GeminiService(config)
    }
    case 'ollama': {
      const { OllamaService } = await import('./ollama')
      return new OllamaService(config)
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

export async function getCurrentAIService(): Promise<AIService> {
  // Check if running in proper Electron context
  if (typeof window !== 'undefined' && !(window as any).electron) {
    throw new Error(
      'AI services are only available in Electron. Please run the full Electron app (npm run dev), not just the Vite dev server.'
    )
  }

  const { getSettings, getDecryptedAPIKey } = await import('@/lib/api/settings')
  const settings = await getSettings()

  if (!settings || !settings.aiProvider) {
    throw new Error('AI provider not configured. Please go to Settings and configure an AI provider.')
  }

  const config: any = {}

  switch (settings.aiProvider) {
    case 'openai':
      if (!settings.aiSettings.openai) {
        throw new Error('OpenAI is not configured. Please go to Settings → AI Settings and configure OpenAI.')
      }
      const openaiKey = await getDecryptedAPIKey('openai')
      console.log('[AI Client] Decrypted OpenAI key:', openaiKey?.substring(0, 10) + '...')
      if (!openaiKey) {
        throw new Error('OpenAI API key is missing. Please go to Settings → AI Settings and add your OpenAI API key.')
      }
      config.apiKey = openaiKey
      config.model = settings.aiSettings.openai.model || 'gpt-4o-mini'
      config.temperature = settings.aiSettings.openai.temperature || 0.7
      config.maxTokens = settings.aiSettings.openai.maxTokens || 4096
      console.log('[AI Client] OpenAI config:', { ...config, apiKey: config.apiKey?.substring(0, 10) + '...' })
      break
    case 'anthropic':
      if (!settings.aiSettings.anthropic) {
        throw new Error('Anthropic is not configured. Please go to Settings → AI Settings and configure Anthropic Claude.')
      }
      const anthropicKey = await getDecryptedAPIKey('anthropic')
      if (!anthropicKey) {
        throw new Error('Anthropic API key is missing. Please go to Settings → AI Settings and add your Anthropic API key.')
      }
      config.apiKey = anthropicKey
      config.model = settings.aiSettings.anthropic.model || 'claude-3-5-sonnet-20241022'
      config.temperature = settings.aiSettings.anthropic.temperature || 0.7
      config.maxTokens = settings.aiSettings.anthropic.maxTokens || 4096
      break
    case 'gemini':
      if (!settings.aiSettings.gemini) {
        throw new Error('Google Gemini is not configured. Please go to Settings → AI Settings and configure Gemini.')
      }
      const geminiKey = await getDecryptedAPIKey('gemini')
      if (!geminiKey) {
        throw new Error('Gemini API key is missing. Please go to Settings → AI Settings and add your Gemini API key.')
      }
      config.apiKey = geminiKey
      config.model = settings.aiSettings.gemini.model || 'gemini-2.0-flash-exp'
      config.temperature = settings.aiSettings.gemini.temperature || 0.7
      config.maxTokens = settings.aiSettings.gemini.maxTokens || 8192
      break
    case 'ollama':
      if (!settings.aiSettings.ollama) {
        throw new Error('Ollama is not configured. Please go to Settings → AI Settings and configure Ollama.')
      }
      config.baseUrl = settings.aiSettings.ollama.baseUrl || 'http://localhost:11434'
      config.model = settings.aiSettings.ollama.model || 'llama3.1:8b'
      config.temperature = settings.aiSettings.ollama.temperature || 0.7
      break
    default:
      throw new Error(`Unsupported AI provider: ${settings.aiProvider}`)
  }

  return loadAIService(settings.aiProvider, config)
}

export async function testAIConnection(
  provider: AIProvider,
  config: any
): Promise<{ success: boolean; message: string; latency?: number }> {
  try {
    console.log('[Test Connection] Provider:', provider)
    console.log('[Test Connection] Config:', { ...config, apiKey: config.apiKey?.substring(0, 10) + '...' })

    // Check if running in Electron - use IPC if available
    if (typeof window !== 'undefined' && (window as any).electron) {
      console.log('[Test Connection] Using Electron IPC')
      const result = await (window as any).electron.testAIConnection(provider, config)
      return result
    }

    // Fallback to direct import (dev mode with Vite dev server)
    console.log('[Test Connection] Using direct import')
    const service = await loadAIService(provider, config)
    const result = await service.testConnection()

    return result
  } catch (error: any) {
    console.error('[Test Connection] Error:', error)
    return {
      success: false,
      message: error.message || 'Connection failed'
    }
  }
}

/**
 * Generate tests via IPC (for Electron)
 * This allows AI SDKs to run in the main process instead of renderer
 */
export async function generateTestsViaIPC(options: any): Promise<any> {
  // Get settings
  const { getSettings, getDecryptedAPIKey } = await import('@/lib/api/settings')
  const settings = await getSettings()

  if (!settings || !settings.aiProvider) {
    throw new Error('AI provider not configured. Please go to Settings and configure an AI provider.')
  }

  // Build config based on provider
  const config: any = {}
  const provider = settings.aiProvider

  switch (provider) {
    case 'openai':
      if (!settings.aiSettings.openai) {
        throw new Error('OpenAI is not configured. Please go to Settings → AI Settings and configure OpenAI.')
      }
      const openaiKey = await getDecryptedAPIKey('openai')
      if (!openaiKey) {
        throw new Error('OpenAI API key is missing. Please go to Settings → AI Settings and add your OpenAI API key.')
      }
      config.apiKey = openaiKey
      config.model = settings.aiSettings.openai.model || 'gpt-4o-mini'
      config.temperature = settings.aiSettings.openai.temperature || 0.7
      config.maxTokens = settings.aiSettings.openai.maxTokens || 4096
      break
    case 'anthropic':
      if (!settings.aiSettings.anthropic) {
        throw new Error('Anthropic is not configured. Please go to Settings → AI Settings and configure Anthropic Claude.')
      }
      const anthropicKey = await getDecryptedAPIKey('anthropic')
      if (!anthropicKey) {
        throw new Error('Anthropic API key is missing. Please go to Settings → AI Settings and add your Anthropic API key.')
      }
      config.apiKey = anthropicKey
      config.model = settings.aiSettings.anthropic.model || 'claude-3-5-sonnet-20241022'
      config.temperature = settings.aiSettings.anthropic.temperature || 0.7
      config.maxTokens = settings.aiSettings.anthropic.maxTokens || 4096
      break
    case 'gemini':
      if (!settings.aiSettings.gemini) {
        throw new Error('Google Gemini is not configured. Please go to Settings → AI Settings and configure Gemini.')
      }
      const geminiKey = await getDecryptedAPIKey('gemini')
      if (!geminiKey) {
        throw new Error('Gemini API key is missing. Please go to Settings → AI Settings and add your Gemini API key.')
      }
      config.apiKey = geminiKey
      config.model = settings.aiSettings.gemini.model || 'gemini-2.0-flash-exp'
      config.temperature = settings.aiSettings.gemini.temperature || 0.7
      config.maxTokens = settings.aiSettings.gemini.maxTokens || 8192
      break
    case 'ollama':
      if (!settings.aiSettings.ollama) {
        throw new Error('Ollama is not configured. Please go to Settings → AI Settings and configure Ollama.')
      }
      config.baseUrl = settings.aiSettings.ollama.baseUrl || 'http://localhost:11434'
      config.model = settings.aiSettings.ollama.model || 'llama3.1:8b'
      config.temperature = settings.aiSettings.ollama.temperature || 0.7
      break
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }

  console.log('[Generate Tests] Using IPC with provider:', provider)

  // Set up event listeners for progress updates
  const electron = (window as any).electron
  if (options.onProgress) {
    electron.onGenerateTestsProgress(options.onProgress)
  }
  if (options.onTestGenerated) {
    electron.onGenerateTestsTestGenerated(options.onTestGenerated)
  }

  try {
    // Call IPC handler
    const result = await electron.generateTests(provider, config, {
      endpoints: options.endpoints,
      spec: options.spec,
      previousMessages: options.previousMessages,
      generatedTestsSummary: options.generatedTestsSummary,
    })

    return result
  } finally {
    // Clean up event listeners
    electron.removeGenerateTestsListeners()
  }
}
