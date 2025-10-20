/**
 * Import API - Handle importing endpoints to existing specs
 *
 * Critical Safety: When replacing duplicate endpoints, NEVER delete endpoints
 * that have tests. Mark them as deprecated instead to preserve test integrity.
 */

import {db} from '@/lib/db'
import type {Endpoint} from '@/types/database'

// ============================================
// Type Definitions
// ============================================

/**
 * Duplicate endpoint with test count
 */
export interface DuplicateEndpoint {
  incoming: Endpoint // New endpoint from import
  existing: Endpoint // Existing endpoint in database
  affectedTests: number // Number of tests linked to existing endpoint
  hasChanges: boolean // Whether the endpoints differ in schema
  changes?: {
    field: string
    oldValue?: any
    newValue?: any
    added?: any[]
    removed?: any[]
  }[]
}

/**
 * Import analysis results
 */
export interface ImportAnalysis {
  totalEndpoints: number // Total endpoints in import
  newEndpoints: Endpoint[] // Endpoints that don't exist yet
  duplicates: DuplicateEndpoint[] // Endpoints that already exist
  summary: {
    new: number
    duplicatesWithTests: number // Duplicates with linked tests (DANGER)
    duplicatesWithoutTests: number // Duplicates with no tests (safe to replace)
    totalTests: number // Total tests that could be affected
  }
}

/**
 * Options for handling duplicates during import
 */
export interface ImportOptions {
  onDuplicate: 'skip' | 'replace' | 'ask'

  // For 'ask' mode - user specifies which duplicates to replace
  // Array of existing endpoint IDs to replace
  replacements?: number[]

  // Whether to mark old endpoints as deprecated (vs deleting)
  markAsDeprecated?: boolean // Default: true
}

/**
 * Import result summary
 */
export interface ImportResult {
  imported: number // New endpoints created
  replaced: number // Duplicates replaced
  skipped: number // Duplicates skipped
  deprecated: number // Old endpoints marked as deprecated
  errors: string[] // Any errors encountered
  endpointIds: number[] // IDs of all imported/updated endpoints
}

// ============================================
// Core Import Functions
// ============================================

/**
 * Analyze import to detect duplicates and count affected tests
 *
 * This function does NOT modify the database. It only analyzes the import
 * and returns detailed information about duplicates and potential conflicts.
 */
export async function analyzeImport(
  endpoints: Omit<Endpoint, 'id' | 'createdAt'>[],
  targetSpecId: number
): Promise<ImportAnalysis> {
  const newEndpoints: Endpoint[] = []
  const duplicates: DuplicateEndpoint[] = []
  let totalTestsAffected = 0

  for (const incomingEndpoint of endpoints) {
    // Find existing endpoint by method + path using compound index
    const existing = await db.findEndpoint(
      targetSpecId,
      incomingEndpoint.method,
      incomingEndpoint.path
    )

    if (!existing) {
      // New endpoint - no duplicate
      newEndpoints.push(incomingEndpoint as Endpoint)
    } else {
      // Duplicate found - count affected tests
      const affectedTests = await db.testCases
        .where('currentEndpointId')
        .equals(existing.id!)
        .count()

      totalTestsAffected += affectedTests

      // Compare endpoints to detect changes
      const comparison = compareEndpoints(existing, incomingEndpoint as Endpoint)

      duplicates.push({
        incoming: incomingEndpoint as Endpoint,
        existing,
        affectedTests,
        hasChanges: comparison.hasChanges,
        changes: comparison.changes,
      })
    }
  }

  // Calculate summary statistics
  const duplicatesWithTests = duplicates.filter(d => d.affectedTests > 0).length
  const duplicatesWithoutTests = duplicates.filter(d => d.affectedTests === 0).length

  return {
    totalEndpoints: endpoints.length,
    newEndpoints,
    duplicates,
    summary: {
      new: newEndpoints.length,
      duplicatesWithTests,
      duplicatesWithoutTests,
      totalTests: totalTestsAffected,
    },
  }
}

/**
 * Import endpoints to existing spec with safe duplicate handling
 *
 * Critical Safety Rules:
 * 1. NEVER delete endpoints with tests
 * 2. When replacing endpoints with tests, mark old as deprecated
 * 3. Tests remain linked to original endpoint (preserves test integrity)
 * 4. Only truly delete endpoints with 0 tests (and user confirmed replacement)
 */
