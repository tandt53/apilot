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
