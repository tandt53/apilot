/**
 * cURL to Canonical Format Converter
 *
 * Parses cURL commands and converts them to canonical endpoint format.
 * Supports common cURL flags: -X, -H, -d, --data, --header, etc.
 */

import type {CanonicalEndpoint, CanonicalParameter, CanonicalRequestBody} from '@/types/canonical'
import { applySmartDefaults } from './smart-defaults'

/**
 * Parse cURL command and convert to canonical format
 */
export function convertCurlToCanonical(curlCommand: string): Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  console.log('[cURL Converter] Parsing cURL command')

  const parsed = parseCurlCommand(curlCommand)

  // Extract path and query from URL
  const url = new URL(parsed.url)
  const path = url.pathname
  const queryParams = extractQueryParameters(url)

  const endpoint = {
    source: 'curl',
    method: parsed.method,
    path,
    name: `${parsed.method} ${path}`,
    description: `Imported from cURL command`,
    tags: ['imported', 'curl'],
    operationId: undefined,
    deprecated: false,
    request: {
      contentType: parsed.contentType || 'application/json',
      parameters: [
        ...queryParams,
        ...parsed.headers.map(h => convertHeaderToParameter(h)),
      ],
      body: parsed.body ? convertBodyToCanonical(parsed.body, parsed.contentType) : undefined,
    },
    responses: {
      success: {
        status: 200,
        description: 'Expected successful response',
        contentType: 'application/json',
      },
      errors: [],
    },
    auth: detectAuthFromHeaders(parsed.headers),
  }

  // Apply smart defaults to enrich metadata
  return applySmartDefaults(endpoint as any) as Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>
}

/**
 * Parse cURL command into structured data
 */
interface ParsedCurl {
  method: string
  url: string
  headers: Array<{ name: string; value: string }>
  body?: string
  contentType?: string
}

