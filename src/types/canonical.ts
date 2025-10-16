/**
 * Canonical Endpoint Format
 *
 * Universal internal structure that all input formats (OpenAPI, cURL, Postman, HAR, manual)
 * convert to. This format is used throughout the app for:
 * - Database storage
 * - UI display
 * - AI prompt generation
 * - Test case generation
 * - Export to various formats
 *
 * Design Principles:
 * - Flat structure (minimal nesting)
 * - Concrete examples + field definitions together
 * - Constraints at field level (no separate rules)
 * - Single parameters array with 'in' discriminator
 * - Success/error response pattern (not status code keys)
 */

/**
 * Parameter (path, query, header, cookie)
 */
export interface CanonicalParameter {
  name: string                      // "id" | "limit" | "Authorization"
  in: 'path' | 'query' | 'header' | 'cookie'
  type: string                      // "string" | "integer" | "boolean" | "number" | "array"
  required: boolean
  description?: string
  example: any                      // Concrete example value (e.g., 123, "test", true)

  // Validation constraints (flattened)
  enum?: any[]                      // Allowed values
  pattern?: string                  // Regex pattern
  min?: number                      // minimum (numbers) or minLength (strings)
  max?: number                      // maximum (numbers) or maxLength (strings)
  default?: any                     // Default value
  format?: string                   // "date-time" | "email" | "uuid" | "uri" | etc.

  // For array types
  items?: {
    type: string
    example?: any
  }
}

/**
 * Body Field Definition
 */
export interface CanonicalField {
  name: string                      // Field name
  type: string                      // "string" | "integer" | "boolean" | "number" | "file" | "array" | "object"
  required: boolean
  description?: string
  format?: string                   // "binary" | "email" | "date-time" | "uuid" | etc.

  // Validation constraints
  enum?: any[]
  pattern?: string
  min?: number
  max?: number

  // For nested types
  items?: {                         // If type is "array"
    type: string
    example?: any
  }
  properties?: CanonicalField[]     // If type is "object" (nested fields)

  // Example value for this field
  example?: any
}

/**
 * Request Body
 */
export interface CanonicalRequestBody {
  required: boolean
  description?: string

  // Concrete example (primary - ready to use)
  example: any                      // {name: "John", age: 30, photo: "file.jpg"}

  // Field definitions (for validation, documentation, UI)
  fields: CanonicalField[]
}

/**
 * Request Specification
 */
export interface CanonicalRequest {
  // Content-Type (single, explicit)
  contentType: string               // "application/json" | "multipart/form-data" | "application/x-www-form-urlencoded"

  // All parameters (unified array)
  parameters?: CanonicalParameter[]

  // Request body (if exists)
  body?: CanonicalRequestBody
}

/**
 * Success Response
 */
export interface CanonicalSuccessResponse {
  status: number                    // 200 | 201 | 204
  description?: string
  contentType?: string              // "application/json" | "application/xml"

  // Concrete example (ready for assertions)
  example?: any                     // {id: 1, name: "John", email: "john@example.com"}

  // Field definitions (for understanding structure) - uses CanonicalField to support nesting
  fields?: CanonicalField[]

  // Response headers
  headers?: Array<{
    name: string
    type: string
    description?: string
    example?: any
  }>
}

/**
 * Error Response
 */
export interface CanonicalErrorResponse {
  status: number                    // 400 | 401 | 404 | 500
  reason: string                    // "Invalid input" | "Not found" | "Unauthorized"
  description?: string
  contentType?: string

  // Example error response
  example?: any                     // {code: 400, message: "Invalid input"}
}

/**
 * Response Specification
 */
export interface CanonicalResponses {
  // Primary success response (200/201/204)
  success: CanonicalSuccessResponse

  // Error responses (4xx, 5xx)
  errors?: CanonicalErrorResponse[]
}

/**
 * Authentication/Authorization
 */
export interface CanonicalAuth {
  required: boolean
  type: 'bearer' | 'apiKey' | 'basic' | 'oauth2' | 'none'
  scheme?: string                   // "bearer" | "basic" (for HTTP auth)
  bearerFormat?: string             // "JWT"
  in?: 'header' | 'query' | 'cookie' // For apiKey
  name?: string                     // "Authorization" | "X-API-Key"
  description?: string
  example?: string                  // "Bearer eyJhbGc..." | "your-api-key-here"
}

/**
 * Canonical Endpoint (Complete)
 *
 * This is the universal internal format stored in the database
 * and used throughout the application.
 */
export interface CanonicalEndpoint {
  // Identity & Metadata
  id?: number                       // Database ID
  specId: number                    // Parent spec/collection ID
  source: 'openapi' | 'curl' | 'postman' | 'har' | 'manual' | 'ai'

  // Basic Info
  method: string                    // "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
  path: string                      // "/users/{id}" (with template variables)
  name: string                      // Human-readable name/summary
  description?: string              // Full description
  tags?: string[]                   // For organization/categorization
  operationId?: string              // Original OpenAPI operationId (if from OpenAPI)

  // Request Specification
  request: CanonicalRequest

  // Response Specification
  responses: CanonicalResponses

  // Authentication
  auth?: CanonicalAuth

  // Metadata
  createdAt: Date
  updatedAt: Date
  createdBy: 'import' | 'ai' | 'manual'

  // Deprecated flag (for OpenAPI)
  deprecated?: boolean
}

/**
 * Type guards
 */
export function isCanonicalEndpoint(obj: any): obj is CanonicalEndpoint {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.method === 'string' &&
    typeof obj.path === 'string' &&
    typeof obj.name === 'string' &&
    obj.request &&
    typeof obj.request === 'object' &&
    obj.responses &&
    typeof obj.responses === 'object'
  )
}

/**
 * Helper to create empty canonical endpoint
 */
export function createEmptyCanonicalEndpoint(
  specId: number,
  method: string = 'GET',
  path: string = '/'
): CanonicalEndpoint {
  return {
    specId,
    source: 'manual',
    method: method.toUpperCase(),
    path,
    name: `${method.toUpperCase()} ${path}`,
    request: {
      contentType: 'application/json',
    },
    responses: {
      success: {
        status: 200,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'manual',
  }
}
