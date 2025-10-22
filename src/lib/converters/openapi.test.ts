import { describe, it, expect } from 'vitest'
import { convertOpenAPIToCanonical } from './openapi'

describe('convertOpenAPIToCanonical', () => {
  describe('OpenAPI 3.x Support', () => {
    it('should parse OpenAPI 3.0.0 spec', () => {
      const operation = {
        summary: 'Get users',
        operationId: 'getUsers',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      }

      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.method).toBe('GET')
      expect(endpoint.path).toBe('/users')
      expect(endpoint.name).toBe('Get users')
    })

    it('should parse OpenAPI 3.0.1 spec', () => {
      const operation = {
        summary: 'Create user',
        responses: { '201': { description: 'Created' } },
      }

      const spec = {
        openapi: '3.0.1',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'post', spec)

      expect(endpoint.method).toBe('POST')
      expect(endpoint.source).toBe('openapi')
    })

    it('should parse OpenAPI 3.0.2 spec', () => {
      const operation = {
        summary: 'Update user',
        responses: { '200': { description: 'Updated' } },
      }

      const spec = {
        openapi: '3.0.2',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users/{id}', 'put', spec)

      expect(endpoint.method).toBe('PUT')
      expect(endpoint.path).toBe('/users/{id}')
    })

    it('should parse OpenAPI 3.0.3 spec', () => {
      const operation = {
        summary: 'Delete user',
        responses: { '204': { description: 'Deleted' } },
      }

      const spec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users/{id}', 'delete', spec)

      expect(endpoint.method).toBe('DELETE')
    })

    it('should parse OpenAPI 3.1.0 spec', () => {
      const operation = {
        summary: 'List users',
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.method).toBe('GET')
      expect(endpoint.source).toBe('openapi')
    })
  })

  describe('Swagger 2.0 Support', () => {
    it('should parse Swagger 2.0 spec', () => {
      const operation = {
        summary: 'Get pets',
        operationId: 'getPets',
        responses: {
          '200': {
            description: 'Success',
            schema: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
      }

      const spec = {
        swagger: '2.0',
        info: { title: 'Pet Store', version: '1.0.0' },
        host: 'petstore.swagger.io',
        basePath: '/v2',
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/pets', 'get', spec)

      expect(endpoint.method).toBe('GET')
      expect(endpoint.path).toBe('/pets')
      expect(endpoint.source).toBe('openapi')
    })
  })

  describe('Request Parameters', () => {
    it('should parse path parameters', () => {
      const operation = {
        summary: 'Get user',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'User ID',
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users/{userId}', 'get', spec)

      const pathParams = endpoint.request?.parameters?.filter((p) => p.in === 'path')
      expect(pathParams).toBeDefined()
      expect(pathParams![0].name).toBe('userId')
      expect(pathParams![0].required).toBe(true)
    })

    it('should parse query parameters', () => {
      const operation = {
        summary: 'List users',
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 10 },
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      const queryParams = endpoint.request?.parameters?.filter((p) => p.in === 'query')
      expect(queryParams?.length).toBe(2)
      expect(queryParams![0].name).toBe('page')
      expect(queryParams![1].name).toBe('limit')
    })

    it('should parse header parameters', () => {
      const operation = {
        summary: 'Get user',
        parameters: [
          {
            name: 'X-API-Key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      const headerParams = endpoint.request?.parameters?.filter((p) => p.in === 'header')
      expect(headerParams).toBeDefined()
      expect(headerParams![0].name).toBe('X-API-Key')
    })
  })

  describe('Request Body', () => {
    it('should parse JSON request body', () => {
      const operation = {
        summary: 'Create user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'post', spec)

      expect(endpoint.request?.contentType).toBe('application/json')
      expect(endpoint.request?.body).toBeDefined()
      // Body structure varies based on schema
      expect(endpoint.request?.body).toBeTruthy()
    })

    it('should handle multiple content types', () => {
      const operation = {
        summary: 'Create user',
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
            'application/xml': {
              schema: { type: 'object' },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'post', spec)

      // Should default to first content type (JSON)
      expect(endpoint.request?.contentType).toBe('application/json')
    })
  })

  describe('Response Handling', () => {
    it('should parse success response', () => {
      const operation = {
        summary: 'Get user',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
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
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users/{id}', 'get', spec)

      expect(endpoint.responses?.success).toBeDefined()
      expect(endpoint.responses?.success?.status).toBe(200)
    })

    it('should parse error responses', () => {
      const operation = {
        summary: 'Get user',
        responses: {
          '200': { description: 'Success' },
          '404': { description: 'Not found' },
          '500': { description: 'Server error' },
        },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users/{id}', 'get', spec)

      expect(endpoint.responses?.errors).toBeDefined()
      expect(endpoint.responses?.errors!.length).toBeGreaterThan(0)
    })
  })

  describe('Security Schemes', () => {
    it('should detect Bearer authentication', () => {
      const operation = {
        summary: 'Get user',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.auth).toBeDefined()
      // Auth type can be 'http' or 'bearer' depending on parsing
      expect(['http', 'bearer']).toContain(endpoint.auth?.type)
    })

    it('should detect API Key authentication', () => {
      const operation = {
        summary: 'Get user',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          securitySchemes: {
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
            },
          },
        },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.auth).toBeDefined()
      expect(endpoint.auth?.type).toBe('apiKey')
    })

    it('should detect OAuth2 authentication', () => {
      const operation = {
        summary: 'Get user',
        security: [{ OAuth2: ['read:users'] }],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          securitySchemes: {
            OAuth2: {
              type: 'oauth2',
              flows: {
                authorizationCode: {
                  authorizationUrl: 'https://example.com/oauth/authorize',
                  tokenUrl: 'https://example.com/oauth/token',
                  scopes: {
                    'read:users': 'Read user data',
                  },
                },
              },
            },
          },
        },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.auth).toBeDefined()
      expect(endpoint.auth?.type).toBe('oauth2')
    })
  })

  describe('Metadata', () => {
    it('should parse tags', () => {
      const operation = {
        summary: 'Get users',
        tags: ['users', 'public'],
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.tags).toEqual(['users', 'public'])
    })

    it('should detect deprecated operations', () => {
      const operation = {
        summary: 'Get users (deprecated)',
        deprecated: true,
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.deprecated).toBe(true)
    })

    it('should parse operation description', () => {
      const operation = {
        summary: 'Get users',
        description: 'Returns a list of users with pagination support',
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/users', 'get', spec)

      expect(endpoint.description).toBe('Returns a list of users with pagination support')
    })
  })

  describe('Swagger 2.0 Bug Fixes (Regression Tests)', () => {
    // BUG-001: Integer parameters should preserve type and format
    it('should preserve integer type for path parameters (BUG-001)', () => {
      const operation = {
        summary: 'Get pet by ID',
        parameters: [
          {
            name: 'petId',
            in: 'path',
            type: 'integer',
            format: 'int64',
            required: true,
            description: 'ID of pet to return',
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/pet/{petId}', 'get', spec)

      expect(endpoint.request.parameters).toBeDefined()
      expect(endpoint.request.parameters).toHaveLength(1)
      expect(endpoint.request.parameters![0].type).toBe('integer')
      expect(endpoint.request.parameters![0].format).toBe('int64')
      expect(endpoint.request.parameters![0].name).toBe('petId')
    })

    // BUG-003: Array parameters should preserve type and items
    it('should preserve array type for query parameters (BUG-003)', () => {
      const operation = {
        summary: 'Find pets by status',
        parameters: [
          {
            name: 'status',
            in: 'query',
            type: 'array',
            items: {
              type: 'string',
              enum: ['available', 'pending', 'sold'],
              default: 'available',
            },
            required: true,
            description: 'Status values',
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/pet/findByStatus', 'get', spec)

      expect(endpoint.request.parameters).toBeDefined()
      expect(endpoint.request.parameters).toHaveLength(1)
      expect(endpoint.request.parameters![0].type).toBe('array')
      expect(endpoint.request.parameters![0].items).toBeDefined()
      expect(endpoint.request.parameters![0].items!.type).toBe('string')
    })

    // BUG-004: Enum values should be preserved
    it('should preserve enum values in array items (BUG-004)', () => {
      const operation = {
        summary: 'Find pets by status',
        parameters: [
          {
            name: 'status',
            in: 'query',
            type: 'array',
            items: {
              type: 'string',
              enum: ['available', 'pending', 'sold'],
            },
            required: true,
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/pet/findByStatus', 'get', spec)

      expect(endpoint.request.parameters![0].items!.enum).toEqual(['available', 'pending', 'sold'])
    })

    // BUG-005: Default values should be preserved
    it('should preserve default values in array items (BUG-005)', () => {
      const operation = {
        summary: 'Find pets by status',
        parameters: [
          {
            name: 'status',
            in: 'query',
            type: 'array',
            items: {
              type: 'string',
              default: 'available',
            },
            required: false,
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/pet/findByStatus', 'get', spec)

      expect(endpoint.request.parameters![0].items!.default).toBe('available')
    })

    // BUG-002: Object $ref should be resolved to object type
    it('should resolve $ref to object type in request body (BUG-002)', () => {
      const operation = {
        summary: 'Create pet',
        parameters: [
          {
            in: 'body',
            name: 'body',
            required: true,
            schema: {
              $ref: '#/definitions/Pet',
            },
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        definitions: {
          Pet: {
            type: 'object',
            required: ['name', 'photoUrls'],
            properties: {
              id: {
                type: 'integer',
                format: 'int64',
              },
              category: {
                $ref: '#/definitions/Category',
              },
              name: {
                type: 'string',
                example: 'doggie',
              },
              photoUrls: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
          Category: {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                format: 'int64',
              },
              name: {
                type: 'string',
              },
            },
          },
        },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/pet', 'post', spec)

      expect(endpoint.request.body).toBeDefined()
      expect(endpoint.request.body!.fields).toBeDefined()

      // Find the category field
      const categoryField = endpoint.request.body!.fields.find(f => f.name === 'category')
      expect(categoryField).toBeDefined()
      expect(categoryField!.type).toBe('object') // Should be 'object', not 'string'
      expect(categoryField!.properties).toBeDefined()
      expect(categoryField!.properties).toHaveLength(2)

      // Verify nested properties
      expect(categoryField!.properties![0].name).toBe('id')
      expect(categoryField!.properties![0].type).toBe('integer')
      expect(categoryField!.properties![1].name).toBe('name')
      expect(categoryField!.properties![1].type).toBe('string')
    })

    // Combined test: All bugs in one realistic Swagger 2.0 endpoint
    it('should handle complex Swagger 2.0 endpoint with all bug fixes', () => {
      const operation = {
        summary: 'Search pets',
        parameters: [
          {
            name: 'petId',
            in: 'path',
            type: 'integer',
            format: 'int64',
            required: true,
          },
          {
            name: 'status',
            in: 'query',
            type: 'array',
            items: {
              type: 'string',
              enum: ['available', 'pending', 'sold'],
              default: 'available',
            },
            required: false,
          },
        ],
        responses: { '200': { description: 'Success' } },
      }

      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
      }

      const endpoint = convertOpenAPIToCanonical(operation, '/pet/{petId}/search', 'get', spec)

      // Verify integer parameter (BUG-001)
      const petIdParam = endpoint.request.parameters!.find(p => p.name === 'petId')
      expect(petIdParam!.type).toBe('integer')
      expect(petIdParam!.format).toBe('int64')

      // Verify array parameter (BUG-003)
      const statusParam = endpoint.request.parameters!.find(p => p.name === 'status')
      expect(statusParam!.type).toBe('array')

      // Verify enum (BUG-004)
      expect(statusParam!.items!.enum).toEqual(['available', 'pending', 'sold'])

      // Verify default (BUG-005)
      expect(statusParam!.items!.default).toBe('available')
    })
  })

  describe('Edge Cases', () => {
    it('should handle minimal operation', () => {
      const operation = {
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/test', 'get', spec)

      expect(endpoint.method).toBe('GET')
      expect(endpoint.path).toBe('/test')
    })

    it('should handle operation without responses', () => {
      const operation = {
        summary: 'Test operation',
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/test', 'get', spec)

      expect(endpoint.responses).toBeDefined()
    })

    it('should normalize HTTP method to uppercase', () => {
      const operation = {
        summary: 'Test',
        responses: { '200': { description: 'Success' } },
      }

      const spec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } }

      const endpoint = convertOpenAPIToCanonical(operation, '/test', 'patch', spec)

      expect(endpoint.method).toBe('PATCH')
    })
  })
})
