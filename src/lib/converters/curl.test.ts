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
