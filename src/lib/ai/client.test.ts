/**
 * AI Client Tests
 * Tests for IPC-based AI service wrapper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { testAIConnection, generateTestsViaIPC } from './client'
import type { AIProvider } from '@/types/database'

// Mock window.electron
const mockTestAIConnection = vi.fn()
const mockGenerateTests = vi.fn()
const mockOnGenerateTestsProgress = vi.fn()
const mockOnGenerateTestsTestGenerated = vi.fn()
const mockRemoveGenerateTestsListeners = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  // Setup window.electron mock
  global.window = {
    electron: {
      testAIConnection: mockTestAIConnection,
      generateTests: mockGenerateTests,
      onGenerateTestsProgress: mockOnGenerateTestsProgress,
      onGenerateTestsTestGenerated: mockOnGenerateTestsTestGenerated,
      removeGenerateTestsListeners: mockRemoveGenerateTestsListeners,
    },
  } as any
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('AI Client', () => {
  describe('testAIConnection', () => {
    it('should test OpenAI connection via IPC', async () => {
      const mockResult = {
        success: true,
        message: 'Connection successful',
        latency: 150,
      }

      mockTestAIConnection.mockResolvedValueOnce(mockResult)

      const provider: AIProvider = 'openai'
      const config = {
        apiKey: 'sk-test123',
        model: 'gpt-4o-mini',
      }

      const result = await testAIConnection(provider, config)

      expect(mockTestAIConnection).toHaveBeenCalledWith(provider, config)
      expect(result).toEqual(mockResult)
    })

    it('should test Anthropic connection via IPC', async () => {
      const mockResult = {
        success: true,
        message: 'Connected to Claude',
        latency: 200,
      }

      mockTestAIConnection.mockResolvedValueOnce(mockResult)

      const provider: AIProvider = 'anthropic'
      const config = {
        apiKey: 'sk-ant-test123',
        model: 'claude-3-5-sonnet-20241022',
      }

      const result = await testAIConnection(provider, config)

      expect(mockTestAIConnection).toHaveBeenCalledWith(provider, config)
      expect(result.success).toBe(true)
      expect(result.message).toContain('Claude')
    })

    it('should test Gemini connection via IPC', async () => {
      const mockResult = {
        success: true,
        message: 'Gemini connection successful',
        latency: 180,
      }

      mockTestAIConnection.mockResolvedValueOnce(mockResult)

      const provider: AIProvider = 'gemini'
      const config = {
        apiKey: 'AIza-test123',
        model: 'gemini-2.0-flash-exp',
      }

      const result = await testAIConnection(provider, config)

      expect(result.success).toBe(true)
    })

    it('should test Ollama connection via IPC', async () => {
      const mockResult = {
        success: true,
        message: 'Ollama connection successful',
        latency: 50,
      }

      mockTestAIConnection.mockResolvedValueOnce(mockResult)

      const provider: AIProvider = 'ollama'
      const config = {
        baseUrl: 'http://localhost:11434',
        model: 'llama3.1:8b',
      }

      const result = await testAIConnection(provider, config)

      expect(result.success).toBe(true)
    })

    it('should handle connection failure', async () => {
      mockTestAIConnection.mockRejectedValueOnce(new Error('Network error'))

      const provider: AIProvider = 'openai'
      const config = { apiKey: 'sk-test123' }

      const result = await testAIConnection(provider, config)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Network error')
    })

    it('should handle IPC not available', async () => {
      // Remove electron from window
      delete (global.window as any).electron

      const provider: AIProvider = 'openai'
      const config = { apiKey: 'sk-test123' }

      const result = await testAIConnection(provider, config)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Electron IPC not available')
    })

    it('should mask API key in logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      mockTestAIConnection.mockResolvedValueOnce({
        success: true,
        message: 'Success',
      })

      const provider: AIProvider = 'openai'
      const config = {
        apiKey: 'sk-verylongsecretkey123456',
        model: 'gpt-4o',
      }

      await testAIConnection(provider, config)

      // Check that full API key is not logged
      const logCalls = consoleSpy.mock.calls.map(call => JSON.stringify(call))
      const hasFullKey = logCalls.some(log => log.includes('sk-verylongsecretkey123456'))

      expect(hasFullKey).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should return success with latency', async () => {
      const mockResult = {
        success: true,
        message: 'Connected',
        latency: 123,
      }

      mockTestAIConnection.mockResolvedValueOnce(mockResult)

      const result = await testAIConnection('openai', { apiKey: 'test' })

      expect(result.latency).toBe(123)
    })
  })

  describe('generateTestsViaIPC', () => {
    beforeEach(() => {
      // Mock settings module
      vi.doMock('@/lib/api/settings', () => ({
        getSettings: vi.fn().mockResolvedValue({
          aiProvider: 'openai',
          aiSettings: {
            openai: {
              apiKey: 'encrypted-key',
              model: 'gpt-4o-mini',
              temperature: 0.7,
              maxTokens: 4096,
            },
          },
        }),
        getDecryptedAPIKey: vi.fn().mockResolvedValue('sk-decrypted-key'),
      }))
    })

    afterEach(() => {
      vi.doUnmock('@/lib/api/settings')
    })

    it('should generate tests for OpenAI via IPC', async () => {
      const mockTests = [
        {
          name: 'Test 1',
          method: 'GET',
          path: '/users',
          category: 'Functional',
        },
        {
          name: 'Test 2',
          method: 'POST',
          path: '/users',
          category: 'Functional',
        },
      ]

      mockGenerateTests.mockResolvedValueOnce({
        tests: mockTests,
        completed: true,
      })

      const options = {
        endpoints: [
          { method: 'GET', path: '/users', name: 'Get Users' },
        ],
        spec: { title: 'Test API', version: '1.0.0' },
      }

      const result = await generateTestsViaIPC(options)

      expect(mockGenerateTests).toHaveBeenCalled()
      expect(result.tests).toEqual(mockTests)
      expect(result.completed).toBe(true)
      expect(mockRemoveGenerateTestsListeners).toHaveBeenCalled()
    })

    it('should set up progress callback', async () => {
      mockGenerateTests.mockResolvedValueOnce({
        tests: [],
        completed: true,
      })

      const onProgress = vi.fn()
      const options = {
        endpoints: [],
        spec: {},
        onProgress,
      }

      await generateTestsViaIPC(options)

      expect(mockOnGenerateTestsProgress).toHaveBeenCalledWith(onProgress)
    })

    it('should set up test generated callback', async () => {
      mockGenerateTests.mockResolvedValueOnce({
        tests: [],
        completed: true,
      })

      const onTestGenerated = vi.fn()
      const options = {
        endpoints: [],
        spec: {},
        onTestGenerated,
      }

      await generateTestsViaIPC(options)

      expect(mockOnGenerateTestsTestGenerated).toHaveBeenCalled()
    })

    it('should clean up listeners after generation', async () => {
      mockGenerateTests.mockResolvedValueOnce({
        tests: [],
        completed: true,
      })

      await generateTestsViaIPC({ endpoints: [], spec: {} })

      expect(mockRemoveGenerateTestsListeners).toHaveBeenCalled()
    })

    it('should clean up listeners even on error', async () => {
      mockGenerateTests.mockRejectedValueOnce(new Error('Generation failed'))

      try {
        await generateTestsViaIPC({ endpoints: [], spec: {} })
      } catch (error) {
        // Expected
      }

      expect(mockRemoveGenerateTestsListeners).toHaveBeenCalled()
    })

    it('should pass through previousMetadata', async () => {
      mockGenerateTests.mockResolvedValueOnce({
        tests: [],
        completed: true,
      })

      const previousMetadata = {
        totalTokens: 1000,
        completedEndpoints: 5,
      }

      await generateTestsViaIPC({
        endpoints: [],
        spec: {},
        previousMetadata,
      })

      expect(mockGenerateTests).toHaveBeenCalledWith(
        'openai',
        expect.any(Object),
        expect.objectContaining({
          previousMetadata,
        })
      )
    })

    it('should pass through referenceEndpoints', async () => {
      mockGenerateTests.mockResolvedValueOnce({
        tests: [],
        completed: true,
      })

      const referenceEndpoints = [
        { method: 'GET', path: '/ref1' },
        { method: 'POST', path: '/ref2' },
      ]

      await generateTestsViaIPC({
        endpoints: [],
        spec: {},
        referenceEndpoints,
      })

      expect(mockGenerateTests).toHaveBeenCalledWith(
        'openai',
        expect.any(Object),
        expect.objectContaining({
          referenceEndpoints,
        })
      )
    })

    it('should pass through customRequirements', async () => {
      mockGenerateTests.mockResolvedValueOnce({
        tests: [],
        completed: true,
      })

      const customRequirements = 'Focus on security testing'

      await generateTestsViaIPC({
        endpoints: [],
        spec: {},
        customRequirements,
      })

      expect(mockGenerateTests).toHaveBeenCalledWith(
        'openai',
        expect.any(Object),
        expect.objectContaining({
          customRequirements,
        })
      )
    })

    it('should throw error if provider not configured', async () => {
      vi.doMock('@/lib/api/settings', () => ({
        getSettings: vi.fn().mockResolvedValue(null),
        getDecryptedAPIKey: vi.fn(),
      }))

      await expect(generateTestsViaIPC({ endpoints: [], spec: {} })).rejects.toThrow(
        'AI provider not configured'
      )

      vi.doUnmock('@/lib/api/settings')
    })

    it('should throw error if OpenAI not configured', async () => {
      vi.doMock('@/lib/api/settings', () => ({
        getSettings: vi.fn().mockResolvedValue({
          aiProvider: 'openai',
          aiSettings: {},
        }),
        getDecryptedAPIKey: vi.fn(),
      }))

      await expect(generateTestsViaIPC({ endpoints: [], spec: {} })).rejects.toThrow(
        'OpenAI is not configured'
      )

      vi.doUnmock('@/lib/api/settings')
    })

    it('should throw error if API key missing', async () => {
      vi.doMock('@/lib/api/settings', () => ({
        getSettings: vi.fn().mockResolvedValue({
          aiProvider: 'openai',
          aiSettings: {
            openai: {
              model: 'gpt-4o-mini',
            },
          },
        }),
        getDecryptedAPIKey: vi.fn().mockResolvedValue(null),
      }))

      await expect(generateTestsViaIPC({ endpoints: [], spec: {} })).rejects.toThrow(
        'OpenAI API key is missing'
      )

      vi.doUnmock('@/lib/api/settings')
    })
  })
})
