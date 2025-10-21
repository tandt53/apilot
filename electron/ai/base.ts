/**
 * AI Service Interface
 * Base interface for all AI providers
 */

import type {Endpoint, TestCase} from '../../src/types/database'

/**
 * Parsed test info for message history
 */
export interface ParsedTestInfo {
  name: string
  testType: 'single' | 'workflow' | 'integration'
  method?: string
  path?: string
  endpointId?: number
  status: 'complete' | 'partial' // whether it was fully parsed or had issues
}

/**
 * Generation metadata for continuation
 */
export interface GenerationMetadata {
  attemptedEndpointIds: number[] // Endpoints that were attempted (regardless of success)
  successfulEndpointIds: number[] // Endpoints that got complete tests
  partialEndpointIds: number[] // Endpoints that got partial/failed tests
  completeParsedTests: ParsedTestInfo[] // Successfully parsed tests
  partialParsedTests: ParsedTestInfo[] // Partially parsed or failed tests
  rawResponseLength: number // Length of AI response
  tokenLimitReached: boolean
}

export type ContextMode = 'selected-only' | 'all-reference' | 'unselected-reference'

export interface GenerateTestsOptions {
  endpoints: Endpoint[] // Endpoints to generate tests for
  spec: any
  maxTestsPerEndpoint?: number
  onProgress?: (progress: { current: number; total: number; test?: Partial<TestCase> }) => void
  onTestGenerated?: (test: Partial<TestCase>) => Promise<void> // Real-time test save callback
  signal?: AbortSignal // For cancellation

  // Context and requirements (new)
  contextMode?: ContextMode // How to use endpoint context
  referenceEndpoints?: Endpoint[] // Additional endpoints for context only
  customRequirements?: string // User's custom instructions for test generation

  // For continuation after token limit
  previousMetadata?: GenerationMetadata // Metadata from previous generation attempts
}

export interface GenerateTestsResult {
  tests: Partial<TestCase>[]
  completed: boolean // true if all endpoints were processed
  completedEndpointIds: number[] // IDs of endpoints that got tests generated
  remainingEndpointIds: number[] // IDs of endpoints that still need tests
  error?: 'TOKEN_LIMIT_REACHED' | 'ABORTED' | string

  // For continuation support
  metadata: GenerationMetadata // Detailed metadata for continuation
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
   * Returns both complete (successfully parsed) and partial (corrupted) tests
   */
  protected extractJsonBlocks(text: string): {
    complete: any[]
    partial: ParsedTestInfo[]
  } {
    const complete: any[] = []
    const partial: ParsedTestInfo[] = []
    const regex = /```json\s*([\s\S]*?)```/g
    let match

    while ((match = regex.exec(text)) !== null) {
      try {
        const jsonString = match[1].trim()
        const json = JSON.parse(jsonString)
        complete.push(json)
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
          complete.push(json)
        } catch (retryError) {
          console.error('Still failed after attempted fixes')
          // Extract partial info from corrupted JSON
          const partialInfo = this.extractPartialTestInfo(match[1])
          if (partialInfo) {
            partial.push({
              ...partialInfo,
              status: 'partial'
            })
            console.warn('[AI Service] ⚠️ Tracked partial test:', partialInfo.name || 'unknown')
          } else {
            console.warn('[AI Service] ⚠️ Completely corrupted JSON block (no extractable info)')
          }
        }
      }
    }

    return { complete, partial }
  }

  /**
   * Helper: Extract partial test info from corrupted JSON
   * Uses regex to find field values even when JSON is malformed
   */
  protected extractPartialTestInfo(brokenJson: string): ParsedTestInfo | null {
    const nameMatch = brokenJson.match(/"name"\s*:\s*"([^"]+)"/)
    const methodMatch = brokenJson.match(/"method"\s*:\s*"([^"]+)"/)
    const pathMatch = brokenJson.match(/"path"\s*:\s*"([^"]+)"/)
    const typeMatch = brokenJson.match(/"test_type"\s*:\s*"([^"]+)"/)
    const endpointMethodMatch = brokenJson.match(/"endpoint_method"\s*:\s*"([^"]+)"/)
    const endpointPathMatch = brokenJson.match(/"endpoint_path"\s*:\s*"([^"]+)"/)

    // Need at least a name OR method+path to be useful
    if (nameMatch || (methodMatch && pathMatch) || (endpointMethodMatch && endpointPathMatch)) {
      return {
        name: nameMatch?.[1] || 'Unknown Test',
        method: methodMatch?.[1] || endpointMethodMatch?.[1],
        path: pathMatch?.[1] || endpointPathMatch?.[1],
        testType: (typeMatch?.[1] as 'single' | 'workflow' | 'integration') || 'single',
        endpointId: undefined,
        status: 'partial'
      }
    }

    return null
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
