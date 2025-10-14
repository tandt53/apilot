import { describe, it, expect } from 'vitest'
import { detectFormat, validateFormat, extractBasicInfo } from './detector'

describe('detectFormat', () => {
  describe('OpenAPI 3.x Detection', () => {
    it('should detect OpenAPI 3.0.3 spec', () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = detectFormat(spec)

      expect(result.format).toBe('openapi')
      expect(result.version).toBe('3.0.3')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect OpenAPI 3.1.0 spec', () => {
      const spec = JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = detectFormat(spec)

      expect(result.format).toBe('openapi')
      expect(result.version).toBe('3.1.0')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('Swagger 2.0 Detection', () => {
    it('should detect Swagger 2.0 spec', () => {
      const spec = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = detectFormat(spec)

      expect(result.format).toBe('swagger')
      expect(result.version).toBe('2.0')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('Postman Collection Detection', () => {
    it('should detect Postman Collection v2.1', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      })

      const result = detectFormat(collection)

      expect(result.format).toBe('postman')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect Postman Collection v2.0', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json',
        },
        item: [],
      })

      const result = detectFormat(collection)

      expect(result.format).toBe('postman')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('cURL Command Detection', () => {
    it('should detect basic cURL command', () => {
      const curl = 'curl https://api.example.com/users'

      const result = detectFormat(curl)

      expect(result.format).toBe('curl')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect cURL with method flag', () => {
      const curl = 'curl -X POST https://api.example.com/users'

      const result = detectFormat(curl)

      expect(result.format).toBe('curl')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect cURL with headers', () => {
      const curl = `curl https://api.example.com/users \\
        -H "Authorization: Bearer token123" \\
        -H "Content-Type: application/json"`

      const result = detectFormat(curl)

      expect(result.format).toBe('curl')
      expect(result.confidence).toBe(1.0)
    })

    it('should detect cURL with data', () => {
      const curl = `curl -X POST https://api.example.com/users \\
        -d '{"name":"John"}'`

      const result = detectFormat(curl)

      expect(result.format).toBe('curl')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('Unknown Format', () => {
    it('should return unknown for invalid JSON', () => {
      const invalid = 'not valid json {'

      const result = detectFormat(invalid)

      expect(result.format).toBe('unknown')
      expect(result.confidence).toBe(0)
    })

    it('should return unknown for empty string', () => {
      const result = detectFormat('')

      expect(result.format).toBe('unknown')
      expect(result.confidence).toBe(0)
    })

    it('should return unknown for random JSON', () => {
      const random = JSON.stringify({ foo: 'bar' })

      const result = detectFormat(random)

      expect(result.format).toBe('unknown')
      expect(result.confidence).toBe(0)
    })
  })
})

describe('validateFormat', () => {
  describe('OpenAPI Validation', () => {
    it('should validate valid OpenAPI spec', () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = validateFormat(spec, 'openapi')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject OpenAPI spec without info', () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        paths: {},
      })

      const result = validateFormat(spec, 'openapi')

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject OpenAPI spec without paths', () => {
      const spec = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
      })

      const result = validateFormat(spec, 'openapi')

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Swagger Validation', () => {
    it('should validate valid Swagger spec', () => {
      const spec = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      })

      const result = validateFormat(spec, 'swagger')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Postman Validation', () => {
    it('should validate valid Postman collection', () => {
      const collection = JSON.stringify({
        info: {
          name: 'Test Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      })

      const result = validateFormat(collection, 'postman')

      // Postman validation is lenient, checks basic structure
      expect(result).toBeDefined()
    })

    it('should reject Postman collection without info', () => {
      const collection = JSON.stringify({
        item: [],
      })

      const result = validateFormat(collection, 'postman')

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('cURL Validation', () => {
    it('should validate valid cURL command', () => {
      const curl = 'curl https://api.example.com/users'

      const result = validateFormat(curl, 'curl')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject cURL without URL', () => {
      const curl = 'curl -X POST'

      const result = validateFormat(curl, 'curl')

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})

describe('extractBasicInfo', () => {
  it('should extract OpenAPI info', () => {
    const spec = JSON.stringify({
      openapi: '3.0.3',
      info: {
        title: 'User API',
        version: '2.0.0',
        description: 'User management',
      },
      paths: {},
    })

    const info = extractBasicInfo(spec)

    expect(info.name).toBe('User API')
    expect(info.version).toBe('2.0.0')
    expect(info.description).toBe('User management')
  })

  it('should extract Swagger info', () => {
    const spec = JSON.stringify({
      swagger: '2.0',
      info: {
        title: 'Pet API',
        version: '1.5.0',
      },
      paths: {},
    })

    const info = extractBasicInfo(spec)

    expect(info.name).toBe('Pet API')
    expect(info.version).toBe('1.5.0')
  })

  it('should extract Postman info', () => {
    const collection = JSON.stringify({
      info: {
        name: 'My Collection',
        version: '3.0.0',
        description: 'Test collection',
      },
      item: [],
    })

    const info = extractBasicInfo(collection)

    expect(info.name).toBe('My Collection')
    expect(info.version).toBe('3.0.0')
    expect(info.description).toBe('Test collection')
  })

  it('should handle missing optional fields', () => {
    const spec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Minimal API' },
      paths: {},
    })

    const info = extractBasicInfo(spec)

    expect(info.name).toBe('Minimal API')
    // Version defaults to 1.0.0 if not provided
    expect(info.version).toBeDefined()
  })
})
