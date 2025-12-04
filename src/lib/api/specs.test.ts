/**
 * Specs API Tests
 * Tests for spec CRUD operations
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import {
  createSpec,
  getSpec,
  getAllSpecs,
  updateSpec,
  deleteSpec,
  searchSpecs,
  getSpecStats,
  getSpecVersions,
  getLatestSpecVersion,
  findSpecsByName,
  createSpecVersion,
} from './specs'
import type { Spec } from '@/types/database'

describe('Specs API', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.specs.clear()
    await db.endpoints.clear()
    await db.testCases.clear()
    await db.executions.clear()
  })

  describe('CRUD Operations', () => {
    it('should create a new spec', async () => {
      const specData: Omit<Spec, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'Pet Store API',
        version: '1.0.0',
        description: 'Pet store management API',
        baseUrl: 'https://petstore.swagger.io/v2',
        rawSpec: '{"openapi": "3.0.0"}',
        format: 'openapi',
        versionGroup: 'test-uuid-123',
        isLatest: true,
        originalName: 'Pet Store API',
      }

      const created = await createSpec(specData)

      expect(created.id).toBeDefined()
      expect(created.name).toBe('Pet Store API')
      expect(created.version).toBe('1.0.0')
      expect(created.createdAt).toBeInstanceOf(Date)
      expect(created.updatedAt).toBeInstanceOf(Date)
    })

    it('should get spec by ID', async () => {
      const specData: Omit<Spec, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'Test API',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup: 'uuid-1',
        isLatest: true,
        originalName: 'Test API',
      }

      const created = await createSpec(specData)
      const retrieved = await getSpec(created.id!)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe('Test API')
    })

    it('should return undefined for non-existent spec', async () => {
      const retrieved = await getSpec(999)

      expect(retrieved).toBeUndefined()
    })

    it('should get all specs ordered by updatedAt', async () => {
      // Create multiple specs
      await createSpec({
        name: 'API 1',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup: 'uuid-1',
        isLatest: true,
        originalName: 'API 1',
      })

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      await createSpec({
        name: 'API 2',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup: 'uuid-2',
        isLatest: true,
        originalName: 'API 2',
      })

      const specs = await getAllSpecs()

      expect(specs).toHaveLength(2)
      // Most recent should be first
      expect(specs[0].name).toBe('API 2')
      expect(specs[1].name).toBe('API 1')
    })

    it('should update spec', async () => {
      const created = await createSpec({
        name: 'Original Name',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup: 'uuid-1',
        isLatest: true,
        originalName: 'Original Name',
      })

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      await updateSpec(created.id!, {
        name: 'Updated Name',
        description: 'Updated description',
      })

      const updated = await getSpec(created.id!)

      expect(updated?.name).toBe('Updated Name')
      expect(updated?.description).toBe('Updated description')
      expect(updated?.version).toBe('1.0.0') // Unchanged
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime())
    })

    it('should delete spec and cascade delete related data', async () => {
      const spec = await createSpec({
        name: 'To Delete',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup: 'uuid-1',
        isLatest: true,
        originalName: 'To Delete',
      })

      // Add related data
      await db.endpoints.add({
        specId: spec.id!,
        method: 'GET',
        path: '/test',
        name: 'Test Endpoint',
        operationId: 'getTest',
        source: 'openapi',
        request: {
          contentType: 'application/json',
          parameters: [],
        },
        responses: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test',
      } as any)

      await db.testCases.add({
        specId: spec.id!,
        currentEndpointId: 1,
        name: 'Test Case',
        method: 'GET',
        path: '/test',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test',
        executionCount: 0,
      } as any)

      await deleteSpec(spec.id!)

      // Verify spec is deleted
      const retrieved = await getSpec(spec.id!)
      expect(retrieved).toBeUndefined()

      // Verify related data is deleted
      const endpoints = await db.endpoints.where('specId').equals(spec.id!).count()
      const testCases = await db.testCases.where('specId').equals(spec.id!).count()

      expect(endpoints).toBe(0)
      expect(testCases).toBe(0)
    })
  })

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Create test data
      await createSpec({
        name: 'Pet Store API',
        version: '1.0.0',
        description: 'Manage pets and orders',
        rawSpec: '{}',
        versionGroup: 'uuid-1',
        isLatest: true,
        originalName: 'Pet Store API',
      })

      await createSpec({
        name: 'User Management API',
        version: '2.0.0',
        description: 'Handle user authentication',
        rawSpec: '{}',
        versionGroup: 'uuid-2',
        isLatest: true,
        originalName: 'User Management API',
      })

      await createSpec({
        name: 'Order API',
        version: '1.5.0',
        description: 'Process orders and payments',
        rawSpec: '{}',
        versionGroup: 'uuid-3',
        isLatest: true,
        originalName: 'Order API',
      })
    })

    it('should search specs by name', async () => {
      const results = await searchSpecs('pet')

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Pet Store API')
    })

    it('should search specs by description', async () => {
      const results = await searchSpecs('authentication')

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('User Management API')
    })

    it('should be case-insensitive', async () => {
      const results = await searchSpecs('ORDER')

      expect(results).toHaveLength(2) // "Order API" and "Pet Store API" (contains "orders")
    })

    it('should return empty array for no matches', async () => {
      const results = await searchSpecs('nonexistent')

      expect(results).toHaveLength(0)
    })

    it('should return all specs for empty query', async () => {
      const results = await searchSpecs('')

      expect(results).toHaveLength(3)
    })

    it('should find specs by name using findSpecsByName', async () => {
      const results = await findSpecsByName('user')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toContain('User')
    })
  })

  describe('Spec Stats', () => {
    it('should get spec statistics', async () => {
      const spec = await createSpec({
        name: 'Test API',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup: 'uuid-1',
        isLatest: true,
        originalName: 'Test API',
      })

      // Add related data
      await db.endpoints.add({
        specId: spec.id!,
        method: 'GET',
        path: '/test1',
        name: 'Test 1',
        operationId: 'getTest1',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [] },
        responses: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test',
      } as any)

      await db.endpoints.add({
        specId: spec.id!,
        method: 'POST',
        path: '/test2',
        name: 'Test 2',
        operationId: 'postTest2',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [] },
        responses: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test',
      } as any)

      await db.testCases.add({
        specId: spec.id!,
        currentEndpointId: 1,
        name: 'Test Case 1',
        method: 'GET',
        path: '/test1',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test',
        executionCount: 0,
      } as any)

      const stats = await getSpecStats(spec.id!)

      expect(stats.endpoints).toBe(2)
      expect(stats.testCases).toBe(1)
      expect(stats.executions).toBe(0)
      expect(stats.passCount).toBe(0)
      expect(stats.failCount).toBe(0)
      expect(stats.errorCount).toBe(0)
      expect(stats.passRate).toBe(0)
    })

    it('should calculate pass rate correctly', async () => {
      const spec = await createSpec({
        name: 'Test API',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup: 'uuid-1',
        isLatest: true,
        originalName: 'Test API',
      })

      // Add test executions
      const now = new Date()

      await db.executions.add({
        testCaseId: 1,
        specId: spec.id!,
        endpointId: 1,
        baseUrl: 'https://api.example.com',
        request: { method: 'GET', url: 'https://api.example.com/test', headers: {}, body: undefined },
        status: 'pass',
        assertionResults: [],
        startedAt: now,
        completedAt: now,
        createdAt: now,
      } as any)

      await db.executions.add({
        testCaseId: 2,
        specId: spec.id!,
        endpointId: 1,
        baseUrl: 'https://api.example.com',
        request: { method: 'GET', url: 'https://api.example.com/test', headers: {}, body: undefined },
        status: 'pass',
        assertionResults: [],
        startedAt: now,
        completedAt: now,
        createdAt: now,
      } as any)

      await db.executions.add({
        testCaseId: 3,
        specId: spec.id!,
        endpointId: 1,
        baseUrl: 'https://api.example.com',
        request: { method: 'GET', url: 'https://api.example.com/test', headers: {}, body: undefined },
        status: 'fail',
        assertionResults: [],
        startedAt: now,
        completedAt: now,
        createdAt: now,
      } as any)

      const stats = await getSpecStats(spec.id!)

      expect(stats.executions).toBe(3)
      expect(stats.passCount).toBe(2)
      expect(stats.failCount).toBe(1)
      expect(stats.passRate).toBeCloseTo(66.67, 1)
    })
  })

  describe('Versioning Operations', () => {
    it('should get all versions of a spec', async () => {
      const versionGroup = 'version-group-123'

      await createSpec({
        name: 'API v1',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup,
        previousVersionId: undefined,
        isLatest: false,
        originalName: 'API',
      })

      await createSpec({
        name: 'API v2',
        version: '2.0.0',
        rawSpec: '{}',
        versionGroup,
        previousVersionId: 1,
        isLatest: true,
        originalName: 'API',
      })

      const versions = await getSpecVersions(versionGroup)

      expect(versions).toHaveLength(2)
    })

    it('should get latest version of a spec', async () => {
      const versionGroup = 'version-group-456'

      await createSpec({
        name: 'API v1',
        version: '1.0.0',
        rawSpec: '{}',
        versionGroup,
        isLatest: false,
        originalName: 'API',
      })

      await createSpec({
        name: 'API v2',
        version: '2.0.0',
        rawSpec: '{}',
        versionGroup,
        isLatest: true,
        originalName: 'API',
      })

      const latest = await getLatestSpecVersion(versionGroup)

      expect(latest).toBeDefined()
      expect(latest?.version).toBe('2.0.0')
      expect(latest?.isLatest).toBe(true)
    })

    it('should create a new version of existing spec', async () => {
      const previousSpec = await createSpec({
        name: 'API v1',
        version: '1.0.0',
        rawSpec: '{"openapi": "3.0.0"}',
        versionGroup: 'vg-789',
        isLatest: true,
        originalName: 'API',
      })

      const newVersion = await createSpecVersion(previousSpec.id!, {
        name: 'API v2',
        version: '2.0.0',
        rawSpec: '{"openapi": "3.1.0"}',
        originalName: 'API',
      })

      expect(newVersion.versionGroup).toBe('vg-789')
      expect(newVersion.previousVersionId).toBe(previousSpec.id)
      expect(newVersion.isLatest).toBe(true)

      // Verify previous version is no longer latest
      const updatedPrevious = await getSpec(previousSpec.id!)
      expect(updatedPrevious?.isLatest).toBe(false)
    })

    it('should throw error when creating version for non-existent spec', async () => {
      await expect(
        createSpecVersion(999, {
          name: 'API v2',
          version: '2.0.0',
          rawSpec: '{}',
          originalName: 'API',
        })
      ).rejects.toThrow('Previous spec with ID 999 not found')
    })
  })
})
