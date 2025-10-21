/**
 * Ollama AI Service Implementation (Local LLM)
 */

import {Ollama} from 'ollama'
import type {TestCase} from '../../src/types/database'
import {AIService, type GenerateTestsOptions, type TestConnectionResult} from './base'
import {
  formatEndpointsForPrompt,
  formatSpecForPrompt,
  formatReferenceEndpointsForPrompt,
  formatCustomRequirementsForPrompt,
  TEST_CONNECTION_PROMPT,
  TEST_GENERATION_PROMPT
} from './prompts'

export interface OllamaConfig {
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class OllamaService extends AIService {
  readonly provider = 'ollama' as const
  private client: Ollama
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(config: OllamaConfig) {
    super()
    this.client = new Ollama({
      host: config.baseUrl || 'http://localhost:11434',
    })
    this.model = config.model || 'llama3.1:8b'
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens || 4096
  }

  /**
   * Test connection to Ollama
   */
  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now()

    try {
      // First check if Ollama is running
      const models = await this.client.list()

      // Check if the model exists
      const modelExists = models.models.some(m => m.name === this.model)

      if (!modelExists) {
        return {
          success: false,
          message: `Model ${this.model} not found`,
          error: `Please pull the model first: ollama pull ${this.model}`,
        }
      }

      // Test with a simple prompt
      const response = await this.client.generate({
        model: this.model,
        prompt: TEST_CONNECTION_PROMPT,
        options: {
          num_predict: 50,
        },
      })

      const latency = Date.now() - startTime

      if (response.response) {
        // Run capability test
        const { CAPABILITY_TEST_PROMPT, validateModelCapability } = await import('./model-validator')

        console.log('[Ollama Service] Running capability test...')
        const capabilityStartTime = Date.now()

        const capabilityResponse = await this.client.generate({
          model: this.model,
          prompt: CAPABILITY_TEST_PROMPT,
          options: {
            num_predict: 500,
          },
        })

        const capabilityLatency = Date.now() - capabilityStartTime
        const capabilityContent = capabilityResponse.response || ''

        const capabilityResult = validateModelCapability(capabilityContent)

        console.log('[Ollama Service] Capability test result:', {
          score: capabilityResult.score,
          capable: capabilityResult.capable,
          issues: capabilityResult.issues,
          warnings: capabilityResult.warnings,
          latency: capabilityLatency,
        })

        return {
          success: true,
          message: response.response,
          latency,
          capabilityTest: {
            score: capabilityResult.score,
            capable: capabilityResult.capable,
            issues: capabilityResult.issues,
            warnings: capabilityResult.warnings,
            recommendation: capabilityResult.recommendation,
          },
        }
      }

      return {
        success: false,
        message: 'No response from Ollama',
        error: 'Empty response',
      }
    } catch (error: any) {
      console.error('[Ollama Service] Test connection failed:', error)

      // Use error detector for detailed classification
      const { classifyOllamaError } = await import('./error-detector')
      const classified = classifyOllamaError(error, this.model, this.client.host || 'http://localhost:11434')

      return {
        success: false,
        message: classified.message,
        error: error.message || String(error),
        errorType: classified.errorType,
        suggestedAction: classified.suggestedAction,
        availableModels: classified.availableModels,
      }
    }
  }

