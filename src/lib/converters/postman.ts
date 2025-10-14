/**
 * Postman Collection to Canonical Format Converter
 *
 * Converts Postman Collection v2.x format to canonical endpoint format.
 * Supports:
 * - Postman Collection v2.0 and v2.1
 * - Request items with various configurations
 * - Postman variables (converted to environment variables)
 * - Nested folders
 */

import type {CanonicalEndpoint, CanonicalParameter, CanonicalRequestBody} from '@/types/canonical'
import { applySmartDefaults } from './smart-defaults'

/**
 * Postman Collection v2.x structure
 */
interface PostmanCollection {
  info: {
    name: string
    version?: string
    description?: string
    schema: string
    _postman_id?: string
  }
  item: PostmanItem[]
  variable?: PostmanVariable[]
}

interface PostmanItem {
  name: string
  description?: string
  request?: PostmanRequest | string // Can be string URL or request object
  item?: PostmanItem[] // Nested folders
  event?: any[]
}

interface PostmanRequest {
  method: string
  header?: Array<{ key: string; value: string; disabled?: boolean }>
  url: PostmanUrl | string
  body?: PostmanRequestBody
  auth?: any
  description?: string
}

interface PostmanUrl {
  raw?: string
  protocol?: string
  host?: string[]
  path?: string[]
  query?: Array<{ key: string; value: string; disabled?: boolean }>
  variable?: Array<{ key: string; value: string }>
}

interface PostmanRequestBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql'
  raw?: string
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>
  formdata?: Array<{ key: string; value: string; type?: string; disabled?: boolean }>
  options?: {
    raw?: {
      language?: string
    }
  }
}

interface PostmanVariable {
  key: string
  value: string
  type?: string
}

/**
 * Convert Postman Collection to canonical format
 */
export function convertPostmanToCanonical(collectionJson: string): {
  name: string
  version: string
  description?: string
  baseUrl?: string
  endpoints: Array<Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  variables: Record<string, any>
} {
  console.log('[Postman Converter] Parsing Postman Collection')

  const collection: PostmanCollection = JSON.parse(collectionJson)

  // Extract endpoints from items (including nested folders)
  const endpoints: Array<Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>> = []
  extractEndpointsFromItems(collection.item, endpoints, [])

  // Extract variables
  const variables: Record<string, any> = {}
  if (collection.variable) {
    for (const v of collection.variable) {
      variables[v.key] = v.value
    }
  }

  // Try to detect base URL from first endpoint
  const baseUrl = detectBaseUrl(endpoints)

  return {
    name: collection.info.name,
    version: collection.info.version || '1.0.0',
    description: collection.info.description,
    baseUrl,
    endpoints,
    variables,
  }
}

/**
 * Recursively extract endpoints from items (handles nested folders)
 */
function extractEndpointsFromItems(
  items: PostmanItem[],
  endpoints: Array<Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  folderPath: string[]
): void {
  for (const item of items) {
    // If item has nested items (folder), recurse
    if (item.item && item.item.length > 0) {
      extractEndpointsFromItems(item.item, endpoints, [...folderPath, item.name])
    }
    // If item has request, convert it
    else if (item.request) {
      const endpoint = convertPostmanRequestToCanonical(item, folderPath)
      endpoints.push(endpoint)
    }
  }
}

/**
 * Convert single Postman request to canonical endpoint
 */
function convertPostmanRequestToCanonical(
  item: PostmanItem,
  folderPath: string[]
): Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  // Handle request as string URL (simple form)
  if (typeof item.request === 'string') {
    const url = new URL(item.request)
    const endpoint = {
      source: 'postman',
      method: 'GET',
      path: url.pathname,
      name: item.name,
      description: item.description,
      tags: folderPath,
      operationId: undefined,
      deprecated: false,
      request: {
        contentType: 'application/json',
        parameters: extractQueryParamsFromUrl(url),
      },
      responses: {
        success: {
          status: 200,
          description: 'Expected successful response',
        },
        errors: [],
      },
      auth: undefined,
    }

    // Apply smart defaults to enrich metadata
    return applySmartDefaults(endpoint as any) as Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>
  }

  // Handle request as object
  const request = item.request as PostmanRequest

  // Parse URL
  const { path, queryParams, pathVariables } = parsePostmanUrl(request.url)

  // Convert headers
  const headers = convertPostmanHeaders(request.header || [])

  // Convert body
  const contentType = detectContentType(request.body, headers)
  const body = request.body ? convertPostmanBody(request.body, contentType) : undefined

  // Detect auth
  const auth = convertPostmanAuth(request.auth, headers)

  const endpoint = {
    source: 'postman',
    method: request.method.toUpperCase(),
    path,
    name: item.name,
    description: item.description || request.description,
    tags: folderPath.length > 0 ? folderPath : ['imported'],
    operationId: undefined,
    deprecated: false,
    request: {
      contentType,
      parameters: [
        ...pathVariables,
        ...queryParams,
        ...headers,
      ],
      body,
    },
    responses: {
      success: {
        status: 200,
        description: 'Expected successful response',
        contentType: 'application/json',
      },
      errors: [],
    },
    auth,
  }

  // Apply smart defaults to enrich metadata
  return applySmartDefaults(endpoint as any) as Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>
}

