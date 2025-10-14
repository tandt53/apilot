/**
 * Smart Defaults for Multi-Source Import
 *
 * Applies intelligent inference to endpoints imported from sources
 * that lack metadata (cURL, Postman). Fills in missing information
 * using pattern detection and heuristics.
 */

import type { CanonicalEndpoint, CanonicalParameter, CanonicalField } from '@/types/canonical'

/**
 * Apply smart defaults to an imported endpoint
 */
export function applySmartDefaults(endpoint: CanonicalEndpoint): CanonicalEndpoint {
  const enhanced = { ...endpoint }

  // Enhance parameters
  if (enhanced.request?.parameters) {
    enhanced.request.parameters = enhanced.request.parameters.map(enrichParameter)
  }

  // Enhance body fields
  if (enhanced.request?.body?.fields) {
    enhanced.request.body.fields = enhanced.request.body.fields.map(enrichField)
  }

  // Enhance response based on method
  if (enhanced.responses?.success) {
    enhanced.responses.success = enrichSuccessResponse(enhanced.method, enhanced.responses.success)
  }

  // Add common error responses if missing
  if (!enhanced.responses.errors || enhanced.responses.errors.length === 0) {
    enhanced.responses.errors = getCommonErrorResponses(enhanced.method, enhanced.auth)
  }

  return enhanced
}

/**
 * Enrich a parameter with smart defaults
 */
function enrichParameter(param: CanonicalParameter): CanonicalParameter {
  const enriched = { ...param }

  // 1. Path parameters are ALWAYS required
  if (enriched.in === 'path') {
    enriched.required = true
    if (!enriched.description) {
      enriched.description = `Path parameter: ${enriched.name}`
    }
  }

  // 2. Detect authentication headers
  if (enriched.name.toLowerCase() === 'authorization') {
    enriched.required = true
    if (!enriched.description) {
      enriched.description = 'Authentication token'
    }
  }

  // 3. Detect common API key headers
  const apiKeyHeaders = ['x-api-key', 'api-key', 'apikey', 'x-api-token']
  if (apiKeyHeaders.includes(enriched.name.toLowerCase())) {
    enriched.required = true
    if (!enriched.description) {
      enriched.description = 'API key for authentication'
    }
  }

  // 4. Detect ID parameters (should be integer/number)
  if (isIdParameter(enriched.name)) {
    enriched.type = detectNumericType(enriched.example) || 'integer'
    if (!enriched.description) {
      enriched.description = `Unique identifier`
    }
  }

  // 5. Detect pagination parameters
  if (isPaginationParameter(enriched.name)) {
    enriched.type = 'integer'
    enriched.required = false
    if (enriched.name.toLowerCase() === 'page') {
      enriched.min = 1
      enriched.default = 1
      if (!enriched.description) {
        enriched.description = 'Page number for pagination (starts at 1)'
      }
    } else if (enriched.name.toLowerCase() === 'limit' || enriched.name.toLowerCase() === 'per_page') {
      enriched.min = 1
      enriched.max = 100
      enriched.default = 10
      if (!enriched.description) {
        enriched.description = 'Number of items per page'
      }
    }
  }

  // 6. Detect sorting parameters
  if (isSortParameter(enriched.name)) {
    enriched.type = 'string'
    enriched.required = false
    if (!enriched.description) {
      enriched.description = 'Sort order for results'
    }
  }

  // 7. Detect filter/search parameters
  if (isFilterParameter(enriched.name)) {
    enriched.required = false
    if (!enriched.description) {
      enriched.description = `Filter results by ${enriched.name}`
    }
  }

  // 8. Enhance type inference from example value
  if (enriched.example !== undefined && !enriched.format) {
    const detectedFormat = detectFormat(enriched.example, enriched.name)
    if (detectedFormat) {
      enriched.format = detectedFormat
    }
  }

  // 9. Refine type based on example value
  if (enriched.example !== undefined) {
    const refinedType = refineType(enriched.type, enriched.example)
    if (refinedType !== enriched.type) {
      enriched.type = refinedType
    }
  }

  return enriched
}

/**
 * Enrich a body field with smart defaults
 */
