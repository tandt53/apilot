/**
 * cURL to Canonical Format Converter
 *
 * Parses cURL commands and converts them to canonical endpoint format.
 * Supports common cURL flags: -X, -H, -d, --data, --header, etc.
 */

import type {CanonicalEndpoint, CanonicalParameter, CanonicalRequestBody} from '@/types/canonical'
import { applySmartDefaults } from './smart-defaults'

/**
 * Base64 encode helper (cross-platform)
 */
function base64Encode(str: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(str)
  }
  // Node.js environment
  return Buffer.from(str).toString('base64')
}

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
  const normalized = command
    .replace(/\\\r?\n/g, ' ') // Remove backslash line continuations
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .replace(/^curl\s+/i, '') // Remove 'curl' command

  const result: ParsedCurl = {
    method: 'GET', // Default (will be changed to POST if --data is present)
    url: '',
    headers: [],
  }

  // Extract method (-X or --request, with or without space)
  // Handles: -X POST, -XPOST, --request POST, --request=POST
  const methodMatch = normalized.match(/(?:-X|--request)(?:=|\s+)?['"]?(\w+)['"]?/)
  if (methodMatch) {
    result.method = methodMatch[1].toUpperCase()
  }

  // Extract basic auth (-u or --user)
  // Handles: -u username:password, --user username:password
  const authMatch = normalized.match(/(?:-u|--user)\s+['"]?([^'"]+?)['"]?(?:\s|$)/)
  if (authMatch) {
    const [username, password] = authMatch[1].split(':')
    // Convert to Base64 for Basic auth
    const credentials = base64Encode(`${username}:${password || ''}`)
    result.headers.push({
      name: 'Authorization',
      value: `Basic ${credentials}`,
    })
  }

  // Extract headers (-H or --header, with or without quotes)
  // Handles: -H "header: value", -H'header: value', -Hheader:value, --header "header: value"
  // IMPORTANT: Use separate patterns for single vs double quotes to allow internal quotes
  const headerRegex = /(?:-H|--header)(?:=|\s+)?(?:'([^']*)'|"([^"]*)"|(\S+))/g
  let headerMatch
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const headerValue = headerMatch[1] || headerMatch[2] || headerMatch[3]
    const [name, ...valueParts] = headerValue.split(':')
    const value = valueParts.join(':').trim()
    result.headers.push({ name: name.trim(), value })
  }

  // Extract multipart form data (-F or --form)
  // Handles: -F "field=value", -F "file=@path/to/file"
  // IMPORTANT: Use separate patterns for single vs double quotes to allow internal quotes
  const formRegex = /(?:-F|--form)\s+(?:'([^']*)'|"([^"]*)"|(\S+))/g
  let formMatch
  const formFields: Array<{ name: string; value: string }> = []
  while ((formMatch = formRegex.exec(normalized)) !== null) {
    const formValue = formMatch[1] || formMatch[2] || formMatch[3]
    const [name, ...valueParts] = formValue.split('=')
    const value = valueParts.join('=')
    formFields.push({ name: name.trim(), value })
  }

  // If form fields exist, set Content-Type and body
  if (formFields.length > 0) {
    result.contentType = 'multipart/form-data'
    // Convert form fields to encoded string (preserve @ prefix for file detection)
    result.body = formFields.map(f => `${f.name}=${f.value}`).join('\n')
  }

  // Extract body (-d, --data, --data-raw, --data-binary)
  // Collect ALL data flags and concatenate them
  // IMPORTANT: Use separate patterns for single vs double quotes to allow internal quotes
  // IMPORTANT: Longer alternatives must come first (--data-raw before --data)
  // Example: -d '{"key": "value"}' should capture the full JSON, not stop at internal "
  const dataRegex = /(?:--data-raw|--data-binary|--data|-d)(?:=|\s+)?(?:'([^']*)'|"([^"]*)"|(\S+))/g
  let dataMatch
  const dataParts: string[] = []
  while ((dataMatch = dataRegex.exec(normalized)) !== null) {
    const dataValue = dataMatch[1] || dataMatch[2] || dataMatch[3]
    dataParts.push(dataValue)
  }

  // If data exists, concatenate and set body
  if (dataParts.length > 0) {
    // Check if it's JSON or form data
    const combinedData = dataParts.join('')
    const isJson = combinedData.trim().startsWith('{') || combinedData.trim().startsWith('[')

    if (isJson) {
      result.body = combinedData
    } else {
      // Form data - concatenate with &
      result.body = dataParts.join('&')
    }

    // If --data is present but no explicit method was set, default to POST
    if (!methodMatch) {
      result.method = 'POST'
    }
  }

  // Extract URL (remaining non-flag content)
  // Also handle URL with embedded auth (https://user:pass@host)
  const urlMatch = normalized.match(/['"]?(https?:\/\/(?:([^:@\s'"]+):([^@\s'"]+)@)?([^\s'"?#]+(?:\?[^\s'"#]*)?(?:#[^\s'"]*)?)?)['"]?/)
  if (urlMatch) {
    const fullUrl = urlMatch[1]
    const urlUser = urlMatch[2]
    const urlPass = urlMatch[3]

    // If URL contains auth, extract it
    if (urlUser && urlPass) {
      const credentials = base64Encode(`${urlUser}:${urlPass}`)
      // Only add if not already added via -u flag
      if (!result.headers.find(h => h.name.toLowerCase() === 'authorization')) {
        result.headers.push({
          name: 'Authorization',
          value: `Basic ${credentials}`,
        })
      }
      // Remove auth from URL
      result.url = fullUrl.replace(`${urlUser}:${urlPass}@`, '')
    } else {
      result.url = fullUrl
    }
  } else {
    throw new Error('Could not extract URL from cURL command')
  }

  // Detect Content-Type from headers (unless already set by form data)
  const contentTypeHeader = result.headers.find(h => h.name.toLowerCase() === 'content-type')
  if (contentTypeHeader && !result.contentType) {
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
  // Content-Type header
  if (header.name.toLowerCase() === 'content-type') {
    return {
      name: header.name,
      in: 'header',
      type: 'string',
      required: false,
      example: header.value,
      description: 'Request content type',
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
        // NOTE: Removed field.example - not needed, only body.example is used
      }]
    }
  }
  // Form data (application/x-www-form-urlencoded)
  else if (contentType?.includes('form-urlencoded')) {
    const params = new URLSearchParams(body)
    // Keep body as URL-encoded string format, not JSON object
    parsedBody = body
    fields = Array.from(params.entries()).map(([name, value]) => ({
      name,
      type: inferType(value),
      required: true,
      // NOTE: Removed field.example - not needed, only body.example is used
    }))
  }
  // Multipart form data (multipart/form-data)
  else if (contentType?.includes('multipart/form-data')) {
    const lines = body.split('\n')
    parsedBody = {}
    fields = []

    for (const line of lines) {
      if (!line.trim()) continue  // Skip empty lines

      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) continue  // Skip malformed lines

      const name = line.substring(0, separatorIndex).trim()
      const value = line.substring(separatorIndex + 1)

      // Detect file uploads from @ prefix
      const isFile = value.startsWith('@')
      const actualValue = isFile ? value.substring(1) : value

      parsedBody[name] = actualValue

      fields.push({
        name,
        type: isFile ? 'file' : inferType(actualValue),
        format: isFile ? 'binary' : undefined,
        required: true,
        // NOTE: Removed field.example - not needed, only body.example is used
        description: isFile ? `File upload: ${actualValue}` : undefined,
      })
    }
  }
  // Raw text
  else {
    parsedBody = body
    fields = [{
      name: 'body',
      type: 'string',
      required: true,
      // NOTE: Removed field.example - not needed, only body.example is used
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
 *
 * IMPORTANT: Matches canonical format structure used by OpenAPI converter.
 * Nested objects are preserved with `properties` array, not flattened with dots.
 */
function extractFieldsFromObject(obj: any): any[] {
  const fields: any[] = []

  if (typeof obj !== 'object' || obj === null) {
    return fields
  }

  for (const [key, value] of Object.entries(obj)) {
    const field: any = {
      name: key,
      type: inferType(value),
      required: true, // Assume required if present in example
      // NOTE: Removed field.example - not needed, only body.example is used
    }

    // Handle nested objects - create properties array (NOT flattened with dots)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      field.properties = extractFieldsFromObject(value)
    }

    // Handle arrays - set items type
    if (Array.isArray(value) && value.length > 0) {
      field.items = {
        type: inferType(value[0]),
        // NOTE: Removed field.items.example - not needed, only body.example is used
      }
      // If array contains objects, recursively extract properties
      if (typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])) {
        field.items.properties = extractFieldsFromObject(value[0])
      }
    }

    fields.push(field)
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