/**
 * Parse Postman URL (supports both string and object format)
 */
function parsePostmanUrl(url: PostmanUrl | string): {
  path: string
  queryParams: CanonicalParameter[]
  pathVariables: CanonicalParameter[]
} {
  // Handle string URL
  if (typeof url === 'string') {
    try {
      const parsed = new URL(url)
      return {
        path: parsed.pathname,
        queryParams: extractQueryParamsFromUrl(parsed),
        pathVariables: [],
      }
    } catch {
      // If not a valid URL, treat as path
      return {
        path: url,
        queryParams: [],
        pathVariables: [],
      }
    }
  }

  // Handle object URL
  const pathParts = url.path || []
  const path = '/' + pathParts.map(p => {
    // Postman uses :variable for path variables
    if (p.startsWith(':')) {
      return `{${p.slice(1)}}` // Convert :id to {id}
    }
    return p
  }).join('/')

  // Extract path variables
  const pathVariables: CanonicalParameter[] = []
  if (url.variable) {
    for (const v of url.variable) {
      pathVariables.push({
        name: v.key,
        in: 'path',
        type: 'string',
        required: true,
        example: v.value || 'example',
        description: `Path variable: ${v.key}`,
      })
    }
  }

  // Extract query parameters
  const queryParams: CanonicalParameter[] = []
  if (url.query) {
    for (const q of url.query) {
      if (!q.disabled) {
        queryParams.push({
          name: q.key,
          in: 'query',
          type: inferType(q.value),
          required: false,
          example: parseValue(q.value),
        })
      }
    }
  }

  return { path, queryParams, pathVariables }
}

/**
 * Extract query params from URL object
 */
function extractQueryParamsFromUrl(url: URL): CanonicalParameter[] {
  const params: CanonicalParameter[] = []

  url.searchParams.forEach((value, key) => {
    params.push({
      name: key,
      in: 'query',
      type: inferType(value),
      required: false,
      example: parseValue(value),
    })
  })

  return params
}

/**
 * Convert Postman headers to canonical parameters
 */
function convertPostmanHeaders(headers: Array<{ key: string; value: string; disabled?: boolean }>): CanonicalParameter[] {
  return headers
    .filter(h => !h.disabled && h.key.toLowerCase() !== 'content-type')
    .map(h => ({
      name: h.key,
      in: 'header' as const,
      type: 'string',
      required: h.key.toLowerCase() === 'authorization',
      example: h.value,
      description: h.key.toLowerCase() === 'authorization' ? 'Authentication header' : undefined,
    }))
}

/**
 * Detect content type from body and headers
 */
function detectContentType(body?: PostmanRequestBody, headers?: CanonicalParameter[]): string {
  // Check headers first
  const contentTypeHeader = headers?.find(h => h.name.toLowerCase() === 'content-type')
  if (contentTypeHeader) {
    return contentTypeHeader.example as string
  }

  // Infer from body mode
  if (!body) {
    return 'application/json'
  }

  switch (body.mode) {
    case 'raw':
      // Check language option
      if (body.options?.raw?.language === 'json') {
        return 'application/json'
      }
      if (body.options?.raw?.language === 'xml') {
        return 'application/xml'
      }
      return 'text/plain'

    case 'urlencoded':
      return 'application/x-www-form-urlencoded'

    case 'formdata':
      return 'multipart/form-data'

    case 'graphql':
      return 'application/json'

    default:
      return 'application/json'
  }
}

/**
 * Convert Postman body to canonical format
 */
