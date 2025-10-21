/**
 * Google Gemini AI Service Implementation
 */

import {GoogleGenerativeAI} from '@google/generative-ai'
import type {TestCase} from '../../src/types/database'
import {AIService, type GenerateTestsOptions, type GenerateTestsResult, type TestConnectionResult} from './base'
import {
  formatEndpointsForPrompt,
  formatSpecForPrompt,
  formatReferenceEndpointsForPrompt,
  formatCustomRequirementsForPrompt,
  TEST_CONNECTION_PROMPT,
  TEST_GENERATION_PROMPT
} from './prompts'

export interface GeminiConfig {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class GeminiService extends AIService {
  readonly provider = 'gemini' as const
  private client: GoogleGenerativeAI
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(config: GeminiConfig) {
    super()
    this.client = new GoogleGenerativeAI(config.apiKey)
    this.model = config.model || 'gemini-2.0-flash-exp'
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens || 8192
  }

  /**
   * Test connection to Gemini
   */
  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now()

    try {
      const model = this.client.getGenerativeModel({ model: this.model })
      const result = await model.generateContent(TEST_CONNECTION_PROMPT)
      const latency = Date.now() - startTime

      const response = result.response
      const text = response.text()

      if (text) {
        // Run capability test
        const { CAPABILITY_TEST_PROMPT, validateModelCapability } = await import('./model-validator')

        console.log('[Gemini Service] Running capability test...')
        const capabilityStartTime = Date.now()

        const capabilityResult = await model.generateContent(CAPABILITY_TEST_PROMPT)
        const capabilityLatency = Date.now() - capabilityStartTime
        const capabilityContent = capabilityResult.response.text()

        const capabilityValidation = validateModelCapability(capabilityContent)

        console.log('[Gemini Service] Capability test result:', {
          score: capabilityValidation.score,
          capable: capabilityValidation.capable,
          issues: capabilityValidation.issues,
          warnings: capabilityValidation.warnings,
          latency: capabilityLatency,
        })

        return {
          success: true,
          message: text,
          latency,
          capabilityTest: {
            score: capabilityValidation.score,
            capable: capabilityValidation.capable,
            issues: capabilityValidation.issues,
            warnings: capabilityValidation.warnings,
            recommendation: capabilityValidation.recommendation,
          },
        }
      }

      return {
        success: false,
        message: 'No response from Gemini',
        error: 'Empty response',
      }
    } catch (error: any) {
      console.error('[Gemini Service] Test connection failed:', error)

      // Use error detector for detailed classification
      const { classifyGeminiError } = await import('./error-detector')
      const classified = classifyGeminiError(error, this.model)

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
  async generateTests(options: GenerateTestsOptions): Promise<GenerateTestsResult> {
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

    console.log('[Gemini Service] Starting test generation for', endpoints.length, 'endpoints')
    if (referenceEndpoints && referenceEndpoints.length > 0) {
      console.log('[Gemini Service] Including', referenceEndpoints.length, 'reference endpoints for context')
    }
    if (customRequirements) {
      console.log('[Gemini Service] Custom requirements provided:', customRequirements.substring(0, 100))
    }

    // Format prompt with new options
    const hasReferenceEndpoints = !!(referenceEndpoints && referenceEndpoints.length > 0)
    const prompt = TEST_GENERATION_PROMPT
      .replace('{endpoints_json}', formatEndpointsForPrompt(endpoints))
      .replace('{spec_json}', formatSpecForPrompt(spec, hasReferenceEndpoints))
      .replace('{reference_endpoints}', formatReferenceEndpointsForPrompt(referenceEndpoints || []))
      .replace('{custom_requirements}', formatCustomRequirementsForPrompt(customRequirements))

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        },
      })

      // Use streaming for better UX
      const result = await model.generateContentStream(prompt)

      let fullResponse = ''
      const tests: Partial<TestCase>[] = []
      let lastJsonBlockCount = 0

      for await (const chunk of result.stream) {
        // Check for cancellation
        if (signal?.aborted) {
          console.log('[Gemini Service] Generation aborted by user')
          throw new Error('ABORTED')
        }

        const chunkText = chunk.text()
        fullResponse += chunkText

        // Try to extract JSON blocks as they arrive
        const { complete: jsonBlocks } = this.extractJsonBlocks(fullResponse)
        // Only process complete blocks during streaming

        // If we have new blocks, process them
        if (jsonBlocks.length > lastJsonBlockCount) {
          for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
            const block = jsonBlocks[i]

            console.log('[Gemini Service] Processing block:', { method: block.method, path: block.path })

            // Find matching endpoint
            const endpoint = endpoints.find(
              e =>
                e.method === block.method &&
                e.path === block.path
            )

            if (endpoint && endpoint.id) {
              console.log('[Gemini Service] Found matching endpoint:', endpoint.id)

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
                console.log('[Gemini Service] Saving test to database...')
                await onTestGenerated(test)
              }
            } else {
              console.warn('[Gemini Service] No matching endpoint found for:', { method: block.method, path: block.path })
            }
          }

          lastJsonBlockCount = jsonBlocks.length
        }
      }

      console.log('[Gemini Service] Full response preview:', fullResponse.substring(0, 500))

      // Final extraction to catch any remaining blocks and partial tests
      const { complete: finalBlocks, partial: partialBlocks } = this.extractJsonBlocks(fullResponse)
      console.log('[Gemini Service] Final extraction found', finalBlocks.length, 'complete blocks')

      // Track partial tests (corrupted JSON)
      const partialParsedTests: import('./base').ParsedTestInfo[] = []
      if (partialBlocks.length > 0) {
        console.log('[Gemini] ⚠️  Detected', partialBlocks.length, 'partial/corrupted tests')
        for (const partial of partialBlocks) {
          partialParsedTests.push(partial)
          console.warn('[Gemini] ⚠️  Partial test:', partial.name || 'Unknown', `(${partial.method || '?'} ${partial.path || '?'})`)
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

      console.log('[Gemini Service] Generation completed. Total tests:', tests.length)

      const completedEndpointIds = endpoints.map(e => e.id).filter((id): id is number => id !== undefined)

      // Note: Gemini SDK doesn't expose finish_reason in streaming, so we can't detect token limits
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
      console.error('[Gemini Service] Generation error:', error)
      throw new Error(`Failed to generate tests: ${error.message || String(error)}`)
    }
  }
}