function enrichField(field: CanonicalField): CanonicalField {
  const enriched = { ...field }

  // Detect ID fields
  if (isIdParameter(enriched.name)) {
    enriched.type = detectNumericType(enriched.example) || 'integer'
    enriched.required = false // IDs usually auto-generated
  }

  // Detect email fields
  if (enriched.name.toLowerCase().includes('email')) {
    enriched.type = 'string'
    enriched.format = 'email'
    if (!enriched.description) {
      enriched.description = 'Email address'
    }
  }

  // Detect password fields
  if (enriched.name.toLowerCase().includes('password')) {
    enriched.type = 'string'
    enriched.format = 'password'
    enriched.min = 8
    if (!enriched.description) {
      enriched.description = 'Password (minimum 8 characters)'
    }
  }

  // Detect URL fields
  if (enriched.name.toLowerCase().includes('url') || enriched.name.toLowerCase().includes('link')) {
    enriched.type = 'string'
    enriched.format = 'uri'
  }

  // Detect date/time fields
  if (isDateTimeField(enriched.name)) {
    enriched.type = 'string'
    enriched.format = 'date-time'
  }

  // Detect boolean fields
  if (isBooleanField(enriched.name)) {
    enriched.type = 'boolean'
  }

  // Enhance type from example
  if (enriched.example !== undefined) {
    const detectedFormat = detectFormat(enriched.example, enriched.name)
    if (detectedFormat && !enriched.format) {
      enriched.format = detectedFormat
    }
  }

  return enriched
}

/**
 * Enrich success response based on HTTP method
 */
function enrichSuccessResponse(method: string, response: any): any {
  const enriched = { ...response }

  // Set appropriate status code based on method
  if (!enriched.status) {
    switch (method.toUpperCase()) {
      case 'POST':
        enriched.status = 201 // Created
        enriched.description = enriched.description || 'Resource created successfully'
        break
      case 'DELETE':
        enriched.status = 204 // No Content
        enriched.description = enriched.description || 'Resource deleted successfully'
        break
      default:
        enriched.status = 200 // OK
        enriched.description = enriched.description || 'Successful response'
    }
  }

  return enriched
}

/**
 * Get common error responses based on endpoint characteristics
 */
function getCommonErrorResponses(method: string, auth?: any): Array<any> {
  const errors: Array<any> = []

  // Authentication errors (if auth is required)
  if (auth && auth.type !== 'none') {
    errors.push({
      status: 401,
      reason: 'Unauthorized',
      description: 'Authentication credentials are missing or invalid',
      contentType: 'application/json',
      example: { code: 401, message: 'Unauthorized' },
    })
    errors.push({
      status: 403,
      reason: 'Forbidden',
      description: 'Authenticated but not authorized to access this resource',
      contentType: 'application/json',
      example: { code: 403, message: 'Forbidden' },
    })
  }

  // Validation errors (for POST/PUT/PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    errors.push({
      status: 400,
      reason: 'Bad Request',
      description: 'Invalid request parameters or body',
      contentType: 'application/json',
      example: { code: 400, message: 'Invalid input' },
    })
  }

  // Not found (for GET/PUT/PATCH/DELETE with ID)
  if (['GET', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    errors.push({
      status: 404,
      reason: 'Not Found',
      description: 'Resource not found',
      contentType: 'application/json',
      example: { code: 404, message: 'Resource not found' },
    })
  }

  // Server error (always possible)
  errors.push({
    status: 500,
    reason: 'Internal Server Error',
    description: 'Unexpected server error',
    contentType: 'application/json',
    example: { code: 500, message: 'Internal server error' },
  })

  return errors
}

/**
 * Calculate metadata completeness score (0-100)
 */
