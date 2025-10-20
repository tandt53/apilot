/**
 * OpenAPI to Canonical Format Converter
 *
 * Converts OpenAPI 3.x and Swagger 2.0 specifications to canonical internal format.
 *
 * Supports both versions:
 * - OpenAPI 3.x: requestBody, components.securitySchemes
 * - Swagger 2.0: formData/body parameters, securityDefinitions
 *
 * Handles:
 * - Parameter extraction and flattening (path, query, header, formData, body)
 * - Request body conversion with examples
 * - Response extraction (success/errors)
 * - Security/Authentication conversion
 * - $ref resolution
 * - Schema to example generation
 */

import type {
    CanonicalAuth,
    CanonicalEndpoint,
    CanonicalParameter,
    CanonicalRequestBody,
    CanonicalResponses,
} from '@/types/canonical'
import {
    extractContentType,
    extractExample,
    flattenSchemaToFields,
    resolveSchemaRef,
    schemaToExample,
} from './schemaUtils'

/**
 * Main converter: OpenAPI operation → Canonical endpoint
 */
export function convertOpenAPIToCanonical(
  operation: any,
  path: string,
  method: string,
  spec: any
): Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  console.log(`[OpenAPI Converter] Converting ${method.toUpperCase()} ${path}`)

  try {
    // Check operation-level security first, then fall back to global security
    const security = operation.security !== undefined ? operation.security : spec.security;

    const result = {
      source: 'openapi' as const,
      method: method.toUpperCase(),
      path,
      name: operation.summary || `${method.toUpperCase()} ${path}`,
      description: operation.description,
      tags: operation.tags || [],
      operationId: operation.operationId,
      deprecated: operation.deprecated || false,
      request: convertRequest(operation, spec),
      responses: convertResponses(operation.responses, spec),
      auth: convertSecurity(security, spec),
    }

    console.log(`[OpenAPI Converter] ${method.toUpperCase()} ${path} - request.body.description:`, result.request?.body?.description)

    return result
  } catch (error) {
    console.error(`[OpenAPI Converter] Error converting ${method.toUpperCase()} ${path}:`, error)
    throw error
  }
}

/**
 * Convert OpenAPI parameters and request body to canonical request
 */
function convertRequest(operation: any, spec: any): any {
  const parameters = operation.parameters || []

  // Check if this is Swagger 2.0 with formData or body parameters
  const formDataParams = parameters.filter((p: any) => p.in === 'formData')
  const bodyParam = parameters.find((p: any) => p.in === 'body')

  let requestBody: any = operation.requestBody // OpenAPI 3.x
  let contentType = 'application/json'

  // Handle Swagger 2.0 formData parameters
  if (formDataParams.length > 0) {
    // Convert formData parameters to requestBody format
    requestBody = convertFormDataToRequestBody(formDataParams, spec)
    contentType = 'multipart/form-data'
  }
  // Handle Swagger 2.0 body parameter
  else if (bodyParam) {
    requestBody = convertBodyParamToRequestBody(bodyParam, spec)
    contentType = operation.consumes?.[0] || 'application/json'
  }
  // OpenAPI 3.x
  else if (operation.requestBody) {
    contentType = extractContentType(operation.requestBody)
  }

  return {
    contentType,
    parameters: convertParameters(parameters.filter((p: any) =>
      p.in !== 'body' && p.in !== 'formData' // Exclude body/formData params
    ), spec),
    body: convertRequestBody(requestBody, spec),
  }
}

/**
 * Convert OpenAPI parameters to canonical parameters
 */
function convertParameters(
  parameters: any[],
  spec: any
): CanonicalParameter[] | undefined {
  if (!parameters || parameters.length === 0) {
    return undefined
  }

  const canonicalParams: CanonicalParameter[] = []

  for (const param of parameters) {
    // Resolve $ref if present
    const resolvedParam = param.$ref
      ? resolveSchemaRef(param.$ref, spec)
      : param

    if (!resolvedParam) continue

    const schema = resolvedParam.schema || {}

    const canonicalParam: CanonicalParameter = {
      name: resolvedParam.name,
      in: resolvedParam.in,
      type: schema.type || 'string',
      required: resolvedParam.required || false,
      description: resolvedParam.description,
      example:
        resolvedParam.example ||
        extractExample(schema) ||
        schemaToExample(schema, resolvedParam.name),
      enum: schema.enum,
      pattern: schema.pattern,
      min: schema.minimum || schema.minLength,
      max: schema.maximum || schema.maxLength,
      default: schema.default,
      format: schema.format,
    }

    // Handle array type
    if (schema.type === 'array' && schema.items) {
      canonicalParam.items = {
        type: schema.items.type || 'string',
        example: schemaToExample(schema.items),
      }
    }

    canonicalParams.push(canonicalParam)
  }

  return canonicalParams.length > 0 ? canonicalParams : undefined
}

