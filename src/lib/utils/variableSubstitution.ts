/**
 * Variable Substitution Utility
 * Replaces {{variableName}} placeholders with actual values from environment
 */

/**
 * Replace variables in a string value
 * Supports nested variables like {{baseUrl}}/users/{{userId}}
 * Detects cyclic references and throws an error
 */
export function replaceVariables(
  value: string,
  variables: Record<string, string> = {},
  options: { keepUnresolved?: boolean; _resolving?: Set<string> } = {}
): string {
  if (!value || typeof value !== 'string') {
    return value
  }

  const { keepUnresolved = true, _resolving = new Set() } = options

  // Replace all {{variableName}} patterns
  return value.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmedName = varName.trim()

    // Detect cyclic references
    if (_resolving.has(trimmedName)) {
      throw new Error(`Cyclic variable reference detected: ${trimmedName}`)
    }

    // Check if variable exists
    if (trimmedName in variables) {
      const varValue = variables[trimmedName]

      // If value contains variables, recursively resolve with cycle tracking
      if (hasVariables(varValue)) {
        // Add to resolving set to detect cycles
        const newResolving = new Set(_resolving)
        newResolving.add(trimmedName)

        const resolved = replaceVariables(varValue, variables, {
          keepUnresolved,
          _resolving: newResolving
        })
        return resolved
      }

      return String(varValue)
    }

    // If variable not found, either keep placeholder or replace with 'undefined'
    return keepUnresolved ? match : 'undefined'
  })
}

/**
 * Replace variables in an object (deep replacement)
 */
export function replaceVariablesInObject(
  obj: any,
  variables: Record<string, string> = {},
  options: { keepUnresolved?: boolean } = {}
): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle string values
  if (typeof obj === 'string') {
    return replaceVariables(obj, variables, options)
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => replaceVariablesInObject(item, variables, options))
  }

  // Handle objects
  if (typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceVariablesInObject(value, variables, options)
    }
    return result
  }

  // Return primitives as-is (numbers, booleans, etc.)
  return obj
}

/**
 * Replace variables in headers
 */
export function replaceVariablesInHeaders(
  headers: Record<string, string> = {},
  variables: Record<string, string> = {},
  options: { keepUnresolved?: boolean } = {}
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    result[key] = replaceVariables(value, variables, options)
  }

  return result
}

/**
 * Extract all variable names from a string
 * Example: "{{baseUrl}}/users/{{userId}}" -> ["baseUrl", "userId"]
 */
export function extractVariableNames(value: string): string[] {
  if (!value || typeof value !== 'string') {
    return []
  }

  const matches = value.matchAll(/\{\{([^}]+)\}\}/g)
  const names: string[] = []

  for (const match of matches) {
    const varName = match[1].trim()
    if (!names.includes(varName)) {
      names.push(varName)
    }
  }

  return names
}

/**
 * Check if a string contains any variables
 */
export function hasVariables(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  return /\{\{[^}]+\}\}/.test(value)
}

/**
 * Validate that all variables in a string can be resolved
 * Returns array of missing variable names
 */
export function findMissingVariables(
  value: string,
  variables: Record<string, string> = {}
): string[] {
  const allVars = extractVariableNames(value)
  return allVars.filter(varName => !(varName in variables))
}