  /**
   * Generate test cases from endpoints
   */
  async generateTests(options: GenerateTestsOptions): Promise<import('./base').GenerateTestsResult> {
    const { endpoints, spec, onProgress, onTestGenerated, signal, referenceEndpoints, customRequirements } = options

    if (endpoints.length === 0) {
      return {
        tests: [],
        completed: true,
        completedEndpointIds: [],
        remainingEndpointIds: [],
        metadata: {
          attemptedEndpointIds: [],
          successfulEndpointIds: [],
          partialEndpointIds: [],
          completeParsedTests: [],
          partialParsedTests: [],
          rawResponseLength: 0,
          tokenLimitReached: false
        }
      }
    }

    console.log('[Ollama Service] Starting test generation for', endpoints.length, 'endpoints')
    if (referenceEndpoints && referenceEndpoints.length > 0) {
      console.log('[Ollama Service] Including', referenceEndpoints.length, 'reference endpoints for context')
    }
    if (customRequirements) {
      console.log('[Ollama Service] Custom requirements provided:', customRequirements.substring(0, 100))
    }

    // Format prompt with new options
    const hasReferenceEndpoints = !!(referenceEndpoints && referenceEndpoints.length > 0)
    const prompt = TEST_GENERATION_PROMPT
      .replace('{endpoints_json}', formatEndpointsForPrompt(endpoints))
      .replace('{spec_json}', formatSpecForPrompt(spec, hasReferenceEndpoints))
      .replace('{reference_endpoints}', formatReferenceEndpointsForPrompt(referenceEndpoints || []))
      .replace('{custom_requirements}', formatCustomRequirementsForPrompt(customRequirements))

    try {
      // Use streaming for better UX
      const stream = await this.client.generate({
        model: this.model,
        prompt,
        stream: true,
        options: {
          temperature: this.temperature,
          num_predict: this.maxTokens,
        },
      })

      let fullResponse = ''
      const tests: Partial<TestCase>[] = []
      let lastJsonBlockCount = 0

      for await (const chunk of stream) {
        // Check for cancellation
        if (signal?.aborted) {
          console.log('[Ollama Service] Generation aborted by user')
          throw new Error('ABORTED')
        }

        const content = chunk.response
        fullResponse += content

        // Try to extract JSON blocks as they arrive
        const { complete: jsonBlocks } = this.extractJsonBlocks(fullResponse)
        // Only process complete blocks during streaming

        // If we have new blocks, process them
        if (jsonBlocks.length > lastJsonBlockCount) {
          for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
            const block = jsonBlocks[i]

            console.log('[Ollama Service] Processing block:', { method: block.method, path: block.path })

            // Find matching endpoint
            const endpoint = endpoints.find(
              e =>
                e.method === block.method &&
                e.path === block.path
            )

            if (endpoint && endpoint.id) {
              console.log('[Ollama Service] Found matching endpoint:', endpoint.id)

              const test = this.mapResponseToTestCase(
                block,
                endpoint.specId,
                endpoint.id
              )
              tests.push(test)

              // Report progress
              if (onProgress) {
                onProgress({
                  current: tests.length,
                  total: endpoints.length * 2, // Estimate 2 tests per endpoint
                  test,
                })
              }

              // Save test in real-time
              if (onTestGenerated) {
                console.log('[Ollama Service] Saving test to database...')
                await onTestGenerated(test)
              }
            } else {
              console.warn('[Ollama Service] No matching endpoint found for:', { method: block.method, path: block.path })
            }
          }

          lastJsonBlockCount = jsonBlocks.length
        }
      }

      console.log('[Ollama Service] Full response preview:', fullResponse.substring(0, 500))

      // Final extraction to catch any remaining blocks and partial tests
      const { complete: finalBlocks, partial: partialBlocks } = this.extractJsonBlocks(fullResponse)
      console.log('[Ollama Service] Final extraction found', finalBlocks.length, 'complete blocks')

      // Track partial tests (corrupted JSON)
      const partialParsedTests: import('./base').ParsedTestInfo[] = []
      if (partialBlocks.length > 0) {
        console.log('[Ollama] ⚠️  Detected', partialBlocks.length, 'partial/corrupted tests')
        for (const partial of partialBlocks) {
          partialParsedTests.push(partial)
          console.warn('[Ollama] ⚠️  Partial test:', partial.name || 'Unknown', `(${partial.method || '?'} ${partial.path || '?'})`)
        }
      }

      for (let i = lastJsonBlockCount; i < finalBlocks.length; i++) {
        const block = finalBlocks[i]
        const endpoint = endpoints.find(
          e =>
            e.method === block.method &&
            e.path === block.path
        )

        if (endpoint && endpoint.id) {
          const test = this.mapResponseToTestCase(block, endpoint.specId, endpoint.id)
          tests.push(test)

          if (onProgress) {
            onProgress({
              current: tests.length,
              total: endpoints.length * 2,
              test,
            })
          }

          if (onTestGenerated) {
            await onTestGenerated(test)
          }
        }
      }

      console.log('[Ollama Service] Generation completed. Total tests:', tests.length)

      // Return complete result
      const completedEndpointIds = endpoints.map(e => e.id!).filter(Boolean)

      // Note: Ollama SDK doesn't expose done_reason in streaming, so we can't detect token limits
      // For now, always treat as completed. TODO: Add token limit detection
      const tokenLimitReached = false

      // If token limit reached, keep all attempted endpoints in remaining list for next iteration
      const remainingEndpointIds = tokenLimitReached
        ? endpoints.map(e => e.id!).filter(id => id !== undefined)
        : []

      const completed = !tokenLimitReached && remainingEndpointIds.length === 0

      return {
        tests,
        completed,
        completedEndpointIds,
        remainingEndpointIds,
        metadata: {
          attemptedEndpointIds: completedEndpointIds,
          successfulEndpointIds: completedEndpointIds,
          partialEndpointIds: [],
          completeParsedTests: tests.map(t => ({
            name: t.name || 'Untitled',
            testType: t.testType || 'single',
            method: t.method,
            path: t.path,
            endpointId: t.currentEndpointId,
            status: 'complete' as const
          })),
          partialParsedTests,
          rawResponseLength: fullResponse.length,
          tokenLimitReached
        }
      }
    } catch (error: any) {
      console.error('[Ollama Service] Generation error:', error)
      throw new Error(`Failed to generate tests: ${error.message || String(error)}`)
    }
  }
}
