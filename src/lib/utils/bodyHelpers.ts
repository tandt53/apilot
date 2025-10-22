/**
 * Body Schema/Example Helper Functions
 *
 * Utilities for working with request body schemas and examples in the canonical format.
 */

import type { CanonicalField } from '@/types/canonical'

/**
 * Build a default request body object from a field schema
 *
 * Uses sensible defaults for each type:
 * - integer/number → 0
 * - string → field name (as placeholder)
 * - boolean → true
 * - array → []
 * - object → {} or recursively build from properties
 *
 * @param fields Field schema array
 * @returns Default body object
 */
export function buildBodyFromSchema(fields: CanonicalField[]): any {
  if (!fields || fields.length === 0) {
    return {}
  }

  const obj: any = {}

  fields.forEach((field) => {
    if (field.type === 'integer' || field.type === 'number') {
      obj[field.name] = 0
    } else if (field.type === 'boolean') {
      obj[field.name] = true
    } else if (field.type === 'array') {
      // If array has item properties, create array with one sample object
      if (field.items?.properties && field.items.properties.length > 0) {
        obj[field.name] = [buildBodyFromSchema(field.items.properties)]
      } else {
        obj[field.name] = []
      }
    } else if (field.type === 'object') {
      // Recursively build nested object
      if (field.properties && field.properties.length > 0) {
        obj[field.name] = buildBodyFromSchema(field.properties)
      } else {
        obj[field.name] = {}
      }
    } else {
      // Default for string and other types: use field name as placeholder
      obj[field.name] = field.name
    }
  })

  return obj
}

/**
 * Validate if body example keys match field schema names
 *
 * Checks for:
 * - Missing keys (in schema but not in example)
 * - Extra keys (in example but not in schema)
 *
 * @param example Body example object
 * @param fields Field schema array
 * @returns Validation result with missing/extra keys
 */
export function validateBodyConsistency(
  example: any,
  fields: CanonicalField[]
): {
  isValid: boolean
  missing: string[]  // Field names in schema but not in example
  extra: string[]    // Keys in example but not in schema
} {
  // Handle edge cases
  if (!example || typeof example !== 'object') {
    return {
      isValid: fields.length === 0,
      missing: fields.map((f) => f.name),
      extra: [],
    }
  }

  if (!fields || fields.length === 0) {
    const exampleKeys = Object.keys(example)
    return {
      isValid: exampleKeys.length === 0,
      missing: [],
      extra: exampleKeys,
    }
  }

  const exampleKeys = Object.keys(example)
  const fieldNames = fields.map((f) => f.name)

  const missing = fieldNames.filter((name) => !exampleKeys.includes(name))
  const extra = exampleKeys.filter((key) => !fieldNames.includes(key))

  return {
    isValid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  }
}

/**
 * Check if body example keys match schema field names
 *
 * Simple boolean check for use in RequestTester
 *
 * @param example Body example object
 * @param fields Field schema array
 * @returns True if all schema fields are present in example (ignores extra keys)
 */
export function bodyMatchesSchema(example: any, fields: CanonicalField[]): boolean {
  if (!example || typeof example !== 'object' || !fields || fields.length === 0) {
    return false
  }

  const exampleKeys = new Set(Object.keys(example))
  const fieldNames = fields.map((f) => f.name)

  // Check if all schema fields are present in example
  return fieldNames.every((name) => exampleKeys.has(name))
}
