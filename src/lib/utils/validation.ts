/**
 * Reusable Validation Utilities
 * Centralized validation functions for form inputs across the application
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Variable name validation
 * Rules: Must start with letter or underscore, contain only alphanumeric and underscores, 1-50 chars
 */
export function validateVariableName(name: string): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Variable name is required' }
  }

  const trimmed = name.trim()

  if (trimmed.length > 50) {
    return { isValid: false, error: 'Variable name too long (max 50 characters)' }
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Variable name must start with a letter or underscore, and contain only letters, numbers, and underscores'
    }
  }

  return { isValid: true }
}

/**
 * URL validation
 * Validates that a string is a valid URL with http/https protocol
 */
export function validateUrl(url: string, required: boolean = false): ValidationResult {
  if (!url || !url.trim()) {
    if (required) {
      return { isValid: false, error: 'URL is required' }
    }
    return { isValid: true }
  }

  const trimmed = url.trim()

  try {
    const urlObj = new URL(trimmed)

    // Check for valid protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: 'URL must use http:// or https:// protocol'
      }
    }

    return { isValid: true }
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format (e.g., https://api.example.com)'
    }
  }
}

/**
 * Semantic version validation
 * Validates semver format: MAJOR.MINOR.PATCH[-prerelease]
 */
export function validateSemver(version: string): ValidationResult {
  if (!version || !version.trim()) {
    return { isValid: false, error: 'Version is required' }
  }

  const trimmed = version.trim()

  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Version must be in semantic format (e.g., 1.0.0 or 1.0.0-beta.1)'
    }
  }

  return { isValid: true }
}

/**
 * JSONPath validation
 * Validates basic JSONPath syntax
 */
export function validateJsonPath(path: string): ValidationResult {
  if (!path || !path.trim()) {
    return { isValid: false, error: 'JSONPath is required' }
  }

  const trimmed = path.trim()

  if (!trimmed.startsWith('$')) {
    return {
      isValid: false,
      error: 'JSONPath must start with $ (e.g., $.data.id or $.items[0].name)'
    }
  }

  // Check for common syntax errors
  if (trimmed.includes('..') && !trimmed.includes('[')) {
    // Recursive descent without proper syntax
    return {
      isValid: false,
      error: 'Invalid JSONPath syntax'
    }
  }

  // Check for unmatched brackets
  const openBrackets = (trimmed.match(/\[/g) || []).length
  const closeBrackets = (trimmed.match(/\]/g) || []).length
  if (openBrackets !== closeBrackets) {
    return {
      isValid: false,
      error: 'Unmatched brackets in JSONPath'
    }
  }

  return { isValid: true }
}

/**
 * HTTP header name validation
 * Validates header names according to HTTP specification
 */
export function validateHeaderName(name: string): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Header name is required' }
  }

  const trimmed = name.trim()

  // HTTP header names: alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Header name can only contain letters, numbers, hyphens, and underscores'
    }
  }

  return { isValid: true }
}

/**
 * API path validation
 * Validates that a path starts with / and has valid format
 */
export function validateApiPath(path: string): ValidationResult {
  if (!path || !path.trim()) {
    return { isValid: false, error: 'Path is required' }
  }

  const trimmed = path.trim()

  if (!trimmed.startsWith('/')) {
    return {
      isValid: false,
      error: 'Path must start with / (e.g., /api/users or /pet/{petId})'
    }
  }

  // Check for valid path parameter syntax
  const openBraces = (trimmed.match(/\{/g) || []).length
  const closeBraces = (trimmed.match(/\}/g) || []).length
  if (openBraces !== closeBraces) {
    return {
      isValid: false,
      error: 'Unmatched braces in path parameters'
    }
  }

  return { isValid: true }
}

/**
 * Parameter/field name validation
 * For API parameters and body field names
 */
export function validateParameterName(name: string): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Parameter name is required' }
  }

  const trimmed = name.trim()

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Parameter name too long (max 100 characters)' }
  }

  // Allow alphanumeric, underscore, hyphen, and dot (for nested params)
  if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Parameter name must start with a letter or underscore, and contain only letters, numbers, underscores, hyphens, and dots'
    }
  }

  return { isValid: true }
}

/**
 * OpenAI API key validation
 * Format: sk-... (legacy) or sk-proj-... (new format)
 */
export function validateOpenAIKey(key: string, required: boolean = false): ValidationResult {
  if (!key || !key.trim()) {
    if (required) {
      return { isValid: false, error: 'API key is required' }
    }
    return { isValid: true }
  }

  const trimmed = key.trim()

  if (!trimmed.startsWith('sk-')) {
    return {
      isValid: false,
      error: 'OpenAI API key must start with "sk-"'
    }
  }

  if (trimmed.length < 20) {
    return {
      isValid: false,
      error: 'API key appears to be too short'
    }
  }

  return { isValid: true }
}

/**
 * Anthropic API key validation
 * Format: sk-ant-...
 */
