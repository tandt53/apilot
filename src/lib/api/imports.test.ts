/**
 * Unit Tests for Import Comparison Logic
 * Tests deep comparison of endpoints for import analysis
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { analyzeImport } from './imports'
import { db } from '@/lib/db'
import type { Endpoint } from '@/types/database'
import { parseImportedContent } from '@/lib/converters'

// Helper to create a basic endpoint for testing
function createTestEndpoint(overrides: Partial<Endpoint> = {}): Omit<Endpoint, 'id' | 'createdAt'> {
  return {
    specId: 1,
    source: 'openapi',
    method: 'GET',
    path: '/users',
    name: 'Get Users',
    description: 'Get all users',
    tags: [],
    request: {
      contentType: 'application/json',
      parameters: [],
    },
    responses: {
      success: {
        status: 200,
        description: 'Success',
      },
    },
    updatedAt: new Date(),
    createdBy: 'import',
    ...overrides,
  }
}

describe('Import Analysis - Deep Comparison', () => {
  const testSpecId = 1

  beforeEach(async () => {
    // Clear database before each test
    await db.endpoints.clear()
    await db.testCases.clear()
  })

  afterEach(async () => {
    // Cleanup after each test
    await db.endpoints.clear()
    await db.testCases.clear()
  })

  describe('Identical Endpoints', () => {
    it('should detect no changes when importing identical endpoint', async () => {
      // Setup: Create existing endpoint
      const existingEndpoint = createTestEndpoint()
      await db.endpoints.add({
        ...existingEndpoint,
        id: 1,
        createdAt: new Date(),
      } as Endpoint)

      // Test: Import identical endpoint
      const incomingEndpoint = createTestEndpoint()
      const analysis = await analyzeImport([incomingEndpoint], testSpecId)

      // Assert: Should detect as duplicate with NO changes
      expect(analysis.newEndpoints).toHaveLength(0)
      expect(analysis.duplicates).toHaveLength(1)
      expect(analysis.duplicates[0].hasChanges).toBe(false)
      expect(analysis.duplicates[0].changes).toHaveLength(0)
    })

    it('should detect no changes when importing endpoint with identical complex structure', async () => {
      const complexEndpoint = createTestEndpoint({
        description: 'Complex endpoint with all fields',
        tags: ['users', 'admin'],
        operationId: 'getUsers',
        deprecated: false,
        request: {
          contentType: 'application/json',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              type: 'integer',
              required: false,
              description: 'Limit results',
              example: 10,
              min: 1,
              max: 100,
              format: 'int32',
            },
            {
              name: 'page',
              in: 'query',
              type: 'integer',
              required: false,
              example: 1,
            },
          ],
          body: {
            required: true,
            description: 'User data',
            example: { name: 'John', email: 'john@example.com' },
            fields: [
              {
                name: 'name',
                type: 'string',
                required: true,
                description: 'User name',
                example: 'John',
              },
              {
                name: 'email',
                type: 'string',
                required: true,
                format: 'email',
                example: 'john@example.com',
              },
            ],
          },
        },
        responses: {
          success: {
            status: 200,
            description: 'Success',
            contentType: 'application/json',
            example: { id: 1, name: 'John' },
            fields: [
              { name: 'id', type: 'integer', required: true, example: 1 },
              { name: 'name', type: 'string', required: true, example: 'John' },
            ],
            headers: [
              { name: 'X-Total-Count', type: 'integer', example: 100 },
            ],
          },
          errors: [
            {
              status: 400,
              reason: 'Bad Request',
              description: 'Invalid input',
              example: { error: 'Invalid email' },
            },
          ],
        },
        auth: {
          required: true,
          type: 'bearer',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token required',
        },
      })

      await db.endpoints.add({
        ...complexEndpoint,
        id: 1,
        createdAt: new Date(),
      } as Endpoint)

      const analysis = await analyzeImport([complexEndpoint], testSpecId)

      expect(analysis.duplicates).toHaveLength(1)
      expect(analysis.duplicates[0].hasChanges).toBe(false)
      expect(analysis.duplicates[0].changes).toHaveLength(0)
    })
  })

  describe('Basic Property Changes', () => {
    it('should detect name change', async () => {
      const existing = createTestEndpoint({ name: 'Get Users' })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({ name: 'List All Users' })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      expect(analysis.duplicates[0].changes).toContainEqual({
        field: 'name',
        oldValue: 'Get Users',
        newValue: 'List All Users',
      })
    })

    it('should detect description change', async () => {
      const existing = createTestEndpoint({ description: 'Old description' })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({ description: 'New description' })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      expect(analysis.duplicates[0].changes).toContainEqual({
        field: 'description',
        oldValue: 'Old description',
        newValue: 'New description',
      })
    })
  })

  describe('Metadata Changes', () => {
    it('should detect tags change', async () => {
      const existing = createTestEndpoint({ tags: ['users', 'admin'] })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({ tags: ['users', 'public'] })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const tagsChange = analysis.duplicates[0].changes.find(c => c.field === 'tags')
      expect(tagsChange).toBeDefined()
      expect(tagsChange?.oldValue).toEqual(['users', 'admin'])
      expect(tagsChange?.newValue).toEqual(['users', 'public'])
    })

    it('should detect operationId change', async () => {
      const existing = createTestEndpoint({ operationId: 'getUsers' })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({ operationId: 'listUsers' })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      expect(analysis.duplicates[0].changes).toContainEqual({
        field: 'operationId',
        oldValue: 'getUsers',
        newValue: 'listUsers',
      })
    })

    it('should detect deprecated flag change', async () => {
      const existing = createTestEndpoint({ deprecated: false })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({ deprecated: true })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      expect(analysis.duplicates[0].changes).toContainEqual({
        field: 'deprecated',
        oldValue: false,
        newValue: true,
      })
    })
  })

  describe('Parameter Changes', () => {
    it('should detect added parameter', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'limit', in: 'query', type: 'integer', required: false, example: 10 },
          ],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'limit', in: 'query', type: 'integer', required: false, example: 10 },
            { name: 'page', in: 'query', type: 'integer', required: false, example: 1 },
          ],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const paramChange = analysis.duplicates[0].changes.find(
        c => c.field === 'parameters' && c.type === 'added'
      )
      expect(paramChange).toBeDefined()
      expect(paramChange?.parameter).toBe('page')
      expect(paramChange?.location).toBe('query')
    })

    it('should detect removed parameter', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'limit', in: 'query', type: 'integer', required: false, example: 10 },
            { name: 'page', in: 'query', type: 'integer', required: false, example: 1 },
          ],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'limit', in: 'query', type: 'integer', required: false, example: 10 },
          ],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const paramChange = analysis.duplicates[0].changes.find(
        c => c.field === 'parameters' && c.type === 'removed'
      )
      expect(paramChange).toBeDefined()
      expect(paramChange?.parameter).toBe('page')
    })

    it('should detect parameter type change', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'id', in: 'path', type: 'string', required: true, example: 'abc' },
          ],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'id', in: 'path', type: 'integer', required: true, example: 123 },
          ],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const paramChange = analysis.duplicates[0].changes.find(
        c => c.field === 'parameters' && c.type === 'modified'
      )
      expect(paramChange).toBeDefined()
      expect(paramChange?.parameter).toBe('id')
      expect(paramChange?.differences).toContainEqual({
        property: 'type',
        oldValue: 'string',
        newValue: 'integer',
      })
    })

    it('should detect parameter required change', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'filter', in: 'query', type: 'string', required: false, example: 'active' },
          ],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'filter', in: 'query', type: 'string', required: true, example: 'active' },
          ],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const paramChange = analysis.duplicates[0].changes.find(
        c => c.field === 'parameters' && c.type === 'modified'
      )
      expect(paramChange?.differences).toContainEqual({
        property: 'required',
        oldValue: false,
        newValue: true,
      })
    })

    it('should detect parameter constraint changes', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'limit', in: 'query', type: 'integer', required: false, example: 10, min: 1, max: 50 },
          ],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'limit', in: 'query', type: 'integer', required: false, example: 10, min: 1, max: 100 },
          ],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const paramChange = analysis.duplicates[0].changes.find(
        c => c.field === 'parameters' && c.type === 'modified'
      )
      expect(paramChange?.differences).toContainEqual({
        property: 'constraints',
        oldValue: { min: 1, max: 50 },
        newValue: { min: 1, max: 100 },
      })
    })

    it('should detect parameter enum change', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'status', in: 'query', type: 'string', required: false, example: 'active', enum: ['active', 'inactive'] },
          ],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'status', in: 'query', type: 'string', required: false, example: 'active', enum: ['active', 'inactive', 'pending'] },
          ],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const paramChange = analysis.duplicates[0].changes.find(
        c => c.field === 'parameters' && c.type === 'modified'
      )
      expect(paramChange?.differences).toContainEqual({
        property: 'enum',
        oldValue: ['active', 'inactive'],
        newValue: ['active', 'inactive', 'pending'],
      })
    })
  })

  describe('Request Body Changes', () => {
    it('should detect request body added', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
          body: {
            required: true,
            example: { name: 'John' },
            fields: [
              { name: 'name', type: 'string', required: true, example: 'John' },
            ],
          },
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const bodyChange = analysis.duplicates[0].changes.find(c => c.field === 'request.body')
      expect(bodyChange).toBeDefined()
      expect(bodyChange?.type).toBe('added')
    })

    it('should detect request body removed', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
          body: {
            required: true,
            example: { name: 'John' },
            fields: [
              { name: 'name', type: 'string', required: true, example: 'John' },
            ],
          },
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const bodyChange = analysis.duplicates[0].changes.find(c => c.field === 'request.body')
      expect(bodyChange).toBeDefined()
      expect(bodyChange?.type).toBe('removed')
    })

    it('should detect request body fields change', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
          body: {
            required: true,
            example: { name: 'John' },
            fields: [
              { name: 'name', type: 'string', required: true, example: 'John' },
            ],
          },
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
          body: {
            required: true,
            example: { name: 'John', email: 'john@example.com' },
            fields: [
              { name: 'name', type: 'string', required: true, example: 'John' },
              { name: 'email', type: 'string', required: true, example: 'john@example.com' },
            ],
          },
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const bodyChange = analysis.duplicates[0].changes.find(c => c.field === 'request.body.fields')
      expect(bodyChange).toBeDefined()
    })

    it('should detect request body example change', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
          body: {
            required: true,
            example: { name: 'John', age: 25 },
            fields: [],
          },
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
          body: {
            required: true,
            example: { name: 'Jane', age: 30 },
            fields: [],
          },
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const bodyChange = analysis.duplicates[0].changes.find(c => c.field === 'request.body.example')
      expect(bodyChange).toBeDefined()
    })

    it('should detect contentType change', async () => {
      const existing = createTestEndpoint({
        request: {
          contentType: 'application/json',
          parameters: [],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        request: {
          contentType: 'multipart/form-data',
          parameters: [],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      expect(analysis.duplicates[0].changes).toContainEqual({
        field: 'request.contentType',
        oldValue: 'application/json',
        newValue: 'multipart/form-data',
      })
    })
  })

  describe('Response Changes', () => {
    it('should detect success response status change', async () => {
      const existing = createTestEndpoint({
        responses: {
          success: {
            status: 200,
            description: 'OK',
          },
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        responses: {
          success: {
            status: 201,
            description: 'Created',
          },
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const responseChange = analysis.duplicates[0].changes.find(c => c.field === 'responses.success')
      expect(responseChange).toBeDefined()
      expect(responseChange?.differences).toContainEqual({
        property: 'status',
        oldValue: 200,
        newValue: 201,
      })
    })

    it('should detect response fields change', async () => {
      const existing = createTestEndpoint({
        responses: {
          success: {
            status: 200,
            fields: [
              { name: 'id', type: 'integer', required: true, example: 1 },
              { name: 'name', type: 'string', required: true, example: 'John' },
            ],
          },
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        responses: {
          success: {
            status: 200,
            fields: [
              { name: 'id', type: 'integer', required: true, example: 1 },
              { name: 'name', type: 'string', required: true, example: 'John' },
              { name: 'email', type: 'string', required: false, example: 'john@example.com' },
            ],
          },
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const responseChange = analysis.duplicates[0].changes.find(c => c.field === 'responses.success')
      expect(responseChange?.differences).toContainEqual(
        expect.objectContaining({ property: 'fields' })
      )
    })

    it('should detect error responses change', async () => {
      const existing = createTestEndpoint({
        responses: {
          success: { status: 200 },
          errors: [
            { status: 400, reason: 'Bad Request', description: 'Invalid input' },
          ],
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        responses: {
          success: { status: 200 },
          errors: [
            { status: 400, reason: 'Bad Request', description: 'Invalid input' },
            { status: 404, reason: 'Not Found', description: 'Resource not found' },
          ],
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const errorChange = analysis.duplicates[0].changes.find(c => c.field === 'responses.errors')
      expect(errorChange).toBeDefined()
    })
  })

  describe('Authentication Changes', () => {
    it('should detect auth type change', async () => {
      const existing = createTestEndpoint({
        auth: {
          required: true,
          type: 'bearer',
          scheme: 'bearer',
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        auth: {
          required: true,
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const authChange = analysis.duplicates[0].changes.find(c => c.field === 'auth')
      expect(authChange).toBeDefined()
      expect(authChange?.differences).toContainEqual({
        property: 'type',
        oldValue: 'bearer',
        newValue: 'apiKey',
      })
    })

    it('should detect auth added', async () => {
      const existing = createTestEndpoint({
        auth: undefined,
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        auth: {
          required: true,
          type: 'bearer',
        },
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const authChange = analysis.duplicates[0].changes.find(c => c.field === 'auth')
      expect(authChange).toBeDefined()
      expect(authChange?.type).toBe('added')
    })

    it('should detect auth removed', async () => {
      const existing = createTestEndpoint({
        auth: {
          required: true,
          type: 'bearer',
        },
      })
      await db.endpoints.add({ ...existing, id: 1, createdAt: new Date() } as Endpoint)

      const incoming = createTestEndpoint({
        auth: undefined,
      })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.duplicates[0].hasChanges).toBe(true)
      const authChange = analysis.duplicates[0].changes.find(c => c.field === 'auth')
      expect(authChange).toBeDefined()
      expect(authChange?.type).toBe('removed')
    })
  })

  describe('New Endpoints Detection', () => {
    it('should detect new endpoint (no match in database)', async () => {
      const incoming = createTestEndpoint({ path: '/posts', name: 'Get Posts' })
      const analysis = await analyzeImport([incoming], testSpecId)

      expect(analysis.newEndpoints).toHaveLength(1)
      expect(analysis.duplicates).toHaveLength(0)
      expect(analysis.summary.new).toBe(1)
    })

    it('should handle multiple new endpoints', async () => {
      const incoming = [
        createTestEndpoint({ path: '/posts', name: 'Get Posts' }),
        createTestEndpoint({ path: '/comments', name: 'Get Comments' }),
        createTestEndpoint({ path: '/tags', name: 'Get Tags' }),
      ]
      const analysis = await analyzeImport(incoming, testSpecId)

      expect(analysis.newEndpoints).toHaveLength(3)
      expect(analysis.summary.new).toBe(3)
    })
  })

  describe('Complex Real-World Scenarios', () => {
    it('should handle user editing endpoint after import', async () => {
      // Scenario: User imports spec, edits endpoint, then re-imports original spec

      // Step 1: Original import
      const originalEndpoint = createTestEndpoint({
        name: 'Create User',
        description: 'Create a new user',
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'notify', in: 'query', type: 'boolean', required: false, example: true },
          ],
          body: {
            required: true,
            example: { name: 'John', email: 'john@example.com' },
            fields: [
              { name: 'name', type: 'string', required: true, example: 'John' },
              { name: 'email', type: 'string', required: true, format: 'email', example: 'john@example.com' },
            ],
          },
        },
        responses: {
          success: {
            status: 201,
            fields: [
              { name: 'id', type: 'integer', required: true, example: 1 },
              { name: 'name', type: 'string', required: true, example: 'John' },
            ],
          },
        },
      })

      // Step 2: User edits (adds parameter, body field, response field)
      const userEditedEndpoint = createTestEndpoint({
        name: 'Create User',
        description: 'Create a new user',
        request: {
          contentType: 'application/json',
          parameters: [
            { name: 'notify', in: 'query', type: 'boolean', required: false, example: true },
            { name: 'sendEmail', in: 'query', type: 'boolean', required: false, example: false }, // USER ADDED
          ],
          body: {
            required: true,
            example: { name: 'John', email: 'john@example.com', phone: '555-1234' },
            fields: [
              { name: 'name', type: 'string', required: true, example: 'John' },
              { name: 'email', type: 'string', required: true, format: 'email', example: 'john@example.com' },
              { name: 'phone', type: 'string', required: false, example: '555-1234' }, // USER ADDED
            ],
          },
        },
        responses: {
          success: {
            status: 201,
            fields: [
              { name: 'id', type: 'integer', required: true, example: 1 },
              { name: 'name', type: 'string', required: true, example: 'John' },
              { name: 'createdAt', type: 'string', required: true, format: 'date-time', example: '2024-01-01T00:00:00Z' }, // USER ADDED
            ],
          },
        },
      })

      await db.endpoints.add({ ...userEditedEndpoint, id: 1, createdAt: new Date() } as Endpoint)

      // Step 3: Re-import original spec
      const analysis = await analyzeImport([originalEndpoint], testSpecId)

      // Assert: Should detect ALL differences
      expect(analysis.duplicates).toHaveLength(1)
      expect(analysis.duplicates[0].hasChanges).toBe(true)

      const changes = analysis.duplicates[0].changes

      // Should detect removed parameter 'sendEmail'
      expect(changes).toContainEqual(
        expect.objectContaining({
          field: 'parameters',
          type: 'removed',
          parameter: 'sendEmail',
        })
      )

      // Should detect body fields change (phone removed)
      expect(changes.some(c => c.field === 'request.body.fields')).toBe(true)

      // Should detect response fields change (createdAt removed)
      expect(changes.some(c =>
        c.field === 'responses.success' &&
        c.differences.some((d: any) => d.property === 'fields')
      )).toBe(true)
    })
  })

  describe('Real OpenAPI Import Flow', () => {
    it('should detect no changes when importing same OpenAPI spec twice', async () => {
      // Real OpenAPI 3.0 spec
      const openAPISpec = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Petstore API',
          version: '1.0.0',
          description: 'A simple petstore API',
        },
        servers: [
          {
            url: 'https://api.petstore.com/v1',
          },
        ],
        paths: {
          '/pets': {
            get: {
              summary: 'List all pets',
              operationId: 'listPets',
              tags: ['pets'],
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  description: 'How many items to return',
                  required: false,
                  schema: {
                    type: 'integer',
                    format: 'int32',
                  },
                },
              ],
              responses: {
                '200': {
                  description: 'A paged array of pets',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            post: {
              summary: 'Create a pet',
              operationId: 'createPets',
              tags: ['pets'],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string' },
                        tag: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Null response',
                },
              },
            },
          },
        },
      })

      // First import
      const firstParse = await parseImportedContent(openAPISpec)
      expect(firstParse.success).toBe(true)

      const firstEndpoints = firstParse.data!.endpoints

      // Store first import in DB
      for (const endpoint of firstEndpoints) {
        await db.endpoints.add({
          ...endpoint,
          specId: testSpecId,
          createdAt: new Date(),
        } as Endpoint)
      }

      // Second import (same spec)
      const secondParse = await parseImportedContent(openAPISpec)
      expect(secondParse.success).toBe(true)

      const secondEndpoints = secondParse.data!.endpoints

      // Analyze import
      const analysis = await analyzeImport(
        secondEndpoints.map(ep => ({ ...ep, specId: testSpecId })),
        testSpecId
      )

      // Debug output
      console.log('First import endpoints:', firstEndpoints.length)
      console.log('Second import endpoints:', secondEndpoints.length)
      console.log('Analysis:', {
        new: analysis.summary.new,
        duplicates: analysis.duplicates.length,
      })

      if (analysis.duplicates.length > 0) {
        analysis.duplicates.forEach((dup, idx) => {
          console.log(`\nDuplicate ${idx + 1}: ${dup.existing.method} ${dup.existing.path}`)
          console.log('  hasChanges:', dup.hasChanges)
          if (dup.hasChanges) {
            console.log('  changes:', JSON.stringify(dup.changes, null, 2))
          }
        })
      }

      // Assert: Should have NO new endpoints
      expect(analysis.newEndpoints).toHaveLength(0)

      // Assert: Should have duplicates for each endpoint
      expect(analysis.duplicates).toHaveLength(firstEndpoints.length)

      // Assert: NO changes should be detected
      analysis.duplicates.forEach((dup, idx) => {
        expect(dup.hasChanges, `Endpoint ${idx + 1} (${dup.existing.method} ${dup.existing.path}) should have no changes`).toBe(false)
        expect(dup.changes, `Endpoint ${idx + 1} should have empty changes array`).toHaveLength(0)
      })
    })

    it('should handle undefined vs empty array edge cases', async () => {
      // Test the specific case where tags might be undefined in DB but [] from converter

      // Case 1: Endpoint with tags = undefined stored in DB
      const endpointWithUndefinedTags = createTestEndpoint({
        tags: undefined,
      })
      await db.endpoints.add({
        ...endpointWithUndefinedTags,
        id: 1,
        createdAt: new Date(),
      } as Endpoint)

      // Import endpoint where converter returns tags = []
      const incomingWithEmptyTags = createTestEndpoint({
        tags: [],
      })

      const analysis1 = await analyzeImport([incomingWithEmptyTags], testSpecId)

      console.log('\nCase 1: undefined → []')
      console.log('  hasChanges:', analysis1.duplicates[0].hasChanges)
      if (analysis1.duplicates[0].hasChanges) {
        console.log('  changes:', JSON.stringify(analysis1.duplicates[0].changes, null, 2))
      }

      // Clear DB
      await db.endpoints.clear()

      // Case 2: Endpoint with tags = [] stored in DB
      const endpointWithEmptyTags = createTestEndpoint({
        tags: [],
      })
      await db.endpoints.add({
        ...endpointWithEmptyTags,
        id: 2,
        createdAt: new Date(),
      } as Endpoint)

      // Import endpoint where converter returns tags = undefined
      const incomingWithUndefinedTags = createTestEndpoint({
        tags: undefined,
      })

      const analysis2 = await analyzeImport([incomingWithUndefinedTags], testSpecId)

      console.log('\nCase 2: [] → undefined')
      console.log('  hasChanges:', analysis2.duplicates[0].hasChanges)
      if (analysis2.duplicates[0].hasChanges) {
        console.log('  changes:', JSON.stringify(analysis2.duplicates[0].changes, null, 2))
      }

      // Both cases should detect NO changes (undefined and [] are semantically equivalent)
      expect(analysis1.duplicates[0].hasChanges, 'undefined → [] should show no changes').toBe(false)
      expect(analysis2.duplicates[0].hasChanges, '[] → undefined should show no changes').toBe(false)
    })

    it('should handle Date serialization from IndexedDB', async () => {
      // Test that Date objects from DB don't cause false positives

      const endpoint = createTestEndpoint({
        tags: ['pets', 'animals'],
      })

      // Add to DB with current date
      const now = new Date()
      const storedId = await db.endpoints.add({
        ...endpoint,
        id: 1,
        createdAt: now,
        updatedAt: now,
      } as Endpoint)

      // Retrieve from DB (dates will be serialized/deserialized)
      const retrievedFromDB = await db.endpoints.get(storedId as number)

      console.log('\nDate serialization test:')
      console.log('  Original createdAt:', now)
      console.log('  Retrieved createdAt:', retrievedFromDB?.createdAt)
      console.log('  Are equal (===):', now === retrievedFromDB?.createdAt)
      console.log('  Are same time:', now.getTime() === retrievedFromDB?.createdAt.getTime())

      // Import the same endpoint with new Date objects
      const incomingEndpoint = createTestEndpoint({
        tags: ['pets', 'animals'],
      })

      const analysis = await analyzeImport([incomingEndpoint], testSpecId)

      console.log('  hasChanges after retrieval:', analysis.duplicates[0].hasChanges)
      if (analysis.duplicates[0].hasChanges) {
        console.log('  changes:', JSON.stringify(analysis.duplicates[0].changes, null, 2))
      }

      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should detect no changes when importing Swagger Petstore spec twice', async () => {
      // Use the actual Swagger 2.0 Petstore spec from test-samples
      const swaggerSpec = await import('/Users/tandt/projects/AI/apilot-app/test-samples/swagger.json')
      const specString = JSON.stringify(swaggerSpec.default)

      // First import
      const firstParse = await parseImportedContent(specString)
      expect(firstParse.success).toBe(true)
      expect(firstParse.detection.format).toBe('swagger')

      const firstEndpoints = firstParse.data!.endpoints

      console.log('\n=== Swagger Petstore Import Test ===')
      console.log('First import endpoints:', firstEndpoints.length)
      console.log('First endpoint example:', {
        method: firstEndpoints[0].method,
        path: firstEndpoints[0].path,
        tags: firstEndpoints[0].tags,
        operationId: firstEndpoints[0].operationId,
      })

      // Store first import in DB
      for (const endpoint of firstEndpoints) {
        await db.endpoints.add({
          ...endpoint,
          specId: testSpecId,
          createdAt: new Date(),
        } as Endpoint)
      }

      // Second import (same spec)
      const secondParse = await parseImportedContent(specString)
      expect(secondParse.success).toBe(true)

      const secondEndpoints = secondParse.data!.endpoints

      console.log('Second import endpoints:', secondEndpoints.length)
      console.log('Second endpoint example:', {
        method: secondEndpoints[0].method,
        path: secondEndpoints[0].path,
        tags: secondEndpoints[0].tags,
        operationId: secondEndpoints[0].operationId,
      })

      // Analyze import
      const analysis = await analyzeImport(
        secondEndpoints.map(ep => ({ ...ep, specId: testSpecId })),
        testSpecId
      )

      console.log('\nAnalysis results:')
      console.log('  New:', analysis.summary.new)
      console.log('  Duplicates:', analysis.duplicates.length)
      console.log('  With changes:', analysis.duplicates.filter(d => d.hasChanges).length)

      // Log any endpoints with changes
      const endpointsWithChanges = analysis.duplicates.filter(d => d.hasChanges)
      if (endpointsWithChanges.length > 0) {
        console.log('\n⚠️ Endpoints with detected changes:')
        endpointsWithChanges.forEach((dup, idx) => {
          console.log(`\n${idx + 1}. ${dup.existing.method} ${dup.existing.path}`)
          console.log('   Changes:', JSON.stringify(dup.changes, null, 2))

          // Deep dive into error responses if that's what changed
          const errorChange = dup.changes.find(c => c.field === 'responses.errors')
          if (errorChange) {
            console.log('\n   DETAILED ERROR RESPONSE COMPARISON:')
            const oldErrors = errorChange.oldValue || []
            const newErrors = errorChange.newValue || []

            console.log('   Old errors length:', oldErrors.length)
            console.log('   New errors length:', newErrors.length)

            if (oldErrors.length > 0 && newErrors.length > 0) {
              const oldErr = oldErrors[0]
              const newErr = newErrors[0]

              console.log('\n   First error object comparison:')
              console.log('   OLD:', JSON.stringify(oldErr, null, 2))
              console.log('   NEW:', JSON.stringify(newErr, null, 2))

              console.log('\n   Field-by-field comparison:')
              const allKeys = new Set([...Object.keys(oldErr), ...Object.keys(newErr)])
              allKeys.forEach(key => {
                const oldVal = oldErr[key]
                const newVal = newErr[key]
                const equal = oldVal === newVal
                console.log(`     ${key}:`, {
                  old: oldVal,
                  new: newVal,
                  equal,
                  oldType: typeof oldVal,
                  newType: typeof newVal,
                })
              })

              console.log('\n   Deep equality check:')
              console.log('   Are identical (===):', oldErr === newErr)
              console.log('   JSON.stringify equal:', JSON.stringify(oldErr) === JSON.stringify(newErr))

              // Manual deep check
              const keysMatch = Object.keys(oldErr).length === Object.keys(newErr).length
              const valuesMatch = Object.keys(oldErr).every(k => oldErr[k] === newErr[k])
              console.log('   Keys match:', keysMatch)
              console.log('   Values match:', valuesMatch)
            }
          }
        })
      }

      // Assert: Should have NO new endpoints
      expect(analysis.newEndpoints).toHaveLength(0)

      // Assert: Should have duplicates for each endpoint
      expect(analysis.duplicates.length).toBeGreaterThan(0)

      // Assert: NO changes should be detected
      expect(endpointsWithChanges.length,
        `Expected 0 endpoints with changes, but found ${endpointsWithChanges.length}`
      ).toBe(0)

      analysis.duplicates.forEach((dup, idx) => {
        expect(dup.hasChanges,
          `Endpoint ${idx + 1} (${dup.existing.method} ${dup.existing.path}) should have no changes`
        ).toBe(false)
      })
    })
  })

  describe('cURL Import Flow', () => {
    it('should detect no changes when importing same cURL GET command twice', async () => {
      const curlCommand = `curl https://api.example.com/users -H "Authorization: Bearer token123" -H "Accept: application/json"`

      // First import
      const firstParse = await parseImportedContent(curlCommand)
      expect(firstParse.success).toBe(true)
      expect(firstParse.detection.format).toBe('curl')

      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== cURL GET Import Test ===')
      console.log('First import endpoint:', {
        method: firstEndpoint.method,
        path: firstEndpoint.path,
        source: firstEndpoint.source,
        errorsCount: firstEndpoint.responses?.errors?.length,
      })

      // Store first import in DB
      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      // Second import (same cURL)
      const secondParse = await parseImportedContent(curlCommand)
      expect(secondParse.success).toBe(true)

      const secondEndpoint = secondParse.data!.endpoints[0]

      console.log('Second import endpoint:', {
        method: secondEndpoint.method,
        path: secondEndpoint.path,
        source: secondEndpoint.source,
        errorsCount: secondEndpoint.responses?.errors?.length,
      })

      // Analyze import
      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      console.log('Analysis:', {
        new: analysis.summary.new,
        duplicates: analysis.duplicates.length,
        withChanges: analysis.duplicates.filter(d => d.hasChanges).length,
      })

      if (analysis.duplicates.length > 0 && analysis.duplicates[0].hasChanges) {
        console.log('Changes detected:', JSON.stringify(analysis.duplicates[0].changes, null, 2))
      }

      // Assert: Should have NO changes
      expect(analysis.newEndpoints).toHaveLength(0)
      expect(analysis.duplicates).toHaveLength(1)
      expect(analysis.duplicates[0].hasChanges).toBe(false)
      expect(analysis.duplicates[0].changes).toHaveLength(0)
    })

    it('should detect no changes when importing same cURL POST command twice', async () => {
      const curlCommand = `curl -X POST https://api.example.com/users -H "Content-Type: application/json" -H "Authorization: Bearer token123" -d '{"name":"John Doe","email":"john@example.com","age":30}'`

      // First import
      const firstParse = await parseImportedContent(curlCommand)
      expect(firstParse.success).toBe(true)

      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== cURL POST Import Test ===')
      console.log('Method:', firstEndpoint.method)
      console.log('Has body:', !!firstEndpoint.request?.body)
      console.log('Body fields:', firstEndpoint.request?.body?.fields?.length)

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      // Second import
      const secondParse = await parseImportedContent(curlCommand)
      const secondEndpoint = secondParse.data!.endpoints[0]

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      if (analysis.duplicates[0]?.hasChanges) {
        console.log('⚠️ Unexpected changes:', JSON.stringify(analysis.duplicates[0].changes, null, 2))
      }

      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should detect no changes when importing cURL with query parameters twice', async () => {
      const curlCommand = `curl "https://api.example.com/users?status=active&limit=10&offset=0" -H "Authorization: Bearer token123"`

      const firstParse = await parseImportedContent(curlCommand)
      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== cURL with Query Params Test ===')
      console.log('Path:', firstEndpoint.path)
      console.log('Parameters:', firstEndpoint.request?.parameters?.map(p => `${p.name}:${p.in}`))

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      const secondParse = await parseImportedContent(curlCommand)
      const secondEndpoint = secondParse.data!.endpoints[0]

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should detect no changes when importing complex cURL command twice', async () => {
      const curlCommand = `curl -X POST https://api.shop.com/orders -H "Content-Type: application/json" -H "Authorization: Bearer shop_token_xyz" -d '{"customerId":12345,"items":[{"productId":101,"quantity":2,"price":29.99},{"productId":205,"quantity":1,"price":49.99}],"shippingAddress":{"street":"123 Main St","city":"San Francisco","state":"CA","zip":"94102"},"paymentMethod":"credit_card"}'`

      const firstParse = await parseImportedContent(curlCommand)
      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== Complex cURL Test ===')
      console.log('Has nested JSON:', !!firstEndpoint.request?.body?.example)

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      const secondParse = await parseImportedContent(curlCommand)
      const secondEndpoint = secondParse.data!.endpoints[0]

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      if (analysis.duplicates[0]?.hasChanges) {
        console.log('Changes:', analysis.duplicates[0].changes)
      }

      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should detect no changes when importing multiple cURL commands twice', async () => {
      const curlCommands = [
        `curl https://api.example.com/users`,
        `curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d '{"name":"Test"}'`,
        `curl -X DELETE https://api.example.com/users/123 -H "Authorization: Bearer token"`,
      ]

      // First batch import
      const firstEndpoints: Array<any> = []
      for (const cmd of curlCommands) {
        const parsed = await parseImportedContent(cmd)
        if (parsed.success) {
          firstEndpoints.push(...parsed.data!.endpoints)
        }
      }

      console.log('\n=== Multiple cURL Commands Test ===')
      console.log('First batch endpoints:', firstEndpoints.length)

      for (const endpoint of firstEndpoints) {
        await db.endpoints.add({
          ...endpoint,
          specId: testSpecId,
          createdAt: new Date(),
        } as Endpoint)
      }

      // Second batch import (same commands)
      const secondEndpoints: Array<any> = []
      for (const cmd of curlCommands) {
        const parsed = await parseImportedContent(cmd)
        if (parsed.success) {
          secondEndpoints.push(...parsed.data!.endpoints)
        }
      }

      const analysis = await analyzeImport(
        secondEndpoints.map(ep => ({ ...ep, specId: testSpecId })),
        testSpecId
      )

      console.log('Analysis:', {
        new: analysis.summary.new,
        duplicates: analysis.duplicates.length,
        withChanges: analysis.duplicates.filter(d => d.hasChanges).length,
      })

      expect(analysis.newEndpoints).toHaveLength(0)
      expect(analysis.duplicates).toHaveLength(3)
      analysis.duplicates.forEach((dup, idx) => {
        expect(dup.hasChanges, `Endpoint ${idx + 1} should have no changes`).toBe(false)
      })
    })
  })

  describe('Postman Import Flow', () => {
    it('should detect no changes when importing same Postman collection twice', async () => {
      const postmanJson = await import('/Users/tandt/projects/AI/apilot-app/test-samples/sample-postman-collection.json')
      const collectionString = JSON.stringify(postmanJson.default)

      // First import
      const firstParse = await parseImportedContent(collectionString)
      expect(firstParse.success).toBe(true)
      expect(firstParse.detection.format).toBe('postman')

      const firstEndpoints = firstParse.data!.endpoints

      console.log('\n=== Postman Collection Import Test ===')
      console.log('First import endpoints:', firstEndpoints.length)
      console.log('First endpoint:', {
        method: firstEndpoints[0].method,
        path: firstEndpoints[0].path,
        source: firstEndpoints[0].source,
      })

      // Store first import
      for (const endpoint of firstEndpoints) {
        await db.endpoints.add({
          ...endpoint,
          specId: testSpecId,
          createdAt: new Date(),
        } as Endpoint)
      }

      // Second import (same collection)
      const secondParse = await parseImportedContent(collectionString)
      expect(secondParse.success).toBe(true)

      const secondEndpoints = secondParse.data!.endpoints

      console.log('Second import endpoints:', secondEndpoints.length)

      // Analyze import
      const analysis = await analyzeImport(
        secondEndpoints.map(ep => ({ ...ep, specId: testSpecId })),
        testSpecId
      )

      console.log('Analysis:', {
        new: analysis.summary.new,
        duplicates: analysis.duplicates.length,
        withChanges: analysis.duplicates.filter(d => d.hasChanges).length,
      })

      // Log any changes
      const withChanges = analysis.duplicates.filter(d => d.hasChanges)
      if (withChanges.length > 0) {
        console.log('\n⚠️ Endpoints with changes:')
        withChanges.forEach(dup => {
          console.log(`  ${dup.existing.method} ${dup.existing.path}`)
          console.log(`  Changes:`, JSON.stringify(dup.changes, null, 2))
        })
      }

      // Assert: Should have NO changes
      expect(analysis.newEndpoints).toHaveLength(0)
      expect(analysis.duplicates.length).toBeGreaterThan(0)
      analysis.duplicates.forEach((dup, idx) => {
        expect(dup.hasChanges, `Endpoint ${idx + 1} (${dup.existing.method} ${dup.existing.path}) should have no changes`).toBe(false)
      })
    })

    it('should handle Postman variables consistently', async () => {
      // Simplified Postman collection with variables
      const collection = {
        info: {
          name: 'Test API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
          { key: 'baseUrl', value: 'https://api.example.com' },
          { key: 'apiKey', value: 'test-key' },
        ],
        item: [
          {
            name: 'Get User',
            request: {
              method: 'GET',
              header: [
                { key: 'Authorization', value: 'Bearer {{apiKey}}' },
              ],
              url: {
                raw: '{{baseUrl}}/users/:id',
                host: ['{{baseUrl}}'],
                path: ['users', ':id'],
                variable: [{ key: 'id', value: '123' }],
              },
            },
          },
        ],
      }

      const collectionString = JSON.stringify(collection)

      const firstParse = await parseImportedContent(collectionString)
      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== Postman Variables Test ===')
      console.log('Path:', firstEndpoint.path)

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      const secondParse = await parseImportedContent(collectionString)
      const secondEndpoint = secondParse.data!.endpoints[0]

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should handle Postman nested folders', async () => {
      const collection = {
        info: {
          name: 'Test API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'User Operations',
            item: [
              {
                name: 'Get User',
                request: {
                  method: 'GET',
                  url: 'https://api.example.com/users',
                },
              },
              {
                name: 'Create User',
                request: {
                  method: 'POST',
                  url: 'https://api.example.com/users',
                  body: {
                    mode: 'raw',
                    raw: JSON.stringify({ name: 'Test' }),
                  },
                },
              },
            ],
          },
        ],
      }

      const collectionString = JSON.stringify(collection)

      const firstParse = await parseImportedContent(collectionString)
      const firstEndpoints = firstParse.data!.endpoints

      console.log('\n=== Postman Nested Folders Test ===')
      console.log('Endpoints from nested folders:', firstEndpoints.length)

      for (const endpoint of firstEndpoints) {
        await db.endpoints.add({
          ...endpoint,
          specId: testSpecId,
          createdAt: new Date(),
        } as Endpoint)
      }

      const secondParse = await parseImportedContent(collectionString)
      const secondEndpoints = secondParse.data!.endpoints

      const analysis = await analyzeImport(
        secondEndpoints.map(ep => ({ ...ep, specId: testSpecId })),
        testSpecId
      )

      expect(analysis.duplicates).toHaveLength(2)
      analysis.duplicates.forEach(dup => {
        expect(dup.hasChanges).toBe(false)
      })
    })

    it('should handle Postman path parameters', async () => {
      const collection = {
        info: {
          name: 'Test API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get User by ID',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/users/:userId/posts/:postId',
                path: ['users', ':userId', 'posts', ':postId'],
                variable: [
                  { key: 'userId', value: '123' },
                  { key: 'postId', value: '456' },
                ],
              },
            },
          },
        ],
      }

      const collectionString = JSON.stringify(collection)

      const firstParse = await parseImportedContent(collectionString)
      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== Postman Path Parameters Test ===')
      console.log('Path:', firstEndpoint.path)
      console.log('Parameters:', firstEndpoint.request?.parameters?.filter(p => p.in === 'path'))

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      const secondParse = await parseImportedContent(collectionString)
      const secondEndpoint = secondParse.data!.endpoints[0]

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      if (analysis.duplicates[0]?.hasChanges) {
        console.log('Changes:', analysis.duplicates[0].changes)
      }

      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should handle Postman different body modes', async () => {
      const rawBodyCollection = {
        info: {
          name: 'Test API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Create User',
            request: {
              method: 'POST',
              url: 'https://api.example.com/users',
              body: {
                mode: 'raw',
                raw: JSON.stringify({ name: 'John', email: 'john@example.com' }),
                options: {
                  raw: {
                    language: 'json',
                  },
                },
              },
            },
          },
        ],
      }

      const collectionString = JSON.stringify(rawBodyCollection)

      const firstParse = await parseImportedContent(collectionString)
      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== Postman Body Modes Test ===')
      console.log('Has body:', !!firstEndpoint.request?.body)
      console.log('Body fields:', firstEndpoint.request?.body?.fields?.length)

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      const secondParse = await parseImportedContent(collectionString)
      const secondEndpoint = secondParse.data!.endpoints[0]

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })
  })

  describe('Mixed Source Imports', () => {
    it('should compare cURL vs cURL correctly (same endpoint)', async () => {
      // First import: cURL GET
      const curlCommand = `curl https://api.example.com/products -H "Authorization: Bearer token"`

      const firstParse = await parseImportedContent(curlCommand)
      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== cURL vs cURL Test ===')
      console.log('First (cURL) endpoint:', {
        method: firstEndpoint.method,
        path: firstEndpoint.path,
        source: firstEndpoint.source,
        errors: firstEndpoint.responses?.errors?.length,
      })

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      // Second import: Same cURL
      const secondParse = await parseImportedContent(curlCommand)
      const secondEndpoint = secondParse.data!.endpoints[0]

      console.log('Second (cURL) endpoint:', {
        method: secondEndpoint.method,
        path: secondEndpoint.path,
        source: secondEndpoint.source,
        errors: secondEndpoint.responses?.errors?.length,
      })

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      // Both use smart defaults → should be identical
      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should compare Postman vs Postman correctly (same endpoint)', async () => {
      const collection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get Products',
            request: {
              method: 'GET',
              url: 'https://api.example.com/products',
              header: [{ key: 'Authorization', value: 'Bearer token' }],
            },
          },
        ],
      }

      const collectionString = JSON.stringify(collection)

      const firstParse = await parseImportedContent(collectionString)
      const firstEndpoint = firstParse.data!.endpoints[0]

      console.log('\n=== Postman vs Postman Test ===')
      console.log('Both use smart defaults:', {
        errors: firstEndpoint.responses?.errors?.length,
      })

      await db.endpoints.add({
        ...firstEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      const secondParse = await parseImportedContent(collectionString)
      const secondEndpoint = secondParse.data!.endpoints[0]

      const analysis = await analyzeImport(
        [{ ...secondEndpoint, specId: testSpecId }],
        testSpecId
      )

      // Both use smart defaults → should be identical
      expect(analysis.duplicates[0].hasChanges).toBe(false)
    })

    it('should compare cURL vs Postman correctly (same endpoint)', async () => {
      // Import cURL first
      const curlCommand = `curl -X POST https://api.example.com/orders -H "Content-Type: application/json" -H "Authorization: Bearer token" -d '{"total":100}'`

      const curlParse = await parseImportedContent(curlCommand)
      const curlEndpoint = curlParse.data!.endpoints[0]

      console.log('\n=== cURL vs Postman Test ===')
      console.log('cURL endpoint:', {
        method: curlEndpoint.method,
        path: curlEndpoint.path,
        errors: curlEndpoint.responses?.errors?.map(e => e.status),
      })

      await db.endpoints.add({
        ...curlEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      // Then import Postman with same endpoint
      const postmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Create Order',
            request: {
              method: 'POST',
              url: 'https://api.example.com/orders',
              header: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'Authorization', value: 'Bearer token' },
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify({ total: 100 }),
              },
            },
          },
        ],
      }

      const postmanParse = await parseImportedContent(JSON.stringify(postmanCollection))
      const postmanEndpoint = postmanParse.data!.endpoints[0]

      console.log('Postman endpoint:', {
        method: postmanEndpoint.method,
        path: postmanEndpoint.path,
        errors: postmanEndpoint.responses?.errors?.map(e => e.status),
      })

      const analysis = await analyzeImport(
        [{ ...postmanEndpoint, specId: testSpecId }],
        testSpecId
      )

      // cURL and Postman have different metadata (names, descriptions, tags, contentType handling)
      // So they SHOULD show changes even though they target the same endpoint
      expect(analysis.duplicates[0].hasChanges).toBe(true)

      // Verify both use same smart defaults for error responses
      expect(curlEndpoint.responses?.errors?.map(e => e.status).sort()).toEqual([400, 401, 403, 500])
      expect(postmanEndpoint.responses?.errors?.map(e => e.status).sort()).toEqual([400, 401, 403, 500])
    })

    it('should detect differences between OpenAPI and cURL (different error handling)', async () => {
      // Import OpenAPI spec first (no smart defaults)
      const openAPISpec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/products': {
            get: {
              summary: 'Get products',
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { type: 'array' },
                    },
                  },
                },
                '404': {
                  description: 'Not found',
                },
              },
            },
          },
        },
      })

      const openAPIParse = await parseImportedContent(openAPISpec)
      const openAPIEndpoint = openAPIParse.data!.endpoints[0]

      console.log('\n=== OpenAPI vs cURL Test ===')
      console.log('OpenAPI endpoint (no smart defaults):', {
        errors: openAPIEndpoint.responses?.errors?.map(e => e.status),
      })

      await db.endpoints.add({
        ...openAPIEndpoint,
        specId: testSpecId,
        createdAt: new Date(),
      } as Endpoint)

      // Import cURL with same endpoint (uses smart defaults)
      const curlCommand = `curl https://api.example.com/products`

      const curlParse = await parseImportedContent(curlCommand)
      const curlEndpoint = curlParse.data!.endpoints[0]

      console.log('cURL endpoint (with smart defaults):', {
        errors: curlEndpoint.responses?.errors?.map(e => e.status),
      })

      const analysis = await analyzeImport(
        [{ ...curlEndpoint, specId: testSpecId }],
        testSpecId
      )

      console.log('Comparison result:', {
        hasChanges: analysis.duplicates[0].hasChanges,
        changes: analysis.duplicates[0].changes?.map(c => c.field),
      })

      // OpenAPI has [404] errors
      // cURL has [404, 500] errors (from smart defaults)
      // Should detect difference in error responses
      expect(analysis.duplicates[0].hasChanges).toBe(true)
      expect(analysis.duplicates[0].changes.some(c => c.field === 'responses.errors')).toBe(true)
    })

    it('should handle all 3 sources to same spec', async () => {
      // Scenario: Import 3 different endpoints from 3 different sources

      // 1. OpenAPI endpoint
      const openAPISpec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      })

      const openAPIParse = await parseImportedContent(openAPISpec)
      const openAPIEndpoint = openAPIParse.data!.endpoints[0]

      // 2. cURL endpoint (different path)
      const curlCommand = `curl https://api.example.com/products`
      const curlParse = await parseImportedContent(curlCommand)
      const curlEndpoint = curlParse.data!.endpoints[0]

      // 3. Postman endpoint (different path)
      const postmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get Orders',
            request: {
              method: 'GET',
              url: 'https://api.example.com/orders',
            },
          },
        ],
      }
      const postmanParse = await parseImportedContent(JSON.stringify(postmanCollection))
      const postmanEndpoint = postmanParse.data!.endpoints[0]

      console.log('\n=== All 3 Sources Test ===')
      console.log('OpenAPI:', { path: openAPIEndpoint.path, errors: openAPIEndpoint.responses?.errors?.length })
      console.log('cURL:', { path: curlEndpoint.path, errors: curlEndpoint.responses?.errors?.length })
      console.log('Postman:', { path: postmanEndpoint.path, errors: postmanEndpoint.responses?.errors?.length })

      // Store all 3
      await db.endpoints.add({ ...openAPIEndpoint, specId: testSpecId, createdAt: new Date() } as Endpoint)
      await db.endpoints.add({ ...curlEndpoint, specId: testSpecId, createdAt: new Date() } as Endpoint)
      await db.endpoints.add({ ...postmanEndpoint, specId: testSpecId, createdAt: new Date() } as Endpoint)

      // Re-import all 3 to verify no changes
      const allEndpoints = [
        ...openAPIParse.data!.endpoints,
        ...curlParse.data!.endpoints,
        ...postmanParse.data!.endpoints,
      ]

      const analysis = await analyzeImport(
        allEndpoints.map(ep => ({ ...ep, specId: testSpecId })),
        testSpecId
      )

      console.log('Analysis:', {
        duplicates: analysis.duplicates.length,
        withChanges: analysis.duplicates.filter(d => d.hasChanges).length,
      })

      // All 3 should match their respective stored versions
      expect(analysis.duplicates).toHaveLength(3)
      analysis.duplicates.forEach(dup => {
        expect(dup.hasChanges).toBe(false)
      })
    })
  })
})
