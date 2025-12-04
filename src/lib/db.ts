/**
 * IndexedDB Setup using Dexie
 *
 * This file initializes the IndexedDB database with Dexie.js
 * and provides typed access to all tables.
 */

import Dexie, {Table} from 'dexie'
import type {Endpoint, Environment, Settings, Spec, TestCase, TestExecution, EncryptionKey} from '@/types/database'

/**
 * Apilot Database
 */
export class ApilotDB extends Dexie {
  // Tables
  specs!: Table<Spec, number>
  endpoints!: Table<Endpoint, number>
  testCases!: Table<TestCase, number>
  executions!: Table<TestExecution, number>
  settings!: Table<Settings, number>
  environments!: Table<Environment, string>
  encryptionKeys!: Table<EncryptionKey, number>

  constructor() {
    super('ApilotDB')

    // Define database schema
    // Version 1: Initial schema (v1.0.0 release)
    this.version(1).stores({
      // Specs table
      // Primary: id (auto-increment)
      // Indexes: versionGroup (to query all versions of same API)
      // Indexes: isLatest (to quickly find latest version)
      // Indexes: previousVersionId (to traverse version chain)
      specs: '++id, name, version, versionGroup, previousVersionId, isLatest, originalName, format, createdAt, updatedAt',

      // Endpoints table (canonical format)
      // Primary: id (auto-increment)
      // Indexes: specId, method, path, operationId, source
      // Compound index: [specId+method+path] for uniqueness
      endpoints: '++id, specId, method, path, operationId, source, [specId+method+path], createdAt',

      // TestCases table
      // Primary: id (auto-increment)
      // Indexes: specId, sourceEndpointId, currentEndpointId
      // Indexes: isCustomEndpoint (to filter custom tests)
      // Indexes: migratedFrom (to track migration chain)
      // Indexes: testType, category, priority, lastResult
      // Compound index: [specId+method+path] (to enable endpoint matching)
      testCases: '++id, specId, sourceEndpointId, currentEndpointId, isCustomEndpoint, migratedFrom, method, path, testType, category, priority, lastResult, lastExecutedAt, createdAt, updatedAt, createdBy, [specId+method+path]',

      // Executions table
      // Primary: id (auto-increment)
      // Indexes: testCaseId, specId, endpointId, status, startedAt
      // Compound indexes for filtering
      executions: '++id, testCaseId, specId, endpointId, status, environment, startedAt, completedAt, createdAt, [testCaseId+status], [specId+status]',

      // Settings table (singleton)
      // Primary: id (always 1)
      settings: 'id, updatedAt',

      // Environments table (per-spec environments)
      // Primary: id (UUID)
      // Indexes: specId (to query all environments for a spec)
      environments: 'id, specId, name, createdAt, updatedAt',
    })

    // Version 2: Add encryption keys table for stable API key encryption
    this.version(2).stores({
      // Add encryptionKeys table (singleton)
      // Primary: id (always 1)
      encryptionKeys: 'id, createdAt',
    })

    // Hooks and middleware can be added here
    this.on('populate', () => this.populate())
  }

