/**
 * Variable Validation Utilities
 * Validates environment variables for cyclic references before saving
 */

import { replaceVariables } from './variableSubstitution'

export interface ValidationResult {
  valid: boolean
  errors: Array<{
    variable: string
    message: string
  }>
}

/**
 * Validate a set of variables for cyclic references
 * Returns validation result with details of any issues found
 */
export function validateVariables(variables: Record<string, string>): ValidationResult {
  const errors: Array<{ variable: string; message: string }> = []

  // Check each variable for cycles
  for (const [key, value] of Object.entries(variables)) {
    // Skip empty values
    if (!value || typeof value !== 'string') continue

    // Check if value contains variables
    if (!/\{\{[^}]+\}\}/.test(value)) continue

    // Try to resolve this variable
    try {
      replaceVariables(`{{${key}}}`, variables)
    } catch (error: any) {
      // Cycle detected
      if (error.message.includes('Cyclic variable reference')) {
        errors.push({
          variable: key,
          message: error.message
        })
      } else {
        // Other error (shouldn't happen, but just in case)
        errors.push({
          variable: key,
          message: `Validation error: ${error.message}`
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format validation errors for display to user
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) return ''

  // Get unique variable names involved in cycles
  const cyclicVars = result.errors.map(err => err.variable)

  if (cyclicVars.length === 1) {
    return `Variable "${cyclicVars[0]}" references itself.`
  }

  return `Cyclic reference detected:\n${cyclicVars.map(v => `  • ${v}`).join('\n')}`
}
