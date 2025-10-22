/**
 * Schema Conversion Utilities
 *
 * Helper functions for converting between JSON Schema and canonical format:
 * - Generate concrete examples from schemas
 * - Flatten nested schemas to field arrays
 * - Infer types from examples
 * - Resolve $ref references
 */

import type {CanonicalField} from '@/types/canonical'

/**
 * Generate a concrete example value from a JSON Schema
 */
export function schemaToExample(schema: any, fieldName?: string): any {
  // Handle null/undefined schemas
  if (!schema || typeof schema !== 'object') {
    return fieldName ? `example-${fieldName}` : 'example-value'
  }

  // Use existing example if available
  if (schema.example !== undefined) return schema.example
  if (schema.examples && schema.examples.length > 0) return schema.examples[0]
  if (schema.default !== undefined) return schema.default

  // Generate based on type
  switch (schema.type) {
    case 'string':
      return generateStringExample(schema, fieldName)

    case 'number':
    case 'integer':
      return generateNumberExample(schema)

    case 'boolean':
      return true

    case 'array':
      if (schema.items) {
        const itemExample = schemaToExample(schema.items, fieldName)
        return [itemExample]
      }
      return []

    case 'object':
      return generateObjectExample(schema)

    case 'null':
      return null

    default:
      // Unknown type, return based on field name hint
      return fieldName ? `example-${fieldName}` : 'example-value'
  }
}

/**
 * Generate string example based on format and field name
 */
function generateStringExample(schema: any, fieldName?: string): string {
  // Check format
  if (schema.format) {
    switch (schema.format) {
      case 'date-time':
        return '2024-01-01T00:00:00.000Z'
      case 'date':
        return '2024-01-01'
      case 'time':
        return '10:30:00'
      case 'email':
        return 'user@example.com'
      case 'uuid':
        return '123e4567-e89b-12d3-a456-426614174000'
      case 'uri':
      case 'url':
        return 'https://example.com'
      case 'hostname':
        return 'example.com'
      case 'ipv4':
        return '192.168.1.1'
      case 'ipv6':
        return '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      case 'binary':
        return `${fieldName || 'file'}.jpg`
      case 'byte':
        return 'SGVsbG8gV29ybGQ='
      case 'password':
        return 'secret123'
    }
  }

  // Check enum
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0]
  }

  // Check pattern (try to generate matching value)
  if (schema.pattern) {
    // Simple pattern matching for common cases
    if (schema.pattern === '^[a-z]+$') return 'example'
    if (schema.pattern === '^[A-Z]+$') return 'EXAMPLE'
    if (schema.pattern === '^[0-9]+$') return '12345'
  }

  // Use field name as hint
  if (fieldName) {
    const lowerName = fieldName.toLowerCase()
    if (lowerName.includes('email')) return 'user@example.com'
    if (lowerName.includes('phone')) return '+1-555-0123'
    if (lowerName.includes('url') || lowerName.includes('link')) return 'https://example.com'
    if (lowerName.includes('name')) return 'Example Name'
    if (lowerName.includes('description')) return 'Example description'
    if (lowerName.includes('title')) return 'Example Title'
    if (lowerName.includes('id')) return 'abc123'
    if (lowerName.includes('code')) return 'CODE123'
    if (lowerName.includes('token')) return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    if (lowerName.includes('key')) return 'your-api-key-here'
    if (lowerName.includes('file') || lowerName.includes('image') || lowerName.includes('photo')) {
      return `${fieldName}.jpg`
    }

    return `example-${fieldName}`
  }

  return 'example-value'
}

/**
 * Generate number example
 */
function generateNumberExample(schema: any): number {
  // Use minimum if exists
  if (schema.minimum !== undefined) {
    return schema.minimum
  }

  // Use exclusiveMinimum + 1
  if (schema.exclusiveMinimum !== undefined) {
    return schema.exclusiveMinimum + 1
  }

  // Check enum
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0]
  }

  // Default values
  return schema.type === 'integer' ? 123 : 123.45
}

/**
 * Generate object example
 */
function generateObjectExample(schema: any): any {
  if (!schema.properties) {
    return {}
  }

  const obj: any = {}
  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    obj[propName] = schemaToExample(propSchema as any, propName)
  }

  return obj
}

/**
 * Flatten a JSON Schema to a canonical fields array
 *
 * Note: Pass spec as third parameter to enable $ref resolution for Swagger 2.0
 */