  /**
   * Populate database with default settings
   */
  private async populate() {
    // Create default settings
    await this.settings.add({
      id: 1,
      aiProvider: 'openai',
      aiSettings: {
        openai: {
          apiKey: '', // Empty - user must configure
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      defaultTimeout: 30000, // 30 seconds
      defaultHeaders: {
        'Content-Type': 'application/json',
      },
      environments: [
        {
          id: crypto.randomUUID(),
          name: 'Development',
          baseUrl: 'http://localhost:3000',
          description: 'Local development environment',
        },
      ],
      theme: 'system',
      updatedAt: new Date(),
    })
  }

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll() {
    await Promise.all([
      this.specs.clear(),
      this.endpoints.clear(),
      this.testCases.clear(),
      this.executions.clear(),
    ])
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const [specs, endpoints, testCases, executions] = await Promise.all([
      this.specs.count(),
      this.endpoints.count(),
      this.testCases.count(),
      this.executions.count(),
    ])

    return {
      specs,
      endpoints,
      testCases,
      executions,
      lastUpdated: new Date(),
    }
  }

  /**
   * Export all data
   */
  async exportAll() {
    const [specs, endpoints, testCases, settings] = await Promise.all([
      this.specs.toArray(),
      this.endpoints.toArray(),
      this.testCases.toArray(),
      this.settings.get(1),
    ])

    return {
      version: '1.0.0',
      exportedAt: new Date(),
      specs,
      endpoints,
      testCases,
      settings,
    }
  }

  /**
   * Import data from export
   */
  async importAll(data: {
    specs: Spec[]
    endpoints: Endpoint[]
    testCases: TestCase[]
    settings?: Settings
  }) {
    await this.transaction('rw', [this.specs, this.endpoints, this.testCases, this.settings], async () => {
      // Clear existing data
      await this.clearAll()

      // Import specs
      if (data.specs.length > 0) {
        await this.specs.bulkAdd(data.specs)
      }

      // Import endpoints
      if (data.endpoints.length > 0) {
        await this.endpoints.bulkAdd(data.endpoints)
      }

      // Import test cases
      if (data.testCases.length > 0) {
        await this.testCases.bulkAdd(data.testCases)
      }

      // Import settings
      if (data.settings) {
        await this.settings.put(data.settings)
      }
    })
  }

  /**
   * Delete spec and all related data
   */
  async deleteSpec(specId: number) {
    await this.transaction('rw', [this.specs, this.endpoints, this.testCases, this.executions, this.environments], async () => {
      // Delete all test executions for this spec
      await this.executions.where('specId').equals(specId).delete()

      // Delete all test cases for this spec
      await this.testCases.where('specId').equals(specId).delete()

      // Delete all endpoints for this spec
      await this.endpoints.where('specId').equals(specId).delete()

      // Delete all environments for this spec
      await this.environments.where('specId').equals(specId).delete()

      // Delete the spec itself
      await this.specs.delete(specId)
    })
  }

  /**
   * Delete test case and all executions
   */
  async deleteTestCase(testCaseId: number) {
    await this.transaction('rw', [this.testCases, this.executions], async () => {
      // Delete all executions for this test case
      await this.executions.where('testCaseId').equals(testCaseId).delete()

      // Delete the test case
      await this.testCases.delete(testCaseId)
    })
  }

  /**
   * Get all test cases for a spec
   */
  async getTestCasesBySpec(specId: number) {
    return this.testCases.where('specId').equals(specId).toArray()
  }

  /**
   * Get all test cases for an endpoint (V2: uses currentEndpointId)
   */
  async getTestCasesByEndpoint(endpointId: number) {
    return this.testCases.where('currentEndpointId').equals(endpointId).toArray()
  }

  /**
   * Get recent test executions
   */
  async getRecentExecutions(limit: number = 50) {
    return this.executions.orderBy('startedAt').reverse().limit(limit).toArray()
  }

  /**
   * Get test executions for a test case
   */
  async getExecutionsByTestCase(testCaseId: number, limit: number = 20) {
    return this.executions
      .where('testCaseId')
      .equals(testCaseId)
      .reverse()
      .limit(limit)
      .toArray()
  }

  /**
   * Get all endpoints for a spec
   */
  async getEndpointsBySpec(specId: number) {
    return this.endpoints.where('specId').equals(specId).toArray()
  }

  /**
   * Update test case execution stats
   */
  async updateTestCaseStats(testCaseId: number, result: 'pass' | 'fail' | 'error') {
    const testCase = await this.testCases.get(testCaseId)
    if (!testCase) return

    await this.testCases.update(testCaseId, {
      lastExecutedAt: new Date(),
      lastResult: result,
      executionCount: (testCase.executionCount || 0) + 1,
      updatedAt: new Date(),
    })
  }

  // ============================================
  // Versioning Helper Methods
  // ============================================

  /**
   * Get all versions of a spec (by versionGroup)
   */
  async getSpecVersions(versionGroup: string) {
    return this.specs
      .where('versionGroup')
      .equals(versionGroup)
      .sortBy('createdAt') // Oldest to newest
  }

  /**
   * Get the latest version of a spec
   */
  async getLatestSpecVersion(versionGroup: string) {
    return this.specs
      .where('versionGroup')
      .equals(versionGroup)
      .and(spec => spec.isLatest === true)
      .first()
  }

  /**
   * Find spec by name (fuzzy match)
   */
  async findSpecByName(name: string) {
    const nameLower = name.toLowerCase()
    return this.specs
      .filter(spec =>
        spec.name.toLowerCase().includes(nameLower) ||
        (spec.originalName?.toLowerCase().includes(nameLower) ?? false) ||
        (spec.displayName?.toLowerCase().includes(nameLower) ?? false)
      )
      .toArray()
  }

  /**
   * Find endpoint by method + path within a spec
   */
  async findEndpoint(specId: number, method: string, path: string) {
    return this.endpoints
      .where('[specId+method+path]')
      .equals([specId, method, path])
      .first()
  }

  /**
   * Find test case by method + path within a spec
   */
  async findTestCase(specId: number, method: string, path: string) {
    return this.testCases
      .where('[specId+method+path]')
      .equals([specId, method, path])
      .toArray()
  }

  /**
   * Mark old spec version as not latest
   */
  async markSpecAsOldVersion(specId: number) {
    await this.specs.update(specId, {
      isLatest: false,
      updatedAt: new Date(),
    })
  }

  /**
   * Get test cases that need migration (from old spec version)
   */
  async getTestCasesForMigration(oldSpecId: number) {
    return this.testCases
      .where('specId')
      .equals(oldSpecId)
      .toArray()
  }

  /**
   * Get endpoints by previous endpoint ID (find what replaced an endpoint)
   */
  async getEndpointByPreviousId(previousEndpointId: number) {
    return this.endpoints
      .where('previousEndpointId')
      .equals(previousEndpointId)
      .first()
  }

  /**
   * Get all custom tests (not linked to any endpoint)
   */
  async getCustomTestCases(specId: number) {
    return this.testCases
      .where('specId')
      .equals(specId)
      .and(test => test.isCustomEndpoint === true)
      .toArray()
  }

  /**
   * Get test migration chain (follow migratedFrom links)
   */
  async getTestMigrationChain(testCaseId: number): Promise<TestCase[]> {
    const chain: TestCase[] = []
    let currentId: number | undefined = testCaseId

    while (currentId) {
      const test: TestCase | undefined = await this.testCases.get(currentId)
      if (!test) break

      chain.push(test)
      currentId = test.migratedFrom
    }

    return chain
  }

  /**
   * Delete spec version and handle cascading deletes + version chain updates
   */
  async deleteSpecVersion(specId: number) {
    await this.transaction('rw', [this.specs, this.endpoints, this.testCases, this.executions, this.environments], async () => {
      const spec = await this.specs.get(specId)
      if (!spec) return

      // If deleting latest version, mark previous version as latest
      if (spec.isLatest && spec.previousVersionId) {
        await this.specs.update(spec.previousVersionId, {
          isLatest: true,
          updatedAt: new Date(),
        })
      }

      // Update any specs that pointed to this as previous version
      const nextVersions = await this.specs
        .where('previousVersionId')
        .equals(specId)
        .toArray()

      for (const nextVersion of nextVersions) {
        await this.specs.update(nextVersion.id!, {
          previousVersionId: spec.previousVersionId,
          updatedAt: new Date(),
        })
      }

      // Delete all test executions for this spec
      await this.executions.where('specId').equals(specId).delete()

      // Delete all test cases for this spec
      await this.testCases.where('specId').equals(specId).delete()

      // Delete all endpoints for this spec
      await this.endpoints.where('specId').equals(specId).delete()

      // Delete all environments for this spec
      await this.environments.where('specId').equals(specId).delete()

      // Delete the spec itself
      await this.specs.delete(specId)
    })
  }

  // ============================================
  // Environment Helper Methods
  // ============================================

  /**
   * Get all environments for a spec
   */
  async getEnvironmentsBySpec(specId: number) {
    return this.environments.where('specId').equals(specId).toArray()
  }

  /**
   * Create environment for a spec
   */
  async createEnvironment(env: Omit<Environment, 'id' | 'createdAt' | 'updatedAt'>) {
    const newEnv: Environment = {
      ...env,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.environments.add(newEnv)
    return newEnv
  }

  /**
   * Update environment
   */
  async updateEnvironment(id: string, updates: Partial<Environment>) {
    await this.environments.update(id, {
      ...updates,
      updatedAt: new Date(),
    })
  }

  /**
   * Delete environment
   */
  async deleteEnvironment(id: string) {
    await this.environments.delete(id)
  }

  /**
   * Export environments for a spec
   */
  async exportEnvironments(specId: number) {
    const environments = await this.getEnvironmentsBySpec(specId)
    return {
      version: '1.0.0',
      exportedAt: new Date(),
      specId,
      environments,
    }
  }

  /**
   * Import environments for a spec
   */
  async importEnvironments(specId: number, environments: Omit<Environment, 'id' | 'specId' | 'createdAt' | 'updatedAt'>[]) {
    const newEnvs: Environment[] = environments.map(env => ({
      ...env,
      id: crypto.randomUUID(),
      specId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    await this.environments.bulkAdd(newEnvs)
    return newEnvs
  }
}

// Create singleton instance
export const db = new ApilotDB()

// Export for convenience
export default db
