/**
 * Specs API
 * CRUD operations for API specifications
 */

import {db} from '@/lib/db'
import type {Spec} from '@/types/database'

/**
 * Create a new spec
 */
export async function createSpec(data: Omit<Spec, 'id' | 'createdAt' | 'updatedAt'>): Promise<Spec> {
  const now = new Date()
  const spec: Omit<Spec, 'id'> = {
    ...data,
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.specs.add(spec as Spec)
  return { ...spec, id } as Spec
}

/**
 * Get spec by ID
 */
export async function getSpec(id: number): Promise<Spec | undefined> {
  return db.specs.get(id)
}

/**
 * Get all specs
 */
export async function getAllSpecs(): Promise<Spec[]> {
  return db.specs.orderBy('updatedAt').reverse().toArray()
}

/**
 * Update spec
 */
export async function updateSpec(id: number, data: Partial<Omit<Spec, 'id' | 'createdAt'>>): Promise<void> {
  await db.specs.update(id, {
    ...data,
    updatedAt: new Date(),
  })
}

/**
 * Delete spec (and all related data)
 */
export async function deleteSpec(id: number): Promise<void> {
  await db.deleteSpec(id)
}

/**
 * Search specs by name
 */
export async function searchSpecs(query: string): Promise<Spec[]> {
  const normalizedQuery = query.toLowerCase()
  return db.specs
    .filter(spec =>
      spec.name.toLowerCase().includes(normalizedQuery) ||
      (spec.description?.toLowerCase().includes(normalizedQuery) ?? false)
    )
    .toArray()
}

/**
 * Get spec stats
 */
export async function getSpecStats(specId: number) {
  const [endpoints, testCases, executions] = await Promise.all([
    db.endpoints.where('specId').equals(specId).count(),
    db.testCases.where('specId').equals(specId).count(),
    db.executions.where('specId').equals(specId).count(),
  ])

  // Get last execution
  const lastExecution = await db.executions
    .where('specId')
    .equals(specId)
    .reverse()
    .first()

  // Get test results summary
  const passCount = await db.executions
    .where(['specId', 'status'])
    .equals([specId, 'pass'])
    .count()

  const failCount = await db.executions
    .where(['specId', 'status'])
    .equals([specId, 'fail'])
    .count()

  const errorCount = await db.executions
    .where(['specId', 'status'])
    .equals([specId, 'error'])
    .count()

  return {
    endpoints,
    testCases,
    executions,
    lastExecutionAt: lastExecution?.startedAt,
    passCount,
    failCount,
    errorCount,
    passRate: executions > 0 ? (passCount / executions) * 100 : 0,
  }
}

// ============================================
// Versioning API Functions
// ============================================

/**
 * Get all versions of a spec (by versionGroup)
 */
export async function getSpecVersions(versionGroup: string): Promise<Spec[]> {
  return db.getSpecVersions(versionGroup)
}

/**
 * Get the latest version of a spec
 */
export async function getLatestSpecVersion(versionGroup: string): Promise<Spec | undefined> {
  return db.getLatestSpecVersion(versionGroup)
}

/**
 * Find specs by name (fuzzy match)
 */
export async function findSpecsByName(name: string): Promise<Spec[]> {
  return db.findSpecByName(name)
}

/**
 * Create a new version of an existing spec
 */
export async function createSpecVersion(
  previousSpecId: number,
  data: Omit<Spec, 'id' | 'createdAt' | 'updatedAt' | 'versionGroup' | 'previousVersionId' | 'isLatest'>
): Promise<Spec> {
  // Get previous spec to inherit versionGroup
  const previousSpec = await db.specs.get(previousSpecId)
  if (!previousSpec) {
    throw new Error(`Previous spec with ID ${previousSpecId} not found`)
  }

  // Mark previous spec as no longer latest
  await db.markSpecAsOldVersion(previousSpecId)

  // Create new version
  const now = new Date()
  const newSpec: Omit<Spec, 'id'> = {
    ...data,
    versionGroup: previousSpec.versionGroup, // Inherit version group
    previousVersionId: previousSpecId, // Link to previous version
    isLatest: true, // Mark as latest
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.specs.add(newSpec as Spec)
  return { ...newSpec, id } as Spec
}

/**
 * Mark spec as latest version
 */
export async function markSpecAsLatest(specId: number, versionGroup: string): Promise<void> {
  // Unmark all other versions in this group
  const versions = await db.getSpecVersions(versionGroup)
  for (const version of versions) {
    if (version.id === specId) {
      await db.specs.update(version.id, { isLatest: true, updatedAt: new Date() })
    } else {
      await db.specs.update(version.id!, { isLatest: false, updatedAt: new Date() })
    }
  }
}

/**
 * Delete spec version (handles version chain updates)
 */
export async function deleteSpecVersion(specId: number): Promise<void> {
  await db.deleteSpecVersion(specId)
}

/**
 * Update spec display name (preserves originalName)
 */
export async function updateSpecDisplayName(specId: number, displayName: string): Promise<void> {
  const spec = await db.specs.get(specId)
  if (!spec) throw new Error(`Spec with ID ${specId} not found`)

  const nameHistory = spec.nameHistory || []
  nameHistory.push({
    changedAt: new Date(),
    oldName: spec.displayName || spec.originalName,
    newName: displayName,
    reason: 'user-edit',
  })

  await db.specs.update(specId, {
    displayName,
    nameHistory,
    updatedAt: new Date(),
  })
}