export function flattenSchemaToFields(
  schema: any,
  requiredFields: string[] = [],
  spec?: any
): CanonicalField[] {
  if (!schema || !schema.properties) {
    return []
  }

  const fields: CanonicalField[] = []

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    let prop = propSchema as any

    // IMPORTANT: Resolve $ref if present (for Swagger 2.0 nested object references)
    if (prop.$ref && spec) {
      const resolved = resolveSchemaRef(prop.$ref, spec)
      if (resolved) {
        prop = resolved
      }
    }

    const field: CanonicalField = {
      name: propName,
      type: prop.type || 'string',
      required: requiredFields.includes(propName),
      description: prop.description,
      format: prop.format,
      enum: prop.enum,
      pattern: prop.pattern,
      min: prop.minimum || prop.minLength,
      max: prop.maximum || prop.maxLength,
    }

    // Handle array items
    if (prop.type === 'array' && prop.items) {
      // Resolve $ref in array items if present
      let items = prop.items
      if (items.$ref && spec) {
        const resolved = resolveSchemaRef(items.$ref, spec)
        if (resolved) {
          items = resolved
        }
      }

      field.items = {
        type: items.type || 'string',
        // NOTE: Removed field.items.example - not needed, only body.example is used
      }

      // Preserve enum from items
      if (items.enum) {
        field.items.enum = items.enum
      }
    }

    // Handle nested objects
    if (prop.type === 'object' && prop.properties) {
      field.properties = flattenSchemaToFields(prop, prop.required || [], spec)
    }

    // NOTE: Removed field.example - not needed, only body.example is used
    // field.example = schemaToExample(prop, propName)

    fields.push(field)
  }

  return fields
}

/**
 * Infer type from example value (reverse operation)
 */
export function inferTypeFromExample(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'string'

  const jsType = typeof value
  switch (jsType) {
    case 'string':
      return 'string'
    case 'number':
      return Number.isInteger(value) ? 'integer' : 'number'
    case 'boolean':
      return 'boolean'
    case 'object':
      if (Array.isArray(value)) return 'array'
      return 'object'
    default:
      return 'string'
  }
}

/**
 * Infer fields from example object (no schema available)
 */
export function inferFieldsFromExample(example: any): CanonicalField[] {
  if (!example || typeof example !== 'object' || Array.isArray(example)) {
    return []
  }

  const fields: CanonicalField[] = []

  for (const [key, value] of Object.entries(example)) {
    const field: CanonicalField = {
      name: key,
      type: inferTypeFromExample(value),
      required: false, // Can't determine from example alone
      // NOTE: Removed field.example - not needed, only body.example is used
    }

    // Handle nested arrays
    if (Array.isArray(value) && value.length > 0) {
      field.items = {
        type: inferTypeFromExample(value[0]),
        // NOTE: Removed field.items.example - not needed, only body.example is used
      }
    }

    // Handle nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      field.properties = inferFieldsFromExample(value)
    }

    fields.push(field)
  }

  return fields
}

/**
 * Resolve a $ref path in a schema
 */
export function resolveSchemaRef(refPath: string, spec: any): any | null {
  if (!refPath.startsWith('#/')) {
    console.warn('[Schema Utils] Unsupported $ref format:', refPath)
    return null
  }

  const parts = refPath.slice(2).split('/') // Remove '#/' and split
  let current = spec

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      console.warn('[Schema Utils] Could not resolve $ref:', refPath)
      return null
    }
  }

  return current
}

/**
 * Merge example and schema to create enhanced field definitions
 */
export function mergeExampleAndSchema(
  example: any,
  schema: any,
  requiredFields: string[] = []
): CanonicalField[] {
  // If we have schema, use it
  if (schema && schema.properties) {
    const fields = flattenSchemaToFields(schema, requiredFields)

    // Override examples from provided example object
    if (example && typeof example === 'object') {
      for (const field of fields) {
        if (example[field.name] !== undefined) {
          field.example = example[field.name]
        }
      }
    }

    return fields
  }

  // If we only have example, infer from it
  if (example && typeof example === 'object') {
    return inferFieldsFromExample(example)
  }

  return []
}

/**
 * Extract content type from request body or response
 */
export function extractContentType(contentObj: any): string {
  if (!contentObj || !contentObj.content) {
    return 'application/json' // Default
  }

  const contentTypes = Object.keys(contentObj.content)
  if (contentTypes.length === 0) {
    return 'application/json'
  }

  // Prefer application/json if available
  if (contentTypes.includes('application/json')) {
    return 'application/json'
  }

  // Return first content type
  return contentTypes[0]
}

/**
 * Get primary example from schema/media type
 */
export function extractExample(schemaOrMediaType: any): any {
  // Handle null/undefined
  if (!schemaOrMediaType || typeof schemaOrMediaType !== 'object') {
    return undefined
  }

  // Check for direct example
  if (schemaOrMediaType.example !== undefined) {
    return schemaOrMediaType.example
  }

  // Check for examples (plural)
  if (schemaOrMediaType.examples) {
    if (Array.isArray(schemaOrMediaType.examples) && schemaOrMediaType.examples.length > 0) {
      return schemaOrMediaType.examples[0]
    }
    // OpenAPI 3.x examples object
    if (typeof schemaOrMediaType.examples === 'object') {
      const exampleKeys = Object.keys(schemaOrMediaType.examples)
      if (exampleKeys.length > 0) {
        const firstExample = schemaOrMediaType.examples[exampleKeys[0]]
        return firstExample.value !== undefined ? firstExample.value : firstExample
      }
    }
  }

  // Check in schema
  if (schemaOrMediaType.schema) {
    return extractExample(schemaOrMediaType.schema)
  }

  // Generate from schema
  if (schemaOrMediaType.type || schemaOrMediaType.properties) {
    return schemaToExample(schemaOrMediaType)
  }

  return undefined
}
