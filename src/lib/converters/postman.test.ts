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

  describe('Regression Tests (Bug Fixes)', () => {
    it('should preserve nested object structure with properties array (BUG-012)', () => {
      // Bug: Nested objects were flattened with dot notation (category.id, category.name)
      // Fix: Preserve nested structure with properties array
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Add Pet',
            request: {
              method: 'POST',
              url: 'https://api.example.com/pet',
              body: {
                mode: 'raw',
                raw: '{"name":"Fluffy","category":{"id":1,"name":"Cats"}}',
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

      const endpoint = result.endpoints[0]
      const fields = endpoint.request?.body?.fields || []

      // Should have 2 top-level fields: name and category
      expect(fields).toHaveLength(2)

      // Find category field
      const categoryField = fields.find((f) => f.name === 'category')
      expect(categoryField).toBeDefined()
      expect(categoryField?.type).toBe('object')

      // Category should have nested properties array (NOT flattened with dots)
      expect(categoryField?.properties).toBeDefined()
      expect(categoryField?.properties).toHaveLength(2)

      // Verify nested properties
      const idField = categoryField?.properties?.find((f) => f.name === 'id')
      expect(idField).toBeDefined()
      expect(idField?.type).toBe('integer') // Should be integer, not string
      expect(idField?.name).toBe('id') // Should be 'id', not 'category.id'

      const nameField = categoryField?.properties?.find((f) => f.name === 'name')
      expect(nameField).toBeDefined()
      expect(nameField?.type).toBe('string')
      expect(nameField?.name).toBe('name') // Should be 'name', not 'category.name'

      // Should NOT have flattened fields
      expect(fields.find((f) => f.name === 'category.id')).toBeUndefined()
      expect(fields.find((f) => f.name === 'category.name')).toBeUndefined()
    })

    it('should preserve array types and not override with smart defaults (BUG-012)', () => {
      // Bug: Smart defaults were overriding array types to string
      // Example: photoUrls (array) was changed to string because name contains "url"
      // Fix: Preserve structural types (object, array) - don't override them
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Add Pet',
            request: {
              method: 'POST',
              url: 'https://api.example.com/pet',
              body: {
                mode: 'raw',
                raw: '{"photoUrls":["https://example.com/cat.jpg","https://example.com/cat2.jpg"],"profileUrl":"https://example.com/profile"}',
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

      const endpoint = result.endpoints[0]
      const fields = endpoint.request?.body?.fields || []

      // Find photoUrls field
      const photoUrlsField = fields.find((f) => f.name === 'photoUrls')
      expect(photoUrlsField).toBeDefined()
      expect(photoUrlsField?.type).toBe('array') // Should be 'array', not overridden to 'string'

      // Array items should have correct type
      expect(photoUrlsField?.items).toBeDefined()
      expect(photoUrlsField?.items?.type).toBe('string')
      // Note: Format detection for array items is not currently implemented
      // but that's OK - the critical fix is preserving the 'array' type itself

      // Find profileUrl field (single URL, should be string)
      const profileUrlField = fields.find((f) => f.name === 'profileUrl')
      expect(profileUrlField).toBeDefined()
      expect(profileUrlField?.type).toBe('string') // This one SHOULD be string (not array)
      expect(profileUrlField?.format).toBe('uri')
    })

    it('should preserve array of objects with nested properties (BUG-012)', () => {
      // Bug: Array items with objects were not preserving nested structure
      // Fix: Array items should have items.properties for nested objects
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Add Pet',
            request: {
              method: 'POST',
              url: 'https://api.example.com/pet',
              body: {
                mode: 'raw',
                raw: '{"tags":[{"id":1,"name":"cute"},{"id":2,"name":"fluffy"}]}',
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

      const endpoint = result.endpoints[0]
      const fields = endpoint.request?.body?.fields || []

      // Find tags field
      const tagsField = fields.find((f) => f.name === 'tags')
      expect(tagsField).toBeDefined()
      expect(tagsField?.type).toBe('array')

      // Array items should have object type with properties
      expect(tagsField?.items).toBeDefined()
      expect(tagsField?.items?.type).toBe('object')
      expect(tagsField?.items?.properties).toBeDefined()
      expect(tagsField?.items?.properties).toHaveLength(2)

      // Verify nested properties in array items
      const idField = tagsField?.items?.properties?.find((f) => f.name === 'id')
      expect(idField).toBeDefined()
      expect(idField?.type).toBe('integer')

      const nameField = tagsField?.items?.properties?.find((f) => f.name === 'name')
      expect(nameField).toBeDefined()
      expect(nameField?.type).toBe('string')
    })

    it('should not apply smart defaults to structural types (BUG-012)', () => {
      // Bug: Smart defaults were incorrectly overriding object/array types
      // Example: category field was changed from 'object' to 'string' and got format: 'date-time'
      // Fix: Check if field is structural type (object/array) before applying smart defaults
      const collection = JSON.stringify({
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Add Item',
            request: {
              method: 'POST',
              url: 'https://api.example.com/item',
              body: {
                mode: 'raw',
                raw: '{"category":{"id":1,"name":"Electronics"},"createdAt":"2025-01-01T00:00:00Z","updated":{"timestamp":"2025-01-01","user":"admin"}}',
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

      const endpoint = result.endpoints[0]
      const fields = endpoint.request?.body?.fields || []

      // category should remain object type, not overridden to string
      const categoryField = fields.find((f) => f.name === 'category')
      expect(categoryField).toBeDefined()
      expect(categoryField?.type).toBe('object')
      expect(categoryField?.format).toBeUndefined() // Should NOT have format: 'date-time'

      // createdAt should be string with date-time format (correct smart default)
      const createdAtField = fields.find((f) => f.name === 'createdAt')
      expect(createdAtField).toBeDefined()
      expect(createdAtField?.type).toBe('string')
      expect(createdAtField?.format).toBe('date-time')

      // updated should remain object type, not overridden to date-time
      const updatedField = fields.find((f) => f.name === 'updated')
      expect(updatedField).toBeDefined()
      expect(updatedField?.type).toBe('object')
      expect(updatedField?.format).toBeUndefined() // Should NOT have format: 'date-time'
    })
  })
})
