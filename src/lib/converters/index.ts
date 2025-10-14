/**
 * Unified Import Parser
 *
 * Entry point for multi-source import.
 * Auto-detects format and routes to appropriate converter.
 */

import type {CanonicalEndpoint} from '@/types/canonical'
import {detectFormat, type DetectionResult, extractBasicInfo, type ImportFormat, validateFormat} from './detector'
import {convertOpenAPIToCanonical} from './openapi'
import {generateSpecFromCurl} from './curl'
import {convertPostmanToCanonical} from './postman'

/**
 * Parsed spec result
 */
export interface ParsedSpec {
  name: string
  version: string
  description?: string
  baseUrl?: string
  format: ImportFormat
  endpoints: Array<Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  variables?: Record<string, any>
  rawSpec: string // Original content for storage
}

/**
 * Parse result with detection info
 */
export interface ParseResult {
  success: boolean
  data?: ParsedSpec
  error?: string
  detection: DetectionResult
}

/**
 * Main entry point: Parse any supported format
 */
export async function parseImportedContent(content: string, expectedFormat?: ImportFormat): Promise<ParseResult> {
  try {
    // Step 1: Detect format
    const detection = detectFormat(content)

    if (detection.format === 'unknown') {
      return {
        success: false,
        error: 'Could not detect format. Supported formats: OpenAPI 3.x, Swagger 2.0, Postman Collection v2.x, cURL command',
        detection,
      }
    }

    // Step 2: Validate if expected format provided
    if (expectedFormat && detection.format !== expectedFormat) {
      return {
        success: false,
        error: `Expected ${expectedFormat} but detected ${detection.format}`,
        detection,
      }
    }

    // Step 3: Validate structure
    const validation = validateFormat(content, detection.format)
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid ${detection.format} structure: ${validation.errors.join(', ')}`,
        detection,
      }
    }

    // Step 4: Parse based on format
    let parsed: ParsedSpec

    switch (detection.format) {
      case 'openapi':
      case 'swagger':
        parsed = await parseOpenAPI(content, detection.format)
        break

      case 'postman':
        parsed = await parsePostman(content)
        break

      case 'curl':
        parsed = await parseCurl(content)
        break

      default:
        return {
          success: false,
          error: `Unsupported format: ${detection.format}`,
          detection,
        }
    }

    return {
      success: true,
      data: parsed,
      detection,
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Parse error: ${error.message}`,
      detection: detectFormat(content),
    }
  }
}

/**
 * Parse OpenAPI/Swagger specification
 */
async function parseOpenAPI(content: string, format: 'openapi' | 'swagger'): Promise<ParsedSpec> {
  const spec = JSON.parse(content)

  const endpoints: Array<Omit<CanonicalEndpoint, 'id' | 'specId' | 'createdAt' | 'updatedAt' | 'createdBy'>> = []

  // Extract endpoints from paths
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths as any)) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        // Skip non-operation fields ($ref, summary, description, parameters, servers)
        if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'].includes(method.toLowerCase())) {
          const endpoint = convertOpenAPIToCanonical(operation, path, method, spec)
          endpoints.push(endpoint)
        }
      }
    }
  }

  // Extract base URL
  const baseUrl = extractBaseUrl(spec, format)

  return {
    name: spec.info?.title || 'Unnamed API',
    version: spec.info?.version || '1.0.0',
    description: spec.info?.description,
    baseUrl,
    format,
    endpoints,
    rawSpec: content,
  }
}

/**
 * Parse Postman Collection
 */
async function parsePostman(content: string): Promise<ParsedSpec> {
  const result = convertPostmanToCanonical(content)

  return {
    name: result.name,
    version: result.version,
    description: result.description,
    baseUrl: result.baseUrl,
    format: 'postman',
    endpoints: result.endpoints,
    variables: result.variables,
    rawSpec: content,
  }
}

/**
 * Parse cURL command
 */
async function parseCurl(content: string): Promise<ParsedSpec> {
  const result = generateSpecFromCurl(content)

  return {
    name: result.name,
    version: result.version,
    description: result.description,
    baseUrl: result.baseUrl,
    format: 'curl',
    endpoints: result.endpoints,
    rawSpec: content,
  }
}

/**
 * Extract base URL from OpenAPI/Swagger spec
 */
function extractBaseUrl(spec: any, format: 'openapi' | 'swagger'): string | undefined {
  // OpenAPI 3.x: servers array
  if (format === 'openapi' && spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url
  }

  // Swagger 2.0: host + basePath + schemes
  if (format === 'swagger') {
    const scheme = spec.schemes?.[0] || 'https'
    const host = spec.host || ''
    const basePath = spec.basePath || ''

    if (host) {
      return `${scheme}://${host}${basePath}`
    }
  }

  return undefined
}

/**
 * Export all converters and utilities
 */
export { detectFormat, validateFormat, extractBasicInfo, type ImportFormat, type DetectionResult }
export { convertOpenAPIToCanonical } from './openapi'
export { convertCurlToCanonical, generateSpecFromCurl } from './curl'
export { convertPostmanToCanonical } from './postman'