function convertPostmanBody(body: PostmanRequestBody, contentType: string): CanonicalRequestBody {
  switch (body.mode) {
    case 'raw':
      return convertRawBody(body.raw || '', contentType)

    case 'urlencoded':
      return convertUrlencodedBody(body.urlencoded || [])

    case 'formdata':
      return convertFormDataBody(body.formdata || [])

    case 'graphql':
      return convertRawBody(body.raw || '', 'application/json')

    default:
      return {
        required: false,
        example: null,
        fields: [],
      }
  }
}

/**
 * Convert raw body (JSON, XML, text)
 */
function convertRawBody(raw: string, contentType: string): CanonicalRequestBody {
  if (contentType.includes('json')) {
    try {
      const parsed = JSON.parse(raw)
      return {
        required: true,
        description: 'Request body',
        example: parsed,
        fields: extractFieldsFromObject(parsed),
      }
    } catch {
      // Invalid JSON, treat as text
      return {
        required: true,
        example: raw,
        fields: [{
          name: 'body',
          type: 'string',
          required: true,
          example: raw,
        }],
      }
    }
  }

  // Non-JSON raw body
  return {
    required: true,
    example: raw,
    fields: [{
      name: 'body',
      type: 'string',
      required: true,
      example: raw,
    }],
  }
}

/**
 * Convert URL-encoded body
 */
function convertUrlencodedBody(items: Array<{ key: string; value: string; disabled?: boolean }>): CanonicalRequestBody {
  const example: Record<string, any> = {}
  const fields: any[] = []

  for (const item of items) {
    if (!item.disabled) {
      example[item.key] = parseValue(item.value)
      fields.push({
        name: item.key,
        type: inferType(item.value),
        required: true,
        example: parseValue(item.value),
      })
    }
  }

  return {
    required: true,
    example,
    fields,
  }
}

/**
 * Convert form data body
 */
function convertFormDataBody(items: Array<{ key: string; value: string; type?: string; disabled?: boolean }>): CanonicalRequestBody {
  const example: Record<string, any> = {}
  const fields: any[] = []

  for (const item of items) {
    if (!item.disabled) {
      const isFile = item.type === 'file'
      example[item.key] = isFile ? `<file: ${item.value}>` : parseValue(item.value)
      fields.push({
        name: item.key,
        type: isFile ? 'file' : inferType(item.value),
        required: true,
        example: example[item.key],
        format: isFile ? 'binary' : undefined,
      })
    }
  }

  return {
    required: true,
    example,
    fields,
  }
}

/**
 * Extract fields from object (for JSON bodies)
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
      required: true,
      example: value,
    })

    // Handle nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      fields.push(...extractFieldsFromObject(value, fieldName))
    }
  }

  return fields
}

/**
 * Convert Postman auth to canonical format
 */
function convertPostmanAuth(auth: any, headers: CanonicalParameter[]): any {
  // Check for Authorization header first
  const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization')
  if (authHeader) {
    const value = authHeader.example as string
    if (value.startsWith('Bearer ')) {
      return { type: 'http', scheme: 'bearer' }
    }
    if (value.startsWith('Basic ')) {
      return { type: 'http', scheme: 'basic' }
    }
    return { type: 'apiKey', in: 'header', name: 'Authorization' }
  }

  // Parse Postman auth object
  if (!auth || !auth.type) {
    return undefined
  }

  switch (auth.type) {
    case 'bearer':
      return { type: 'http', scheme: 'bearer' }
    case 'basic':
      return { type: 'http', scheme: 'basic' }
    case 'apikey':
      return { type: 'apiKey', in: auth.apikey?.in || 'header', name: auth.apikey?.key || 'X-API-Key' }
    case 'oauth2':
      return { type: 'oauth2', flows: {} }
    default:
      return undefined
  }
}

/**
 * Detect base URL from endpoints
 */
function detectBaseUrl(_endpoints: Array<Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>>): string | undefined {
  // For Postman collections, base URL is typically in variables
  // This is a placeholder - base URL detection needs collection variables
  return undefined
}

/**
 * Infer type from value
 */
function inferType(value: any): string {
  if (value === null || value === undefined) return 'string'
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
  if (value === 'true') return true
  if (value === 'false') return false

  const num = Number(value)
  if (!isNaN(num) && value.trim() !== '') {
    return num
  }

  return value
}
