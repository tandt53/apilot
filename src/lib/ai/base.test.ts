import { describe, it, expect } from 'vitest'
import { AIService, GenerateTestsOptions, GenerateTestsResult, TestConnectionResult } from './base'
import type { TestCase } from '@/types/database'

/**
 * Test Helper Class
 * Extends AIService to expose protected methods for testing
 */
class TestAIService extends AIService {
  readonly provider = 'openai' as const

  async testConnection(): Promise<TestConnectionResult> {
    return { success: true, message: 'Test' }
  }

  async generateTests(_options: GenerateTestsOptions): Promise<GenerateTestsResult> {
    return {
      tests: [],
      completed: true,
      completedEndpointIds: [],
      remainingEndpointIds: [],
      conversationMessages: [],
      generatedTestsSummary: ''
    }
  }

  // Expose protected methods for testing
  public extractJsonBlocksPublic(text: string): any[] {
    return this.extractJsonBlocks(text)
  }

  public mapResponseToTestCasePublic(
    response: any,
    specId: number,
    endpointId: number
  ): Partial<TestCase> {
    return this.mapResponseToTestCase(response, specId, endpointId)
  }
}

/**
 * Mock Data Factories
 */
const createMockSingleTest = (overrides = {}) => ({
  name: 'Get user by ID',
  description: 'Retrieve user details',
  test_type: 'single',
  method: 'GET',
  path: '/users/{userId}',
  pathVariables: { userId: '123' },
  queryParams: {},
  headers: { 'Content-Type': 'application/json' },
  body: null,
  assertions: [
    {
      type: 'status-code',
      expected: 200,
      description: 'Status should be 200',
    },
  ],
  category: 'User Management',
  priority: 'high',
  tags: ['users', 'get'],
  ...overrides,
})

const createMockWorkflowTest = (overrides = {}) => ({
  name: 'User CRUD Workflow',
  description: 'Create, verify, and delete user',
  test_type: 'workflow',
  category: 'CRUD Workflow',
  priority: 'high',
  tags: ['workflow', 'crud'],
  steps: [
    {
      id: 'step-1',
      order: 1,
      name: 'Create User',
      method: 'POST',
      path: '/users',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'John Doe', email: 'john@example.com' },
      assertions: [
        {
          type: 'status-code',
          expected: 201,
          description: 'User created',
        },
      ],
      extractVariables: [
        {
          name: 'userId',
          source: 'response-body',
          path: '$.id',
        },
      ],
    },
    {
      id: 'step-2',
      order: 2,
      name: 'Get User',
      method: 'GET',
      path: '/users/{userId}',
      pathVariables: { userId: '{{userId}}' },
      headers: { 'Content-Type': 'application/json' },
      assertions: [
        {
          type: 'status-code',
          expected: 200,
          description: 'User retrieved',
        },
        {
          type: 'json-path',
          field: '$.name',
          operator: 'equals',
          expected: 'John Doe',
        },
      ],
    },
    {
      id: 'step-3',
      order: 3,
      name: 'Delete User',
      method: 'DELETE',
      path: '/users/{userId}',
      pathVariables: { userId: '{{userId}}' },
      assertions: [
        {
          type: 'status-code',
          expected: 204,
          description: 'User deleted',
        },
      ],
    },
  ],
  ...overrides,
})

const createMockAIResponse = (jsonObjects: any[]) => {
  return jsonObjects
    .map((obj) => `\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\``)
    .join('\n\n')
}

/**
 * Test Suite
 */