export function calculateMetadataCompleteness(endpoint: CanonicalEndpoint): {
  score: number
  total: number
  complete: number
  details: {
    parameters: { score: number; total: number }
    body: { score: number; total: number }
    responses: { score: number; total: number }
  }
} {
  let complete = 0
  let total = 0

  // Check parameters
  const paramsComplete = { score: 0, total: 0 }
  endpoint.request?.parameters?.forEach((param) => {
    paramsComplete.total += 4
    if (param.description) paramsComplete.score++
    if (param.required !== undefined) paramsComplete.score++
    if (param.type) paramsComplete.score++
    if (param.example !== undefined) paramsComplete.score++
  })
  complete += paramsComplete.score
  total += paramsComplete.total

  // Check body fields
  const bodyComplete = { score: 0, total: 0 }
  endpoint.request?.body?.fields?.forEach((field) => {
    bodyComplete.total += 4
    if (field.description) bodyComplete.score++
    if (field.required !== undefined) bodyComplete.score++
    if (field.type) bodyComplete.score++
    if (field.example !== undefined) bodyComplete.score++
  })
  complete += bodyComplete.score
  total += bodyComplete.total

  // Check responses
  const responsesComplete = { score: 0, total: 4 }
  if (endpoint.responses?.success?.description) responsesComplete.score++
  if (endpoint.responses?.success?.example) responsesComplete.score++
  if (endpoint.responses?.success?.fields && endpoint.responses.success.fields.length > 0)
    responsesComplete.score++
  if (endpoint.responses?.errors && endpoint.responses.errors.length > 0) responsesComplete.score++
  complete += responsesComplete.score
  total += responsesComplete.total

  const score = total > 0 ? Math.round((complete / total) * 100) : 100

  return {
    score,
    total,
    complete,
    details: {
      parameters: paramsComplete,
      body: bodyComplete,
      responses: responsesComplete,
    },
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function isIdParameter(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower === 'id' ||
    lower.endsWith('_id') ||
    lower.endsWith('id') ||
    lower.startsWith('id_') ||
    /\bid\b/i.test(name)
  )
}

function isPaginationParameter(name: string): boolean {
  const lower = name.toLowerCase()
  return ['page', 'limit', 'offset', 'per_page', 'page_size', 'size'].includes(lower)
}

function isSortParameter(name: string): boolean {
  const lower = name.toLowerCase()
  return ['sort', 'sort_by', 'order', 'order_by', 'sort_order'].includes(lower)
}

function isFilterParameter(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.startsWith('filter_') ||
    lower.includes('search') ||
    lower.includes('query') ||
    lower === 'q' ||
    lower.includes('status') ||
    lower.includes('type') ||
    lower.includes('category')
  )
}

function isDateTimeField(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.includes('date') ||
    lower.includes('time') ||
    lower.includes('at') ||
    lower === 'created' ||
    lower === 'updated' ||
    lower === 'deleted' ||
    lower === 'timestamp'
  )
}

function isBooleanField(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.startsWith('is_') ||
    lower.startsWith('has_') ||
    lower.startsWith('can_') ||
    lower.startsWith('should_') ||
    lower === 'active' ||
    lower === 'enabled' ||
    lower === 'disabled' ||
    lower === 'deleted' ||
    lower === 'published'
  )
}

/**
 * Detect format from value and name
 */
function detectFormat(value: any, _name: string): string | undefined {
  if (typeof value === 'string') {
    // Email
    if (value.includes('@') && value.includes('.')) {
      return 'email'
    }

    // URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return 'uri'
    }

    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'uuid'
    }

    // ISO Date/Time
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'date-time'
    }

    // Date only
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'date'
    }

    // Time only
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
      return 'time'
    }
  }

  return undefined
}

/**
 * Refine type based on example value
 */
function refineType(currentType: string, example: any): string {
  if (example === null || example === undefined) {
    return currentType
  }

  const actualType = typeof example

  // If example is a number
  if (actualType === 'number') {
    return Number.isInteger(example) ? 'integer' : 'number'
  }

  // If example is boolean
  if (actualType === 'boolean') {
    return 'boolean'
  }

  // If example is array
  if (Array.isArray(example)) {
    return 'array'
  }

  // If example is object
  if (actualType === 'object') {
    return 'object'
  }

  // If example is string
  if (actualType === 'string') {
    return 'string'
  }

  return currentType
}

/**
 * Detect if value should be integer or number
 */
function detectNumericType(value: any): 'integer' | 'number' | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number'
  }
  if (typeof value === 'string') {
    const num = Number(value)
    if (!isNaN(num)) {
      return Number.isInteger(num) ? 'integer' : 'number'
    }
  }
  return undefined
}