/**
 * Convert OpenAPI request body to canonical format
 */
function convertRequestBody(
  requestBody: any,
  spec: any
): CanonicalRequestBody | undefined {
  if (!requestBody) {
    return undefined
  }

  // Resolve $ref
  const resolvedBody = requestBody.$ref
    ? resolveSchemaRef(requestBody.$ref, spec)
    : requestBody

  if (!resolvedBody) {
    return undefined
  }

  const contentType = extractContentType(resolvedBody)
  const mediaType = resolvedBody.content?.[contentType] || {}
  const schema = mediaType.schema
    ? resolveSchemaIfRef(mediaType.schema, spec)
    : null

  // Extract or generate example
  let example: any
  if (mediaType.example !== undefined) {
    example = mediaType.example
  } else if (mediaType.examples) {
    // Get first example from examples object
    const exampleKeys = Object.keys(mediaType.examples)
    if (exampleKeys.length > 0) {
      const firstExample = mediaType.examples[exampleKeys[0]]
      example = firstExample.value !== undefined ? firstExample.value : firstExample
    }
  } else if (schema) {
    example = schemaToExample(schema)
  }

  // Generate fields from schema
  const fields = schema
    ? flattenSchemaToFields(schema, schema.required || [])
    : []

  // Merge example values into fields
  if (example && typeof example === 'object' && !Array.isArray(example)) {
    for (const field of fields) {
      if (example[field.name] !== undefined) {
        field.example = example[field.name]
      }
    }
  }

  // For multipart/form-data and application/x-www-form-urlencoded,
  // don't show JSON object as example (causes AI confusion)
  // The fields array already contains individual field examples
  const isFormData = contentType === 'multipart/form-data' ||
                     contentType === 'application/x-www-form-urlencoded'

  const result = {
    required: resolvedBody.required || false,
    description: resolvedBody.description,
    example: isFormData ? undefined : example,  // Hide example for form data
    fields,
  }

  console.log('[OpenAPI Converter] Request body description:', result.description)

  return result
}

/**
 * Convert OpenAPI responses to canonical format (success + errors)
 */
function convertResponses(responses: any, spec: any): CanonicalResponses {
  if (!responses) {
    return {
      success: {
        status: 200,
      },
    }
  }

  // Find success response (200, 201, 204)
  const successResponse = extractSuccessResponse(responses, spec)

  // Find error responses (4xx, 5xx)
  const errorResponses = extractErrorResponses(responses, spec)

  return {
    success: successResponse,
    errors: errorResponses.length > 0 ? errorResponses : undefined,
  }
}

/**
 * Extract primary success response
 */
function extractSuccessResponse(responses: any, spec: any): any {
  const successCodes = ['200', '201', '204']

  for (const code of successCodes) {
    if (responses[code]) {
      const response = responses[code].$ref
        ? resolveSchemaRef(responses[code].$ref, spec)
        : responses[code]

      if (!response) continue

      const contentType = extractContentType(response)
      const content = response.content?.[contentType]
      const schema = content?.schema
        ? resolveSchemaIfRef(content.schema, spec)
        : null

      // Extract example
      const example =
        content?.example ||
        extractExample(content) ||
        (schema ? schemaToExample(schema) : undefined)

      // Generate fields
      const fields = schema
        ? flattenSchemaToFields(schema, schema.required || []).map(f => ({
            name: f.name,
            type: f.type,
            description: f.description,
          }))
        : undefined

      return {
        status: parseInt(code),
        description: response.description,
        contentType,
        example,
        fields,
        headers: extractResponseHeaders(response.headers),
      }
    }
  }

  // No success response found, return default
  return {
    status: 200,
    description: 'Success',
  }
}

/**
 * Extract error responses
 */
function extractErrorResponses(responses: any, spec: any): any[] {
  const errors: any[] = []

  for (const [code, responseRef] of Object.entries(responses)) {
    const statusCode = parseInt(code)

    // Skip non-numeric codes (like "default") and non-error codes
    if (isNaN(statusCode) || statusCode < 400 || statusCode >= 600) {
      continue
    }

    const response = (responseRef as any).$ref
      ? resolveSchemaRef((responseRef as any).$ref, spec)
      : responseRef

    if (!response) continue

    const contentType = extractContentType(response)
    const content = response.content?.[contentType]
    const schema = content?.schema
      ? resolveSchemaIfRef(content.schema, spec)
      : null

    // Extract example
    const example =
      content?.example ||
      extractExample(content) ||
      (schema ? schemaToExample(schema) : undefined)

    errors.push({
      status: statusCode,
      reason: response.description || getDefaultErrorReason(statusCode),
      description: response.description,
      contentType,
      example,
    })
  }

  return errors
}

