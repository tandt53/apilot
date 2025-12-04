/**
 * Endpoints API Tests
 * Tests for endpoint CRUD operations
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import {
  createEndpoint,
  bulkCreateEndpoints,
  getEndpoint,
  getEndpointsBySpec,
  updateEndpoint,
  deleteEndpoint,
  searchEndpoints,
  getEndpointStats,
} from './endpoints'
import type { Endpoint } from '@/types/database'

describe('Endpoints API', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.endpoints.clear()
    await db.testCases.clear()
    await db.executions.clear()
  })

  describe('CRUD Operations', () => {
    const mockEndpoint: Omit<Endpoint, 'id' | 'createdAt'> = {
      specId: 1,
      method: 'GET',
      path: '/users',
      name: 'Get Users',
      description: 'Retrieve all users',
      operationId: 'getUsers',
      source: 'openapi',
      request: {
        contentType: 'application/json',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            type: 'integer',
            description: 'Number of items to return',
          },
        ],
      },
      responses: {
        '200': {
          description: 'Success',
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: [
                {
                  name: 'id',
                  type: 'integer',
                  required: true,
                },
                {
                  name: 'name',
                  type: 'string',
                  required: true,
                },
              ],
            },
          },
        },
      },
      updatedAt: new Date(),
      createdBy: 'test',
    }

    it('should create a new endpoint', async () => {
      const created = await createEndpoint(mockEndpoint)

      expect(created.id).toBeDefined()
      expect(created.method).toBe('GET')
      expect(created.path).toBe('/users')
      expect(created.name).toBe('Get Users')
      expect(created.createdAt).toBeInstanceOf(Date)
    })

    it('should bulk create endpoints', async () => {
      const endpoints: Omit<Endpoint, 'id' | 'createdAt'>[] = [
        {
          ...mockEndpoint,
          method: 'GET',
          path: '/users',
          name: 'Get Users',
          operationId: 'getUsers',
        },
        {
          ...mockEndpoint,
          method: 'POST',
          path: '/users',
          name: 'Create User',
          operationId: 'createUser',
        },
        {
          ...mockEndpoint,
          method: 'GET',
          path: '/users/{id}',
          name: 'Get User',
          operationId: 'getUser',
        },
      ]

      const ids = await bulkCreateEndpoints(endpoints)

      expect(ids).toHaveLength(3)
      expect(ids.every(id => typeof id === 'number')).toBe(true)

      // Verify endpoints were created
      const allEndpoints = await db.endpoints.toArray()
      expect(allEndpoints).toHaveLength(3)
    })

    it('should get endpoint by ID', async () => {
      const created = await createEndpoint(mockEndpoint)
      const retrieved = await getEndpoint(created.id!)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.method).toBe('GET')
      expect(retrieved?.path).toBe('/users')
    })

    it('should return undefined for non-existent endpoint', async () => {
      const retrieved = await getEndpoint(999)

      expect(retrieved).toBeUndefined()
    })

    it('should get all endpoints for a spec', async () => {
      await createEndpoint({ ...mockEndpoint, specId: 1, path: '/users' })
      await createEndpoint({ ...mockEndpoint, specId: 1, path: '/posts' })
      await createEndpoint({ ...mockEndpoint, specId: 2, path: '/comments' })

      const spec1Endpoints = await getEndpointsBySpec(1)
      const spec2Endpoints = await getEndpointsBySpec(2)

      expect(spec1Endpoints).toHaveLength(2)
      expect(spec2Endpoints).toHaveLength(1)
    })

    it('should update endpoint', async () => {
      const created = await createEndpoint(mockEndpoint)

      await updateEndpoint(created.id!, {
        name: 'Updated Name',
        description: 'Updated description',
        updatedAt: new Date(),
      })

      const updated = await getEndpoint(created.id!)

      expect(updated?.name).toBe('Updated Name')
      expect(updated?.description).toBe('Updated description')
      expect(updated?.method).toBe('GET') // Unchanged
    })

    it('should delete endpoint and mark linked tests as custom', async () => {
      const endpoint = await createEndpoint(mockEndpoint)

      // Create a test case linked to this endpoint
      await db.testCases.add({
        specId: 1,
        currentEndpointId: endpoint.id!,
        name: 'Test for endpoint',
        method: 'GET',
        path: '/users',
        testType: 'single',
        category: 'Functional',
        priority: 'medium',
        assertions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test',
        executionCount: 0,
      } as any)

      await deleteEndpoint(endpoint.id!)

      // Verify endpoint is deleted
      const retrieved = await getEndpoint(endpoint.id!)
      expect(retrieved).toBeUndefined()

      // Verify test case is marked as custom
      const testCases = await db.testCases.toArray()
      expect(testCases[0].isCustomEndpoint).toBe(true)
      expect(testCases[0].currentEndpointId).toBeUndefined()
    })
  })

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Create test data
      await createEndpoint({
        ...{
          specId: 1,
          method: 'GET',
          path: '/users',
          name: 'Get Users',
          description: 'Retrieve all users from database',
          operationId: 'getUsers',
          source: 'openapi',
          request: { contentType: 'application/json', parameters: [] },
          responses: {},
          updatedAt: new Date(),
          createdBy: 'test',
        },
      })

      await createEndpoint({
        ...{
          specId: 1,
          method: 'POST',
          path: '/users',
          name: 'Create User',
          description: 'Create a new user account',
          operationId: 'createUser',
          source: 'openapi',
          request: { contentType: 'application/json', parameters: [] },
          responses: {},
          updatedAt: new Date(),
          createdBy: 'test',
        },
      })

      await createEndpoint({
        ...{
          specId: 1,
          method: 'GET',
          path: '/posts',
          name: 'Get Posts',
          description: 'Fetch all blog posts',
          operationId: 'getPosts',
          source: 'openapi',
          request: { contentType: 'application/json', parameters: [] },
          responses: {},
          updatedAt: new Date(),
          createdBy: 'test',
        },
      })
    })

    it('should search endpoints by path', async () => {
      const results = await searchEndpoints(1, 'users')

      expect(results).toHaveLength(2)
      expect(results.every(e => e.path.includes('users'))).toBe(true)
    })

    it('should search endpoints by name', async () => {
      const results = await searchEndpoints(1, 'Create')

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Create User')
    })

    it('should search endpoints by description', async () => {
      const results = await searchEndpoints(1, 'blog')

      expect(results).toHaveLength(1)
      expect(results[0].description).toContain('blog')
    })

    it('should be case-insensitive', async () => {
      const results = await searchEndpoints(1, 'POSTS')

      expect(results.length).toBeGreaterThan(0)
    })

    it('should return empty array for no matches', async () => {
      const results = await searchEndpoints(1, 'nonexistent')

      expect(results).toHaveLength(0)
    })

    it('should search by HTTP method', async () => {
      const getResults = await searchEndpoints(1, 'GET')
      const postResults = await searchEndpoints(1, 'POST')

      expect(getResults.length).toBeGreaterThan(0)
      expect(postResults.length).toBeGreaterThan(0)
      // POST search will match both method and description containing "POST"
      expect(postResults.some(e => e.method === 'POST')).toBe(true)
    })
  })

  describe('Endpoint Stats', () => {
    it('should get endpoint statistics', async () => {
      const endpoint = await createEndpoint({
        specId: 1,
        method: 'GET',
        path: '/test',
        name: 'Test Endpoint',
        operationId: 'getTest',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [] },
        responses: {},
        updatedAt: new Date(),
        createdBy: 'test',
      })

      // Add test cases
      await db.testCases.add({
        specId: 1,
        currentEndpointId: endpoint.id!,
        name: 'Test 1',
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

      await db.testCases.add({
        specId: 1,
        currentEndpointId: endpoint.id!,
        name: 'Test 2',
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

      const stats = await getEndpointStats(endpoint.id!)

      expect(stats.testCases).toBe(2)
      expect(stats.executions).toBe(0)
    })

    it('should calculate pass rate for endpoint', async () => {
      const endpoint = await createEndpoint({
        specId: 1,
        method: 'GET',
        path: '/test',
        name: 'Test',
        operationId: 'getTest',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [] },
        responses: {},
        updatedAt: new Date(),
        createdBy: 'test',
      })

      const now = new Date()

      // Add executions
      await db.executions.add({
        testCaseId: 1,
        specId: 1,
        endpointId: endpoint.id!,
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
        specId: 1,
        endpointId: endpoint.id!,
        baseUrl: 'https://api.example.com',
        request: { method: 'GET', url: 'https://api.example.com/test', headers: {}, body: undefined },
        status: 'fail',
        assertionResults: [],
        startedAt: now,
        completedAt: now,
        createdAt: now,
      } as any)

      const stats = await getEndpointStats(endpoint.id!)

      expect(stats.executions).toBe(2)
      expect(stats.passCount).toBe(1)
      expect(stats.failCount).toBe(1)
      expect(stats.passRate).toBe(50)
    })
  })

  describe('Data Integrity', () => {
    it('should preserve endpoint request parameters', async () => {
      const endpoint = await createEndpoint({
        specId: 1,
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        operationId: 'getUsers',
        source: 'openapi',
        request: {
          contentType: 'application/json',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              type: 'integer',
            },
            {
              name: 'offset',
              in: 'query',
              required: false,
              type: 'integer',
            },
          ],
        },
        responses: {},
        updatedAt: new Date(),
        createdBy: 'test',
      })

      const retrieved = await getEndpoint(endpoint.id!)

      expect(retrieved?.request.parameters).toHaveLength(2)
      expect(retrieved?.request.parameters[0].name).toBe('limit')
      expect(retrieved?.request.parameters[1].name).toBe('offset')
    })

    it('should preserve endpoint response schemas', async () => {
      const endpoint = await createEndpoint({
        specId: 1,
        method: 'GET',
        path: '/users',
        name: 'Get Users',
        operationId: 'getUsers',
        source: 'openapi',
        request: { contentType: 'application/json', parameters: [] },
        responses: {
          '200': {
            description: 'Success',
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: [
                  { name: 'id', type: 'integer', required: true },
                  { name: 'name', type: 'string', required: true },
                ],
              },
            },
          },
          '404': {
            description: 'Not Found',
          },
        },
        updatedAt: new Date(),
        createdBy: 'test',
      })

      const retrieved = await getEndpoint(endpoint.id!)

      expect(retrieved?.responses['200']).toBeDefined()
      expect(retrieved?.responses['404']).toBeDefined()
      expect(retrieved?.responses['200'].schema?.type).toBe('array')
    })
  })
})