export async function importEndpoints(
  endpoints: Omit<Endpoint, 'id' | 'createdAt'>[],
  targetSpecId: number,
  options: ImportOptions
): Promise<ImportResult> {
  console.warn('🚀🚀🚀 [Import] importEndpoints() CALLED 🚀🚀🚀')
  console.warn(`  Spec ID: ${targetSpecId}`)
  console.warn(`  Endpoints to import: ${endpoints.length}`)
  console.warn(`  Options:`, options)

  const result: ImportResult = {
    imported: 0,
    replaced: 0,
    skipped: 0,
    deprecated: 0,
    errors: [],
    endpointIds: [],
  }

  // Get analysis first
  const analysis = await analyzeImport(endpoints, targetSpecId)

  console.warn(`📊 [Import] Analysis complete:`)
  console.warn(`  New: ${analysis.newEndpoints.length}`)
  console.warn(`  Duplicates: ${analysis.duplicates.length}`)

  // Use transaction for atomic import
  await db.transaction('rw', [db.endpoints, db.testCases], async () => {
    // 1. Import all new endpoints (no duplicates)
    const now = new Date()
    const newEndpointsWithMeta = analysis.newEndpoints.map(ep => ({
      ...ep,
      specId: targetSpecId,
      createdAt: now,
    }))

    if (newEndpointsWithMeta.length > 0) {
      // DEBUG: Log request.body.description for each new endpoint
      console.warn('🆕🆕🆕 [Import Save] Saving NEW endpoints 🆕🆕🆕')
      newEndpointsWithMeta.forEach(ep => {
        console.warn(`  ${ep.method} ${ep.path}`)
        console.warn(`    request.body.description:`, ep.request?.body?.description)
      })

      const ids = await db.endpoints.bulkAdd(newEndpointsWithMeta as Endpoint[], {
        allKeys: true,
      })

      console.warn(`✅ [Import Save] ${newEndpointsWithMeta.length} new endpoints saved to database`)

      result.endpointIds.push(...(ids as number[]))
      result.imported = newEndpointsWithMeta.length
    }

    // 2. Handle duplicates based on options
    for (const duplicate of analysis.duplicates) {
      const shouldReplace = shouldReplaceDuplicate(duplicate, options)

      if (!shouldReplace) {
        // Skip this duplicate
        result.skipped++
        continue
      }

      // SAFE REPLACEMENT LOGIC
      if (duplicate.affectedTests > 0) {
        // DANGER ZONE: Endpoint has tests
        // NEVER delete - mark old as deprecated, create new

        // Mark old endpoint as deprecated (add metadata)
        await db.endpoints.update(duplicate.existing.id!, {
          // Add deprecation metadata to tags or description
          tags: [
            ...(duplicate.existing.tags || []),
            'deprecated',
            `replaced-at-${now.toISOString()}`,
          ],
          description: `${duplicate.existing.description || ''}\n\n⚠️ DEPRECATED: Replaced by newer version on ${now.toLocaleDateString()}`,
        })

        // Create new endpoint
        const newEndpointId = await db.endpoints.add({
          ...duplicate.incoming,
          specId: targetSpecId,
          createdAt: now,
        } as Endpoint)

        result.endpointIds.push(newEndpointId as number)
        result.replaced++
        result.deprecated++

        // Tests remain linked to old endpoint (safe)
        // Future: Could offer migration wizard to update tests to new endpoint
      } else {
        // SAFE ZONE: No tests linked to this endpoint
        // Safe to replace directly

        // DEBUG: Log before update
        console.warn('═══════════════════════════════════════════')
        console.warn(`[Import Save] UPDATE ${duplicate.incoming.method} ${duplicate.incoming.path}`)
        console.warn('  Existing request.body.description:', duplicate.existing.request?.body?.description)
        console.warn('  Incoming request.body.description:', duplicate.incoming.request?.body?.description)
        console.warn('═══════════════════════════════════════════')

        // Update existing endpoint with new data
        await db.endpoints.update(duplicate.existing.id!, {
          ...duplicate.incoming,
          id: duplicate.existing.id, // Preserve ID
          specId: targetSpecId, // Ensure correct spec
          createdAt: duplicate.existing.createdAt, // Preserve original creation date
        })

        result.endpointIds.push(duplicate.existing.id!)
        result.replaced++
      }
    }
  })

  return result
}

