/**
 * Integration tests for RequestTester IPC functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RequestTester from './RequestTester'

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})

// Helper to render with QueryClient
const renderWithQueryClient = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  )
}

// Mock window.electron
const mockExecuteTest = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  // Setup window.electron mock
  global.window.electron = {
    executeTest: mockExecuteTest,
    importSpec: vi.fn(),
    testAIConnection: vi.fn(),
    generateTests: vi.fn(),
    onGenerateTestsProgress: vi.fn(),
    onGenerateTestsTestGenerated: vi.fn(),
    removeGenerateTestsListeners: vi.fn(),
    cancelGeneration: vi.fn(),
    platform: 'darwin',
    getVersion: vi.fn().mockResolvedValue('1.0.0')
  } as any
})

describe('RequestTester IPC Integration', () => {
  const mockEndpoint = {
    id: 1,
    method: 'GET',
    path: '/api/users',
    name: 'Get Users',
    request: {
      contentType: 'application/json',
      parameters: [],
      body: undefined
    },
    assertions: []
  }

  describe('GET Requests', () => {
    it('should use IPC to execute GET request', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { users: [] },
        responseTime: 150
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      renderWithQueryClient(
        <RequestTester
          endpoint={mockEndpoint as any}
          specId="1"
        />
      )

      // Click the Send button
      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      // Verify IPC was called
      await waitFor(() => {
        expect(mockExecuteTest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            url: expect.stringContaining('/api/users')
          })
        )
      })
    })

    it('should display response data from IPC', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'Success', count: 5 },
        responseTime: 100
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      renderWithQueryClient(
        <RequestTester
          endpoint={mockEndpoint as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText(/200/)).toBeInTheDocument()
      })
    })
  })

  describe('POST Requests with JSON Body', () => {
    const postEndpoint = {
      ...mockEndpoint,
      method: 'POST',
      path: '/api/users',
      request: {
        contentType: 'application/json',
        parameters: [],
        body: {
          required: true,
          example: { name: 'John', email: 'john@example.com' }
        }
      }
    }

    it('should send JSON body via IPC', async () => {
      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { id: 123 },
        responseTime: 200
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      renderWithQueryClient(
        <RequestTester
          endpoint={postEndpoint as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(mockExecuteTest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String)
          })
        )
      })
    })
  })

  describe('Form Data Requests', () => {
    const formEndpoint = {
      ...mockEndpoint,
      method: 'POST',
      path: '/api/upload',
      request: {
        contentType: 'multipart/form-data',
        parameters: [],
        body: {
          required: true,
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'file', type: 'file', required: true }
          ]
        }
      }
    }

    it('should send form data via IPC', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
        responseTime: 300
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      renderWithQueryClient(
        <RequestTester
          endpoint={formEndpoint as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(mockExecuteTest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            formData: expect.any(Object)
          })
        )
      })
    })

    it('should handle file paths in form data', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { fileId: 'abc123' },
        responseTime: 400
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      renderWithQueryClient(
        <RequestTester
          endpoint={formEndpoint as any}
          specId="1"
        />
      )

      // Simulate selecting a file
      // Note: Actual file input interaction would require more complex setup

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(mockExecuteTest).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display network errors from IPC', async () => {
      mockExecuteTest.mockRejectedValueOnce(new Error('Network error'))

      renderWithQueryClient(
        <RequestTester
          endpoint={mockEndpoint as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })

    it('should display HTTP errors from IPC', async () => {
      const errorResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        data: { error: 'User not found' },
        responseTime: 50
      }

      mockExecuteTest.mockResolvedValueOnce(errorResponse)

      renderWithQueryClient(
        <RequestTester
          endpoint={mockEndpoint as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText(/404/)).toBeInTheDocument()
      })
    })
  })

  describe('Environment Variables', () => {
    const mockEnvironment = {
      id: 1,
      name: 'Development',
      baseUrl: 'https://dev.api.example.com',
      variables: {
        API_KEY: 'test-key-123',
        USER_ID: '42'
      },
      headers: {
        'X-API-Key': '{{API_KEY}}'
      }
    }

    it('should substitute environment variables in IPC request', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
        responseTime: 100
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      renderWithQueryClient(
        <RequestTester
          endpoint={mockEndpoint as any}
          specId="1"
          selectedEnv={mockEnvironment as any}
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(mockExecuteTest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('dev.api.example.com'),
            headers: expect.objectContaining({
              'X-API-Key': 'test-key-123'
            })
          })
        )
      })
    })
  })

  describe('Fallback to Fetch', () => {
    it('should fallback to fetch when electron API is not available', async () => {
      // Remove electron from window
      delete (global.window as any).electron

      // Mock global fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Success' })
      } as any)

      renderWithQueryClient(
        <RequestTester
          endpoint={mockEndpoint as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Built-in Dynamic Variables', () => {
    it('should substitute built-in variables in URL', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
        responseTime: 100
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      const endpointWithBuiltIns = {
        ...mockEndpoint,
        path: '/api/users/{{$uuid}}'
      }

      renderWithQueryClient(
        <RequestTester
          endpoint={endpointWithBuiltIns as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(mockExecuteTest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringMatching(/\/api\/users\/[0-9a-f-]{36}$/i)
          })
        )
      })
    })

    it('should substitute timestamp variables in request body', async () => {
      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { id: 123 },
        responseTime: 200
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      const postEndpoint = {
        ...mockEndpoint,
        method: 'POST',
        request: {
          contentType: 'application/json',
          parameters: [],
          body: {
            required: true,
            example: {
              timestamp: '{{$timestamp}}',
              createdAt: '{{$isoTimestamp}}'
            }
          }
        }
      }

      renderWithQueryClient(
        <RequestTester
          endpoint={postEndpoint as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        const call = mockExecuteTest.mock.calls[0]
        const body = JSON.parse(call[0].body)

        // Timestamp should be a number string
        expect(parseInt(body.timestamp, 10)).toBeGreaterThan(1000000000)

        // ISO timestamp should match format
        expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      })
    })

    it('should generate fresh values for each request', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
        responseTime: 100
      }

      mockExecuteTest.mockResolvedValue(mockResponse)

      const endpointWithBuiltIns = {
        ...mockEndpoint,
        path: '/api/users/{{$uuid}}'
      }

      renderWithQueryClient(
        <RequestTester
          endpoint={endpointWithBuiltIns as any}
          specId="1"
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })

      // Send first request
      await userEvent.click(sendButton)
      await waitFor(() => expect(mockExecuteTest).toHaveBeenCalledTimes(1))
      const firstCall = mockExecuteTest.mock.calls[0]
      const firstUuid = firstCall[0].url.split('/').pop()

      // Send second request
      await userEvent.click(sendButton)
      await waitFor(() => expect(mockExecuteTest).toHaveBeenCalledTimes(2))
      const secondCall = mockExecuteTest.mock.calls[1]
      const secondUuid = secondCall[0].url.split('/').pop()

      // UUIDs should be different
      expect(firstUuid).not.toBe(secondUuid)
      expect(firstUuid).toMatch(/^[0-9a-f-]{36}$/i)
      expect(secondUuid).toMatch(/^[0-9a-f-]{36}$/i)
    })

    it('should work with both built-in and environment variables', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
        responseTime: 100
      }

      mockExecuteTest.mockResolvedValueOnce(mockResponse)

      const mockEnvironment = {
        id: 1,
        name: 'Test',
        baseUrl: 'https://api.example.com',
        variables: {
          userId: '123'
        },
        headers: {}
      }

      const mixedEndpoint = {
        ...mockEndpoint,
        path: '/api/users/{{userId}}/sessions/{{$uuid}}'
      }

      renderWithQueryClient(
        <RequestTester
          endpoint={mixedEndpoint as any}
          specId="1"
          selectedEnv={mockEnvironment as any}
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(mockExecuteTest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringMatching(/\/api\/users\/123\/sessions\/[0-9a-f-]{36}$/i)
          })
        )
      })
    })
  })
})