export function validateAnthropicKey(key: string, required: boolean = false): ValidationResult {
  if (!key || !key.trim()) {
    if (required) {
      return { isValid: false, error: 'API key is required' }
    }
    return { isValid: true }
  }

  const trimmed = key.trim()

  if (!trimmed.startsWith('sk-ant-')) {
    return {
      isValid: false,
      error: 'Anthropic API key must start with "sk-ant-"'
    }
  }

  if (trimmed.length < 20) {
    return {
      isValid: false,
      error: 'API key appears to be too short'
    }
  }

  return { isValid: true }
}

/**
 * Google Gemini API key validation
 * Format: AI... (starts with AI)
 */
export function validateGeminiKey(key: string, required: boolean = false): ValidationResult {
  if (!key || !key.trim()) {
    if (required) {
      return { isValid: false, error: 'API key is required' }
    }
    return { isValid: true }
  }

  const trimmed = key.trim()

  if (!trimmed.startsWith('AI')) {
    return {
      isValid: false,
      error: 'Gemini API key must start with "AI"'
    }
  }

  if (trimmed.length < 20) {
    return {
      isValid: false,
      error: 'API key appears to be too short'
    }
  }

  return { isValid: true }
}

/**
 * Text length validation
 * Generic validation for text fields with min/max constraints
 */
export function validateTextLength(
  text: string,
  options: {
    fieldName: string
    required?: boolean
    minLength?: number
    maxLength?: number
  }
): ValidationResult {
  const { fieldName, required = false, minLength, maxLength } = options

  if (!text || !text.trim()) {
    if (required) {
      return { isValid: false, error: `${fieldName} is required` }
    }
    return { isValid: true }
  }

  const trimmed = text.trim()

  if (minLength !== undefined && trimmed.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} character${minLength > 1 ? 's' : ''}`
    }
  }

  if (maxLength !== undefined && trimmed.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${maxLength} character${maxLength > 1 ? 's' : ''}`
    }
  }

  return { isValid: true }
}

/**
 * Number range validation
 * Validates that a number is within a specified range
 */
export function validateNumberRange(
  value: number | string,
  options: {
    fieldName: string
    min?: number
    max?: number
    integer?: boolean
  }
): ValidationResult {
  const { fieldName, min, max, integer = false } = options

  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` }
  }

  if (integer && !Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} must be an integer` }
  }

  if (min !== undefined && num < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min}`
    }
  }

  if (max !== undefined && num > max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${max}`
    }
  }

  return { isValid: true }
}

/**
 * JSON validation
 * Validates that a string is valid JSON
 */
export function validateJson(jsonString: string, required: boolean = false): ValidationResult {
  if (!jsonString || !jsonString.trim()) {
    if (required) {
      return { isValid: false, error: 'JSON content is required' }
    }
    return { isValid: true }
  }

  try {
    JSON.parse(jsonString)
    return { isValid: true }
  } catch (error: any) {
    return {
      isValid: false,
      error: `Invalid JSON: ${error.message || 'Syntax error'}`
    }
  }
}

/**
 * Generic duplicate detection
 * Checks if an item at a specific index has a duplicate in the array
 */
export function hasDuplicate<T>(
  items: T[],
  getKey: (item: T) => string,
  currentIndex: number
): boolean {
  const key = getKey(items[currentIndex])
  return items.some((item, i) => i !== currentIndex && getKey(item) === key)
}

/**
 * Duplicate name detection with error message
 */
export function validateNoDuplicateName(
  items: Array<{ name: string }>,
  currentIndex: number,
  fieldName: string = 'Name'
): ValidationResult {
  const isDuplicate = hasDuplicate(
    items,
    (item) => item.name.toLowerCase().trim(),
    currentIndex
  )

  if (isDuplicate) {
    return {
      isValid: false,
      error: `${fieldName} already exists. Please use a unique name.`
    }
  }

  return { isValid: true }
}

/**
 * Reserved keyword validation
 * Prevents use of reserved variable names
 */
const RESERVED_KEYWORDS = [
  'baseurl',
  'undefined',
  'null',
  'true',
  'false',
  'if',
  'else',
  'for',
  'while',
  'return',
  'function',
  'var',
  'let',
  'const',
  'class',
  'import',
  'export',
]

export function validateNotReservedKeyword(name: string): ValidationResult {
  const trimmed = name.trim().toLowerCase()

  if (RESERVED_KEYWORDS.includes(trimmed)) {
    return {
      isValid: false,
      error: `"${name}" is a reserved keyword and cannot be used`
    }
  }

  return { isValid: true }
}

/**
 * Combined validation runner
 * Runs multiple validation functions and returns the first error
 */
export function runValidations(
  ...validators: Array<() => ValidationResult>
): ValidationResult {
  for (const validator of validators) {
    const result = validator()
    if (!result.isValid) {
      return result
    }
  }
  return { isValid: true }
}
