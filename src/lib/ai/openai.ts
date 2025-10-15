/**
 * OpenAI AI Service Implementation
 */

import OpenAI from 'openai'
import type {TestCase} from '@/types/database'
import {AIService, type GenerateTestsOptions, type TestConnectionResult} from './base'
import {formatEndpointsForPrompt, formatSpecForPrompt, TEST_CONNECTION_PROMPT, TEST_GENERATION_PROMPT} from './prompts'

export interface OpenAIConfig {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class OpenAIService extends AIService {
  readonly provider = 'openai' as const
  private client: OpenAI
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(config: OpenAIConfig) {
    super()
    console.log('[OpenAI Service] Constructor config:', { ...config, apiKey: config.apiKey?.substring(0, 10) + '...' })
    this.client = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true, // Required for desktop Electron app
    })
    this.model = config.model || 'gpt-4o-mini'
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens || 4096
    console.log('[OpenAI Service] Client created with model:', this.model)
  }

  /**
   * Test connection to OpenAI
   */
  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now()

    try {
      console.log('[OpenAI Service] Testing connection with model:', this.model)
      console.log('[OpenAI Service] Test prompt:', TEST_CONNECTION_PROMPT)

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: TEST_CONNECTION_PROMPT,
          },
        ],
        max_completion_tokens: 50,
      })

      const latency = Date.now() - startTime

      if (response.choices && response.choices.length > 0) {
        console.log('[OpenAI Service] Test connection successful, latency:', latency)
        return {
          success: true,
          message: response.choices[0].message.content || 'Connected successfully',
          latency,
        }
      }

      return {
        success: false,
        message: 'No response from OpenAI',
        error: 'Empty response',
      }
    } catch (error: any) {
      console.error('[OpenAI Service] Test connection failed:', error)
      return {
        success: false,
        message: 'Failed to connect to OpenAI',
        error: error.message || String(error),
      }
    }
  }

  /**
   * Generate test cases from endpoints (with streaming and real-time save)
   */
  async generateTests(options: GenerateTestsOptions): Promise<import('./base').GenerateTestsResult> {
    const { endpoints, spec, onProgress, onTestGenerated, signal, previousMessages, generatedTestsSummary } = options

    if (endpoints.length === 0) {
      return {
        tests: [],
        completed: true,
        completedEndpointIds: [],
        remainingEndpointIds: [],
        conversationMessages: previousMessages || [],
        generatedTestsSummary: generatedTestsSummary || '',
      }
    }

    // Format prompt - if continuing, include summary of what was already done
    let prompt = TEST_GENERATION_PROMPT.replace(
      '{endpoints_json}',
      formatEndpointsForPrompt(endpoints)
    ).replace('{spec_json}', formatSpecForPrompt(spec))

    // If continuing generation, prepend context about what was already done
    if (generatedTestsSummary) {
      prompt = `IMPORTANT: You are continuing test generation after a token limit. Previously generated tests:\n\n${generatedTestsSummary}\n\nNow generate tests for the REMAINING endpoints below. Do NOT regenerate tests that were already created.\n\n${prompt}`
    }

    // Declare variables outside try block so they're accessible in catch
    let tests: Partial<TestCase>[] = []
    let completedEndpointIds = new Set<number>()

    try {
      // Build messages array - include history if continuing
      const messages: Array<{role: 'user' | 'assistant', content: string}> = [
        ...(previousMessages || []),
        {
          role: 'user',
          content: prompt,
        },
      ]

      // Use streaming for better UX
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        temperature: this.temperature,
        max_completion_tokens: this.maxTokens,
        stream: true,
      })

      let fullResponse = ''
      let lastJsonBlockCount = 0
      let tokenLimitReached = false

      console.log('[OpenAI Service] Starting stream processing...')

      for await (const chunk of stream) {
        // Check for abort signal
        if (signal?.aborted) {
          stream.controller.abort()
          throw new Error('ABORTED')
        }

        const content = chunk.choices[0]?.delta?.content || ''
        fullResponse += content

        // Check for finish reason (token limit, stop, etc.)
        const finishReason = chunk.choices[0]?.finish_reason

        // Try to extract JSON blocks as they arrive
        const jsonBlocks = this.extractJsonBlocks(fullResponse)

        // If we have new blocks, process them
        if (jsonBlocks.length > lastJsonBlockCount) {
          console.log(`[OpenAI Service] Found ${jsonBlocks.length - lastJsonBlockCount} new JSON blocks`)

          for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
            const block = jsonBlocks[i]

            console.log('[OpenAI Service] Processing block:', {
              method: block.method,
              path: block.path,
              name: block.name,
              testType: block.test_type,
            })

            let endpoint: any = null

            // Handle workflow tests differently
            if (block.test_type === 'workflow') {
              console.log('[OpenAI Service] Processing workflow test during streaming:', block.name)

              // For workflow tests, match using first step's endpoint or use fallback
              if (block.steps && block.steps.length > 0) {
                const firstStep = block.steps[0]
                endpoint = endpoints.find(
                  e =>
                    e.method === firstStep.method &&
                    e.path === firstStep.path
                )

                if (!endpoint) {
                  console.log('[OpenAI Service] No matching endpoint for first step, using first available endpoint')
                  endpoint = endpoints[0]
                }
              } else {
                endpoint = endpoints[0]
              }

              if (endpoint && endpoint.id) {
                console.log('[OpenAI Service] Using endpoint', endpoint.id, 'for workflow test')

                const test = this.mapResponseToTestCase(
                  block,
                  endpoint.specId,
                  endpoint.id
                )
                tests.push(test)
                completedEndpointIds.add(endpoint.id) // Track completion

                // Save test in real-time
                if (onTestGenerated) {
                  console.log('[OpenAI Service] Saving workflow test to database...')
                  await onTestGenerated(test)
                  console.log('[OpenAI Service] Workflow test saved successfully')
                }

                // Report progress
                if (onProgress) {
                  onProgress({
                    current: tests.length,
                    total: endpoints.length * 2,
                    test,
                  })
                }
              } else {
                console.warn('[OpenAI Service] No endpoint available for workflow test')
              }
            } else {
              // Single test - match by method and path
              endpoint = endpoints.find(
                e =>
                  e.method === block.method &&
                  e.path === block.path
              )

              // Fallback: try matching using endpoint_path field
              if (!endpoint && block.endpoint_path) {
                endpoint = endpoints.find(
                  e =>
                    e.method === block.endpoint_method &&
                    e.path === block.endpoint_path
                )
              }

              if (endpoint && endpoint.id) {
                console.log('[OpenAI Service] Found matching endpoint:', endpoint.id, 'for path:', block.path)

                const test = this.mapResponseToTestCase(
                  block,
                  endpoint.specId,
                  endpoint.id
                )
                tests.push(test)
                completedEndpointIds.add(endpoint.id) // Track completion

                // Save test in real-time
                if (onTestGenerated) {
                  console.log('[OpenAI Service] Saving test to database...')
                  await onTestGenerated(test)
                  console.log('[OpenAI Service] Test saved successfully')
                }

                // Report progress
                if (onProgress) {
                  onProgress({
                    current: tests.length,
                    total: endpoints.length * 2, // Estimate 2 tests per endpoint
                    test,
                  })
                }
              } else {
                console.warn('[OpenAI Service] No matching endpoint found for:', {
                  method: block.method,
                  path: block.path,
                  availableEndpoints: endpoints.map(e => ({ method: e.method, path: e.path }))
                })
              }
            }
          }

          lastJsonBlockCount = jsonBlocks.length
        }

        // Handle token limit - set flag but don't throw
        if (finishReason === 'length') {
          console.log('[OpenAI Service] Token limit reached, will return partial results')
          tokenLimitReached = true
          break // Exit loop early
        }
      }

      console.log('[OpenAI Service] Stream processing complete. Total tests:', tests.length)
      console.log('[OpenAI Service] Full response length:', fullResponse.length)
      console.log('[OpenAI Service] Full response preview:', fullResponse.substring(0, 1000))

      // Log full response for debugging (helps see if AI generated workflow tests)
      console.log('[OpenAI Service] === FULL AI RESPONSE ===')
      console.log(fullResponse)
      console.log('[OpenAI Service] === END FULL AI RESPONSE ===')

      // Final extraction to catch any remaining blocks
      console.log('[OpenAI Service] Performing final extraction...')
      const finalBlocks = this.extractJsonBlocks(fullResponse)
      console.log('[OpenAI Service] Final extraction found', finalBlocks.length, 'total blocks')

      // Log details of all extracted blocks
      console.log('[OpenAI Service] === EXTRACTED JSON BLOCKS ===')
      finalBlocks.forEach((block, index) => {
        console.log(`[OpenAI Service] Block ${index + 1}:`, {
          name: block.name,
          testType: block.test_type,
          method: block.method || 'N/A',
          path: block.path || 'N/A',
          hasSteps: !!block.steps,
          stepCount: block.steps?.length || 0,
        })
        if (block.test_type === 'workflow' && block.steps) {
          console.log(`[OpenAI Service]   Workflow steps:`)
          block.steps.forEach((step: any, stepIdx: number) => {
            console.log(`[OpenAI Service]     Step ${stepIdx + 1}: ${step.name} (${step.method} ${step.path})`)
          })
        }
      })
      console.log('[OpenAI Service] === END EXTRACTED JSON BLOCKS ===')

      if (finalBlocks.length > lastJsonBlockCount) {
        console.log(`[OpenAI Service] Processing ${finalBlocks.length - lastJsonBlockCount} remaining blocks`)
      }

      for (let i = lastJsonBlockCount; i < finalBlocks.length; i++) {
        const block = finalBlocks[i]
        console.log('[OpenAI Service] Processing final block:', {
          method: block.method,
          path: block.path,
          name: block.name,
          testType: block.test_type,
        })

        let endpoint: any = null

        // Handle workflow tests differently - they don't have top-level method/path
        if (block.test_type === 'workflow') {
          console.log('[OpenAI Service] Processing workflow test:', block.name)

          // For workflow tests, use the first step's endpoint or just use the first available endpoint
          if (block.steps && block.steps.length > 0) {
            const firstStep = block.steps[0]
            endpoint = endpoints.find(
              e =>
                e.method === firstStep.method &&
                e.path === firstStep.path
            )

            if (!endpoint) {
              console.log('[OpenAI Service] No matching endpoint for first step, using first available endpoint')
              endpoint = endpoints[0] // Use first endpoint as fallback for workflow tests
            }
          } else {
            endpoint = endpoints[0]
          }

          const specId = endpoint?.specId

          if (endpoint && endpoint.id) {
            console.log('[OpenAI Service] Using endpoint', endpoint.id, 'for workflow test')
            const test = this.mapResponseToTestCase(block, specId!, endpoint.id)
            tests.push(test)
            completedEndpointIds.add(endpoint.id) // Track completion

            // Save test in real-time
            if (onTestGenerated) {
              console.log('[OpenAI Service] Saving workflow test to database...')
              await onTestGenerated(test)
              console.log('[OpenAI Service] Workflow test saved successfully')
            }

            if (onProgress) {
              onProgress({
                current: tests.length,
                total: endpoints.length * 2,
                test,
              })
            }
          } else {
            console.warn('[OpenAI Service] No endpoint available for workflow test')
          }
        } else {
          // Single test - match by method and path
          endpoint = endpoints.find(
            e =>
              e.method === block.method &&
              e.path === block.path
          )

          // Fallback: try matching using endpoint_path field
          if (!endpoint && block.endpoint_path) {
            endpoint = endpoints.find(
              e =>
                e.method === block.endpoint_method &&
                e.path === block.endpoint_path
            )
          }

          if (endpoint && endpoint.id) {
            console.log('[OpenAI Service] Found matching endpoint for final block:', endpoint.id, 'for path:', block.path)
            const test = this.mapResponseToTestCase(block, endpoint.specId, endpoint.id)
            tests.push(test)
            completedEndpointIds.add(endpoint.id) // Track completion

            // Save test in real-time
            if (onTestGenerated) {
              console.log('[OpenAI Service] Saving final test to database...')
              await onTestGenerated(test)
              console.log('[OpenAI Service] Final test saved successfully')
            }

            if (onProgress) {
              onProgress({
                current: tests.length,
                total: endpoints.length * 2,
                test,
              })
            }
          } else {
            console.warn('[OpenAI Service] No matching endpoint found for final block:', {
              method: block.method,
              path: block.path
            })
          }
        }
      }

      console.log('[OpenAI Service] Generation complete. Total tests generated:', tests.length)
      console.log('[OpenAI Service] Completed endpoint IDs:', Array.from(completedEndpointIds))

      // Calculate remaining endpoints
      const completedIds = Array.from(completedEndpointIds)
      const remainingEndpointIds = endpoints
        .filter(e => e.id && !completedEndpointIds.has(e.id))
        .map(e => e.id!)

      const completed = !tokenLimitReached && remainingEndpointIds.length === 0

      console.log('[OpenAI Service] Token limit reached:', tokenLimitReached)
      console.log('[OpenAI Service] Remaining endpoints:', remainingEndpointIds.length)

      // Update conversation messages with assistant's response
      const conversationMessages = [
        ...messages,
        {
          role: 'assistant' as const,
          content: fullResponse,
        },
      ]

      // Create compact summary of generated tests (titles + endpoints only)
      const newTestsSummary = tests.map(test => {
        if (test.testType === 'workflow') {
          const stepsList = test.steps?.map(s => `${s.method} ${s.path}`).join(' → ') || ''
          return `- [WORKFLOW] ${test.name}: ${stepsList}`
        } else {
          return `- ${test.method} ${test.path}: ${test.name}`
        }
      }).join('\n')

      // Append to existing summary if continuing
      const fullSummary = generatedTestsSummary
        ? `${generatedTestsSummary}\n${newTestsSummary}`
        : newTestsSummary

      return {
        tests,
        completed,
        completedEndpointIds: completedIds,
        remainingEndpointIds,
        error: tokenLimitReached ? 'TOKEN_LIMIT_REACHED' : undefined,
        conversationMessages,
        generatedTestsSummary: fullSummary,
      }
    } catch (error: any) {
      // For aborted requests, return partial results
      if (error.message === 'ABORTED') {
        console.log('Test generation aborted by user')

        // Calculate what was completed before abort
        const completedIds = Array.from(completedEndpointIds || [])
        const remainingEndpointIds = endpoints
          .filter(e => e.id && !completedIds.includes(e.id!))
          .map(e => e.id!)

        // Create summary for what was done before abort
        const abortedSummary = (tests || []).map(test => {
          if (test.testType === 'workflow') {
            const stepsList = test.steps?.map(s => `${s.method} ${s.path}`).join(' → ') || ''
            return `- [WORKFLOW] ${test.name}: ${stepsList}`
          } else {
            return `- ${test.method} ${test.path}: ${test.name}`
          }
        }).join('\n')

        const fullSummary = generatedTestsSummary
          ? `${generatedTestsSummary}\n${abortedSummary}`
          : abortedSummary

        return {
          tests: tests || [],
          completed: false,
          completedEndpointIds: completedIds,
          remainingEndpointIds,
          error: 'ABORTED',
          conversationMessages: previousMessages || [],
          generatedTestsSummary: fullSummary,
        }
      }

      console.error('OpenAI generation error:', error)
      throw new Error(`Failed to generate tests: ${error.message || String(error)}`)
    }
  }
}
