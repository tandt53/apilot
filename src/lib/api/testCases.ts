/**
 * Test Cases API
 * CRUD operations for test cases
 */

import {db} from '@/lib/db'
import type {TestCase} from '@/types/database'

/**
 * Create a new test case
 */
export async function createTestCase(data: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<TestCase> {
  console.log('[createTestCase] Creating test case:', { name: data.name, specId: data.specId, method: data.method, path: data.path })

  const now = new Date()
  const testCase: Omit<TestCase, 'id'> = {
    ...data,
    executionCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.testCases.add(testCase as TestCase)
  console.log('[createTestCase] Test case created with ID:', id)

  return { ...testCase, id } as TestCase
}

/**
 * Bulk create test cases
 */
export async function bulkCreateTestCases(
  testCases: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>[]
): Promise<number[]> {
  const now = new Date()
  const testCasesWithTimestamp = testCases.map(tc => ({
    ...tc,
    executionCount: 0,
    createdAt: now,
    updatedAt: now,
  })) as TestCase[]

  const ids = await db.testCases.bulkAdd(testCasesWithTimestamp, { allKeys: true })
  return ids as number[]
}

/**
 * Get test case by ID
 */
export async function getTestCase(id: number): Promise<TestCase | undefined> {
  return db.testCases.get(id)
}

/**
 * Get all test cases
 */
export async function getAllTestCases(): Promise<TestCase[]> {
  return db.testCases.toArray()
}

/**
 * Get all test cases for a spec
 */
export async function getTestCasesBySpec(specId: number): Promise<TestCase[]> {
  return db.getTestCasesBySpec(specId)
}

/**
 * Get all test cases for an endpoint
 */
export async function getTestCasesByEndpoint(endpointId: number): Promise<TestCase[]> {
  return db.getTestCasesByEndpoint(endpointId)
}

/**
 * Update test case
 */
export async function updateTestCase(id: number, data: Partial<Omit<TestCase, 'id' | 'specId' | 'createdAt'>>): Promise<void> {
  await db.testCases.update(id, {
    ...data,
    updatedAt: new Date(),
  })
}

/**
 * Delete test case (and all executions)
 */
export async function deleteTestCase(id: number): Promise<void> {
  await db.deleteTestCase(id)
}

/**
 * Get test cases by category
 */
export async function getTestCasesByCategory(specId: number, category: string): Promise<TestCase[]> {
  return db.testCases
    .where(['specId', 'category'])
    .equals([specId, category])
    .toArray()
}

/**
 * Get test cases by priority
 */
export async function getTestCasesByPriority(specId: number, priority: 'low' | 'medium' | 'high' | 'critical'): Promise<TestCase[]> {
  return db.testCases
    .where(['specId', 'priority'])
    .equals([specId, priority])
    .toArray()
}

/**
 * Get test cases by result
 */
export async function getTestCasesByResult(specId: number, result: 'pass' | 'fail' | 'error' | 'pending'): Promise<TestCase[]> {
  return db.testCases
    .where(['specId', 'lastResult'])
    .equals([specId, result])
    .toArray()
}

/**
 * Search test cases
 */
export async function searchTestCases(specId: number, query: string): Promise<TestCase[]> {
  const normalizedQuery = query.toLowerCase()
  return db.testCases
    .where('specId')
    .equals(specId)
    .filter(testCase =>
      testCase.name.toLowerCase().includes(normalizedQuery) ||
      (testCase.description?.toLowerCase().includes(normalizedQuery) ?? false) ||
      testCase.path.toLowerCase().includes(normalizedQuery) ||
      testCase.method.toLowerCase().includes(normalizedQuery)
    )
    .toArray()
}

/**
 * Get test case stats
 */
export async function getTestCaseStats(testCaseId: number) {
  const testCase = await db.testCases.get(testCaseId)
  if (!testCase) {
    return null
  }

  const executions = await db.executions
    .where('testCaseId')
    .equals(testCaseId)
    .toArray()

  const passCount = executions.filter(e => e.status === 'pass').length
  const failCount = executions.filter(e => e.status === 'fail').length
  const errorCount = executions.filter(e => e.status === 'error').length

  // Calculate average response time
  const completedExecutions = executions.filter(e => e.duration !== undefined)
  const avgResponseTime = completedExecutions.length > 0
    ? completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / completedExecutions.length
    : 0

  // Get last 5 executions
  const recentExecutions = executions
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 5)

  return {
    executionCount: testCase.executionCount,
    passCount,
    failCount,
    errorCount,
    passRate: executions.length > 0 ? (passCount / executions.length) * 100 : 0,
    avgResponseTime,
    lastExecutedAt: testCase.lastExecutedAt,
    lastResult: testCase.lastResult,
    recentExecutions,
  }
}

/**
 * Get all unique categories for a spec
 */
export async function getSpecCategories(specId: number): Promise<string[]> {
  const testCases = await db.testCases.where('specId').equals(specId).toArray()
  const categoriesSet = new Set<string>()

  testCases.forEach(testCase => {
    if (testCase.category) {
      categoriesSet.add(testCase.category)
    }
  })

  return Array.from(categoriesSet).sort()
}

/**
 * Get all unique tags for a spec
 */
export async function getSpecTestTags(specId: number): Promise<string[]> {
  const testCases = await db.testCases.where('specId').equals(specId).toArray()
  const tagsSet = new Set<string>()

  testCases.forEach(testCase => {
    testCase.tags?.forEach(tag => tagsSet.add(tag))
  })

  return Array.from(tagsSet).sort()
}

/**
 * Clone test case
 */
export async function cloneTestCase(id: number): Promise<TestCase> {
  const original = await db.testCases.get(id)
  if (!original) {
    throw new Error('Test case not found')
  }

  const { id: _, createdAt: __, updatedAt: ___, lastExecutedAt: ____, executionCount: _____, lastResult: ______, ...data } = original

  return createTestCase({
    ...data,
    name: `${data.name} (Copy)`,
    createdBy: 'manual',
  })
}

/**
 * Update test case execution stats (internal use)
 */
export async function updateTestCaseExecutionStats(
  testCaseId: number,
  result: 'pass' | 'fail' | 'error'
): Promise<void> {
  await db.updateTestCaseStats(testCaseId, result)
}

// ============================================
// Versioning and Flexible Linking API Functions
// ============================================

/**
 * Get test cases that need migration (from old spec version)
 */
export async function getTestCasesForMigration(oldSpecId: number): Promise<TestCase[]> {
  return db.getTestCasesForMigration(oldSpecId)
}

/**
 * Get all custom tests (not linked to any endpoint)
 */
export async function getCustomTestCases(specId: number): Promise<TestCase[]> {
  return db.getCustomTestCases(specId)
}

/**
 * Get test migration chain (follow migratedFrom links)
 */
export async function getTestMigrationChain(testCaseId: number): Promise<TestCase[]> {
  return db.getTestMigrationChain(testCaseId)
}

/**
 * Find test case by method + path within a spec
 */
export async function findTestCaseByEndpoint(
  specId: number,
  method: string,
  path: string
): Promise<TestCase[]> {
  return db.findTestCase(specId, method, path)
}

/**
 * Update test case endpoint linking (auto-relink)
 * When user edits method/path, find matching endpoint and update currentEndpointId
 */
export async function relinkTestCaseToEndpoint(testCaseId: number): Promise<boolean> {
  const testCase = await db.testCases.get(testCaseId)
  if (!testCase) return false

  // Find matching endpoint by method + path
  const matchingEndpoint = await db.findEndpoint(testCase.specId, testCase.method, testCase.path)

  if (matchingEndpoint) {
    // Found matching endpoint - relink
    await db.testCases.update(testCaseId, {
      currentEndpointId: matchingEndpoint.id,
      isCustomEndpoint: false, // No longer custom
      updatedAt: new Date(),
    })
    return true
  } else {
    // No matching endpoint - mark as custom
    await db.testCases.update(testCaseId, {
      currentEndpointId: undefined,
      isCustomEndpoint: true, // Custom test
      updatedAt: new Date(),
    })
    return false
  }
}

/**
 * Migrate test case to new spec version
 * Creates new test record linked to new spec, preserves old test
 */
export async function migrateTestCase(
  testCaseId: number,
  newSpecId: number,
  newEndpointId?: number
): Promise<TestCase> {
  const original = await db.testCases.get(testCaseId)
  if (!original) {
    throw new Error('Test case not found')
  }

  // Create new test case (preserve original)
  const now = new Date()
  const migratedTest: Omit<TestCase, 'id'> = {
    // Copy all test data
    ...original,

    // Update ownership
    specId: newSpecId, // Owned by new spec version

    // Update endpoint linking
    sourceEndpointId: original.currentEndpointId || original.sourceEndpointId, // Track original
    currentEndpointId: newEndpointId, // Link to new endpoint (if found)
    isCustomEndpoint: !newEndpointId, // Custom if no matching endpoint

    // Track migration chain
    migratedFrom: testCaseId, // Link to original test

    // Reset execution stats (new version = fresh start)
    lastExecutedAt: undefined,
    lastResult: 'pending' as const,
    executionCount: 0,

    // Update timestamps
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.testCases.add(migratedTest as TestCase)
  return { ...migratedTest, id } as TestCase
}

/**
 * Bulk migrate test cases to new spec version
 */
export async function bulkMigrateTestCases(
  oldSpecId: number,
  newSpecId: number,
  endpointMapping: Map<number, number> // Map old endpoint ID to new endpoint ID
): Promise<TestCase[]> {
  const testCasesToMigrate = await db.getTestCasesForMigration(oldSpecId)
  const migratedTests: TestCase[] = []

  for (const testCase of testCasesToMigrate) {
    // Find new endpoint ID from mapping
    const oldEndpointId = testCase.currentEndpointId || testCase.sourceEndpointId
    const newEndpointId = oldEndpointId ? endpointMapping.get(oldEndpointId) : undefined

    // Migrate test case
    const migratedTest = await migrateTestCase(testCase.id!, newSpecId, newEndpointId)
    migratedTests.push(migratedTest)
  }

  return migratedTests
}
