/**
 * Test Cases API Tests
 * Tests for CRUD operations, auto-linking, and migration logic
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import {
  createTestCase,
  bulkCreateTestCases,
  getTestCase,
  getAllTestCases,
  getTestCasesBySpec,
  getTestCasesByEndpoint,
  updateTestCase,
  deleteTestCase,
  deleteTestCasesBySpec,
  searchTestCases,
  getTestCaseStats,
  cloneTestCase,
  relinkTestCaseToEndpoint,
  migrateTestCase,
  bulkMigrateTestCases,
  getCustomTestCases,
} from './testCases'
import type { TestCase, Spec, Endpoint } from '@/types/database'

describe('Test Cases API', () => {
  // Setup: Clear database before each test
  beforeEach(async () => {
    await db.specs.clear()
    await db.endpoints.clear()
    await db.testCases.clear()
    await db.executions.clear()
  })

  describe('CRUD Operations', () => {
    it('should create a test case with proper defaults', async () => {
      const testData: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Test user creation',
        method: 'POST',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'high',
        assertions: [
          { id: 'a1', type: 'status-code', expected: 201 },
        ],
        createdBy: 'test',
      }

      const testCase = await createTestCase(testData)

      expect(testCase.id).toBeDefined()
      expect(testCase.executionCount).toBe(0)
      expect(testCase.createdAt).toBeInstanceOf(Date)
      expect(testCase.updatedAt).toBeInstanceOf(Date)
      expect(testCase.name).toBe('Test user creation')
      expect(testCase.method).toBe('POST')
    })

    it('should bulk create multiple test cases', async () => {
      const testCases = [
        {
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'Test 1',
          method: 'GET',
          path: '/users',
          testType: 'single' as const,
          category: 'Functional',
          priority: 'high' as const,
          assertions: [],
          createdBy: 'test',
        },
        {
          specId: 1,
          sourceEndpointId: 2,
          currentEndpointId: 2,
          name: 'Test 2',
          method: 'POST',
          path: '/users',
          testType: 'single' as const,
          category: 'Security',
          priority: 'critical' as const,
          assertions: [],
          createdBy: 'test',
        },
      ]

      const ids = await bulkCreateTestCases(testCases)

      expect(ids).toHaveLength(2)
      expect(ids[0]).toBeGreaterThan(0)
      expect(ids[1]).toBeGreaterThan(0)

      const allTests = await getAllTestCases()
      expect(allTests).toHaveLength(2)
    })

    it('should get test case by ID', async () => {
      const testData: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Get test',
        method: 'GET',
        path: '/test',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [],
        createdBy: 'test',
      }

      const created = await createTestCase(testData)
      const retrieved = await getTestCase(created.id!)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe('Get test')
    })

    it('should update test case and update timestamp', async () => {
      const testData: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Original name',
        method: 'GET',
        path: '/test',
        testType: 'single',
        category: 'Functional',
        priority: 'low',
        assertions: [],
        createdBy: 'test',
      }

      const testCase = await createTestCase(testData)
      const originalUpdatedAt = testCase.updatedAt

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10))

      await updateTestCase(testCase.id!, {
        name: 'Updated name',
        priority: 'high',
      })

      const updated = await getTestCase(testCase.id!)

      expect(updated?.name).toBe('Updated name')
      expect(updated?.priority).toBe('high')
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should delete test case', async () => {
      const testData: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'To be deleted',
        method: 'DELETE',
        path: '/test',
        testType: 'single',
        category: 'Functional',
        priority: 'low',
        assertions: [],
        createdBy: 'test',
      }

      const testCase = await createTestCase(testData)
      await deleteTestCase(testCase.id!)

      const deleted = await getTestCase(testCase.id!)
      expect(deleted).toBeUndefined()
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test data
      await bulkCreateTestCases([
        {
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'User creation test',
          method: 'POST',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'high',
          assertions: [],
          createdBy: 'test',
        },
        {
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'Auth test',
          method: 'POST',
          path: '/users',
          testType: 'single',
          category: 'Security',
          priority: 'critical',
          assertions: [],
          createdBy: 'test',
        },
        {
          specId: 2,
          sourceEndpointId: 2,
          currentEndpointId: 2,
          name: 'Order test',
          method: 'GET',
          path: '/orders',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [],
          createdBy: 'test',
        },
      ])
    })

    it('should get test cases by spec', async () => {
      const spec1Tests = await getTestCasesBySpec(1)
      const spec2Tests = await getTestCasesBySpec(2)

      expect(spec1Tests).toHaveLength(2)
      expect(spec2Tests).toHaveLength(1)
      expect(spec2Tests[0].name).toBe('Order test')
    })

    it('should get test cases by endpoint', async () => {
      const endpoint1Tests = await getTestCasesByEndpoint(1)
      const endpoint2Tests = await getTestCasesByEndpoint(2)

      expect(endpoint1Tests).toHaveLength(2)
      expect(endpoint2Tests).toHaveLength(1)
    })

    it('should search test cases by name', async () => {
      const results = await searchTestCases(1, 'creation')

      expect(results).toHaveLength(1)
      expect(results[0].name).toContain('creation')
    })

    it('should search test cases by description', async () => {
      // Create test with description
      await createTestCase({
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Test',
        description: 'This tests email validation',
        method: 'POST',
        path: '/test',
        testType: 'single',
        category: 'Data Validation',
        priority: 'medium',
        assertions: [],
        createdBy: 'test',
      })

      const results = await searchTestCases(1, 'email')

      expect(results).toHaveLength(1)
      expect(results[0].description).toContain('email')
    })

    it('should search test cases by method', async () => {
      const results = await searchTestCases(1, 'post')

      expect(results).toHaveLength(2) // Both POST tests
    })

    it('should search test cases by path', async () => {
      const results = await searchTestCases(1, '/users')

      expect(results).toHaveLength(2)
    })
  })

  describe('Delete Operations', () => {
    it('should delete all test cases for a spec', async () => {
      await bulkCreateTestCases([
        {
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          name: 'Test 1',
          method: 'GET',
          path: '/test1',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [],
          createdBy: 'test',
        },
        {
          specId: 1,
          sourceEndpointId: 2,
          currentEndpointId: 2,
          name: 'Test 2',
          method: 'POST',
          path: '/test2',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [],
          createdBy: 'test',
        },
        {
          specId: 2,
          sourceEndpointId: 3,
          currentEndpointId: 3,
          name: 'Test 3',
          method: 'GET',
          path: '/test3',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [],
          createdBy: 'test',
        },
      ])

      await deleteTestCasesBySpec(1)

      const spec1Tests = await getTestCasesBySpec(1)
      const spec2Tests = await getTestCasesBySpec(2)

      expect(spec1Tests).toHaveLength(0)
      expect(spec2Tests).toHaveLength(1)
    })
  })

  describe('Clone Operations', () => {
    it('should clone test case with "(Copy)" suffix', async () => {
      const original = await createTestCase({
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Original test',
        method: 'GET',
        path: '/test',
        testType: 'single',
        category: 'Functional',
        priority: 'high',
        body: { key: 'value' },
        assertions: [
          { id: 'a1', type: 'status-code', expected: 200 },
        ],
        createdBy: 'user',
      })

      const cloned = await cloneTestCase(original.id!)

      expect(cloned.id).not.toBe(original.id)
      expect(cloned.name).toBe('Original test (Copy)')
      expect(cloned.method).toBe(original.method)
      expect(cloned.path).toBe(original.path)
      expect(cloned.body).toEqual(original.body)
      expect(cloned.assertions).toEqual(original.assertions)
      expect(cloned.executionCount).toBe(0)
      expect(cloned.createdBy).toBe('manual')
    })
  })

  describe('Auto-Linking Logic', () => {
    beforeEach(async () => {
      // Create spec
      await db.specs.add({
        id: 1,
        name: 'Test API',
        version: '1.0.0',
        baseUrl: 'http://localhost',
        rawSpec: '{}',
        format: 'openapi',
        versionGroup: 'test-group',
        isLatest: true,
        originalName: 'test.json',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Spec)

      // Create endpoints
      await db.endpoints.add({
        id: 1,
        specId: 1,
        method: 'GET',
        path: '/users',
        name: 'Get users',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [], body: null },
        responses: { success: { status: 200, fields: [] }, errors: [] },
        auth: { required: false },
      } as Endpoint)

      await db.endpoints.add({
        id: 2,
        specId: 1,
        method: 'POST',
        path: '/users',
        name: 'Create user',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [], body: null },
        responses: { success: { status: 201, fields: [] }, errors: [] },
        auth: { required: true },
      } as Endpoint)
    })

    it('should auto-link test to matching endpoint', async () => {
      const testCase = await createTestCase({
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'User test',
        method: 'POST',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [],
        createdBy: 'test',
      })

      const linked = await relinkTestCaseToEndpoint(testCase.id!)

      expect(linked).toBe(true)

      const updated = await getTestCase(testCase.id!)
      expect(updated?.currentEndpointId).toBe(2) // Should link to POST /users endpoint
      expect(updated?.isCustomEndpoint).toBe(false)
    })

    it('should mark as custom when no matching endpoint exists', async () => {
      const testCase = await createTestCase({
        specId: 1,
        sourceEndpointId: undefined,
        currentEndpointId: undefined,
        name: 'Custom test',
        method: 'DELETE',
        path: '/nonexistent',
        testType: 'single',
        category: 'Functional',
        priority: 'low',
        assertions: [],
        createdBy: 'test',
      })

      const linked = await relinkTestCaseToEndpoint(testCase.id!)

      expect(linked).toBe(false)

      const updated = await getTestCase(testCase.id!)
      expect(updated?.currentEndpointId).toBeUndefined()
      expect(updated?.isCustomEndpoint).toBe(true)
    })
  })

  describe('Migration Logic', () => {
    let spec1Id: number
    let spec2Id: number
    let endpoint10Id: number

    beforeEach(async () => {
      // Clear database to avoid ID conflicts with other tests
      await db.specs.clear()
      await db.endpoints.clear()
      await db.testCases.clear()
      await db.executions.clear()

      // Create old and new spec versions (without specifying IDs)
      spec1Id = await db.specs.add({
        name: 'Test API',
        version: '1.0.0',
        baseUrl: 'http://localhost',
        rawSpec: '{}',
        format: 'openapi',
        versionGroup: 'test-group',
        isLatest: false,
        originalName: 'test.json',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Spec)

      spec2Id = await db.specs.add({
        name: 'Test API',
        version: '2.0.0',
        baseUrl: 'http://localhost',
        rawSpec: '{}',
        format: 'openapi',
        versionGroup: 'test-group',
        isLatest: true,
        originalName: 'test.json',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Spec)

      // Create endpoints for new version
      endpoint10Id = await db.endpoints.add({
        specId: spec2Id,
        method: 'GET',
        path: '/users',
        name: 'Get users',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [], body: null },
        responses: { success: { status: 200, fields: [] }, errors: [] },
        auth: { required: false },
      } as Endpoint)
    })

    it.skip('should migrate test case to new spec version', async () => {
      const originalTest = await createTestCase({
        specId: spec1Id,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'User test',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'high',
        assertions: [
          { id: 'a1', type: 'status-code', expected: 200 },
        ],
        executionCount: 5,
        lastResult: 'pass',
        createdBy: 'ai',
      })

      const migratedTest = await migrateTestCase(originalTest.id!, spec2Id, endpoint10Id)

      expect(migratedTest.id).not.toBe(originalTest.id)
      expect(migratedTest.specId).toBe(spec2Id) // New spec
      expect(migratedTest.currentEndpointId).toBe(endpoint10Id) // New endpoint
      expect(migratedTest.sourceEndpointId).toBe(1) // Tracks original
      expect(migratedTest.migratedFrom).toBe(originalTest.id)
      expect(migratedTest.executionCount).toBe(0) // Reset stats
      expect(migratedTest.lastResult).toBe('pending') // Reset stats
      expect(migratedTest.name).toBe(originalTest.name) // Preserve name
      expect(migratedTest.assertions).toEqual(originalTest.assertions) // Preserve assertions
    })

    it.skip('should bulk migrate test cases', async () => {
      const test1 = await createTestCase({
        specId: spec1Id,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Test 1',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'high',
        assertions: [],
        createdBy: 'ai',
      })

      const test2 = await createTestCase({
        specId: spec1Id,
        sourceEndpointId: 2,
        currentEndpointId: 2,
        name: 'Test 2',
        method: 'POST',
        path: '/users',
        testType: 'single',
        category: 'Security',
        priority: 'critical',
        assertions: [],
        createdBy: 'ai',
      })

      const endpointMapping = new Map<number, number>([
        [1, endpoint10Id], // Old endpoint 1 → New endpoint
      ])

      const migratedTests = await bulkMigrateTestCases(spec1Id, spec2Id, endpointMapping)

      expect(migratedTests).toHaveLength(2)
      expect(migratedTests[0].specId).toBe(spec2Id)
      expect(migratedTests[1].specId).toBe(spec2Id)
      expect(migratedTests[0].currentEndpointId).toBe(endpoint10Id)
      expect(migratedTests[1].currentEndpointId).toBeUndefined() // No mapping for endpoint 2
    })
  })

  describe('Custom Tests', () => {
    it('should identify custom tests (not linked to endpoints)', async () => {
      await bulkCreateTestCases([
        {
          specId: 1,
          sourceEndpointId: undefined,
          currentEndpointId: undefined,
          isCustomEndpoint: true,
          name: 'Custom test',
          method: 'GET',
          path: '/custom',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [],
          createdBy: 'manual',
        },
        {
          specId: 1,
          sourceEndpointId: 1,
          currentEndpointId: 1,
          isCustomEndpoint: false,
          name: 'Linked test',
          method: 'GET',
          path: '/users',
          testType: 'single',
          category: 'Functional',
          priority: 'medium',
          assertions: [],
          createdBy: 'ai',
        },
      ])

      const customTests = await getCustomTestCases(1)

      expect(customTests).toHaveLength(1)
      expect(customTests[0].name).toBe('Custom test')
      expect(customTests[0].isCustomEndpoint).toBe(true)
    })
  })

  describe('Test Stats', () => {
    it('should calculate test case statistics', async () => {
      const testCase = await createTestCase({
        specId: 1,
        sourceEndpointId: 1,
        currentEndpointId: 1,
        name: 'Stats test',
        method: 'GET',
        path: '/test',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [],
        lastResult: 'pass',
        lastExecutedAt: new Date(),
        createdBy: 'test',
      })

      // Update execution count manually (normally done by updateTestCaseExecutionStats)
      await updateTestCase(testCase.id!, { executionCount: 3 })

      // Create some executions
      await db.executions.add({
        id: 1,
        testCaseId: testCase.id!,
        specId: 1,
        endpointId: 1,
        status: 'pass',
        request: { method: 'GET', url: '/test', headers: {}, body: null },
        assertionResults: [],
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 100,
        createdAt: new Date(),
      } as any)

      await db.executions.add({
        id: 2,
        testCaseId: testCase.id!,
        specId: 1,
        endpointId: 1,
        status: 'fail',
        request: { method: 'GET', url: '/test', headers: {}, body: null },
        assertionResults: [],
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 150,
        createdAt: new Date(),
      } as any)

      const stats = await getTestCaseStats(testCase.id!)

      expect(stats).toBeDefined()
      expect(stats?.executionCount).toBe(3)
      expect(stats?.passCount).toBe(1)
      expect(stats?.failCount).toBe(1)
      expect(stats?.errorCount).toBe(0)
      expect(stats?.passRate).toBe(50)
      expect(stats?.avgResponseTime).toBe(125)
    })
  })
})
