/**
 * React Query Hooks for Test Cases
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import * as api from '@/lib/api'
import type {TestCase} from '@/types/database'
import {specsKeys} from './useSpecs'
import {endpointsKeys} from './useEndpoints'

/**
 * Query keys for test cases
 */
export const testCasesKeys = {
  all: ['testCases'] as const,
  lists: () => [...testCasesKeys.all, 'list'] as const,
  list: (specId: number) => [...testCasesKeys.lists(), specId] as const,
  byEndpoint: (endpointId: number) => [...testCasesKeys.lists(), 'endpoint', endpointId] as const,
  details: () => [...testCasesKeys.all, 'detail'] as const,
  detail: (id: number) => [...testCasesKeys.details(), id] as const,
  stats: (id: number) => [...testCasesKeys.detail(id), 'stats'] as const,
  categories: (specId: number) => [...testCasesKeys.list(specId), 'categories'] as const,
  tags: (specId: number) => [...testCasesKeys.list(specId), 'tags'] as const,
}

/**
 * Get all test cases
 */
export function useTestCases() {
  return useQuery({
    queryKey: testCasesKeys.all,
    queryFn: () => api.getAllTestCases(),
  })
}

/**
 * Get test cases by spec
 */
export function useTestCasesBySpec(specId: number) {
  return useQuery({
    queryKey: testCasesKeys.list(specId),
    queryFn: () => api.getTestCasesBySpec(specId),
    enabled: !!specId,
  })
}

/**
 * Get test cases by endpoint
 */
export function useTestCasesByEndpoint(endpointId: number) {
  return useQuery({
    queryKey: testCasesKeys.byEndpoint(endpointId),
    queryFn: () => api.getTestCasesByEndpoint(endpointId),
    enabled: !!endpointId,
  })
}

/**
 * Get single test case
 */
export function useTestCase(id: number) {
  return useQuery({
    queryKey: testCasesKeys.detail(id),
    queryFn: () => api.getTestCase(id),
    enabled: !!id,
  })
}

/**
 * Get test case stats
 */
export function useTestCaseStats(id: number) {
  return useQuery({
    queryKey: testCasesKeys.stats(id),
    queryFn: () => api.getTestCaseStats(id),
    enabled: !!id,
  })
}

/**
 * Get spec categories
 */
export function useSpecCategories(specId: number) {
  return useQuery({
    queryKey: testCasesKeys.categories(specId),
    queryFn: () => api.getSpecCategories(specId),
    enabled: !!specId,
  })
}

/**
 * Get spec test tags
 */
export function useSpecTestTags(specId: number) {
  return useQuery({
    queryKey: testCasesKeys.tags(specId),
    queryFn: () => api.getSpecTestTags(specId),
    enabled: !!specId,
  })
}

/**
 * Search test cases
 */
export function useSearchTestCases(specId: number, query: string) {
  return useQuery({
    queryKey: [...testCasesKeys.list(specId), 'search', query],
    queryFn: () => api.searchTestCases(specId, query),
    enabled: !!specId && query.length > 0,
  })
}

/**
 * Get test cases by category
 */
export function useTestCasesByCategory(specId: number, category: string) {
  return useQuery({
    queryKey: [...testCasesKeys.list(specId), 'category', category],
    queryFn: () => api.getTestCasesByCategory(specId, category),
    enabled: !!specId && !!category,
  })
}

/**
 * Get test cases by priority
 */
export function useTestCasesByPriority(specId: number, priority: 'low' | 'medium' | 'high' | 'critical') {
  return useQuery({
    queryKey: [...testCasesKeys.list(specId), 'priority', priority],
    queryFn: () => api.getTestCasesByPriority(specId, priority),
    enabled: !!specId && !!priority,
  })
}

/**
 * Get test cases by result
 */