/**
 * Extract response headers
 */
function extractResponseHeaders(headers: any): any[] | undefined {
  if (!headers || Object.keys(headers).length === 0) {
    return undefined
  }

  const headerArray: any[] = []

  for (const [name, header] of Object.entries(headers)) {
    const h = header as any
    headerArray.push({
      name,
      type: h.schema?.type || 'string',
      description: h.description,
      example: h.example || (h.schema ? schemaToExample(h.schema) : undefined),
    })
  }

  return headerArray
}

/**
 * Convert OpenAPI security to canonical auth
 */
function convertSecurity(
  security: any[],
  spec: any
): CanonicalAuth | undefined {
  if (!security || security.length === 0) {
    return undefined
  }

  // Get first security requirement
  const secReq = security[0]
  const schemeName = Object.keys(secReq)[0]

  if (!schemeName) {
    return undefined
  }

  // Look up scheme in components.securitySchemes (OpenAPI 3.x) or securityDefinitions (Swagger 2.0)
  const securitySchemes = spec.components?.securitySchemes || spec.securityDefinitions || {}
  const scheme = securitySchemes[schemeName]

  if (!scheme) {
    console.warn(`[OpenAPI Converter] Security scheme "${schemeName}" not found in spec`)
    return undefined
  }

  const auth: CanonicalAuth = {
    required: true,
    type: mapSecurityType(scheme.type, scheme.scheme),
    scheme: scheme.scheme,
    bearerFormat: scheme.bearerFormat,
    in: scheme.in,
    name: scheme.name || schemeName,
    description: scheme.description,
    example: generateAuthExample(scheme),
  }

  return auth
}

/**
 * Map OpenAPI security type to canonical type
 */
function mapSecurityType(type: string, scheme?: string): any {
  if (type === 'http') {
    return scheme === 'bearer' ? 'bearer' : 'basic'
  }
  if (type === 'apiKey') {
    return 'apiKey'
  }
  if (type === 'oauth2') {
    return 'oauth2'
  }
  return 'none'
}

/**
 * Generate example auth value
 */
function generateAuthExample(scheme: any): string {
  if (scheme.type === 'http' && scheme.scheme === 'bearer') {
    return 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
  if (scheme.type === 'http' && scheme.scheme === 'basic') {
    return 'Basic dXNlcm5hbWU6cGFzc3dvcmQ='
  }
  if (scheme.type === 'apiKey') {
    return 'your-api-key-here'
  }
  return ''
}

/**
 * Get default error reason for status code
 */
function getDefaultErrorReason(statusCode: number): string {
  const reasons: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  }

  return reasons[statusCode] || 'Error'
}

/**
 * Convert Swagger 2.0 formData parameters to requestBody format
 */
function convertFormDataToRequestBody(formDataParams: any[], spec: any): any {
  // Create a schema with properties from formData parameters
  const properties: any = {}
  const required: string[] = []

  for (const param of formDataParams) {
    const resolvedParam = param.$ref ? resolveSchemaRef(param.$ref, spec) : param
    if (!resolvedParam) continue

    properties[resolvedParam.name] = {
      type: resolvedParam.type || 'string',
      format: resolvedParam.format,
      description: resolvedParam.description,
      example: resolvedParam.example,
      enum: resolvedParam.enum,
      default: resolvedParam.default,
    }

    if (resolvedParam.required) {
      required.push(resolvedParam.name)
    }
  }

  return {
    required: required.length > 0,
    description: 'Form data',
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties,
          required,
        },
      },
    },
  }
}

/**
 * Convert Swagger 2.0 body parameter to requestBody format
 */
function convertBodyParamToRequestBody(bodyParam: any, spec: any): any {
  const resolvedParam = bodyParam.$ref ? resolveSchemaRef(bodyParam.$ref, spec) : bodyParam
  if (!resolvedParam) return undefined

  const schema = resolvedParam.schema ? resolveSchemaIfRef(resolvedParam.schema, spec) : null

  return {
    required: resolvedParam.required || false,
    description: resolvedParam.description,
    content: {
      'application/json': {
        schema,
      },
    },
  }
}

/**
 * Resolve schema if it's a $ref, otherwise return as-is
 */
function resolveSchemaIfRef(schema: any, spec: any): any {
  if (!schema) {
    return null
  }
  if (schema.$ref) {
    return resolveSchemaRef(schema.$ref, spec)
  }
  return schema
}
