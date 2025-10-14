/**
 * Environments API
 * CRUD operations for per-spec environments
 */

import {db} from '@/lib/db'
import type {Environment} from '@/types/database'

/**
 * Get all environments for a spec
 */
export async function getEnvironmentsBySpec(specId: number): Promise<Environment[]> {
  return db.getEnvironmentsBySpec(specId)
}

/**
 * Get single environment
 */
export async function getEnvironment(id: string): Promise<Environment | undefined> {
  return db.environments.get(id)
}

/**
 * Create environment
 */
export async function createEnvironment(
  data: Omit<Environment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Environment> {
  return db.createEnvironment(data)
}

/**
 * Update environment
 */
export async function updateEnvironment(
  id: string,
  updates: Partial<Omit<Environment, 'id' | 'specId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await db.updateEnvironment(id, updates)
}

/**
 * Delete environment
 */
export async function deleteEnvironment(id: string): Promise<void> {
  await db.deleteEnvironment(id)
}

/**
 * Export environments for a spec
 */
export async function exportEnvironments(specId: number) {
  return db.exportEnvironments(specId)
}

/**
 * Import environments for a spec
 */
export async function importEnvironments(
  specId: number,
  environments: Omit<Environment, 'id' | 'specId' | 'createdAt' | 'updatedAt'>[]
) {
  return db.importEnvironments(specId, environments)
}