export function useTestCasesByResult(specId: number, result: 'pass' | 'fail' | 'error' | 'pending') {
  return useQuery({
    queryKey: [...testCasesKeys.list(specId), 'result', result],
    queryFn: () => api.getTestCasesByResult(specId, result),
    enabled: !!specId && !!result,
  })
}

/**
 * Create test case mutation
 */
export function useCreateTestCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>) =>
      api.createTestCase(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: testCasesKeys.list(variables.specId) })
      // Invalidate current endpoint if linked
      if (variables.currentEndpointId) {
        queryClient.invalidateQueries({ queryKey: testCasesKeys.byEndpoint(variables.currentEndpointId) })
        queryClient.invalidateQueries({ queryKey: endpointsKeys.stats(variables.currentEndpointId) })
      }
      queryClient.invalidateQueries({ queryKey: specsKeys.stats(variables.specId) })
    },
  })
}

/**
 * Bulk create test cases mutation
 */
export function useBulkCreateTestCases() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      specId: _specId,
      testCases,
    }: {
      specId: number
      testCases: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>[]
    }) => api.bulkCreateTestCases(testCases),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: testCasesKeys.list(variables.specId) })
      queryClient.invalidateQueries({ queryKey: specsKeys.stats(variables.specId) })
      // Invalidate all endpoint stats for this spec
      queryClient.invalidateQueries({ queryKey: endpointsKeys.list(variables.specId) })
    },
  })
}

/**
 * Update test case mutation (with auto-relink)
 */
export function useUpdateTestCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<Omit<TestCase, 'id' | 'specId' | 'createdAt'>>
    }) => {
      // Update test case
      await api.updateTestCase(id, data)

      // Auto-relink if method or path changed
      if (data.method !== undefined || data.path !== undefined) {
        await api.relinkTestCaseToEndpoint(id)
      }
    },
    onSuccess: async (_, variables) => {
      const testCase = await api.getTestCase(variables.id)
      if (testCase) {
        queryClient.invalidateQueries({ queryKey: testCasesKeys.detail(variables.id) })
        queryClient.invalidateQueries({ queryKey: testCasesKeys.list(testCase.specId) })
        // Invalidate both old and new endpoint queries
        if (testCase.currentEndpointId) {
          queryClient.invalidateQueries({ queryKey: testCasesKeys.byEndpoint(testCase.currentEndpointId) })
        }
        if (testCase.sourceEndpointId && testCase.sourceEndpointId !== testCase.currentEndpointId) {
          queryClient.invalidateQueries({ queryKey: testCasesKeys.byEndpoint(testCase.sourceEndpointId) })
        }
      }
    },
  })
}

/**
 * Delete test case mutation
 */
export function useDeleteTestCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.deleteTestCase(id),
    onSuccess: async (_, id) => {
      const testCase = await api.getTestCase(id)
      if (testCase) {
        queryClient.invalidateQueries({ queryKey: testCasesKeys.list(testCase.specId) })
        // Invalidate current endpoint if linked
        if (testCase.currentEndpointId) {
          queryClient.invalidateQueries({ queryKey: testCasesKeys.byEndpoint(testCase.currentEndpointId) })
          queryClient.invalidateQueries({ queryKey: endpointsKeys.stats(testCase.currentEndpointId) })
        }
        queryClient.invalidateQueries({ queryKey: specsKeys.stats(testCase.specId) })
      }
      queryClient.invalidateQueries({ queryKey: testCasesKeys.all })
    },
  })
}

/**
 * Clone test case mutation
 */
export function useCloneTestCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.cloneTestCase(id),
    onSuccess: async (newTestCase) => {
      queryClient.invalidateQueries({ queryKey: testCasesKeys.list(newTestCase.specId) })
      // Invalidate current endpoint if linked
      if (newTestCase.currentEndpointId) {
        queryClient.invalidateQueries({ queryKey: testCasesKeys.byEndpoint(newTestCase.currentEndpointId) })
      }
    },
  })
}
