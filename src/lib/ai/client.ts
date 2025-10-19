/**
 * AI Client - IPC wrapper for AI services
 * All AI operations now go through IPC to the main process
 */

import type {AIProvider} from '@/types/database'

/**
 * Test AI connection via IPC
 */
export async function testAIConnection(
    provider: AIProvider,
    config: any
): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
        console.log('[Test Connection] Provider:', provider)
        console.log('[Test Connection] Config:', {...config, apiKey: config.apiKey?.substring(0, 10) + '...'})

        // Use IPC to test connection in main process
        if (typeof window !== 'undefined' && (window as any).electron) {
            console.log('[Test Connection] Using Electron IPC')
            const result = await (window as any).electron.testAIConnection(provider, config)
            return result
        }

        throw new Error('Electron IPC not available. Please run the full Electron app.')
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
    const {getSettings, getDecryptedAPIKey} = await import('@/lib/api/settings')
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
        console.log('[IPC Client] Setting up onProgress listener')
        electron.onGenerateTestsProgress(options.onProgress)
    }

    if (options.onTestGenerated) {
        console.log('[IPC Client] Setting up onTestGenerated listener')
        const wrappedCallback = (test: any) => {
            console.log('[IPC Client] Received test from main process:', {
                name: test.name,
                method: test.method,
                path: test.path
            })
            options.onTestGenerated(test)
        }
        electron.onGenerateTestsTestGenerated(wrappedCallback)
    }

    try {
        // Call IPC handler
        console.log('[IPC Client] Calling generateTests...')
        const result = await electron.generateTests(provider, config, {
            endpoints: options.endpoints,
            spec: options.spec,
            previousMetadata: options.previousMetadata,
        })

        console.log('[IPC Client] Received result:', {
            testsCount: result.tests?.length,
            completed: result.completed,
            tests: result.tests?.map((t: any) => ({name: t.name, method: t.method, path: t.path}))
        })

        return result
    } finally {
        // Clean up event listeners
        console.log('[IPC Client] Cleaning up event listeners')
        electron.removeGenerateTestsListeners()
    }
}
