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

/**
 * Create environment from parsed spec data
 * Automatically extracts baseUrl and variables from parsed import
 *
 * @param specId - ID of the spec to create environment for
 * @param parsedData - Parsed spec data containing baseUrl and/or variables
 * @returns Created environment, or undefined if no baseUrl/variables present
 */
export async function createEnvironmentFromParsedSpec(
  specId: number,
  parsedData: {
    name: string
    baseUrl?: string
    variables?: Record<string, any>
  }
): Promise<Environment | undefined> {
  const hasBaseUrl = parsedData.baseUrl && parsedData.baseUrl.trim() !== ''
  const hasVariables = parsedData.variables && Object.keys(parsedData.variables).length > 0

  // Skip if no baseUrl and no variables
  if (!hasBaseUrl && !hasVariables) {
    return undefined
  }

  // Smart variable filtering: Remove Postman placeholder variables ({{variableName}})
  // Only keep variables with actual values
  let cleanedVariables: Record<string, string> | undefined
  if (hasVariables) {
    cleanedVariables = Object.entries(parsedData.variables!)
      .filter(([_, value]) => {
        // Skip if value is a placeholder like "{{someVar}}"
        if (typeof value === 'string' && value.match(/^\{\{.*\}\}$/)) {
          return false
        }
        // Keep values that are actual data
        return true
      })
      .reduce((acc, [key, value]) => {
        acc[key] = String(value) // Convert to string for consistency
        return acc
      }, {} as Record<string, string>)

    // If all variables were placeholders, treat as no variables
    if (Object.keys(cleanedVariables).length === 0) {
      cleanedVariables = undefined
    }
  }

  // Re-check: if after filtering we have no variables and no baseUrl, return undefined
  if (!hasBaseUrl && !cleanedVariables) {
    return undefined
  }

  // Determine environment name based on baseUrl or spec name
  let envName = 'Default'
  if (hasBaseUrl) {
    try {
      const url = new URL(parsedData.baseUrl!)
      const hostname = url.hostname

      // Smart naming based on common patterns
      if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        envName = 'Local Development'
      } else if (hostname.includes('dev')) {
        envName = 'Development'
      } else if (hostname.includes('staging') || hostname.includes('stg')) {
        envName = 'Staging'
      } else if (hostname.includes('test') || hostname.includes('qa')) {
        envName = 'Testing'
      } else if (hostname.includes('prod') || hostname.includes('api.')) {
        envName = 'Production'
      } else {
        // Use the hostname as the name
        envName = hostname
      }
    } catch {
      // Invalid URL, use spec name or generic name
      envName = parsedData.name || 'Imported Environment'
    }
  } else if (hasVariables) {
    envName = 'Imported Variables'
  }

  return createEnvironment({
    specId,
    name: envName,
    baseUrl: parsedData.baseUrl || '',
    variables: cleanedVariables,
    description: hasVariables
      ? `Auto-created from ${parsedData.name} with ${Object.keys(cleanedVariables || {}).length} variables`
      : `Auto-created from ${parsedData.name}`,
  })
}
