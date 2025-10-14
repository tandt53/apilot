/**
 * OpenAPI / Swagger Parser
 * Parses and validates OpenAPI 3.x and Swagger 2.0 specifications
 */

import * as yaml from 'js-yaml'
import type {Endpoint} from '@/types/database'
import {convertOpenAPIToCanonical} from '@/lib/converters/openapi'

export interface ParsedSpec {
  spec: any // Raw parsed spec
  format: 'openapi' | 'swagger'
  version: string
}

export interface SpecSummary {
  title: string
  version: string
  description: string
  endpointCount: number
  specVersion: string
  baseUrl?: string
}

/**
 * Parse API specification from string content
 */
export function parseSpec(content: string, filename: string): ParsedSpec {
  let spec: any

  // Try JSON first
  if (filename.endsWith('.json')) {
    try {
      spec = JSON.parse(content)
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`)
    }
  }
  // Try YAML
  else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
    try {
      spec = yaml.load(content) as any
    } catch (error) {
      throw new Error(`Invalid YAML: ${(error as Error).message}`)
    }
  }
  // Auto-detect
  else {
    try {
      // Try JSON first
      spec = JSON.parse(content)
    } catch {
      try {
        // Try YAML
        spec = yaml.load(content) as any
      } catch (error) {
        throw new Error(`Unable to parse specification: ${(error as Error).message}`)
      }
    }
  }

  // Determine format
  if (spec.openapi) {
    return {
      spec,
      format: 'openapi',
      version: spec.openapi,
    }
  } else if (spec.swagger) {
    return {
      spec,
      format: 'swagger',
      version: spec.swagger,
    }
  } else {
    throw new Error('Not a valid OpenAPI/Swagger specification')
  }
}

/**
 * Validate OpenAPI/Swagger specification
 */
export function validateSpec(spec: any): boolean {
  // Check for OpenAPI 3.x
  if (spec.openapi) {
    if (!spec.paths) {
      throw new Error("OpenAPI spec missing 'paths'")
    }
    if (!spec.info) {
      throw new Error("OpenAPI spec missing 'info'")
    }
    return true
  }

  // Check for Swagger 2.0
  if (spec.swagger) {
    if (!spec.paths) {
      throw new Error("Swagger spec missing 'paths'")
    }
    if (!spec.info) {
      throw new Error("Swagger spec missing 'info'")
    }
    return true
  }

  throw new Error('Not a valid OpenAPI/Swagger specification')
}

/**
 * Get spec summary information
 */
export function getSpecSummary(spec: any): SpecSummary {
  const info = spec.info || {}
  const paths = spec.paths || {}

  let endpointCount = 0
  for (const path in paths) {
    for (const method in paths[path]) {
      if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method.toLowerCase())) {
        endpointCount++
      }
    }
  }

  // Extract base URL
  let baseUrl: string | undefined
  if (spec.servers && spec.servers.length > 0) {
    // OpenAPI 3.x
    baseUrl = spec.servers[0].url
  } else if (spec.host) {
    // Swagger 2.0
    const scheme = spec.schemes && spec.schemes.length > 0 ? spec.schemes[0] : 'https'
    const basePath = spec.basePath || ''
    baseUrl = `${scheme}://${spec.host}${basePath}`
  }

  return {
    title: info.title || 'Unknown',
    version: info.version || '1.0.0',
    description: info.description || '',
    endpointCount,
    specVersion: spec.openapi || spec.swagger || 'unknown',
    baseUrl,
  }
}

/**
 * Extract all endpoints from specification
 * Uses canonical format converter for universal structure
 */
export function extractEndpoints(spec: any, specId: number): Omit<Endpoint, 'id' | 'createdAt'>[] {
  const paths = spec.paths || {}
  const endpoints: Omit<Endpoint, 'id' | 'createdAt'>[] = []

  console.log('[OpenAPI Parser] Extracting endpoints from spec')

  for (const path in paths) {
    const pathItem = paths[path]

    for (const method in pathItem) {
      const methodLower = method.toLowerCase()
      if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodLower)) {
        const operation = pathItem[method]

        // Convert to canonical format
        const canonical = convertOpenAPIToCanonical(operation, path, method, spec)

        // Add database-specific fields
        const endpoint: Omit<Endpoint, 'id' | 'createdAt'>= {
          ...canonical,
          specId,
          updatedAt: new Date(),
          createdBy: 'import',
        }

        endpoints.push(endpoint)
      }
    }
  }

  console.log(`[OpenAPI Parser] Extracted ${endpoints.length} endpoints`)
  return endpoints
}

/**
 * Resolve JSON reference
 */
function resolveRef(refPath: string, spec: any): any | null {
  if (!refPath.startsWith('#/')) {
    return null
  }

  const parts = refPath.slice(2).split('/')
  let current = spec

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      return null
    }
  }

  return current
}

/**
 * Dereference object recursively
 */
function dereferenceObject(obj: any, spec: any, visited: Set<string> = new Set()): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => dereferenceObject(item, spec, new Set(visited)))
  }

  // Check if this is a reference
  if ('$ref' in obj && Object.keys(obj).length === 1) {
    const refPath = obj.$ref

    // Prevent circular references
    if (visited.has(refPath)) {
      return { description: `Circular reference to ${refPath}` }
    }

    visited.add(refPath)
    const resolved = resolveRef(refPath, spec)

    if (resolved !== null) {
      return dereferenceObject(JSON.parse(JSON.stringify(resolved)), spec, visited)
    }

    return obj
  }

  // Recursively dereference all values
  const result: any = {}
  for (const key in obj) {
    if (key === '$ref') {
      const refPath = obj[key]
      if (!visited.has(refPath)) {
        visited.add(refPath)
        const resolved = resolveRef(refPath, spec)
        if (resolved !== null) {
          const resolvedDeref = dereferenceObject(
            JSON.parse(JSON.stringify(resolved)),
            spec,
            visited
          )
          if (typeof resolvedDeref === 'object' && !Array.isArray(resolvedDeref)) {
            Object.assign(result, resolvedDeref)
          }
        }
      }
    } else {
      result[key] = dereferenceObject(obj[key], spec, new Set(visited))
    }
  }

  return result
}

/**
 * Dereference all $ref in spec
 */
export function dereferenceSpec(spec: any): any {
  try {
    return dereferenceObject(JSON.parse(JSON.stringify(spec)), spec)
  } catch (error) {
    console.error('Dereferencing failed:', error)
    return JSON.parse(JSON.stringify(spec))
  }
}

/**
 * Parse and process OpenAPI spec for storage
 */
export async function processOpenAPISpec(
  content: string,
  filename: string
): Promise<{
  summary: SpecSummary
  spec: any
  endpoints: Omit<Endpoint, 'id' | 'createdAt'>[]
}> {
  // Parse the spec
  const parsed = parseSpec(content, filename)

  // Validate it
  validateSpec(parsed.spec)

  // Dereference $refs
  const dereferencedSpec = dereferenceSpec(parsed.spec)

  // Get summary
  const summary = getSpecSummary(dereferencedSpec)

  // Note: endpoints will be extracted with specId after spec is saved
  return {
    summary,
    spec: dereferencedSpec,
    endpoints: [], // Will be populated after spec creation
  }
}
