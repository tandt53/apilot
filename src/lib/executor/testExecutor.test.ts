/**
 * Test Executor Tests
 * Tests for test execution, assertion validation, and variable substitution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeTest } from './testExecutor'
import type { TestCase, Environment } from '@/types/database'
import * as api from '@/lib/api'

// Mock axios
vi.mock('axios', () => {
  return {
    default: vi.fn((config) => {
      // Mock HTTP responses based on request
      const url = config.url || ''
      const method = config.method?.toUpperCase() || 'GET'

      if (url.includes('/users') && method === 'GET') {
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
          ],
        })
      }

      if (url.includes('/users') && method === 'POST') {
        return Promise.resolve({
          status: 201,
          statusText: 'Created',
          headers: { 'content-type': 'application/json' },
          data: { id: 123, name: 'Test User', email: 'test@example.com' },
        })
      }

      if (url.includes('/error')) {
        return Promise.reject({
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            headers: {},
            data: { error: 'Server error' },
          },
        })
      }

      // Default response
      return Promise.resolve({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
      })
    }),
  }
})

// Mock database operations
vi.mock('@/lib/api', () => ({
  createExecution: vi.fn((execution) => Promise.resolve({ ...execution, id: 1, createdAt: new Date() })),
  updateTestCaseExecutionStats: vi.fn(() => Promise.resolve()),
}))

describe('Test Executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Single Step Tests', () => {
    it('should execute a simple GET request successfully', async () => {
      const testCase: TestCase = {
        id: 1,
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Get users',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'high',
        assertions: [
          { id: 'a1', type: 'status-code', expected: 200 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const result = await executeTest(testCase)

      expect(result.status).toBe('pass')
      expect(result.response?.statusCode).toBe(200)
      expect(result.assertionResults).toHaveLength(1)
      expect(result.assertionResults[0].passed).toBe(true)
      expect(api.createExecution).toHaveBeenCalled()
      expect(api.updateTestCaseExecutionStats).toHaveBeenCalledWith(1, 'pass')
    })

    it('should execute a POST request with body', async () => {
      const testCase: TestCase = {
        id: 2,
        specId: 1,
        sourceEndpointId: 2,
        currentEndpointId: 2,
        name: 'Create user',
        method: 'POST',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'high',
        body: { name: 'Test User', email: 'test@example.com' },
        assertions: [
          { id: 'a1', type: 'status-code', expected: 201 },
          { id: 'a2', type: 'json-path', field: '$.id', expected: 123 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const result = await executeTest(testCase)

      expect(result.status).toBe('pass')
      expect(result.response?.statusCode).toBe(201)
      expect(result.assertionResults).toHaveLength(2)
      expect(result.assertionResults[0].passed).toBe(true)
      expect(result.assertionResults[1].passed).toBe(true)
    })

    it('should fail when assertion does not match', async () => {
      const testCase: TestCase = {
        id: 3,
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Get users - expect 404',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [
          { id: 'a1', type: 'status-code', expected: 404 }, // Should fail
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const result = await executeTest(testCase)

      expect(result.status).toBe('fail')
      expect(result.assertionResults).toHaveLength(1)
      expect(result.assertionResults[0].passed).toBe(false)
      expect(api.updateTestCaseExecutionStats).toHaveBeenCalledWith(3, 'fail')
    })

    it('should handle HTTP errors', async () => {
      const testCase: TestCase = {
        id: 4,
        specId: 1,
        sourceEndpointId: 3,
        currentEndpointId: 3,
        name: 'Error endpoint',
        method: 'GET',
        path: '/error',
        testType: 'single',
        category: 'Functional',
        priority: 'low',
        assertions: [
          { id: 'a1', type: 'status-code', expected: 500 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const result = await executeTest(testCase)

      // Should handle error and still create execution record
      expect(result.response?.statusCode).toBe(500)
      expect(result.status).toBe('pass') // Assertion expects 500
      expect(api.createExecution).toHaveBeenCalled()
    })
  })

  describe('Assertion Validation', () => {
    describe('Status Code Assertions', () => {
      it('should validate status code with equals operator', async () => {
        const testCase: TestCase = {
          id: 5,
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'Status code test',
          method: 'GET',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            { id: 'a1', type: 'status-code', operator: 'equals', expected: 200 },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(true)
        expect(result.assertionResults[0].actual).toBe(200)
      })
    })

    describe('JSON Path Assertions', () => {
      it('should extract value from response using JSONPath', async () => {
        const testCase: TestCase = {
          id: 6,
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'JSONPath test',
          method: 'GET',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            // Note: testExecutor uses simplified JSONPath (uses dot notation for array indices)
            { id: 'a1', type: 'json-path', field: '$.0.name', expected: 'John Doe' },
            { id: 'a2', type: 'json-path', field: '$.1.email', expected: 'jane@example.com' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(true)
        expect(result.assertionResults[0].actual).toBe('John Doe')
        expect(result.assertionResults[1].passed).toBe(true)
        expect(result.assertionResults[1].actual).toBe('jane@example.com')
      })

      it('should handle nested object access', async () => {
        const testCase: TestCase = {
          id: 7,
          specId: 1,
          sourceEndpointId: 2,
          currentEndpointId: 2,
          name: 'Nested object test',
          method: 'POST',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            { id: 'a1', type: 'json-path', field: '$.name', expected: 'Test User' },
            { id: 'a2', type: 'json-path', field: '$.email', expected: 'test@example.com' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(true)
        expect(result.assertionResults[1].passed).toBe(true)
      })

      it('should fail when field does not exist', async () => {
        const testCase: TestCase = {
          id: 8,
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'Missing field test',
          method: 'GET',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            { id: 'a1', type: 'json-path', field: '$.nonExistentField', expected: 'value' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(false)
        expect(result.assertionResults[0].message).toContain('Field not found')
      })
    })

    describe('Header Assertions', () => {
      it('should validate response headers', async () => {
        const testCase: TestCase = {
          id: 9,
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'Header test',
          method: 'GET',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            { id: 'a1', type: 'header', field: 'content-type', expected: 'application/json' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(true)
      })
    })

    describe('Body Contains Assertions', () => {
      it('should validate body contains text', async () => {
        const testCase: TestCase = {
          id: 10,
          specId: 1,
          sourceEndpointId: 2,
          currentEndpointId: 2,
          name: 'Body contains test',
          method: 'POST',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            { id: 'a1', type: 'body-contains', expected: 'Test User' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(true)
      })
    })

    describe('Body Matches (Regex) Assertions', () => {
      it('should validate body matches regex pattern', async () => {
        const testCase: TestCase = {
          id: 11,
          specId: 1,
          sourceEndpointId: 2,
          currentEndpointId: 2,
          name: 'Regex test',
          method: 'POST',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            { id: 'a1', type: 'body-matches', expected: '.*@example\\.com.*' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(true)
      })
    })

    describe('Response Time Assertions', () => {
      it('should validate response time', async () => {
        const testCase: TestCase = {
          id: 12,
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'Response time test',
          method: 'GET',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [
            { id: 'a1', type: 'response-time', operator: 'less-than', expected: 5000 },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
          createdBy: 'test',
        }

        const result = await executeTest(testCase)

        expect(result.assertionResults[0].passed).toBe(true)
        expect(result.response?.responseTime).toBeDefined()
        expect(result.response?.responseTime).toBeLessThan(5000)
      })
    })
  })

  describe('Variable Substitution', () => {
    it('should substitute environment variables in baseUrl', async () => {
      const testCase: TestCase = {
        id: 13,
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Variable substitution test',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [
          { id: 'a1', type: 'status-code', expected: 200 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const environment: Environment = {
        id: 1,
        name: 'Test Env',
        baseUrl: 'https://{{domain}}/api',
        variables: { domain: 'api.example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await executeTest(testCase, environment)

      expect(result.baseUrl).toBe('https://api.example.com/api')
    })

    it('should substitute variables in headers', async () => {
      const testCase: TestCase = {
        id: 14,
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Header variable substitution',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        headers: {
          'Authorization': 'Bearer {{token}}',
        },
        assertions: [
          { id: 'a1', type: 'status-code', expected: 200 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const environment: Environment = {
        id: 1,
        name: 'Test Env',
        baseUrl: 'http://localhost:3000',
        variables: { token: 'abc123xyz' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await executeTest(testCase, environment)

      expect(result.request.headers?.['Authorization']).toBe('Bearer abc123xyz')
    })
  })

  describe('Multi-Step Tests', () => {
    it('should execute multi-step test with variable extraction', async () => {
      const testCase: TestCase = {
        id: 15,
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Multi-step workflow',
        method: 'POST',
        path: '/workflow',
        testType: 'workflow',
        category: 'Workflow',
        priority: 'high',
        steps: [
          {
            id: 'step1',
            order: 1,
            name: 'Create user',
            method: 'POST',
            path: '/users',
            body: { name: 'Test User', email: 'test@example.com' },
            assertions: [
              { id: 'a1', type: 'status-code', expected: 201 },
            ],
            extractVariables: [
              { name: 'userId', source: 'response-body', path: '$.id' },
            ],
          },
          {
            id: 'step2',
            order: 2,
            name: 'Get created user',
            method: 'GET',
            path: '/users/{{userId}}',
            assertions: [
              { id: 'a2', type: 'status-code', expected: 200 },
            ],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const result = await executeTest(testCase)

      expect(result.status).toBe('pass')
      expect(result.stepResults).toHaveLength(2)
      expect(result.stepResults?.[0].extractedVariables?.userId).toBe(123)
      expect(result.stepResults?.[0].assertionResults[0].passed).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle test case with no assertions', async () => {
      const testCase: TestCase = {
        id: 16,
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'No assertions test',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'low',
        assertions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const result = await executeTest(testCase)

      expect(result.status).toBe('pass') // No assertions = all pass
      expect(result.assertionResults).toHaveLength(0)
    })

    it('should record execution duration', async () => {
      const testCase: TestCase = {
        id: 17,
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Duration test',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [
          { id: 'a1', type: 'status-code', expected: 200 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        createdBy: 'test',
      }

      const result = await executeTest(testCase)

      expect(result.duration).toBeDefined()
      expect(result.duration).toBeGreaterThanOrEqual(0) // Mock axios returns immediately, so duration may be 0
      expect(result.startedAt).toBeDefined()
      expect(result.completedAt).toBeDefined()
    })
  })
})
