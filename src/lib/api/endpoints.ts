/**
 * Endpoints API
 * CRUD operations for API endpoints
 */

import {db} from '@/lib/db'
import type {Endpoint} from '@/types/database'

/**
 * Create a new endpoint
 */
export async function createEndpoint(data: Omit<Endpoint, 'id' | 'createdAt'>): Promise<Endpoint> {
  const endpoint: Omit<Endpoint, 'id'> = {
    ...data,
    createdAt: new Date(),
  }

  const id = await db.endpoints.add(endpoint as Endpoint)
  return { ...endpoint, id } as Endpoint
}

/**
 * Bulk create endpoints
 */
export async function bulkCreateEndpoints(endpoints: Omit<Endpoint, 'id' | 'createdAt'>[]): Promise<number[]> {
  const now = new Date()
  const endpointsWithTimestamp = endpoints.map(e => ({
    ...e,
    createdAt: now,
  })) as Endpoint[]

  const ids = await db.endpoints.bulkAdd(endpointsWithTimestamp, { allKeys: true })
  return ids as number[]
}

/**
 * Get endpoint by ID
 */
export async function getEndpoint(id: number): Promise<Endpoint | undefined> {
  return db.endpoints.get(id)
}

/**
 * Get all endpoints for a spec
 */
export async function getEndpointsBySpec(specId: number): Promise<Endpoint[]> {
  return db.getEndpointsBySpec(specId)
}

/**
 * Update endpoint
 */
export async function updateEndpoint(id: number, data: Partial<Omit<Endpoint, 'id' | 'specId' | 'createdAt'>>): Promise<void> {
  await db.endpoints.update(id, data)
}

/**
 * Delete endpoint (updates test cases to mark as custom)
 */
export async function deleteEndpoint(id: number): Promise<void> {
  // Don't delete test cases, just mark them as custom
  const linkedTests = await db.testCases.where('currentEndpointId').equals(id).toArray()
  for (const test of linkedTests) {
    await db.testCases.update(test.id!, {
      currentEndpointId: undefined,
      isCustomEndpoint: true,
      updatedAt: new Date(),
    })
  }

  // Delete the endpoint
  await db.endpoints.delete(id)
}

/**
 * Get endpoints by method
 */
export async function getEndpointsByMethod(specId: number, method: string): Promise<Endpoint[]> {
  return db.endpoints
    .where(['specId', 'method'])
    .equals([specId, method])
    .toArray()
}

/**
 * Get endpoints by tag
 */
export async function getEndpointsByTag(specId: number, tag: string): Promise<Endpoint[]> {
  return db.endpoints
    .where('specId')
    .equals(specId)
    .filter(endpoint => endpoint.tags?.includes(tag) ?? false)
    .toArray()
}

/**
 * Search endpoints
 */
export async function searchEndpoints(specId: number, query: string): Promise<Endpoint[]> {
  const normalizedQuery = query.toLowerCase()
  return db.endpoints
    .where('specId')
    .equals(specId)
    .filter(endpoint =>
      endpoint.path.toLowerCase().includes(normalizedQuery) ||
      endpoint.method.toLowerCase().includes(normalizedQuery) ||
      endpoint.name.toLowerCase().includes(normalizedQuery) ||
      (endpoint.description?.toLowerCase().includes(normalizedQuery) ?? false) ||
      (endpoint.operationId?.toLowerCase().includes(normalizedQuery) ?? false)
    )
    .toArray()
}

/**
 * Get endpoint stats
 */
