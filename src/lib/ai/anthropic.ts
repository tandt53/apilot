/**
 * Anthropic Claude AI Service Implementation
 */

import Anthropic from '@anthropic-ai/sdk'
import type {TestCase} from '@/types/database'
import {AIService, type GenerateTestsOptions, type GenerateTestsResult, type TestConnectionResult} from './base'
import {formatEndpointsForPrompt, formatSpecForPrompt, TEST_CONNECTION_PROMPT, TEST_GENERATION_PROMPT} from './prompts'

export interface AnthropicConfig {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class AnthropicService extends AIService {
  readonly provider = 'anthropic' as const
  private client: Anthropic
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(config: AnthropicConfig) {
    super()
    this.client = new Anthropic({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true, // Required for desktop Electron app
    })
    this.model = config.model || 'claude-3-5-sonnet-20241022'
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens || 4096
  }

  /**
   * Test connection to Anthropic
   */
  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now()

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: TEST_CONNECTION_PROMPT,
          },
        ],
      })

      const latency = Date.now() - startTime

      if (response.content && response.content.length > 0) {
        const content = response.content[0]
        const message = content.type === 'text' ? content.text : 'Connected successfully'

        return {
          success: true,
          message,
          latency,
        }
      }

      return {
        success: false,
        message: 'No response from Anthropic',
        error: 'Empty response',
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to connect to Anthropic',
        error: error.message || String(error),
      }
    }
  }

  /**
   * Generate test cases from endpoints
   */
  async generateTests(options: GenerateTestsOptions): Promise<GenerateTestsResult> {
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

    console.log('[Anthropic Service] Starting test generation for', endpoints.length, 'endpoints')

    // Format prompt
    const prompt = TEST_GENERATION_PROMPT.replace(
      '{endpoints_json}',
      formatEndpointsForPrompt(endpoints)
    ).replace('{spec_json}', formatSpecForPrompt(spec))

    try {
      // Use streaming for better UX
      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      let fullResponse = ''
      const tests: Partial<TestCase>[] = []
      let lastJsonBlockCount = 0

      for await (const event of stream) {
        // Check for cancellation
        if (signal?.aborted) {
          console.log('[Anthropic Service] Generation aborted by user')
          throw new Error('ABORTED')
        }

        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const content = event.delta.text
          fullResponse += content

          // Try to extract JSON blocks as they arrive
          const jsonBlocks = this.extractJsonBlocks(fullResponse)

          // If we have new blocks, process them
          if (jsonBlocks.length > lastJsonBlockCount) {
            for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
              const block = jsonBlocks[i]

              console.log('[Anthropic Service] Processing block:', {
                method: block.method,
                path: block.path,
                testType: block.test_type,
              })

              let endpoint: any = null

              // Handle workflow tests differently
              if (block.test_type === 'workflow') {
                console.log('[Anthropic Service] Processing workflow test:', block.name)

                // For workflow tests, match using first step's endpoint or use fallback
                if (block.steps && block.steps.length > 0) {
                  const firstStep = block.steps[0]
                  endpoint = endpoints.find(
                    e =>
                      e.method === firstStep.method &&
                      e.path === firstStep.path
                  )

                  if (!endpoint) {
                    console.log('[Anthropic Service] No matching endpoint for first step, using first available endpoint')
                    endpoint = endpoints[0]
                  }
                } else {
                  endpoint = endpoints[0]
                }

                if (endpoint && endpoint.id) {
                  console.log('[Anthropic Service] Using endpoint', endpoint.id, 'for workflow test')

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
                      total: endpoints.length * 2,
                      test,
                    })
                  }

                  // Save test in real-time
                  if (onTestGenerated) {
                    console.log('[Anthropic Service] Saving workflow test to database...')
                    await onTestGenerated(test)
                  }
                } else {
                  console.warn('[Anthropic Service] No endpoint available for workflow test')
                }
              } else {
                // Single test - match by method and path
                endpoint = endpoints.find(
                  e =>
                    e.method === block.method &&
                    e.path === block.path
                )

                if (endpoint && endpoint.id) {
                  console.log('[Anthropic Service] Found matching endpoint:', endpoint.id)

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
                    console.log('[Anthropic Service] Saving test to database...')
                    await onTestGenerated(test)
                  }
                } else {
                  console.warn('[Anthropic Service] No matching endpoint found for:', { method: block.method, path: block.path })
                }
              }
            }

            lastJsonBlockCount = jsonBlocks.length
          }
        }
      }

      console.log('[Anthropic Service] Full response preview:', fullResponse.substring(0, 500))

      // Log full response for debugging
      console.log('[Anthropic Service] === FULL AI RESPONSE ===')
      console.log(fullResponse)
      console.log('[Anthropic Service] === END FULL AI RESPONSE ===')

      // Final extraction to catch any remaining blocks
      const finalBlocks = this.extractJsonBlocks(fullResponse)
      console.log('[Anthropic Service] Final extraction found', finalBlocks.length, 'total blocks')

      // Log details of all extracted blocks
      console.log('[Anthropic Service] === EXTRACTED JSON BLOCKS ===')
      finalBlocks.forEach((block, index) => {
        console.log(`[Anthropic Service] Block ${index + 1}:`, {
          name: block.name,
          testType: block.test_type,
          method: block.method || 'N/A',
          path: block.path || 'N/A',
          hasSteps: !!block.steps,
          stepCount: block.steps?.length || 0,
        })
        if (block.test_type === 'workflow' && block.steps) {
          console.log(`[Anthropic Service]   Workflow steps:`)
          block.steps.forEach((step: any, stepIdx: number) => {
            console.log(`[Anthropic Service]     Step ${stepIdx + 1}: ${step.name} (${step.method} ${step.path})`)
          })
        }
      })
      console.log('[Anthropic Service] === END EXTRACTED JSON BLOCKS ===')

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

      console.log('[Anthropic Service] Generation completed. Total tests:', tests.length)

      const completedEndpointIds = endpoints.map(e => e.id).filter((id): id is number => id !== undefined)

      return {
        tests,
        completed: true,
        completedEndpointIds,
        remainingEndpointIds: [],
        conversationMessages: [{ role: 'user', content: '' }],
        generatedTestsSummary: `Generated ${tests.length} test(s) for ${endpoints.length} endpoint(s)`
      }
    } catch (error: any) {
      console.error('[Anthropic Service] Generation error:', error)
      throw new Error(`Failed to generate tests: ${error.message || String(error)}`)
    }
  }
}
