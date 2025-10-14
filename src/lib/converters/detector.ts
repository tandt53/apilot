/**
 * Format Detection for Multi-Source Import
 *
 * Automatically detects the format of imported API specifications:
 * - OpenAPI 3.x (JSON/YAML)
 * - Swagger 2.0 (JSON/YAML)
 * - Postman Collection v2.x (JSON)
 * - cURL command (text)
 */

export type ImportFormat = 'openapi' | 'swagger' | 'postman' | 'curl' | 'unknown'

export interface DetectionResult {
  format: ImportFormat
  version?: string
  confidence: number // 0-1 (1 = certain)
  details?: string
}

/**
 * Detect format from content
 */
export function detectFormat(content: string): DetectionResult {
  // Trim whitespace
  const trimmed = content.trim()

  // Try to detect cURL first (text-based, doesn't need JSON parsing)
  if (isCurlCommand(trimmed)) {
    return {
      format: 'curl',
      confidence: 1.0,
      details: 'Detected cURL command',
    }
  }

  // Try to parse as JSON
  let parsed: any
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    // If not JSON, might be YAML (future support)
    return {
      format: 'unknown',
      confidence: 0,
      details: 'Not valid JSON and not a cURL command',
    }
  }

  // Detect OpenAPI 3.x
  if (parsed.openapi && typeof parsed.openapi === 'string') {
    const version = parsed.openapi
    return {
      format: 'openapi',
      version,
      confidence: 1.0,
      details: `OpenAPI ${version} specification`,
    }
  }

  // Detect Swagger 2.0
  if (parsed.swagger && parsed.swagger === '2.0') {
    return {
      format: 'swagger',
      version: '2.0',
      confidence: 1.0,
      details: 'Swagger 2.0 specification',
    }
  }

  // Detect Postman Collection v2.x
  if (isPostmanCollection(parsed)) {
    const version = parsed.info?.schema || '2.1.0'
    return {
      format: 'postman',
      version,
      confidence: 1.0,
      details: `Postman Collection ${version}`,
    }
  }

  // Unknown format
  return {
    format: 'unknown',
    confidence: 0,
    details: 'Could not determine format',
  }
}

/**
 * Check if content is a cURL command
 */
function isCurlCommand(content: string): boolean {
  const trimmed = content.trim()

  // Check for curl command at start
  if (trimmed.startsWith('curl ') || trimmed.startsWith('curl\n') || trimmed.startsWith('curl\r\n')) {
    return true
  }

  // Check for multiline curl with backslashes
  if (/^curl\s+[\\]?\s*$/m.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Check if parsed JSON is a Postman Collection
 */
function isPostmanCollection(parsed: any): boolean {
  // Postman Collection has these characteristics:
  // 1. Has "info" object with "name" and "_postman_id" or "schema"
  // 2. Has "item" array containing requests

  if (!parsed.info || typeof parsed.info !== 'object') {
    return false
  }

  // Check for Postman-specific fields
  const hasPostmanId = '_postman_id' in parsed.info
  const hasSchema = 'schema' in parsed.info && typeof parsed.info.schema === 'string'
  const hasName = 'name' in parsed.info

  if (!hasName) {
    return false
  }

  // Must have either _postman_id or schema URL
  if (!hasPostmanId && !hasSchema) {
    return false
  }

  // Check for schema URL pattern
  if (hasSchema && parsed.info.schema.includes('postman')) {
    return true
  }

  // Has item array (requests)
  if (!Array.isArray(parsed.item)) {
    return false
  }

  return true
}

/**
 * Validate format-specific structure
 */
export function validateFormat(content: string, expectedFormat: ImportFormat): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    const detection = detectFormat(content)

    if (detection.format !== expectedFormat) {
      errors.push(`Expected ${expectedFormat} but detected ${detection.format}`)
      return { valid: false, errors }
    }

    // Format-specific validation
    switch (expectedFormat) {
      case 'openapi':
      case 'swagger':
        return validateOpenAPIStructure(content)

      case 'postman':
        return validatePostmanStructure(content)

      case 'curl':
        return validateCurlStructure(content)

      default:
        errors.push(`Unknown format: ${expectedFormat}`)
        return { valid: false, errors }
    }
  } catch (error: any) {
    errors.push(`Validation error: ${error.message}`)
    return { valid: false, errors }
  }
}

/**
 * Validate OpenAPI/Swagger structure
 */
function validateOpenAPIStructure(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    const spec = JSON.parse(content)

    // Check for required fields
    if (!spec.info) {
      errors.push('Missing "info" object')
    }

    if (!spec.paths && !spec.components?.schemas) {
      errors.push('Missing "paths" object (no endpoints defined)')
    }

    // OpenAPI 3.x specific
    if (spec.openapi) {
      if (!spec.info?.title) {
        errors.push('Missing "info.title"')
      }
      if (!spec.info?.version) {
        errors.push('Missing "info.version"')
      }
    }

    // Swagger 2.0 specific
    if (spec.swagger === '2.0') {
      if (!spec.info?.title) {
        errors.push('Missing "info.title"')
      }
      if (!spec.info?.version) {
        errors.push('Missing "info.version"')
      }
    }

    return { valid: errors.length === 0, errors }
  } catch (error: any) {
    errors.push(`Invalid JSON: ${error.message}`)
    return { valid: false, errors }
  }
}

/**
 * Validate Postman Collection structure
 */
function validatePostmanStructure(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    const collection = JSON.parse(content)

    if (!collection.info?.name) {
      errors.push('Missing "info.name"')
    }

    if (!Array.isArray(collection.item)) {
      errors.push('Missing or invalid "item" array')
    } else if (collection.item.length === 0) {
      errors.push('Collection has no items (requests)')
    }

    return { valid: errors.length === 0, errors }
  } catch (error: any) {
    errors.push(`Invalid JSON: ${error.message}`)
    return { valid: false, errors }
  }
}

/**
 * Validate cURL command structure
 */
function validateCurlStructure(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const trimmed = content.trim()

  if (!isCurlCommand(trimmed)) {
    errors.push('Not a valid cURL command')
  }

  // Check for URL (required)
  if (!trimmed.includes('http://') && !trimmed.includes('https://')) {
    errors.push('cURL command must contain a URL')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Extract basic info from content (without full parsing)
 */
export function extractBasicInfo(content: string): { name?: string; version?: string; description?: string } {
  const detection = detectFormat(content)

  if (detection.format === 'curl') {
    // Extract URL from cURL
    const urlMatch = content.match(/https?:\/\/[^\s'"]+/)
    if (urlMatch) {
      return {
        name: `cURL: ${urlMatch[0]}`,
        version: '1.0.0',
        description: 'Imported from cURL command',
      }
    }
    return {}
  }

  try {
    const parsed = JSON.parse(content)

    // OpenAPI/Swagger
    if (parsed.info) {
      return {
        name: parsed.info.title || parsed.info.name,
        version: parsed.info.version || '1.0.0',
        description: parsed.info.description,
      }
    }

    return {}
  } catch {
    return {}
  }
}
