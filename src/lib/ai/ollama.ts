/**
 * Ollama AI Service Implementation (Local LLM)
 */

import {Ollama} from 'ollama'
import type {TestCase} from '@/types/database'
import {AIService, type GenerateTestsOptions, type TestConnectionResult} from './base'
import {formatEndpointsForPrompt, formatSpecForPrompt, TEST_CONNECTION_PROMPT, TEST_GENERATION_PROMPT} from './prompts'

export interface OllamaConfig {
  baseUrl?: string
  model?: string
  temperature?: number
}

export class OllamaService extends AIService {
  readonly provider = 'ollama' as const
  private client: Ollama
  private model: string
  private temperature: number

  constructor(config: OllamaConfig) {
    super()
    this.client = new Ollama({
      host: config.baseUrl || 'http://localhost:11434',
    })
    this.model = config.model || 'llama3.1:8b'
    this.temperature = config.temperature ?? 0.7
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
        return {
          success: true,
          message: response.response,
          latency,
        }
      }

      return {
        success: false,
        message: 'No response from Ollama',
        error: 'Empty response',
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to connect to Ollama',
        error: error.message || String(error),
      }
    }
  }

  /**
   * Generate test cases from endpoints
   */
  async generateTests(options: GenerateTestsOptions): Promise<import('./base').GenerateTestsResult> {
    const { endpoints, spec, onProgress, onTestGenerated, signal } = options

    if (endpoints.length === 0) {
      return {
        tests: [],
        completed: true,
        completedEndpointIds: [],
        remainingEndpointIds: [],
        conversationMessages: [],
        generatedTestsSummary: ''
      }
    }

    console.log('[Ollama Service] Starting test generation for', endpoints.length, 'endpoints')

    // Format prompt
    const prompt = TEST_GENERATION_PROMPT.replace(
      '{endpoints_json}',
      formatEndpointsForPrompt(endpoints)
    ).replace('{spec_json}', formatSpecForPrompt(spec))

    try {
      // Use streaming for better UX
      const stream = await this.client.generate({
        model: this.model,
        prompt,
        stream: true,
        options: {
          temperature: this.temperature,
          num_predict: 4096,
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
        const jsonBlocks = this.extractJsonBlocks(fullResponse)

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

      // Final extraction to catch any remaining blocks
      const finalBlocks = this.extractJsonBlocks(fullResponse)
      console.log('[Ollama Service] Final extraction found', finalBlocks.length, 'total blocks')

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
      return {
        tests,
        completed: true,
        completedEndpointIds,
        remainingEndpointIds: [],
        conversationMessages: [],
        generatedTestsSummary: ''
      }
    } catch (error: any) {
      console.error('[Ollama Service] Generation error:', error)
      throw new Error(`Failed to generate tests: ${error.message || String(error)}`)
    }
  }
}
