import { describe, it, expect } from 'vitest'
import { parseImportedContent } from './index'

describe('parseImportedContent', () => {
  describe('OpenAPI Integration', () => {
    it('should parse complete OpenAPI 3.0 spec', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: {
          title: 'User API',
          version: '2.0.0',
          description: 'User management API',
        },
        servers: [{ url: 'https://api.example.com/v1' }],
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              operationId: 'listUsers',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      })

      const result = await parseImportedContent(spec)

      expect(result.success).toBe(true)
      expect(result.detection.format).toBe('openapi')
      expect(result.data?.name).toBe('User API')
      expect(result.data?.version).toBe('2.0.0')
      expect(result.data?.baseUrl).toBe('https://api.example.com/v1')
      expect(result.data?.endpoints.length).toBeGreaterThan(0)
    })

    it('should parse Swagger 2.0 spec', async () => {
      const spec = JSON.stringify({
        swagger: '2.0',
        info: {
          title: 'Pet Store API',
          version: '1.0.0',
        },
        host: 'petstore.swagger.io',
        basePath: '/v2',
        schemes: ['https'],
        paths: {
          '/pets': {
            get: {
              summary: 'List pets',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      })

      const result = await parseImportedContent(spec)

      expect(result.success).toBe(true)
      expect(result.detection.format).toBe('swagger')
      expect(result.data?.baseUrl).toBe('https://petstore.swagger.io/v2')
    })
  })

  describe('Postman Integration', () => {
    it('should parse Postman collection', async () => {
      const collection = JSON.stringify({
        info: {
          name: 'E-commerce API',
          version: '1.5.0',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
          { key: 'baseUrl', value: 'https://api.shop.com', type: 'string' },
        ],
        item: [
          {
            name: 'Products',
            item: [
              {
                name: 'List Products',
                request: {
                  method: 'GET',
                  url: 'https://api.shop.com/products',
                },
              },
            ],
          },
        ],
      })

      const result = await parseImportedContent(collection)

      expect(result.success).toBe(true)
      expect(result.detection.format).toBe('postman')
      expect(result.data?.name).toBe('E-commerce API')
      expect(result.data?.variables).toHaveProperty('baseUrl')
    })
  })

  describe('cURL Integration', () => {
    it('should parse simple cURL command', async () => {
      const curl = 'curl https://api.github.com/users/octocat'

      const result = await parseImportedContent(curl)

      expect(result.success).toBe(true)
      expect(result.detection.format).toBe('curl')
      expect(result.data?.endpoints[0].method).toBe('GET')
      expect(result.data?.endpoints[0].path).toBe('/users/octocat')
    })

    it('should parse cURL with headers', async () => {
      const curl = `curl -X POST https://api.example.com/users \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer token123" \\
        -d '{"name":"John"}'`

      const result = await parseImportedContent(curl)

      expect(result.success).toBe(true)
      expect(result.data?.endpoints[0].method).toBe('POST')
      expect(result.data?.endpoints[0].request?.body).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should fail on unknown format', async () => {
      const invalid = 'This is not a valid spec'

      const result = await parseImportedContent(invalid)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Could not detect format')
    })

    it('should fail on invalid OpenAPI structure', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        // Missing required fields
      })

      const result = await parseImportedContent(spec)

      expect(result.success).toBe(false)
    })

    it('should fail on cURL without URL', async () => {
      const curl = 'curl -X POST -d "data"'

      const result = await parseImportedContent(curl)

      expect(result.success).toBe(false)
    })
  })

  describe('Format Validation', () => {
    it('should validate expected format matches detected', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      })

      const result = await parseImportedContent(spec, 'openapi')

      expect(result.success).toBe(true)
    })

    it('should fail when expected format does not match', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      })

      const result = await parseImportedContent(spec, 'postman')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Expected postman but detected openapi')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty paths in OpenAPI', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Empty', version: '1.0.0' },
        paths: {},
      })

      const result = await parseImportedContent(spec)

      expect(result.success).toBe(true)
      expect(result.data?.endpoints).toHaveLength(0)
    })

    it('should preserve rawSpec', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      })

      const result = await parseImportedContent(spec)

      expect(result.data?.rawSpec).toBe(spec)
    })

    it('should handle URLs with ports in cURL', async () => {
      const curl = 'curl http://localhost:3000/api/users'

      const result = await parseImportedContent(curl)

      expect(result.success).toBe(true)
      expect(result.data?.baseUrl).toBe('http://localhost:3000')
    })
  })
})
