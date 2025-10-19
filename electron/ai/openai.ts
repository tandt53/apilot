/**
 * OpenAI AI Service Implementation
 */

import OpenAI from 'openai'
import type {TestCase} from '../../src/types/database'
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
      // Running in main process, no need for dangerouslyAllowBrowser
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
    const { endpoints, spec, onProgress, onTestGenerated, signal, previousMetadata } = options

    if (endpoints.length === 0) {
      return {
        tests: [],
        completed: true,
        completedEndpointIds: [],
        remainingEndpointIds: [],
        metadata: previousMetadata || {
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

    // Format prompt - if continuing, include summary of what was already done
    let prompt = TEST_GENERATION_PROMPT.replace(
      '{endpoints_json}',
      formatEndpointsForPrompt(endpoints)
    ).replace('{spec_json}', formatSpecForPrompt(spec))

    // If continuing generation, prepend context about what was already done
    if (previousMetadata) {
      const { completeParsedTests, partialParsedTests, attemptedEndpointIds } = previousMetadata

      const completeTestsSummary = completeParsedTests.map(test => {
        if (test.testType === 'workflow') {
          return `  ✓ [WORKFLOW] ${test.name}`
        } else {
          return `  ✓ ${test.method} ${test.path}: ${test.name}`
        }
      }).join('\n')

      const partialTestsSummary = partialParsedTests.length > 0
        ? `\n\n⚠️  Incomplete tests (token limit cut off mid-generation - COMPLETE these first):\n${
            partialParsedTests.map(t => {
              const fields = []
              if (t.name) fields.push(`name: "${t.name}"`)
              if (t.method && t.path) fields.push(`endpoint: ${t.method} ${t.path}`)
              if (t.testType) fields.push(`type: ${t.testType}`)
              const fieldStr = fields.length > 0 ? fields.join(', ') : 'Unknown test'
              return `  ⚠ ${fieldStr} - was cut off, please regenerate this test completely`
            }).join('\n')
          }`
        : ''

      const attemptedEndpoints = endpoints.filter(e => attemptedEndpointIds.includes(e.id!))
      const unattemptedEndpoints = endpoints.filter(e => !attemptedEndpointIds.includes(e.id!))

      prompt = `=== CONTINUATION REQUEST ===

Token limit was reached in previous response.

Previously generated tests (${completeParsedTests.length} complete):
${completeTestsSummary}${partialTestsSummary}

Attempted endpoints: ${attemptedEndpoints.map(e => `${e.method} ${e.path}`).join(', ')}
Unattempted endpoints: ${unattemptedEndpoints.length > 0 ? unattemptedEndpoints.map(e => `${e.method} ${e.path}`).join(', ') : 'none'}

**FOCUS FOR CONTINUATION:**
1. **FIRST PRIORITY**: If there are incomplete tests marked with ⚠, regenerate these tests COMPLETELY with full valid JSON
2. If there are UNATTEMPTED endpoints, prioritize generating tests for those next
3. For attempted endpoints, generate ADDITIONAL different test scenarios (edge cases, negative tests, security tests)
4. DO NOT regenerate tests that were already successfully created (marked with ✓)
5. Generate workflow tests if you see relationships between endpoints

${prompt}`
    }

    // Declare variables outside try block so they're accessible in catch
    const tests: Partial<TestCase>[] = []
    const completedEndpointIds = new Set<number>()
    const completeParsedTests: import('./base').ParsedTestInfo[] = [...(previousMetadata?.completeParsedTests || [])]
    const partialParsedTests: import('./base').ParsedTestInfo[] = [...(previousMetadata?.partialParsedTests || [])]
    const attemptedEndpointIds = new Set<number>(previousMetadata?.attemptedEndpointIds || [])

    try {
      // Log request summary and received metadata
      if (previousMetadata) {
        console.log('[OpenAI] 🔄 CONTINUATION REQUEST')
        console.log('[OpenAI]   📥 Received metadata:', {
          completeParsedTests: previousMetadata.completeParsedTests?.length || 0,
          tests: previousMetadata.completeParsedTests?.map(t => t.name) || []
        })
        console.log('[OpenAI]   ✓ Already generated:', completeParsedTests.length, 'complete tests')
        if (partialParsedTests.length > 0) {
          console.log('[OpenAI]   ⚠ Partial tests:', partialParsedTests.length)
        }
        console.log('[OpenAI]   📋 Attempting:', endpoints.length, 'endpoints')
      } else {
        console.log('[OpenAI] ✨ NEW REQUEST')
        console.log('[OpenAI]   📋 Generating tests for:', endpoints.length, 'endpoints')
      }
      console.log('[OpenAI]   🤖 Model:', this.model, '| Max tokens:', this.maxTokens)

      // Use streaming for better UX
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }] as any,
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

        // Log finish reason when present
        if (finishReason) {
          console.log('[OpenAI Service] === FINISH REASON DETECTED ===')
          console.log('[OpenAI Service] Finish reason:', finishReason)
          console.log('[OpenAI Service] Response length so far:', fullResponse.length)
          console.log('[OpenAI Service] Tests generated so far:', tests.length)
          console.log('[OpenAI Service] === END FINISH REASON ===')
        }

        // Try to extract JSON blocks as they arrive
        const { complete: jsonBlocks } = this.extractJsonBlocks(fullResponse)
        // Only process complete blocks during streaming, partial tests tracked at the end

        // If we have new blocks, process them
        if (jsonBlocks.length > lastJsonBlockCount) {
          console.log(`[OpenAI Service] Found ${jsonBlocks.length - lastJsonBlockCount} new JSON blocks`)

          for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
            const block = jsonBlocks[i]

            let endpoint: any = null

            // Handle workflow tests differently
            if (block.test_type === 'workflow') {
              console.log('[OpenAI] 📝 [WORKFLOW]', block.name)

              // For workflow tests, match using first step's endpoint or use fallback
              if (block.steps && block.steps.length > 0) {
                const firstStep = block.steps[0]
                endpoint = endpoints.find(
                  e =>
                    e.method === firstStep.method &&
                    e.path === firstStep.path
                )

                if (!endpoint) {
                  endpoint = endpoints[0]
                }
              } else {
                endpoint = endpoints[0]
              }

              if (endpoint && endpoint.id) {
                const test = this.mapResponseToTestCase(
                  block,
                  endpoint.specId,
                  endpoint.id
                )
                tests.push(test)
                completedEndpointIds.add(endpoint.id)

                // Track in metadata for continuation
                completeParsedTests.push({
                  name: test.name || 'Untitled',
                  testType: test.testType || 'single',
                  method: test.method,
                  path: test.path,
                  endpointId: endpoint.id,
                  status: 'complete'
                })
                attemptedEndpointIds.add(endpoint.id)

                // Save test in real-time
                if (onTestGenerated) {
                  await onTestGenerated(test)
                  console.log('[OpenAI]   ✓ Saved')
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
                console.log('[OpenAI] 📝', block.method, block.path, '-', block.name)

                const test = this.mapResponseToTestCase(
                  block,
                  endpoint.specId,
                  endpoint.id
                )
                tests.push(test)
                completedEndpointIds.add(endpoint.id)

                // Track in metadata for continuation
                completeParsedTests.push({
                  name: test.name || 'Untitled',
                  testType: test.testType || 'single',
                  method: test.method,
                  path: test.path,
                  endpointId: endpoint.id,
                  status: 'complete'
                })
                attemptedEndpointIds.add(endpoint.id)

                // Save test in real-time
                if (onTestGenerated) {
                  await onTestGenerated(test)
                  console.log('[OpenAI]   ✓ Saved')
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
          console.log('[OpenAI] ⚠️  Token limit reached')
          tokenLimitReached = true
          break
        }
      }

      console.log('[OpenAI] 📦 Stream complete:', tests.length, 'tests parsed')

      // Final extraction to catch any remaining blocks and partial tests
      const { complete: finalBlocks, partial: partialBlocks } = this.extractJsonBlocks(fullResponse)

      // Track partial tests (corrupted JSON that couldn't be fully parsed)
      if (partialBlocks.length > 0) {
        console.log('[OpenAI] ⚠️  Detected', partialBlocks.length, 'partial/corrupted tests')
        console.log('[OpenAI] 📋 Corrupted JSON Details:')

        // Extract and show the corrupted JSON snippets from the response
        const jsonBlockRegex = /```json\s*([\s\S]*?)```/g
        let match: RegExpExecArray | null
        let blockIndex = 0

        while ((match = jsonBlockRegex.exec(fullResponse)) !== null) {
          try {
            JSON.parse(match[1].trim())
            blockIndex++
          } catch {
            // This is a corrupted block
            const snippet = match[1].trim()
            console.log(`[OpenAI]   📄 Corrupted Block #${blockIndex + 1}:`)
            console.log(`[OpenAI]      ${snippet.substring(0, 200)}${snippet.length > 200 ? '...' : ''}`)
            blockIndex++
          }
        }

        for (const partial of partialBlocks) {
          partialParsedTests.push(partial)
          console.warn('[OpenAI]   ⚠️  Partial test:', partial.name || 'Unknown', `(${partial.method || '?'} ${partial.path || '?'})`)
        }
      }

      if (finalBlocks.length > lastJsonBlockCount) {
        console.log('[OpenAI] 🔍 Final extraction:', finalBlocks.length - lastJsonBlockCount, 'remaining blocks')
      }

      for (let i = lastJsonBlockCount; i < finalBlocks.length; i++) {
        const block = finalBlocks[i]

        let endpoint: any = null

        // Handle workflow tests differently - they don't have top-level method/path
        if (block.test_type === 'workflow') {
          console.log('[OpenAI] 📝 [WORKFLOW]', block.name)

          // For workflow tests, use the first step's endpoint or just use the first available endpoint
          if (block.steps && block.steps.length > 0) {
            const firstStep = block.steps[0]
            endpoint = endpoints.find(
              e =>
                e.method === firstStep.method &&
                e.path === firstStep.path
            )

            if (!endpoint) {
              endpoint = endpoints[0]
            }
          } else {
            endpoint = endpoints[0]
          }

          const specId = endpoint?.specId

          if (endpoint && endpoint.id) {
            const test = this.mapResponseToTestCase(block, specId!, endpoint.id)
            tests.push(test)
            completedEndpointIds.add(endpoint.id)

            // Track in metadata for continuation
            completeParsedTests.push({
              name: test.name || 'Untitled',
              testType: test.testType || 'single',
              method: test.method,
              path: test.path,
              endpointId: endpoint.id,
              status: 'complete'
            })
            attemptedEndpointIds.add(endpoint.id)

            // Save test in real-time
            if (onTestGenerated) {
              await onTestGenerated(test)
              console.log('[OpenAI]   ✓ Saved')
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
            console.log('[OpenAI] 📝', block.method, block.path, '-', block.name)
            const test = this.mapResponseToTestCase(block, endpoint.specId, endpoint.id)
            tests.push(test)
            completedEndpointIds.add(endpoint.id)

            // Track in metadata for continuation
            completeParsedTests.push({
              name: test.name || 'Untitled',
              testType: test.testType || 'single',
              method: test.method,
              path: test.path,
              endpointId: endpoint.id,
              status: 'complete'
            })
            attemptedEndpointIds.add(endpoint.id)

            // Save test in real-time
            if (onTestGenerated) {
              await onTestGenerated(test)
              console.log('[OpenAI]   ✓ Saved')
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

      // Calculate remaining endpoints
      const completedIds = Array.from(completedEndpointIds)

      // If token limit reached, keep all attempted endpoints in remaining list for next iteration
      // This allows continuous generation until AI naturally finishes (finish_reason = "stop")
      const remainingEndpointIds = tokenLimitReached
        ? endpoints.map(e => e.id!).filter(id => id !== undefined)  // Keep all endpoints for continuation
        : endpoints
            .filter(e => e.id && !completedEndpointIds.has(e.id))
            .map(e => e.id!)

      const completed = !tokenLimitReached && remainingEndpointIds.length === 0

      console.log('[OpenAI] 🎯 RESULT')
      console.log('[OpenAI]   ✓ Generated:', tests.length, 'tests')
      console.log('[OpenAI]   ✓ Complete tests:', completeParsedTests.length)
      console.log('[OpenAI]   📊 Completed endpoints:', completedIds.length, '/', endpoints.length)
      if (tokenLimitReached) {
        console.log('[OpenAI]   ⚠️  Token limit reached - can continue')
        console.log('[OpenAI]   🔄 Keeping', remainingEndpointIds.length, 'endpoints for next iteration')
      }

      // Log complete list of all generated tests
      console.log('[OpenAI] 📋 Complete Test List:')
      if (completeParsedTests.length > 0) {
        completeParsedTests.forEach((test, index) => {
          if (test.testType === 'workflow') {
            console.log(`[OpenAI]   ${index + 1}. ✓ [WORKFLOW] ${test.name}`)
          } else {
            console.log(`[OpenAI]   ${index + 1}. ✓ ${test.method} ${test.path} - ${test.name}`)
          }
        })
      }
      if (partialParsedTests.length > 0) {
        console.log('[OpenAI] ⚠️  Partial Tests (Corrupted):')
        partialParsedTests.forEach((test, index) => {
          console.log(`[OpenAI]   ${index + 1}. ⚠ ${test.method || '?'} ${test.path || '?'} - ${test.name || 'Unknown'}`)
        })
      }

      // Build generation metadata
      const metadata: import('./base').GenerationMetadata = {
        attemptedEndpointIds: Array.from(attemptedEndpointIds),
        successfulEndpointIds: completedIds,
        partialEndpointIds: [], // TODO: Track partial parsing failures
        completeParsedTests,
        partialParsedTests,
        rawResponseLength: fullResponse.length,
        tokenLimitReached
      }

      console.log('[OpenAI] 📤 Returning metadata:', {
        completeParsedTests: metadata.completeParsedTests.length,
        tests: metadata.completeParsedTests.map(t => t.name)
      })

      return {
        tests,
        completed,
        completedEndpointIds: completedIds,
        remainingEndpointIds,
        error: tokenLimitReached ? 'TOKEN_LIMIT_REACHED' : undefined,
        metadata,
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

        // Track what was parsed before abort
        for (const test of tests) {
          const parsedInfo: import('./base').ParsedTestInfo = {
            name: test.name || 'Untitled',
            testType: test.testType || 'single',
            method: test.method,
            path: test.path,
            endpointId: test.currentEndpointId,
            status: 'complete'
          }
          completeParsedTests.push(parsedInfo)
          if (test.currentEndpointId) {
            attemptedEndpointIds.add(test.currentEndpointId)
          }
        }

        const metadata: import('./base').GenerationMetadata = {
          attemptedEndpointIds: Array.from(attemptedEndpointIds),
          successfulEndpointIds: completedIds,
          partialEndpointIds: [],
          completeParsedTests,
          partialParsedTests,
          rawResponseLength: 0,
          tokenLimitReached: false
        }

        return {
          tests: tests || [],
          completed: false,
          completedEndpointIds: completedIds,
          remainingEndpointIds,
          error: 'ABORTED',
          metadata,
        }
      }

      console.error('OpenAI generation error:', error)
      throw new Error(`Failed to generate tests: ${error.message || String(error)}`)
    }
  }
}