/**
 * Determine if a duplicate should be replaced based on options
 */
function shouldReplaceDuplicate(
  duplicate: DuplicateEndpoint,
  options: ImportOptions
): boolean {
  switch (options.onDuplicate) {
    case 'skip':
      return false

    case 'replace':
      return true

    case 'ask':
      // Check if this endpoint is in the replacements list
      return options.replacements?.includes(duplicate.existing.id!) ?? false

    default:
      return false
  }
}

/**
 * Deep equality check for objects and arrays
 */
function deepEqual(a: any, b: any): boolean {
  // Same reference or both null/undefined
  if (a === b) return true

  // Handle NaN (NaN !== NaN in JavaScript)
  if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) {
    return true
  }

  // One is null/undefined, other isn't
  if (a == null || b == null) return false

  // Different types
  if (typeof a !== typeof b) return false

  // Primitives (already checked by ===)
  if (typeof a !== 'object') return a === b

  // Dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  // One is array, other isn't
  if (Array.isArray(a) !== Array.isArray(b)) return false

  // Objects
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  return keysA.every(key => deepEqual(a[key], b[key]))
}

/**
 * Compare two endpoints to detect changes
 *
 * Returns whether the endpoints differ and what changed.
 * Performs deep comparison of all canonical endpoint fields.
 */
function compareEndpoints(
  oldEndpoint: Endpoint,
  newEndpoint: Endpoint
): { hasChanges: boolean; changes: any[] } {
  const changes: any[] = []

  // 1. Compare basic properties
  if (oldEndpoint.name !== newEndpoint.name) {
    changes.push({
      field: 'name',
      oldValue: oldEndpoint.name,
      newValue: newEndpoint.name,
    })
  }

  if (oldEndpoint.description !== newEndpoint.description) {
    changes.push({
      field: 'description',
      oldValue: oldEndpoint.description,
      newValue: newEndpoint.description,
    })
  }

  // 2. Compare metadata
  if (!deepEqual(oldEndpoint.tags || [], newEndpoint.tags || [])) {
    changes.push({
      field: 'tags',
      oldValue: oldEndpoint.tags,
      newValue: newEndpoint.tags,
    })
  }

  if (oldEndpoint.operationId !== newEndpoint.operationId) {
    changes.push({
      field: 'operationId',
      oldValue: oldEndpoint.operationId,
      newValue: newEndpoint.operationId,
    })
  }

  if (oldEndpoint.deprecated !== newEndpoint.deprecated) {
    changes.push({
      field: 'deprecated',
      oldValue: oldEndpoint.deprecated,
      newValue: newEndpoint.deprecated,
    })
  }

  // 3. Compare request contentType
  if (oldEndpoint.request?.contentType !== newEndpoint.request?.contentType) {
    changes.push({
      field: 'request.contentType',
      oldValue: oldEndpoint.request?.contentType,
      newValue: newEndpoint.request?.contentType,
    })
  }

  // 4. Compare parameters (deep comparison)
  const oldParams = oldEndpoint.request?.parameters || []
  const newParams = newEndpoint.request?.parameters || []

  // Find added, removed, and modified parameters
  const paramChanges = compareParameterArrays(oldParams, newParams)
  if (paramChanges.length > 0) {
    changes.push(...paramChanges)
  }

  // 5. Compare request body (deep comparison)
  const bodyChanges = compareRequestBody(
    oldEndpoint.request?.body,
    newEndpoint.request?.body
  )
  if (bodyChanges.length > 0) {
    changes.push(...bodyChanges)
  }

  // 6. Compare responses (deep comparison)
  const responseChanges = compareResponses(
    oldEndpoint.responses,
    newEndpoint.responses
  )
  if (responseChanges.length > 0) {
    changes.push(...responseChanges)
  }

  // 7. Compare authentication (deep comparison)
  const authChanges = compareAuth(oldEndpoint.auth, newEndpoint.auth)
  if (authChanges.length > 0) {
    changes.push(...authChanges)
  }

  return {
    hasChanges: changes.length > 0,
    changes,
  }
}

/**
 * Compare parameter arrays deeply
 */