export async function getEndpointStats(endpointId: number) {
  const [testCases, executions] = await Promise.all([
    db.testCases.where('currentEndpointId').equals(endpointId).count(),
    db.executions.where('endpointId').equals(endpointId).count(),
  ])

  // Get last execution
  const lastExecution = await db.executions
    .where('endpointId')
    .equals(endpointId)
    .reverse()
    .first()

  // Get test results summary
  const passCount = await db.executions
    .where('endpointId')
    .equals(endpointId)
    .filter(e => e.status === 'pass')
    .count()

  const failCount = await db.executions
    .where('endpointId')
    .equals(endpointId)
    .filter(e => e.status === 'fail')
    .count()

  return {
    testCases,
    executions,
    lastExecutionAt: lastExecution?.startedAt,
    passCount,
    failCount,
    passRate: executions > 0 ? (passCount / executions) * 100 : 0,
  }
}

/**
 * Get all unique tags for a spec
 */
export async function getSpecTags(specId: number): Promise<string[]> {
  const endpoints = await db.endpoints.where('specId').equals(specId).toArray()
  const tagsSet = new Set<string>()

  endpoints.forEach(endpoint => {
    endpoint.tags?.forEach(tag => tagsSet.add(tag))
  })

  return Array.from(tagsSet).sort()
}

// ============================================
// Versioning and Comparison API Functions
// ============================================

/**
 * Find endpoint by method + path within a spec
 */
export async function findEndpoint(
  specId: number,
  method: string,
  path: string
): Promise<Endpoint | undefined> {
  return db.findEndpoint(specId, method, path)
}

/**
 * Get endpoint by previous endpoint ID (find what replaced an endpoint)
 */
export async function getEndpointByPreviousId(previousEndpointId: number): Promise<Endpoint | undefined> {
  return db.getEndpointByPreviousId(previousEndpointId)
}

/**
 * Compare two endpoints and detect changes
 */
export function compareEndpoints(oldEndpoint: Endpoint, newEndpoint: Endpoint) {
  const changes: any[] = []

  // Compare parameters
  const oldParams = oldEndpoint.request.parameters || []
  const newParams = newEndpoint.request.parameters || []

  const addedParams = newParams.filter(
    np => !oldParams.find(op => op.name === np.name && op.in === np.in)
  )
  const removedParams = oldParams.filter(
    op => !newParams.find(np => np.name === op.name && np.in === op.in)
  )

  if (addedParams.length > 0 || removedParams.length > 0) {
    changes.push({
      field: 'parameters',
      added: addedParams,
      removed: removedParams,
    })
  }

  // Compare request body
  const oldHasBody = !!oldEndpoint.request.body
  const newHasBody = !!newEndpoint.request.body

  if (oldHasBody !== newHasBody) {
    changes.push({
      field: 'requestBody',
      oldValue: oldHasBody,
      newValue: newHasBody,
    })
  }

  // Compare responses
  const oldResponseCodes = Object.keys(oldEndpoint.responses || {})
  const newResponseCodes = Object.keys(newEndpoint.responses || {})

  const addedResponses = newResponseCodes.filter(code => !oldResponseCodes.includes(code))
  const removedResponses = oldResponseCodes.filter(code => !newResponseCodes.includes(code))

  if (addedResponses.length > 0 || removedResponses.length > 0) {
    changes.push({
      field: 'responses',
      added: addedResponses,
      removed: removedResponses,
    })
  }

  return {
    hasChanges: changes.length > 0,
    changes,
  }
}

/**
 * Create endpoint mapping between old and new spec versions
 * Maps old endpoint IDs to new endpoint IDs by matching method+path
 */
export async function createEndpointMapping(
  oldSpecId: number,
  newSpecId: number
): Promise<Map<number, number>> {
  const mapping = new Map<number, number>()

  const oldEndpoints = await db.getEndpointsBySpec(oldSpecId)
  const newEndpoints = await db.getEndpointsBySpec(newSpecId)

  for (const oldEndpoint of oldEndpoints) {
    const matchingNewEndpoint = newEndpoints.find(
      ne => ne.method === oldEndpoint.method && ne.path === oldEndpoint.path
    )

    if (matchingNewEndpoint && oldEndpoint.id && matchingNewEndpoint.id) {
      mapping.set(oldEndpoint.id, matchingNewEndpoint.id)
    }
  }

  return mapping
}
