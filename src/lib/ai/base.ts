/**
 * AI Service Interface
 * Base interface for all AI providers
 */

import type {Endpoint, TestCase} from '@/types/database'

export interface GenerateTestsOptions {
  endpoints: Endpoint[]
  spec: any
  maxTestsPerEndpoint?: number
  onProgress?: (progress: { current: number; total: number; test?: Partial<TestCase> }) => void
  onTestGenerated?: (test: Partial<TestCase>) => Promise<void> // Real-time test save callback
  signal?: AbortSignal // For cancellation

  // For continuation after token limit
  previousMessages?: Array<{role: 'user' | 'assistant', content: string}> // Conversation history
  generatedTestsSummary?: string // Compact summary of already generated tests (titles + endpoints only)
}

export interface GenerateTestsResult {
  tests: Partial<TestCase>[]
  completed: boolean // true if all endpoints were processed
  completedEndpointIds: number[] // IDs of endpoints that got tests generated
  remainingEndpointIds: number[] // IDs of endpoints that still need tests
  error?: 'TOKEN_LIMIT_REACHED' | 'ABORTED' | string

  // For continuation support
  conversationMessages: Array<{role: 'user' | 'assistant', content: string}> // Full conversation history
  generatedTestsSummary: string // Compact summary of all generated tests so far
}

export interface TestConnectionResult {
  success: boolean
  message: string
  latency?: number
  error?: string
}

/**
 * Base AI Service Interface
 */
export abstract class AIService {
  abstract readonly provider: 'openai' | 'anthropic' | 'gemini' | 'ollama'

  /**
   * Test connection to AI provider
   */
  abstract testConnection(): Promise<TestConnectionResult>

  /**
   * Generate test cases from endpoints
   * Returns result object with tests and completion status
   */
  abstract generateTests(options: GenerateTestsOptions): Promise<GenerateTestsResult>

  /**
   * Helper: Extract JSON blocks from AI response
   */
  protected extractJsonBlocks(text: string): any[] {
    const jsonBlocks: any[] = []
    const regex = /```json\s*([\s\S]*?)```/g
    let match

    while ((match = regex.exec(text)) !== null) {
      try {
        const jsonString = match[1].trim()
        const json = JSON.parse(jsonString)
        jsonBlocks.push(json)
      } catch (error) {
        console.error('Failed to parse JSON block:', error)
        console.error('Attempted to parse:', match[1].trim().substring(0, 500))
        // Try to fix common JSON issues
        try {
          let fixed = match[1].trim()
          // Remove trailing commas before } or ]
          fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
          // Fix single quotes to double quotes (common AI mistake)
          fixed = fixed.replace(/'/g, '"')
          const json = JSON.parse(fixed)
          console.log('Successfully parsed after fixes')
          jsonBlocks.push(json)
        } catch (retryError) {
          console.error('Still failed after attempted fixes')
        }
      }
    }

    return jsonBlocks
  }

  /**
   * Helper: Map AI response to TestCase
   */
  protected mapResponseToTestCase(
    response: any,
    specId: number,
    endpointId: number
  ): Partial<TestCase> {
    // Handle workflow steps if present
    const steps = response.steps?.map((step: any) => ({
      ...step,
      id: step.id || crypto.randomUUID(),
      isCustomEndpoint: false,
      assertions: (step.assertions || []).map((assertion: any) => ({
        ...assertion,
        id: assertion.id || crypto.randomUUID(),
      })),
    }))

    // Generate UUIDs for assertions if missing (for single tests)
    const assertions = (response.assertions || []).map((assertion: any) => ({
      ...assertion,
      id: assertion.id || crypto.randomUUID(),
    }))

    return {
      specId,
      sourceEndpointId: endpointId, // Original endpoint
      currentEndpointId: endpointId, // Current endpoint (same initially)
      isCustomEndpoint: false, // Generated from spec endpoint
      name: response.name || 'Untitled Test',
      description: response.description || '',

      // Single test fields (only used when testType='single')
      method: response.method || response.endpoint_method || 'GET',
      path: response.path || response.endpoint_path || '/',
      pathVariables: response.pathVariables || {},
      queryParams: response.queryParams || {},
      headers: response.headers || { 'Content-Type': 'application/json' },
      body: response.body,
      assertions,

      // Test type and workflow fields
      testType: response.test_type || 'single',
      steps,

      // Metadata
      category: response.category || 'API Tests',
      priority: response.priority || 'medium',
      tags: response.tags || [],
      lastResult: 'pending',
      executionCount: 0,
      createdBy: 'ai',
    }
  }
}

/**
 * AI Provider Status
 */
export interface AIProviderInfo {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama'
  name: string
  description: string
  requiresApiKey: boolean
  models: string[]
  defaultModel: string
}

/**
 * Available AI providers
 */
export const AI_PROVIDERS: AIProviderInfo[] = [
  {
    provider: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 and GPT-3.5 models',
    requiresApiKey: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    provider: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet and other models',
    requiresApiKey: true,
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  {
    provider: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 2.0 and 1.5 models',
    requiresApiKey: true,
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash-exp',
  },
  {
    provider: 'ollama',
    name: 'Ollama',
    description: 'Local LLM models',
    requiresApiKey: false,
    models: ['llama3.1:8b', 'llama3.1:70b', 'mistral', 'codellama', 'phi'],
    defaultModel: 'llama3.1:8b',
  },
]