function compareParameterArrays(oldParams: any[], newParams: any[]): any[] {
  const changes: any[] = []

  // Find removed parameters
  for (const oldParam of oldParams) {
    const newParam = newParams.find(
      p => p.name === oldParam.name && p.in === oldParam.in
    )
    if (!newParam) {
      changes.push({
        field: 'parameters',
        type: 'removed',
        parameter: oldParam.name,
        location: oldParam.in,
        oldValue: oldParam,
      })
    }
  }

  // Find added and modified parameters
  for (const newParam of newParams) {
    const oldParam = oldParams.find(
      p => p.name === newParam.name && p.in === newParam.in
    )

    if (!oldParam) {
      // Added parameter
      changes.push({
        field: 'parameters',
        type: 'added',
        parameter: newParam.name,
        location: newParam.in,
        newValue: newParam,
      })
    } else if (!deepEqual(oldParam, newParam)) {
      // Modified parameter - find specific differences
      const paramChanges: any = {
        field: 'parameters',
        type: 'modified',
        parameter: newParam.name,
        location: newParam.in,
        differences: [],
      }

      if (oldParam.type !== newParam.type) {
        paramChanges.differences.push({
          property: 'type',
          oldValue: oldParam.type,
          newValue: newParam.type,
        })
      }
      if (oldParam.required !== newParam.required) {
        paramChanges.differences.push({
          property: 'required',
          oldValue: oldParam.required,
          newValue: newParam.required,
        })
      }
      if (oldParam.description !== newParam.description) {
        paramChanges.differences.push({
          property: 'description',
          oldValue: oldParam.description,
          newValue: newParam.description,
        })
      }
      if (!deepEqual(oldParam.example, newParam.example)) {
        paramChanges.differences.push({
          property: 'example',
          oldValue: oldParam.example,
          newValue: newParam.example,
        })
      }
      if (!deepEqual(oldParam.enum, newParam.enum)) {
        paramChanges.differences.push({
          property: 'enum',
          oldValue: oldParam.enum,
          newValue: newParam.enum,
        })
      }
      if (oldParam.min !== newParam.min || oldParam.max !== newParam.max) {
        paramChanges.differences.push({
          property: 'constraints',
          oldValue: { min: oldParam.min, max: oldParam.max },
          newValue: { min: newParam.min, max: newParam.max },
        })
      }
      if (oldParam.format !== newParam.format) {
        paramChanges.differences.push({
          property: 'format',
          oldValue: oldParam.format,
          newValue: newParam.format,
        })
      }

      if (paramChanges.differences.length > 0) {
        changes.push(paramChanges)
      }
    }
  }

  return changes
}

/**
 * Compare request body deeply
 */
function compareRequestBody(oldBody: any, newBody: any): any[] {
  const changes: any[] = []

  // Body added or removed
  const oldHasBody = !!oldBody
  const newHasBody = !!newBody

  if (oldHasBody !== newHasBody) {
    changes.push({
      field: 'request.body',
      type: oldHasBody ? 'removed' : 'added',
      oldValue: oldHasBody,
      newValue: newHasBody,
    })
    return changes
  }

  // Both have body - compare properties
  if (oldBody && newBody) {
    if (oldBody.required !== newBody.required) {
      changes.push({
        field: 'request.body.required',
        oldValue: oldBody.required,
        newValue: newBody.required,
      })
    }

    // Only report description change if both have values or one was explicitly set
    const oldDesc = oldBody.description
    const newDesc = newBody.description
    const oldHasDesc = oldDesc !== undefined && oldDesc !== null && oldDesc !== ''
    const newHasDesc = newDesc !== undefined && newDesc !== null && newDesc !== ''

    if (oldHasDesc && newHasDesc && oldDesc !== newDesc) {
      // Both have descriptions, different values
      changes.push({
        field: 'request.body.description',
        type: 'modified',
        oldValue: oldDesc,
        newValue: newDesc,
      })
    } else if (oldHasDesc && !newHasDesc) {
      // Description was removed
      changes.push({
        field: 'request.body.description',
        type: 'removed',
        oldValue: oldDesc,
      })
    } else if (!oldHasDesc && newHasDesc) {
      // Description was added
      changes.push({
        field: 'request.body.description',
        type: 'added',
        newValue: newDesc,
      })
    }

    if (!deepEqual(oldBody.example, newBody.example)) {
      changes.push({
        field: 'request.body.example',
        oldValue: oldBody.example,
        newValue: newBody.example,
      })
    }

    // Compare fields array (field-by-field like parameters)
    const oldFields = oldBody.fields || []
    const newFields = newBody.fields || []
    if (!deepEqual(oldFields, newFields)) {
      // Add detailed field-by-field comparison
      const fieldChanges = compareBodyFields(oldFields, newFields)
      changes.push(...fieldChanges)
    }
  }

  return changes
}

