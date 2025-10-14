import { describe, it, expect } from 'vitest'
import { convertPostmanToCanonical } from './postman'

describe('convertPostmanToCanonical', () => {
  describe('Basic Collection Parsing', () => {
    it('should parse minimal collection', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test Collection',
          version: '1.0.0',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.name).toBe('Test Collection')
      expect(result.version).toBe('1.0.0')
      expect(result.endpoints).toEqual([])
    })

    it('should parse collection with single GET request', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get Users',
            request: {
              method: 'GET',
              url: 'https://api.example.com/users',
            },
          },
        ],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.endpoints).toHaveLength(1)
      expect(result.endpoints[0].method).toBe('GET')
      expect(result.endpoints[0].name).toBe('Get Users')
    })

    it('should extract collection variables', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
          { key: 'baseUrl', value: 'https://api.example.com', type: 'string' },
          { key: 'apiKey', value: 'secret123', type: 'string' },
        ],
        item: [],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.variables).toEqual({
        baseUrl: 'https://api.example.com',
        apiKey: 'secret123',
      })
    })
  })

  describe('HTTP Methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

    methods.forEach((method) => {
      it(`should handle ${method} method`, () => {
        const collection = JSON.stringify({
          info: {
            name: 'Test',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: `${method} Request`,
              request: {
                method,
                url: 'https://api.example.com/resource',
              },
            },
          ],
        })

        const result = convertPostmanToCanonical(collection)

        expect(result.endpoints[0].method).toBe(method)
      })
    })
  })

  describe('URL Parsing', () => {
    it('should parse string URL', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Test',
            request: {
              method: 'GET',
              url: 'https://api.example.com/users',
            },
          },
        ],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.endpoints[0].path).toBe('/users')
    })

    it('should convert path variables from :id to {id}', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Test',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/users/:userId',
                path: ['users', ':userId'],
              },
            },
          },
        ],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.endpoints[0].path).toBe('/users/{userId}')
    })
  })

  describe('Request Body', () => {
    it('should parse raw JSON body', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Test',
            request: {
              method: 'POST',
              url: 'https://api.example.com/users',
              body: {
                mode: 'raw',
                raw: '{"name":"John"}',
                options: {
                  raw: {
                    language: 'json',
                  },
                },
              },
            },
          },
        ],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.endpoints[0].request?.contentType).toBe('application/json')
      expect(result.endpoints[0].request?.body).toBeDefined()
    })

    it('should parse urlencoded body', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Test',
            request: {
              method: 'POST',
              url: 'https://api.example.com/login',
              body: {
                mode: 'urlencoded',
                urlencoded: [
                  { key: 'username', value: 'john' },
                  { key: 'password', value: 'secret' },
                ],
              },
            },
          },
        ],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.endpoints[0].request?.contentType).toBe('application/x-www-form-urlencoded')
    })
  })

  describe('Nested Folders', () => {
    it('should extract endpoints from nested folders', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Users',
            item: [
              {
                name: 'Get User',
                request: {
                  method: 'GET',
                  url: 'https://api.example.com/users/1',
                },
              },
            ],
          },
        ],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.endpoints).toHaveLength(1)
      expect(result.endpoints[0].tags).toContain('Users')
    })
  })

  describe('Edge Cases', () => {
    it('should use default version if not provided', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      })

      const result = convertPostmanToCanonical(collection)

      expect(result.version).toBe('1.0.0')
    })
  })
})