function parseCurlCommand(command: string): ParsedCurl {
  // Remove line continuations and normalize whitespace
  let normalized = command
    .replace(/\\\r?\n/g, ' ') // Remove backslash line continuations
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  // Remove 'curl' command
  normalized = normalized.replace(/^curl\s+/i, '')

  const result: ParsedCurl = {
    method: 'GET', // Default
    url: '',
    headers: [],
  }

  // Extract method (-X or --request)
  const methodMatch = normalized.match(/(?:-X|--request)\s+['"]?(\w+)['"]?/)
  if (methodMatch) {
    result.method = methodMatch[1].toUpperCase()
    normalized = normalized.replace(methodMatch[0], '')
  }

  // Extract headers (-H or --header)
  const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/g
  let headerMatch
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const headerValue = headerMatch[1]
    const [name, ...valueParts] = headerValue.split(':')
    const value = valueParts.join(':').trim()
    result.headers.push({ name: name.trim(), value })
    normalized = normalized.replace(headerMatch[0], '')
  }

  // Extract body (-d, --data, --data-raw, --data-binary)
  const dataRegex = /(?:-d|--data|--data-raw|--data-binary)\s+['"](.+?)['"]/
  const dataMatch = normalized.match(dataRegex)
  if (dataMatch) {
    result.body = dataMatch[1]
    normalized = normalized.replace(dataMatch[0], '')
  }

  // Extract URL (remaining non-flag content)
  const urlMatch = normalized.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/)
  if (urlMatch) {
    result.url = urlMatch[1]
  } else {
    throw new Error('Could not extract URL from cURL command')
  }

  // Detect Content-Type from headers
  const contentTypeHeader = result.headers.find(h => h.name.toLowerCase() === 'content-type')
  if (contentTypeHeader) {
    result.contentType = contentTypeHeader.value
  }

  // If body exists but no Content-Type, default to JSON
  if (result.body && !result.contentType) {
    result.contentType = 'application/json'
  }

  return result
}

/**
 * Extract query parameters from URL
 */
function extractQueryParameters(url: URL): CanonicalParameter[] {
  const params: CanonicalParameter[] = []

  url.searchParams.forEach((value, name) => {
    params.push({
      name,
      in: 'query',
      type: inferType(value),
      required: false, // Query params are typically optional
      example: parseValue(value),
      description: undefined,
    })
  })

  return params
}

/**
 * Convert header to canonical parameter
 */
function convertHeaderToParameter(header: { name: string; value: string }): CanonicalParameter {
  // Skip Content-Type header (handled separately)
  if (header.name.toLowerCase() === 'content-type') {
    return {
      name: header.name,
      in: 'header',
      type: 'string',
      required: false,
      example: header.value,
    }
  }

  return {
    name: header.name,
    in: 'header',
    type: 'string',
    required: header.name.toLowerCase() === 'authorization', // Auth headers typically required
    example: header.value,
    description: header.name.toLowerCase() === 'authorization' ? 'Authentication token' : undefined,
  }
}

/**
 * Convert body string to canonical request body
 */
function convertBodyToCanonical(body: string, contentType?: string): CanonicalRequestBody {
  let parsedBody: any
  let fields: any[] = []

  // Try to parse as JSON
  if (contentType?.includes('json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
    try {
      parsedBody = JSON.parse(body)
      fields = extractFieldsFromObject(parsedBody)
    } catch {
      // Not valid JSON, treat as raw text
      parsedBody = body
      fields = [{
        name: 'body',
        type: 'string',
        required: true,
        example: body,
      }]
    }
  }
  // Form data
  else if (contentType?.includes('form-urlencoded')) {
    const params = new URLSearchParams(body)
    parsedBody = Object.fromEntries(params)
    fields = Array.from(params.entries()).map(([name, value]) => ({
      name,
      type: inferType(value),
      required: true,
      example: parseValue(value),
    }))
  }
  // Raw text
  else {
    parsedBody = body
    fields = [{
      name: 'body',
      type: 'string',
      required: true,
      example: body,
    }]
  }

  return {
    required: true,
    description: 'Request body from cURL command',
    example: parsedBody,
    fields,
  }
}

/**
 * Extract fields from JSON object
 */
function extractFieldsFromObject(obj: any, prefix = ''): any[] {
  const fields: any[] = []

  if (typeof obj !== 'object' || obj === null) {
    return fields
  }

  for (const [key, value] of Object.entries(obj)) {
    const fieldName = prefix ? `${prefix}.${key}` : key

    fields.push({
      name: fieldName,
      type: inferType(value),
      required: true, // Assume required if present in example
      example: value,
    })

    // Recursively extract nested fields
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      fields.push(...extractFieldsFromObject(value, fieldName))
    }
  }

  return fields
}

/**
 * Infer type from value
 */
function inferType(value: any): string {
  if (value === null) return 'string'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

/**
 * Parse value to appropriate type
 */
function parseValue(value: string): any {
  // Try boolean
  if (value === 'true') return true
  if (value === 'false') return false

  // Try number
  const num = Number(value)
  if (!isNaN(num) && value.trim() !== '') {
    return num
  }

  // Return as string
  return value
}

/**
 * Detect authentication from headers
 */
function detectAuthFromHeaders(headers: Array<{ name: string; value: string }>): any {
  const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization')

  if (!authHeader) {
    return undefined
  }

  const value = authHeader.value

  // Bearer token
  if (value.startsWith('Bearer ')) {
    return {
      type: 'http',
      scheme: 'bearer',
      description: 'Bearer token authentication',
    }
  }

  // Basic auth
  if (value.startsWith('Basic ')) {
    return {
      type: 'http',
      scheme: 'basic',
      description: 'Basic authentication',
    }
  }

  // API key
  return {
    type: 'apiKey',
    in: 'header',
    name: 'Authorization',
    description: 'API key authentication',
  }
}

/**
 * Generate spec from cURL command
 * (cURL is a single endpoint, so we create a minimal spec)
 */
export function generateSpecFromCurl(curlCommand: string, specName?: string): {
  name: string
  version: string
  description: string
  baseUrl: string
  endpoints: Array<Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>>
} {
  const endpoint = convertCurlToCanonical(curlCommand)
  const parsed = parseCurlCommand(curlCommand)
  const url = new URL(parsed.url)

  return {
    name: specName || `cURL Import: ${endpoint.method} ${endpoint.path}`,
    version: '1.0.0',
    description: 'Imported from cURL command',
    baseUrl: `${url.protocol}//${url.host}`,
    endpoints: [endpoint],
  }
}
