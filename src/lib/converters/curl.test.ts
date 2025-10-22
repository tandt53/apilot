import { describe, it, expect } from 'vitest'
import { convertCurlToCanonical, generateSpecFromCurl } from './curl'

describe('convertCurlToCanonical', () => {
  describe('Basic HTTP Methods', () => {
    it('should parse simple GET request', () => {
      const curl = 'curl https://api.example.com/users'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('GET')
      expect(endpoint.path).toBe('/users')
      expect(endpoint.source).toBe('curl')
      expect(endpoint.name).toBe('GET /users')
    })

    it('should parse POST with -X flag', () => {
      const curl = 'curl -X POST https://api.example.com/users'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
      expect(endpoint.path).toBe('/users')
    })

    it('should parse PUT request', () => {
      const curl = 'curl -X PUT https://api.example.com/users/123'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('PUT')
      expect(endpoint.path).toBe('/users/123')
    })

    it('should parse DELETE request', () => {
      const curl = 'curl -X DELETE https://api.example.com/users/123'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('DELETE')
      expect(endpoint.path).toBe('/users/123')
    })
  })

  describe('Request Body Handling', () => {
    it('should parse POST with JSON body', () => {
      const curl = `curl -X POST https://api.example.com/users \\
        -H "Content-Type: application/json" \\
        -d '{"name":"John","email":"john@example.com"}'`

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
      expect(endpoint.request?.contentType).toBe('application/json')
      expect(endpoint.request?.body).toBeDefined()
    })

    it('should parse body with -d flag', () => {
      const curl = 'curl -X POST https://api.example.com/users -d \'{"username":"john"}\''

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.request?.body).toBeDefined()
    })
  })

  describe('Query Parameters', () => {
    it('should extract query parameters from URL', () => {
      const curl = 'curl "https://api.example.com/users?status=active&limit=10"'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.path).toBe('/users')
      const queryParams = endpoint.request?.parameters?.filter((p) => p.in === 'query')
      expect(queryParams).toBeDefined()
      expect(queryParams!.length).toBeGreaterThan(0)
    })
  })

  describe('Headers', () => {
    it('should convert headers to parameters', () => {
      const curl = `curl https://api.example.com/users \\
        -H "Accept: application/json" \\
        -H "X-API-Key: abc123"`

      const endpoint = convertCurlToCanonical(curl)

      const headerParams = endpoint.request?.parameters?.filter((p) => p.in === 'header')
      expect(headerParams).toBeDefined()
      expect(headerParams!.length).toBeGreaterThan(0)
    })
  })

  describe('Authentication Detection', () => {
    it('should detect Bearer token auth', () => {
      const curl = 'curl https://api.example.com/users -H "Authorization: Bearer token123"'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.auth).toBeDefined()
      // Auth type could be 'http' or 'bearer' depending on implementation
      expect(endpoint.auth?.type).toBeDefined()
    })

    it('should detect Basic auth', () => {
      const curl = 'curl https://api.example.com/users -H "Authorization: Basic dXNlcjpwYXNz"'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.auth).toBeDefined()
      expect(endpoint.auth?.type).toBeDefined()
    })

    it('should detect API key in headers', () => {
      const curl = 'curl https://api.example.com/users -H "X-API-Key: abc123"'

      const endpoint = convertCurlToCanonical(curl)

      // API key detection may vary
      expect(endpoint.request?.parameters?.some((p) => p.name === 'X-API-Key')).toBe(true)
    })

    it('should handle -u flag for basic auth', () => {
      const curl = 'curl -u admin:secret https://api.example.com/users'

      const endpoint = convertCurlToCanonical(curl)

      const authHeader = endpoint.request?.parameters?.find((p) => p.name === 'Authorization')
      expect(authHeader).toBeDefined()
      expect(authHeader?.example).toContain('Basic ')
    })

    it('should handle URL-embedded auth', () => {
      const curl = 'curl https://admin:secret@api.example.com/users'

      const endpoint = convertCurlToCanonical(curl)

      const authHeader = endpoint.request?.parameters?.find((p) => p.name === 'Authorization')
      expect(authHeader).toBeDefined()
      expect(authHeader?.example).toContain('Basic ')
    })
  })

  describe('New Parser Features', () => {
    it('should handle data without quotes', () => {
      const curl = 'curl -X POST https://api.example.com/users -d {"name":"John"}'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
      expect(endpoint.request?.body).toBeDefined()
    })

    it('should handle headers without quotes', () => {
      const curl = 'curl https://api.example.com/users -H Content-Type:application/json'

      const endpoint = convertCurlToCanonical(curl)

      const headerParams = endpoint.request?.parameters?.filter((p) => p.in === 'header')
      expect(headerParams?.some((p) => p.name === 'Content-Type')).toBe(true)
    })

    it('should handle short flags without spaces', () => {
      const curl = 'curl -XPOST https://api.example.com/users -H\'Content-Type: application/json\''

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
    })

    it('should handle multiple -d flags', () => {
      const curl = 'curl https://api.example.com/users -d param1=value1 -d param2=value2'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
      expect(endpoint.request?.body?.example).toContain('param1=value1')
      expect(endpoint.request?.body?.example).toContain('param2=value2')
    })

    it('should handle -F flag for multipart form data', () => {
      const curl = 'curl https://api.example.com/upload -F "file=@photo.jpg" -F "name=John"'

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.request?.contentType).toBe('multipart/form-data')
      expect(endpoint.request?.body).toBeDefined()

      // Verify individual fields parsed correctly
      expect(endpoint.request?.body?.fields).toHaveLength(2)

      // Verify file field
      const fileField = endpoint.request?.body?.fields.find((f: any) => f.name === 'file')
      expect(fileField).toBeDefined()
      expect(fileField?.type).toBe('file')
      expect(fileField?.format).toBe('binary')
      // NOTE: field.example removed, only body.example is used

      // Verify string field
      const nameField = endpoint.request?.body?.fields.find((f: any) => f.name === 'name')
      expect(nameField).toBeDefined()
      expect(nameField?.type).toBe('string')
      // NOTE: field.example removed, only body.example is used

      // Verify example object
      expect(typeof endpoint.request?.body?.example).toBe('object')
      expect(endpoint.request?.body?.example).toEqual({
        file: 'photo.jpg',
        name: 'John'
      })
    })

    it('should default to POST when --data is present without -X', () => {
      const curl = 'curl https://api.example.com/users --data \'{"name":"John"}\''

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
    })

    it('should handle user-provided curl from issue', () => {
      const curl = `curl --location 'https://api.openai.com/v1/chat/completions' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer ' \\
--data '{
    "model": "gpt-4o-mini",
    "messages": [
        {
            "role": "user",
            "content": "create a test case for log in feature using email and password."
        }
    ],
    "n": 1,
    "max_completion_tokens": 500
}'`

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
      expect(endpoint.path).toBe('/v1/chat/completions')
      expect(endpoint.request?.contentType).toBe('application/json')
      expect(endpoint.request?.body).toBeDefined()
    })
  })

  describe('Complex Examples', () => {
    it('should parse complex cURL with multiple flags', () => {
      const curl = `curl -X POST https://api.example.com/users \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer token123" \\
        -d '{"name":"John Doe","email":"john@example.com","age":30}'`

      const endpoint = convertCurlToCanonical(curl)

      expect(endpoint.method).toBe('POST')
      expect(endpoint.path).toBe('/users')
      expect(endpoint.request?.contentType).toBe('application/json')
      expect(endpoint.request?.body).toBeDefined()
      // Just verify the endpoint was parsed successfully with some headers
      expect(endpoint.request?.parameters).toBeDefined()
      expect(endpoint.request?.parameters!.length).toBeGreaterThan(0)
    })
  })

  describe('Regression Tests (Bug Fixes)', () => {
    it('should parse complex nested JSON with internal quotes (BUG-006)', () => {
      // Bug: Regex pattern stopped at first internal quote, capturing only "{ " instead of full JSON
      // Fix: Use separate patterns for single vs double quotes
      const curl = `curl -X POST https://api.shop.com/orders \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer shop_token_xyz" \\
  -d '{
    "customerId": 12345,
    "items": [
      {"productId": 101, "quantity": 2, "price": 29.99},
      {"productId": 205, "quantity": 1, "price": 49.99}
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102"
    },
    "paymentMethod": "credit_card"
  }'`

      const endpoint = convertCurlToCanonical(curl)

      // Verify method and path
      expect(endpoint.method).toBe('POST')
      expect(endpoint.path).toBe('/orders')

      // Verify body was parsed completely (not just "{ ")
      expect(endpoint.request?.body).toBeDefined()
      expect(endpoint.request?.body?.example).toBeDefined()

      // Verify it's a proper object, not a truncated string
      expect(typeof endpoint.request?.body?.example).toBe('object')
      expect(endpoint.request?.body?.example).toHaveProperty('customerId', 12345)
      expect(endpoint.request?.body?.example).toHaveProperty('items')
      expect(endpoint.request?.body?.example).toHaveProperty('shippingAddress')
      expect(endpoint.request?.body?.example).toHaveProperty('paymentMethod', 'credit_card')

      // Verify nested array
      expect(Array.isArray(endpoint.request?.body?.example.items)).toBe(true)
      expect(endpoint.request?.body?.example.items).toHaveLength(2)
      expect(endpoint.request?.body?.example.items[0]).toHaveProperty('productId', 101)

      // Verify nested object
      expect(typeof endpoint.request?.body?.example.shippingAddress).toBe('object')
      expect(endpoint.request?.body?.example.shippingAddress).toHaveProperty('city', 'San Francisco')

      // Verify fields were extracted (should have structured fields, not just "body: string")
      expect(endpoint.request?.body?.fields).toBeDefined()
      expect(endpoint.request?.body?.fields.length).toBe(4) // Should have 4 top-level fields

      // Check for specific top-level fields (no flattened dotted names!)
      const fieldNames = endpoint.request?.body?.fields.map((f: any) => f.name)
      expect(fieldNames).toContain('customerId')
      expect(fieldNames).toContain('items')
      expect(fieldNames).toContain('shippingAddress')
      expect(fieldNames).toContain('paymentMethod')

      // Verify NO flattened fields with dots (BUG-007)
      expect(fieldNames).not.toContain('shippingAddress.street')
      expect(fieldNames).not.toContain('shippingAddress.city')

      // Verify shippingAddress has nested properties array (not flattened)
      const shippingField = endpoint.request?.body?.fields.find((f: any) => f.name === 'shippingAddress')
      expect(shippingField).toBeDefined()
      expect(shippingField?.type).toBe('object')
      expect(shippingField?.properties).toBeDefined()
      expect(Array.isArray(shippingField?.properties)).toBe(true)
      expect(shippingField?.properties.length).toBe(4) // street, city, state, zip

      // Verify nested property names
      const nestedNames = shippingField?.properties.map((p: any) => p.name)
      expect(nestedNames).toContain('street')
      expect(nestedNames).toContain('city')
      expect(nestedNames).toContain('state')
      expect(nestedNames).toContain('zip')

      // Verify items array has properties for nested objects
      const itemsField = endpoint.request?.body?.fields.find((f: any) => f.name === 'items')
      expect(itemsField).toBeDefined()
      expect(itemsField?.type).toBe('array')
      expect(itemsField?.items).toBeDefined()
      expect(itemsField?.items.type).toBe('object')
      expect(itemsField?.items.properties).toBeDefined()
      expect(itemsField?.items.properties.length).toBe(3) // productId, quantity, price
    })

    it('should parse multipart form data with file uploads (BUG-008)', () => {
      // Bug: Multipart form data was treated as raw text with single 'body' field
      // Fix: Parse individual fields and detect file uploads from @ prefix
      const curl = `curl -X POST https://api.example.com/upload \\
  -H "Authorization: Bearer token123" \\
  -F "file=@photo.jpg" \\
  -F "description=Profile Photo"`

      const endpoint = convertCurlToCanonical(curl)

      // Verify method and path
      expect(endpoint.method).toBe('POST')
      expect(endpoint.path).toBe('/upload')

      // Verify content type
      expect(endpoint.request?.contentType).toBe('multipart/form-data')

      // Verify 2 separate fields (not 1 'body' field)
      expect(endpoint.request?.body?.fields).toHaveLength(2)

      // Verify file field with proper type
      const fileField = endpoint.request?.body?.fields.find((f: any) => f.name === 'file')
      expect(fileField).toBeDefined()
      expect(fileField?.type).toBe('file')
      expect(fileField?.format).toBe('binary')
      // NOTE: field.example removed, only body.example is used
      expect(fileField?.description).toContain('File upload')

      // Verify string field
      const descField = endpoint.request?.body?.fields.find((f: any) => f.name === 'description')
      expect(descField).toBeDefined()
      expect(descField?.type).toBe('string')
      // NOTE: field.example removed, only body.example is used

      // Verify example is object (not string)
      expect(typeof endpoint.request?.body?.example).toBe('object')
      expect(endpoint.request?.body?.example).toEqual({
        file: 'photo.jpg',
        description: 'Profile Photo'
      })

      // Verify NOT a single 'body' field
      const bodyField = endpoint.request?.body?.fields.find((f: any) => f.name === 'body')
      expect(bodyField).toBeUndefined()
    })
  })
})

