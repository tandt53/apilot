/**
 * OpenAPI Parser Tests
 * Tests for OpenAPI/Swagger parsing and validation
 */

import { describe, it, expect } from 'vitest'
import {
  parseSpec,
  validateSpec,
  getSpecSummary,
  extractEndpoints,
  dereferenceSpec,
  processOpenAPISpec,
} from './openapi'

describe('OpenAPI Parser', () => {
  describe('parseSpec', () => {
    it('should parse valid OpenAPI 3.x JSON', () => {
      const content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = parseSpec(content, 'test.json')

      expect(result.format).toBe('openapi')
      expect(result.version).toBe('3.0.0')
      expect(result.spec.info.title).toBe('Test API')
    })

    it('should parse valid Swagger 2.0 JSON', () => {
      const content = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = parseSpec(content, 'test.json')

      expect(result.format).toBe('swagger')
      expect(result.version).toBe('2.0')
      expect(result.spec.info.title).toBe('Test API')
    })

    it('should parse valid OpenAPI YAML', () => {
      const content = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
      `

      const result = parseSpec(content, 'test.yaml')

      expect(result.format).toBe('openapi')
      expect(result.version).toBe('3.0.0')
      expect(result.spec.info.title).toBe('Test API')
    })

    it('should parse valid Swagger YAML', () => {
      const content = `
swagger: '2.0'
info:
  title: Test API
  version: 1.0.0
paths: {}
      `

      const result = parseSpec(content, 'test.yml')

      expect(result.format).toBe('swagger')
      expect(result.version).toBe('2.0')
    })

    it('should auto-detect JSON format', () => {
      const content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = parseSpec(content, 'test.txt')

      expect(result.format).toBe('openapi')
      expect(result.version).toBe('3.0.0')
    })

    it('should auto-detect YAML format', () => {
      const content = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
      `

      const result = parseSpec(content, 'test.txt')

      expect(result.format).toBe('openapi')
    })

    it('should throw error for invalid JSON', () => {
      const content = '{invalid json'

      expect(() => parseSpec(content, 'test.json')).toThrow('Invalid JSON')
    })

    it('should throw error for invalid YAML', () => {
      const content = `
openapi: 3.0.0
info:
  title: Test API
  invalid: - - -
      `

      expect(() => parseSpec(content, 'test.yaml')).toThrow('Invalid YAML')
    })

    it('should throw error for non-OpenAPI/Swagger spec', () => {
      const content = JSON.stringify({
        randomField: 'value',
      })

      expect(() => parseSpec(content, 'test.json')).toThrow('Not a valid OpenAPI/Swagger specification')
    })
  })

  describe('validateSpec', () => {
    it('should validate valid OpenAPI spec', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      expect(validateSpec(spec)).toBe(true)
    })

    it('should validate valid Swagger spec', () => {
      const spec = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      expect(validateSpec(spec)).toBe(true)
    })

    it('should throw error for OpenAPI spec missing paths', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
      }

      expect(() => validateSpec(spec)).toThrow("OpenAPI spec missing 'paths'")
    })

    it('should throw error for OpenAPI spec missing info', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {},
      }

      expect(() => validateSpec(spec)).toThrow("OpenAPI spec missing 'info'")
    })

    it('should throw error for Swagger spec missing paths', () => {
      const spec = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
      }

      expect(() => validateSpec(spec)).toThrow("Swagger spec missing 'paths'")
    })

    it('should throw error for Swagger spec missing info', () => {
      const spec = {
        swagger: '2.0',
        paths: {},
      }

      expect(() => validateSpec(spec)).toThrow("Swagger spec missing 'info'")
    })

    it('should throw error for invalid spec format', () => {
      const spec = {
        randomField: 'value',
      }

      expect(() => validateSpec(spec)).toThrow('Not a valid OpenAPI/Swagger specification')
    })
  })

  describe('getSpecSummary', () => {
    it('should extract summary from OpenAPI spec', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Pet Store API',
          version: '1.2.3',
          description: 'API for pet store',
        },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/pets': {
            get: {},
            post: {},
          },
          '/pets/{id}': {
            get: {},
            put: {},
            delete: {},
          },
        },
      }

      const summary = getSpecSummary(spec)

      expect(summary.title).toBe('Pet Store API')
      expect(summary.version).toBe('1.2.3')
      expect(summary.description).toBe('API for pet store')
      expect(summary.endpointCount).toBe(5)
      expect(summary.specVersion).toBe('3.0.0')
      expect(summary.baseUrl).toBe('https://api.example.com')
    })

    it('should extract summary from Swagger spec', () => {
      const spec = {
        swagger: '2.0',
        info: {
          title: 'User API',
          version: '2.0.0',
          description: 'API for users',
        },
        host: 'api.example.com',
        basePath: '/v1',
        schemes: ['https'],
        paths: {
          '/users': {
            get: {},
            post: {},
          },
        },
      }

      const summary = getSpecSummary(spec)

      expect(summary.title).toBe('User API')
      expect(summary.version).toBe('2.0.0')
      expect(summary.description).toBe('API for users')
      expect(summary.endpointCount).toBe(2)
      expect(summary.specVersion).toBe('2.0')
      expect(summary.baseUrl).toBe('https://api.example.com/v1')
    })

    it('should handle missing info fields', () => {
      const spec = {
        openapi: '3.0.0',
        info: {},
        paths: {},
      }

      const summary = getSpecSummary(spec)

      expect(summary.title).toBe('Unknown')
      expect(summary.version).toBe('1.0.0')
      expect(summary.description).toBe('')
    })

    it('should count only valid HTTP methods', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {},
            post: {},
            put: {},
            delete: {},
            patch: {},
            head: {},
            options: {},
            parameters: [], // Not a method
            servers: [], // Not a method
          },
        },
      }

      const summary = getSpecSummary(spec)

      expect(summary.endpointCount).toBe(7)
    })

    it('should handle Swagger spec with no schemes', () => {
      const spec = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        host: 'api.example.com',
        paths: {},
      }

      const summary = getSpecSummary(spec)

      expect(summary.baseUrl).toBe('https://api.example.com')
    })
  })

  describe('extractEndpoints', () => {
    it('should extract endpoints from OpenAPI spec', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
            post: {
              operationId: 'createUser',
              summary: 'Create user',
              responses: {
                '201': {
                  description: 'Created',
                },
              },
            },
          },
        },
      }

      const endpoints = extractEndpoints(spec, 1)

      expect(endpoints).toHaveLength(2)
      expect(endpoints[0].method).toBe('GET')
      expect(endpoints[0].path).toBe('/users')
      expect(endpoints[0].specId).toBe(1)
      expect(endpoints[0].createdBy).toBe('import')
      expect(endpoints[1].method).toBe('POST')
      expect(endpoints[1].path).toBe('/users')
    })

    it('should handle spec with no paths', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
      }

      const endpoints = extractEndpoints(spec, 1)

      expect(endpoints).toHaveLength(0)
    })

    it('should handle mixed case HTTP methods', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            GET: {},
            Post: {},
            DeLeTe: {},
          },
        },
      }

      const endpoints = extractEndpoints(spec, 1)

      expect(endpoints).toHaveLength(3)
    })

    it('should ignore non-HTTP method properties', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {},
            parameters: [], // Should be ignored
            servers: [], // Should be ignored
            $ref: '#/components', // Should be ignored
          },
        },
      }

      const endpoints = extractEndpoints(spec, 1)

      expect(endpoints).toHaveLength(1)
    })
  })

  describe('dereferenceSpec', () => {
    it('should dereference $ref in spec', () => {
      const spec = {
        openapi: '3.0.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/User',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const dereferenced = dereferenceSpec(spec)

      const responseSchema = dereferenced.paths['/users'].get.responses['200'].content['application/json'].schema
      expect(responseSchema.type).toBe('object')
      expect(responseSchema.properties.name.type).toBe('string')
    })

    it('should handle circular references', () => {
      const spec = {
        openapi: '3.0.0',
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                next: {
                  $ref: '#/components/schemas/Node',
                },
              },
            },
          },
        },
        paths: {},
      }

      const dereferenced = dereferenceSpec(spec)

      // Should not throw or infinite loop
      expect(dereferenced.components.schemas.Node.properties.value.type).toBe('string')
      // Circular reference should be detected and handled
      const nextProperty = dereferenced.components.schemas.Node.properties.next
      expect(nextProperty).toBeDefined()
      if (nextProperty.description) {
        expect(nextProperty.description).toContain('Circular reference')
      }
    })

    it('should handle missing references gracefully', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/NonExistent',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const dereferenced = dereferenceSpec(spec)

      // Should preserve the invalid ref
      expect(dereferenced.paths['/test'].get.responses['200'].content['application/json'].schema.$ref).toBeDefined()
    })

    it('should handle nested references', () => {
      const spec = {
        openapi: '3.0.0',
        components: {
          schemas: {
            Address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
              },
            },
            User: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                address: {
                  $ref: '#/components/schemas/Address',
                },
              },
            },
          },
        },
        paths: {},
      }

      const dereferenced = dereferenceSpec(spec)

      const userSchema = dereferenced.components.schemas.User
      expect(userSchema.properties.address.type).toBe('object')
      expect(userSchema.properties.address.properties.street.type).toBe('string')
    })
  })

  describe('processOpenAPISpec', () => {
    it('should process valid OpenAPI spec end-to-end', async () => {
      const content = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Complete API',
          version: '1.0.0',
          description: 'Complete test API',
        },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get users',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      })

      const result = await processOpenAPISpec(content, 'test.json')

      expect(result.summary.title).toBe('Complete API')
      expect(result.summary.version).toBe('1.0.0')
      expect(result.summary.endpointCount).toBe(1)
      expect(result.spec.paths['/users'].get).toBeDefined()
    })

    it('should process valid Swagger spec end-to-end', async () => {
      const content = JSON.stringify({
        swagger: '2.0',
        info: {
          title: 'Swagger API',
          version: '2.0.0',
        },
        host: 'api.example.com',
        paths: {
          '/items': {
            get: {},
            post: {},
          },
        },
      })

      const result = await processOpenAPISpec(content, 'swagger.json')

      expect(result.summary.title).toBe('Swagger API')
      expect(result.summary.specVersion).toBe('2.0')
      expect(result.summary.endpointCount).toBe(2)
    })

    it('should throw error for invalid spec', async () => {
      const content = JSON.stringify({
        randomField: 'value',
      })

      await expect(processOpenAPISpec(content, 'test.json')).rejects.toThrow()
    })

    it('should handle YAML spec', async () => {
      const content = `
openapi: 3.0.0
info:
  title: YAML API
  version: 1.0.0
paths:
  /test:
    get: {}
      `

      const result = await processOpenAPISpec(content, 'spec.yaml')

      expect(result.summary.title).toBe('YAML API')
      expect(result.summary.endpointCount).toBe(1)
    })
  })
})