/**
 * Compare body fields arrays deeply
 */
function compareBodyFields(oldFields: any[], newFields: any[]): any[] {
  const changes: any[] = []

  // Find removed fields
  for (const oldField of oldFields) {
    const newField = newFields.find(f => f.name === oldField.name)
    if (!newField) {
      changes.push({
        field: 'request.body.fields',
        type: 'removed',
        fieldName: oldField.name,
        oldValue: oldField,
      })
    }
  }

  // Find added and modified fields
  for (const newField of newFields) {
    const oldField = oldFields.find(f => f.name === newField.name)

    if (!oldField) {
      // Added field
      changes.push({
        field: 'request.body.fields',
        type: 'added',
        fieldName: newField.name,
        newValue: newField,
      })
    } else if (!deepEqual(oldField, newField)) {
      // Modified field - find specific differences
      const fieldChange: any = {
        field: 'request.body.fields',
        type: 'modified',
        fieldName: newField.name,
        differences: [],
      }

      if (oldField.type !== newField.type) {
        fieldChange.differences.push({
          property: 'type',
          oldValue: oldField.type,
          newValue: newField.type,
        })
      }
      if (oldField.required !== newField.required) {
        fieldChange.differences.push({
          property: 'required',
          oldValue: oldField.required,
          newValue: newField.required,
        })
      }
      if (oldField.description !== newField.description) {
        fieldChange.differences.push({
          property: 'description',
          oldValue: oldField.description,
          newValue: newField.description,
        })
      }
      if (!deepEqual(oldField.example, newField.example)) {
        fieldChange.differences.push({
          property: 'example',
          oldValue: oldField.example,
          newValue: newField.example,
        })
      }
      if (!deepEqual(oldField.enum, newField.enum)) {
        fieldChange.differences.push({
          property: 'enum',
          oldValue: oldField.enum,
          newValue: newField.enum,
        })
      }
      if (oldField.format !== newField.format) {
        fieldChange.differences.push({
          property: 'format',
          oldValue: oldField.format,
          newValue: newField.format,
        })
      }
      if (oldField.min !== newField.min) {
        fieldChange.differences.push({
          property: 'min',
          oldValue: oldField.min,
          newValue: newField.min,
        })
      }
      if (oldField.max !== newField.max) {
        fieldChange.differences.push({
          property: 'max',
          oldValue: oldField.max,
          newValue: newField.max,
        })
      }
      if (!deepEqual(oldField.items, newField.items)) {
        fieldChange.differences.push({
          property: 'items',
          oldValue: oldField.items,
          newValue: newField.items,
        })
      }
      if (!deepEqual(oldField.properties, newField.properties)) {
        fieldChange.differences.push({
          property: 'properties',
          oldValue: oldField.properties,
          newValue: newField.properties,
        })
      }

      if (fieldChange.differences.length > 0) {
        changes.push(fieldChange)
      }
    }
  }

  return changes
}

/**
 * Compare responses deeply
 */
function compareResponses(oldResponses: any, newResponses: any): any[] {
  const changes: any[] = []

  if (!oldResponses || !newResponses) {
    if (oldResponses !== newResponses) {
      changes.push({
        field: 'responses',
        oldValue: oldResponses,
        newValue: newResponses,
      })
    }
    return changes
  }

  // Compare success response
  if (!deepEqual(oldResponses.success, newResponses.success)) {
    const successChanges: any = {
      field: 'responses.success',
      differences: [],
    }

    if (oldResponses.success?.status !== newResponses.success?.status) {
      successChanges.differences.push({
        property: 'status',
        oldValue: oldResponses.success?.status,
        newValue: newResponses.success?.status,
      })
    }

    if (oldResponses.success?.description !== newResponses.success?.description) {
      successChanges.differences.push({
        property: 'description',
        oldValue: oldResponses.success?.description,
        newValue: newResponses.success?.description,
      })
    }

    if (oldResponses.success?.contentType !== newResponses.success?.contentType) {
      successChanges.differences.push({
        property: 'contentType',
        oldValue: oldResponses.success?.contentType,
        newValue: newResponses.success?.contentType,
      })
    }

    if (!deepEqual(oldResponses.success?.example, newResponses.success?.example)) {
      successChanges.differences.push({
        property: 'example',
        oldValue: oldResponses.success?.example,
        newValue: newResponses.success?.example,
      })
    }

    if (!deepEqual(oldResponses.success?.fields, newResponses.success?.fields)) {
      successChanges.differences.push({
        property: 'fields',
        oldValue: oldResponses.success?.fields,
        newValue: newResponses.success?.fields,
      })
    }

    if (!deepEqual(oldResponses.success?.headers, newResponses.success?.headers)) {
      successChanges.differences.push({
        property: 'headers',
        oldValue: oldResponses.success?.headers,
        newValue: newResponses.success?.headers,
      })
    }

    if (successChanges.differences.length > 0) {
      changes.push(successChanges)
    }
  }

  // Compare error responses
  const oldErrors = oldResponses.errors || []
  const newErrors = newResponses.errors || []

  if (!deepEqual(oldErrors, newErrors)) {
    changes.push({
      field: 'responses.errors',
      oldValue: oldResponses.errors,
      newValue: newResponses.errors,
    })
  }

  return changes
}

