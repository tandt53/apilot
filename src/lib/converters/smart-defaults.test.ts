import { describe, it, expect } from 'vitest'
import { applySmartDefaults, calculateMetadataCompleteness } from './smart-defaults'
import type { CanonicalEndpoint } from '@/types/canonical'

describe('applySmartDefaults', () => {
  describe('Parameter Enrichment', () => {
    it('should mark path parameters as required', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users/{userId}',
        name: 'Get User',
        request: {
          parameters: [
            { name: 'userId', in: 'path', type: 'string', required: false },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const pathParam = enriched.request?.parameters?.find((p) => p.in === 'path')
      expect(pathParam?.required).toBe(true)
      expect(pathParam?.description).toBeDefined()
    })

    it('should detect Authorization header and mark as required', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'Authorization', in: 'header', type: 'string', required: false },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const authParam = enriched.request?.parameters?.find((p) => p.name === 'Authorization')
      expect(authParam?.required).toBe(true)
      expect(authParam?.description).toBe('Authentication token')
    })

    it('should detect API key headers and mark as required', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'X-API-Key', in: 'header', type: 'string', required: false },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const apiKeyParam = enriched.request?.parameters?.find((p) => p.name === 'X-API-Key')
      expect(apiKeyParam?.required).toBe(true)
      expect(apiKeyParam?.description).toBe('API key for authentication')
    })

    it('should detect ID parameters and set integer type', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'user_id', in: 'query', type: 'string', required: false, example: 123 },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const idParam = enriched.request?.parameters?.find((p) => p.name === 'user_id')
      expect(idParam?.type).toBe('integer')
      expect(idParam?.description).toBe('Unique identifier')
    })

    it('should detect pagination parameters and add constraints', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'page', in: 'query', type: 'string', required: true },
            { name: 'limit', in: 'query', type: 'string', required: true },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const pageParam = enriched.request?.parameters?.find((p) => p.name === 'page')
      expect(pageParam?.type).toBe('integer')
      expect(pageParam?.required).toBe(false)
      expect(pageParam?.min).toBe(1)
      expect(pageParam?.default).toBe(1)

      const limitParam = enriched.request?.parameters?.find((p) => p.name === 'limit')
      expect(limitParam?.type).toBe('integer')
      expect(limitParam?.required).toBe(false)
      expect(limitParam?.min).toBe(1)
      expect(limitParam?.max).toBe(100)
      expect(limitParam?.default).toBe(10)
    })

    it('should detect sort parameters', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'sort_by', in: 'query', type: 'integer', required: true },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const sortParam = enriched.request?.parameters?.find((p) => p.name === 'sort_by')
      expect(sortParam?.type).toBe('string')
      expect(sortParam?.required).toBe(false)
      expect(sortParam?.description).toBe('Sort order for results')
    })

    it('should detect filter parameters', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'status', in: 'query', type: 'string', required: true },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const filterParam = enriched.request?.parameters?.find((p) => p.name === 'status')
      expect(filterParam?.required).toBe(false)
      expect(filterParam?.description).toBe('Filter results by status')
    })

    it('should detect email format from example value', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'email', in: 'query', type: 'string', example: 'user@example.com' },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const emailParam = enriched.request?.parameters?.find((p) => p.name === 'email')
      expect(emailParam?.format).toBe('email')
    })

    it('should detect URI format from example value', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'website', in: 'query', type: 'string', example: 'https://example.com' },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const urlParam = enriched.request?.parameters?.find((p) => p.name === 'website')
      expect(urlParam?.format).toBe('uri')
    })

    it('should refine type based on example value', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            { name: 'count', in: 'query', type: 'string', example: 42 },
            { name: 'active', in: 'query', type: 'string', example: true },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const countParam = enriched.request?.parameters?.find((p) => p.name === 'count')
      expect(countParam?.type).toBe('integer')

      const activeParam = enriched.request?.parameters?.find((p) => p.name === 'active')
      expect(activeParam?.type).toBe('boolean')
    })
  })

  describe('Body Field Enrichment', () => {
    it('should detect email fields', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {
          body: {
            required: true,
            fields: [
              { name: 'email', type: 'string' },
            ],
          },
        },
        responses: {
          success: { status: 201, description: 'Created' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const emailField = enriched.request?.body?.fields?.find((f) => f.name === 'email')
      expect(emailField?.type).toBe('string')
      expect(emailField?.format).toBe('email')
      expect(emailField?.description).toBe('Email address')
    })

    it('should detect password fields', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {
          body: {
            required: true,
            fields: [
              { name: 'password', type: 'string' },
            ],
          },
        },
        responses: {
          success: { status: 201, description: 'Created' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const passwordField = enriched.request?.body?.fields?.find((f) => f.name === 'password')
      expect(passwordField?.type).toBe('string')
      expect(passwordField?.format).toBe('password')
      expect(passwordField?.min).toBe(8)
      expect(passwordField?.description).toBe('Password (minimum 8 characters)')
    })

    it('should detect URL fields', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {
          body: {
            required: true,
            fields: [
              { name: 'website_url', type: 'string' },
            ],
          },
        },
        responses: {
          success: { status: 201, description: 'Created' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const urlField = enriched.request?.body?.fields?.find((f) => f.name === 'website_url')
      expect(urlField?.type).toBe('string')
      expect(urlField?.format).toBe('uri')
    })

    it('should detect date/time fields', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {
          body: {
            required: true,
            fields: [
              { name: 'created_at', type: 'string' },
            ],
          },
        },
        responses: {
          success: { status: 201, description: 'Created' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const dateField = enriched.request?.body?.fields?.find((f) => f.name === 'created_at')
      expect(dateField?.type).toBe('string')
      expect(dateField?.format).toBe('date-time')
    })

    it('should detect boolean fields', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {
          body: {
            required: true,
            fields: [
              { name: 'is_active', type: 'string' },
            ],
          },
        },
        responses: {
          success: { status: 201, description: 'Created' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const boolField = enriched.request?.body?.fields?.find((f) => f.name === 'is_active')
      expect(boolField?.type).toBe('boolean')
    })

    it('should detect ID fields in body', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {
          body: {
            required: true,
            fields: [
              { name: 'user_id', type: 'string', example: '123' },
            ],
          },
        },
        responses: {
          success: { status: 201, description: 'Created' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const idField = enriched.request?.body?.fields?.find((f) => f.name === 'user_id')
      expect(idField?.type).toBe('integer')
      expect(idField?.required).toBe(false) // IDs usually auto-generated
    })
  })

  describe('Response Enrichment', () => {
    it('should set status 201 for POST requests', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {},
        responses: {
          success: {},
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      expect(enriched.responses?.success?.status).toBe(201)
      expect(enriched.responses?.success?.description).toBe('Resource created successfully')
    })

    it('should set status 204 for DELETE requests', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'DELETE',
        path: '/users/123',
        name: 'Delete User',
        request: {},
        responses: {
          success: {},
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      expect(enriched.responses?.success?.status).toBe(204)
      expect(enriched.responses?.success?.description).toBe('Resource deleted successfully')
    })

    it('should set status 200 for GET requests', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {},
        responses: {
          success: {},
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      expect(enriched.responses?.success?.status).toBe(200)
      expect(enriched.responses?.success?.description).toBe('Successful response')
    })

    it('should add common error responses when missing', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {},
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
        auth: { type: 'http', scheme: 'bearer' },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      expect(enriched.responses?.errors).toBeDefined()
      expect(enriched.responses?.errors!.length).toBeGreaterThan(0)

      // Should include auth errors
      const unauthorizedError = enriched.responses?.errors?.find((e) => e.status === 401)
      expect(unauthorizedError).toBeDefined()
      expect(unauthorizedError?.reason).toBe('Unauthorized')

      const forbiddenError = enriched.responses?.errors?.find((e) => e.status === 403)
      expect(forbiddenError).toBeDefined()

      // Should include validation error for POST
      const badRequestError = enriched.responses?.errors?.find((e) => e.status === 400)
      expect(badRequestError).toBeDefined()

      // Should include server error
      const serverError = enriched.responses?.errors?.find((e) => e.status === 500)
      expect(serverError).toBeDefined()
    })

    it('should add 404 error for GET/PUT/PATCH/DELETE', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users/123',
        name: 'Get User',
        request: {},
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const notFoundError = enriched.responses?.errors?.find((e) => e.status === 404)
      expect(notFoundError).toBeDefined()
      expect(notFoundError?.reason).toBe('Not Found')
    })

    it('should not duplicate existing error responses', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'POST',
        path: '/users',
        name: 'Create User',
        request: {},
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [
            { status: 400, reason: 'Bad Request', description: 'Custom error' },
          ],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      // Should keep existing errors
      expect(enriched.responses?.errors).toBeDefined()
      expect(enriched.responses?.errors!.length).toBeGreaterThan(0)
    })
  })

  describe('Format Detection', () => {
    it('should detect UUID format', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            {
              name: 'id',
              in: 'query',
              type: 'string',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const idParam = enriched.request?.parameters?.find((p) => p.name === 'id')
      expect(idParam?.format).toBe('uuid')
    })

    it('should detect date-time format', () => {
      const endpoint: CanonicalEndpoint = {
        source: 'curl',
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        request: {
          parameters: [
            {
              name: 'created',
              in: 'query',
              type: 'string',
              example: '2024-01-01T12:00:00Z',
            },
          ],
        },
        responses: {
          success: { status: 200, description: 'Success' },
          errors: [],
        },
      } as CanonicalEndpoint

      const enriched = applySmartDefaults(endpoint)

      const dateParam = enriched.request?.parameters?.find((p) => p.name === 'created')
      expect(dateParam?.format).toBe('date-time')
    })
  })
})

describe('calculateMetadataCompleteness', () => {
  it('should calculate 100% for fully complete endpoint', () => {
    const endpoint: CanonicalEndpoint = {
      source: 'openapi',
      method: 'GET',
      path: '/users',
      name: 'Get Users',
      request: {
        parameters: [
          {
            name: 'page',
            in: 'query',
            type: 'integer',
            required: false,
            example: 1,
            description: 'Page number',
          },
        ],
        body: {
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              example: 'John',
              description: 'User name',
            },
          ],
        },
      },
      responses: {
        success: {
          status: 200,
          description: 'Success',
          example: { users: [] },
          fields: [{ name: 'users', type: 'array' }],
        },
        errors: [{ status: 404, reason: 'Not Found' }],
      },
    } as CanonicalEndpoint

    const result = calculateMetadataCompleteness(endpoint)

    expect(result.score).toBe(100)
    expect(result.complete).toBe(result.total)
  })

  it('should calculate 0% for minimal endpoint', () => {
    const endpoint: CanonicalEndpoint = {
      source: 'curl',
      method: 'GET',
      path: '/users',
      name: 'Get Users',
      request: {},
      responses: {
        success: { status: 200 },
        errors: [],
      },
    } as CanonicalEndpoint

    const result = calculateMetadataCompleteness(endpoint)

    expect(result.score).toBe(0)
    expect(result.complete).toBe(0)
  })

  it('should calculate partial completion correctly', () => {
    const endpoint: CanonicalEndpoint = {
      source: 'curl',
      method: 'GET',
      path: '/users',
      name: 'Get Users',
      request: {
        parameters: [
          {
            name: 'page',
            in: 'query',
            type: 'integer',
            required: false,
            // Missing example and description
          },
        ],
      },
      responses: {
        success: { status: 200, description: 'Success' },
        errors: [],
      },
    } as CanonicalEndpoint

    const result = calculateMetadataCompleteness(endpoint)

    expect(result.score).toBeLessThan(100)
    expect(result.score).toBeGreaterThan(0)
    expect(result.details.parameters.score).toBe(2) // type + required
    expect(result.details.parameters.total).toBe(4) // description, required, type, example
  })

  it('should provide detailed breakdown', () => {
    const endpoint: CanonicalEndpoint = {
      source: 'curl',
      method: 'POST',
      path: '/users',
      name: 'Create User',
      request: {
        parameters: [
          { name: 'token', in: 'header', type: 'string', required: true },
        ],
        body: {
          fields: [
            { name: 'name', type: 'string', required: true, example: 'John' },
          ],
        },
      },
      responses: {
        success: { status: 201, description: 'Created', example: { id: 1 } },
        errors: [{ status: 400, reason: 'Bad Request' }],
      },
    } as CanonicalEndpoint

    const result = calculateMetadataCompleteness(endpoint)

    expect(result.details).toBeDefined()
    expect(result.details.parameters).toBeDefined()
    expect(result.details.body).toBeDefined()
    expect(result.details.responses).toBeDefined()

    // Parameters: 2/4 (missing description and example)
    expect(result.details.parameters.score).toBe(2)
    expect(result.details.parameters.total).toBe(4)

    // Body: 3/4 (missing description)
    expect(result.details.body.score).toBe(3)
    expect(result.details.body.total).toBe(4)

    // Responses: 3/4 (missing fields)
    expect(result.details.responses.score).toBe(3)
    expect(result.details.responses.total).toBe(4)
  })
})