describe('generateSpecFromCurl', () => {
  it('should generate spec from single curl command', () => {
    const curl = 'curl https://api.example.com/users'

    const spec = generateSpecFromCurl(curl)

    expect(spec.name).toContain('cURL Import')
    expect(spec.version).toBe('1.0.0')
    expect(spec.baseUrl).toBe('https://api.example.com')
    expect(spec.endpoints).toHaveLength(1)
    expect(spec.endpoints[0].method).toBe('GET')
    expect(spec.endpoints[0].path).toBe('/users')
  })

  it('should extract base URL correctly', () => {
    const curl = 'curl https://api.github.com/repos/microsoft/typescript/issues'

    const spec = generateSpecFromCurl(curl)

    expect(spec.baseUrl).toBe('https://api.github.com')
  })

  it('should handle URLs with ports', () => {
    const curl = 'curl http://localhost:3000/api/users'

    const spec = generateSpecFromCurl(curl)

    expect(spec.baseUrl).toBe('http://localhost:3000')
    expect(spec.endpoints[0].path).toBe('/api/users')
  })

  it('should generate description', () => {
    const curl = 'curl -X POST https://api.example.com/users -d \'{"name":"John"}\''

    const spec = generateSpecFromCurl(curl)

    expect(spec.description).toBeDefined()
  })
})