/**
 * Compare authentication deeply
 */
function compareAuth(oldAuth: any, newAuth: any): any[] {
  const changes: any[] = []

  // Auth added or removed
  const oldHasAuth = !!oldAuth
  const newHasAuth = !!newAuth

  if (oldHasAuth !== newHasAuth) {
    changes.push({
      field: 'auth',
      type: oldHasAuth ? 'removed' : 'added',
      oldValue: oldAuth,
      newValue: newAuth,
    })
    return changes
  }

  // Both have auth - compare properties
  if (oldAuth && newAuth && !deepEqual(oldAuth, newAuth)) {
    const authChanges: any = {
      field: 'auth',
      differences: [],
    }

    if (oldAuth.required !== newAuth.required) {
      authChanges.differences.push({
        property: 'required',
        oldValue: oldAuth.required,
        newValue: newAuth.required,
      })
    }

    if (oldAuth.type !== newAuth.type) {
      authChanges.differences.push({
        property: 'type',
        oldValue: oldAuth.type,
        newValue: newAuth.type,
      })
    }

    if (oldAuth.scheme !== newAuth.scheme) {
      authChanges.differences.push({
        property: 'scheme',
        oldValue: oldAuth.scheme,
        newValue: newAuth.scheme,
      })
    }

    if (oldAuth.bearerFormat !== newAuth.bearerFormat) {
      authChanges.differences.push({
        property: 'bearerFormat',
        oldValue: oldAuth.bearerFormat,
        newValue: newAuth.bearerFormat,
      })
    }

    if (oldAuth.in !== newAuth.in) {
      authChanges.differences.push({
        property: 'in',
        oldValue: oldAuth.in,
        newValue: newAuth.in,
      })
    }

    if (oldAuth.name !== newAuth.name) {
      authChanges.differences.push({
        property: 'name',
        oldValue: oldAuth.name,
        newValue: newAuth.name,
      })
    }

    if (authChanges.differences.length > 0) {
      changes.push(authChanges)
    }
  }

  return changes
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get quick stats about an import (without full analysis)
 */
export async function getImportStats(
  endpoints: Omit<Endpoint, 'id' | 'createdAt'>[],
  targetSpecId: number
): Promise<{
  total: number
  estimatedNew: number
  estimatedDuplicates: number
}> {
  let duplicateCount = 0

  for (const endpoint of endpoints) {
    const existing = await db.findEndpoint(
      targetSpecId,
      endpoint.method,
      endpoint.path
    )
    if (existing) {
      duplicateCount++
    }
  }

  return {
    total: endpoints.length,
    estimatedNew: endpoints.length - duplicateCount,
    estimatedDuplicates: duplicateCount,
  }
}

/**
 * Merge endpoints from multiple sources
 *
 * Useful for merging multiple spec imports before analyzing.
 */
export function mergeEndpoints(
  endpointSets: Omit<Endpoint, 'id' | 'createdAt'>[][]
): Omit<Endpoint, 'id' | 'createdAt'>[] {
  const merged: Omit<Endpoint, 'id' | 'createdAt'>[] = []
  const seen = new Set<string>()

  for (const endpoints of endpointSets) {
    for (const endpoint of endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(endpoint)
      }
    }
  }

  return merged
}