describe('AIService Base', () => {
  const service = new TestAIService()
  const mockSpecId = 1
  const mockEndpointId = 100

  describe('extractJsonBlocks', () => {
    it('should extract single JSON block', () => {
      const response = createMockAIResponse([{ name: 'Test 1', value: 123 }])
      const blocks = service.extractJsonBlocksPublic(response)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({ name: 'Test 1', value: 123 })
    })

    it('should extract multiple JSON blocks', () => {
      const response = createMockAIResponse([
        { name: 'Test 1', value: 123 },
        { name: 'Test 2', value: 456 },
        { name: 'Test 3', value: 789 },
      ])
      const blocks = service.extractJsonBlocksPublic(response)

      expect(blocks).toHaveLength(3)
      expect(blocks[0].name).toBe('Test 1')
      expect(blocks[1].name).toBe('Test 2')
      expect(blocks[2].name).toBe('Test 3')
    })

    it('should handle malformed JSON with trailing commas', () => {
      const response = `\`\`\`json
{
  "name": "Test",
  "value": 123,
}
\`\`\``
      const blocks = service.extractJsonBlocksPublic(response)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({ name: 'Test', value: 123 })
    })

    it('should fix single quotes to double quotes', () => {
      const response = `\`\`\`json
{
  'name': 'Test',
  'value': 123
}
\`\`\``
      const blocks = service.extractJsonBlocksPublic(response)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({ name: 'Test', value: 123 })
    })

    it('should handle empty response', () => {
      const blocks = service.extractJsonBlocksPublic('')
      expect(blocks).toHaveLength(0)
    })

    it('should handle response without JSON blocks', () => {
      const response = 'This is just plain text without any JSON blocks.'
      const blocks = service.extractJsonBlocksPublic(response)
      expect(blocks).toHaveLength(0)
    })
  })

  describe('mapResponseToTestCase - Single Tests', () => {
    it('should map basic single test', () => {
      const mockResponse = createMockSingleTest()
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.name).toBe('Get user by ID')
      expect(result.description).toBe('Retrieve user details')
      expect(result.testType).toBe('single')
      expect(result.method).toBe('GET')
      expect(result.path).toBe('/users/{userId}')
      expect(result.specId).toBe(mockSpecId)
      expect(result.sourceEndpointId).toBe(mockEndpointId)
      expect(result.currentEndpointId).toBe(mockEndpointId)
      expect(result.isCustomEndpoint).toBe(false)
      expect(result.createdBy).toBe('ai')
      expect(result.lastResult).toBe('pending')
      expect(result.executionCount).toBe(0)
    })

    it('should map POST request with body', () => {
      const mockResponse = createMockSingleTest({
        method: 'POST',
        path: '/users',
        body: { name: 'John', email: 'john@example.com' },
      })
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.method).toBe('POST')
      expect(result.path).toBe('/users')
      expect(result.body).toEqual({ name: 'John', email: 'john@example.com' })
    })

    it('should map test with path variables', () => {
      const mockResponse = createMockSingleTest({
        pathVariables: { userId: '123', orgId: '456' },
      })
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.pathVariables).toEqual({ userId: '123', orgId: '456' })
    })

    it('should map test with query parameters', () => {
      const mockResponse = createMockSingleTest({
        queryParams: { page: 1, limit: 10, sort: 'name' },
      })
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.queryParams).toEqual({ page: 1, limit: 10, sort: 'name' })
    })

    it('should map test with custom headers', () => {
      const mockResponse = createMockSingleTest({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
          'X-API-Key': 'key123',
        },
      })
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
        'X-API-Key': 'key123',
      })
    })

    it('should map test with multiple assertions', () => {
      const mockResponse = createMockSingleTest({
        assertions: [
          { type: 'status-code', expected: 200 },
          { type: 'json-path', field: '$.name', operator: 'equals', expected: 'John' },
          { type: 'response-time', operator: 'less-than', expected: 500 },
        ],
      })
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.assertions).toHaveLength(3)
      expect(result.assertions![0].type).toBe('status-code')
      expect(result.assertions![1].type).toBe('json-path')
      expect(result.assertions![2].type).toBe('response-time')
    })

    it('should generate UUID for assertions if missing', () => {
      const mockResponse = createMockSingleTest({
        assertions: [
          { type: 'status-code', expected: 200 }, // No id
        ],
      })
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.assertions).toHaveLength(1)
      expect(result.assertions![0].id).toBeDefined()
      expect(typeof result.assertions![0].id).toBe('string')
      expect(result.assertions![0].id?.length).toBeGreaterThan(0)
    })

    it('should apply default values correctly', () => {
      const mockResponse = {
        name: 'Minimal Test',
        // Missing most fields
      }
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.testType).toBe('single')
      expect(result.method).toBe('GET')
      expect(result.path).toBe('/')
      expect(result.pathVariables).toEqual({})
      expect(result.queryParams).toEqual({})
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(result.category).toBe('API Tests')
      expect(result.priority).toBe('medium')
      expect(result.tags).toEqual([])
      expect(result.lastResult).toBe('pending')
      expect(result.executionCount).toBe(0)
      expect(result.createdBy).toBe('ai')
    })
  })

  describe('mapResponseToTestCase - Workflow Tests', () => {
    it('should map workflow test with multiple steps', () => {
      const mockResponse = createMockWorkflowTest()
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.name).toBe('User CRUD Workflow')
      expect(result.testType).toBe('workflow')
      expect(result.steps).toHaveLength(3)
      expect(result.category).toBe('CRUD Workflow')
      expect(result.tags).toEqual(['workflow', 'crud'])
    })

    it('should map workflow with variable extraction', () => {
      const mockResponse = createMockWorkflowTest()
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      const firstStep = result.steps![0]
      expect(firstStep.extractVariables).toHaveLength(1)
      expect(firstStep.extractVariables![0].name).toBe('userId')
      expect(firstStep.extractVariables![0].source).toBe('response-body')
      expect(firstStep.extractVariables![0].path).toBe('$.id')
    })

    it('should generate UUIDs for steps if missing', () => {
      const mockResponse = createMockWorkflowTest({
        steps: [
          {
            order: 1,
            name: 'Step 1',
            method: 'GET',
            path: '/test',
            // No id field
            assertions: [],
          },
        ],
      })
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.steps).toHaveLength(1)
      expect(result.steps![0].id).toBeDefined()
      expect(typeof result.steps![0].id).toBe('string')
      expect(result.steps![0].id.length).toBeGreaterThan(0)
    })

    it('should generate UUIDs for step assertions', () => {
      const mockResponse = createMockWorkflowTest()
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      // Check first step assertions
      expect(result.steps![0].assertions).toHaveLength(1)
      expect(result.steps![0].assertions[0].id).toBeDefined()

      // Check second step assertions (has 2)
      expect(result.steps![1].assertions).toHaveLength(2)
      expect(result.steps![1].assertions[0].id).toBeDefined()
      expect(result.steps![1].assertions[1].id).toBeDefined()

      // Check third step assertions
      expect(result.steps![2].assertions).toHaveLength(1)
      expect(result.steps![2].assertions[0].id).toBeDefined()
    })

    it('should handle workflow with 3+ steps correctly', () => {
      const mockResponse = createMockWorkflowTest()
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.steps).toHaveLength(3)

      // Verify step 1
      expect(result.steps![0].name).toBe('Create User')
      expect(result.steps![0].method).toBe('POST')
      expect(result.steps![0].path).toBe('/users')
      expect(result.steps![0].order).toBe(1)

      // Verify step 2
      expect(result.steps![1].name).toBe('Get User')
      expect(result.steps![1].method).toBe('GET')
      expect(result.steps![1].path).toBe('/users/{userId}')
      expect(result.steps![1].order).toBe(2)

      // Verify step 3
      expect(result.steps![2].name).toBe('Delete User')
      expect(result.steps![2].method).toBe('DELETE')
      expect(result.steps![2].path).toBe('/users/{userId}')
      expect(result.steps![2].order).toBe(3)
    })

    it('should preserve extractVariables configuration', () => {
      const mockResponse = createMockWorkflowTest()
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      const firstStep = result.steps![0]
      expect(firstStep.extractVariables).toBeDefined()
      expect(firstStep.extractVariables).toHaveLength(1)
      expect(firstStep.extractVariables![0]).toEqual({
        name: 'userId',
        source: 'response-body',
        path: '$.id',
      })
    })

    it('should set workflow testType correctly', () => {
      const mockResponse = createMockWorkflowTest()
      const result = service.mapResponseToTestCasePublic(
        mockResponse,
        mockSpecId,
        mockEndpointId
      )

      expect(result.testType).toBe('workflow')
    })
  })

  describe('Integration', () => {
    it('should parse multiple single tests from AI response', () => {
      const mockTest1 = createMockSingleTest({ name: 'Test 1' })
      const mockTest2 = createMockSingleTest({ name: 'Test 2', method: 'POST' })
      const mockTest3 = createMockSingleTest({ name: 'Test 3', method: 'DELETE' })

      const aiResponse = createMockAIResponse([mockTest1, mockTest2, mockTest3])
      const blocks = service.extractJsonBlocksPublic(aiResponse)

      expect(blocks).toHaveLength(3)

      const results = blocks.map((block) =>
        service.mapResponseToTestCasePublic(block, mockSpecId, mockEndpointId)
      )

      expect(results).toHaveLength(3)
      expect(results[0].name).toBe('Test 1')
      expect(results[0].testType).toBe('single')
      expect(results[1].name).toBe('Test 2')
      expect(results[1].method).toBe('POST')
      expect(results[2].name).toBe('Test 3')
      expect(results[2].method).toBe('DELETE')
    })

    it('should parse mixed single + workflow tests', () => {
      const mockSingle = createMockSingleTest({ name: 'Single Test' })
      const mockWorkflow = createMockWorkflowTest({ name: 'Workflow Test' })

      const aiResponse = createMockAIResponse([mockSingle, mockWorkflow])
      const blocks = service.extractJsonBlocksPublic(aiResponse)

      expect(blocks).toHaveLength(2)

      const results = blocks.map((block) =>
        service.mapResponseToTestCasePublic(block, mockSpecId, mockEndpointId)
      )

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe('Single Test')
      expect(results[0].testType).toBe('single')
      expect(results[0].steps).toBeUndefined()

      expect(results[1].name).toBe('Workflow Test')
      expect(results[1].testType).toBe('workflow')
      expect(results[1].steps).toHaveLength(3)
    })

    it('should parse workflow tests only', () => {
      const mockWorkflow1 = createMockWorkflowTest({ name: 'Workflow 1' })
      const mockWorkflow2 = createMockWorkflowTest({ name: 'Workflow 2' })

      const aiResponse = createMockAIResponse([mockWorkflow1, mockWorkflow2])
      const blocks = service.extractJsonBlocksPublic(aiResponse)

      expect(blocks).toHaveLength(2)

      const results = blocks.map((block) =>
        service.mapResponseToTestCasePublic(block, mockSpecId, mockEndpointId)
      )

      expect(results).toHaveLength(2)
      expect(results[0].testType).toBe('workflow')
      expect(results[0].steps).toHaveLength(3)
      expect(results[1].testType).toBe('workflow')
      expect(results[1].steps).toHaveLength(3)
    })

    it('should handle response with some invalid JSON blocks', () => {
      const validTest = createMockSingleTest({ name: 'Valid Test' })
      const response = `
Here are the tests:

\`\`\`json
${JSON.stringify(validTest, null, 2)}
\`\`\`

\`\`\`json
{ this is invalid json }
\`\`\`

\`\`\`json
${JSON.stringify(createMockSingleTest({ name: 'Another Valid Test' }), null, 2)}
\`\`\`
      `

      const blocks = service.extractJsonBlocksPublic(response)

      // Should extract only valid blocks (2)
      expect(blocks.length).toBeGreaterThanOrEqual(2)
      expect(blocks[0].name).toBe('Valid Test')
    })
  })
})
