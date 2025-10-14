/**
 * React Query Hooks for Test Executions
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import * as api from '@/lib/api'
import type {TestExecution} from '@/types/database'
import {testCasesKeys} from './useTestCases'
import {specsKeys} from './useSpecs'
import {endpointsKeys} from './useEndpoints'

/**
 * Query keys for executions
 */
export const executionsKeys = {
  all: ['executions'] as const,
  lists: () => [...executionsKeys.all, 'list'] as const,
  recent: (limit?: number) => [...executionsKeys.lists(), 'recent', limit] as const,
  byTestCase: (testCaseId: number, limit?: number) => [...executionsKeys.lists(), 'testCase', testCaseId, limit] as const,
  bySpec: (specId: number, limit?: number) => [...executionsKeys.lists(), 'spec', specId, limit] as const,
  byEndpoint: (endpointId: number, limit?: number) => [...executionsKeys.lists(), 'endpoint', endpointId, limit] as const,
  details: () => [...executionsKeys.all, 'detail'] as const,
  detail: (id: number) => [...executionsKeys.details(), id] as const,
  summary: (specId: number) => [...executionsKeys.all, 'summary', specId] as const,
  testCaseSummary: (testCaseId: number) => [...executionsKeys.all, 'testCaseSummary', testCaseId] as const,
  stats: (specId: number, startDate: Date, endDate: Date) => [
    ...executionsKeys.all,
    'stats',
    specId,
    startDate.toISOString(),
    endDate.toISOString(),
  ] as const,
}

/**
 * Get recent executions
 */
export function useRecentExecutions(limit: number = 50) {
  return useQuery({
    queryKey: executionsKeys.recent(limit),
    queryFn: () => api.getRecentExecutions(limit),
  })
}

/**
 * Get executions by test case
 */
export function useExecutionsByTestCase(testCaseId: number, limit: number = 20) {
  return useQuery({
    queryKey: executionsKeys.byTestCase(testCaseId, limit),
    queryFn: () => api.getExecutionsByTestCase(testCaseId, limit),
    enabled: !!testCaseId,
  })
}

/**
 * Get executions by spec
 */
export function useExecutionsBySpec(specId: number, limit: number = 50) {
  return useQuery({
    queryKey: executionsKeys.bySpec(specId, limit),
    queryFn: () => api.getExecutionsBySpec(specId, limit),
    enabled: !!specId,
  })
}

/**
 * Get executions by endpoint
 */
export function useExecutionsByEndpoint(endpointId: number, limit: number = 50) {
  return useQuery({
    queryKey: executionsKeys.byEndpoint(endpointId, limit),
    queryFn: () => api.getExecutionsByEndpoint(endpointId, limit),
    enabled: !!endpointId,
  })
}

/**
 * Get single execution
 */
export function useExecution(id: number) {
  return useQuery({
    queryKey: executionsKeys.detail(id),
    queryFn: () => api.getExecution(id),
    enabled: !!id,
  })
}

/**
 * Get spec execution summary
 */
export function useSpecExecutionSummary(specId: number) {
  return useQuery({
    queryKey: executionsKeys.summary(specId),
    queryFn: () => api.getSpecExecutionSummary(specId),
    enabled: !!specId,
  })
}

/**
 * Get test case execution summary
 */
export function useTestCaseExecutionSummary(testCaseId: number) {
  return useQuery({
    queryKey: executionsKeys.testCaseSummary(testCaseId),
    queryFn: () => api.getTestCaseExecutionSummary(testCaseId),
    enabled: !!testCaseId,
  })
}

/**
 * Get execution stats by date range
 */
export function useExecutionStats(specId: number, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: executionsKeys.stats(specId, startDate, endDate),
    queryFn: () => api.getExecutionStatsByDateRange(specId, startDate, endDate),
    enabled: !!specId,
  })
}

/**
 * Get executions by status
 */
export function useExecutionsByStatus(
  specId: number,
  status: 'pending' | 'running' | 'pass' | 'fail' | 'error',
  limit: number = 50
) {
  return useQuery({
    queryKey: [...executionsKeys.bySpec(specId), 'status', status, limit],
    queryFn: () => api.getExecutionsByStatus(specId, status, limit),
    enabled: !!specId && !!status,
  })
}

/**
 * Get executions by environment
 */
export function useExecutionsByEnvironment(specId: number, environment: string, limit: number = 50) {
  return useQuery({
    queryKey: [...executionsKeys.bySpec(specId), 'environment', environment, limit],
    queryFn: () => api.getExecutionsByEnvironment(specId, environment, limit),
    enabled: !!specId && !!environment,
  })
}

/**
 * Create execution mutation
 */
export function useCreateExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<TestExecution, 'id' | 'createdAt'>) => api.createExecution(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: executionsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: executionsKeys.byTestCase(variables.testCaseId) })
      queryClient.invalidateQueries({ queryKey: executionsKeys.bySpec(variables.specId) })
      queryClient.invalidateQueries({ queryKey: executionsKeys.byEndpoint(variables.endpointId) })
      queryClient.invalidateQueries({ queryKey: executionsKeys.summary(variables.specId) })
      queryClient.invalidateQueries({ queryKey: executionsKeys.testCaseSummary(variables.testCaseId) })
      queryClient.invalidateQueries({ queryKey: testCasesKeys.detail(variables.testCaseId) })
      queryClient.invalidateQueries({ queryKey: testCasesKeys.stats(variables.testCaseId) })
      queryClient.invalidateQueries({ queryKey: specsKeys.stats(variables.specId) })
      queryClient.invalidateQueries({ queryKey: endpointsKeys.stats(variables.endpointId) })
    },
  })
}

/**
 * Update execution mutation
 */
export function useUpdateExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: Partial<Omit<TestExecution, 'id' | 'testCaseId' | 'specId' | 'endpointId' | 'createdAt'>>
    }) => api.updateExecution(id, data),
    onSuccess: async (_, variables) => {
      const execution = await api.getExecution(variables.id)
      if (execution) {
        queryClient.invalidateQueries({ queryKey: executionsKeys.detail(variables.id) })
        queryClient.invalidateQueries({ queryKey: executionsKeys.byTestCase(execution.testCaseId) })
        queryClient.invalidateQueries({ queryKey: executionsKeys.bySpec(execution.specId) })
        queryClient.invalidateQueries({ queryKey: executionsKeys.byEndpoint(execution.endpointId) })
        queryClient.invalidateQueries({ queryKey: executionsKeys.summary(execution.specId) })
        queryClient.invalidateQueries({ queryKey: executionsKeys.testCaseSummary(execution.testCaseId) })
        queryClient.invalidateQueries({ queryKey: testCasesKeys.stats(execution.testCaseId) })
      }
    },
  })
}

/**
 * Delete execution mutation
 */
export function useDeleteExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.deleteExecution(id),
    onSuccess: async (_, id) => {
      const execution = await api.getExecution(id)
      if (execution) {
        queryClient.invalidateQueries({ queryKey: executionsKeys.lists() })
        queryClient.invalidateQueries({ queryKey: executionsKeys.byTestCase(execution.testCaseId) })
        queryClient.invalidateQueries({ queryKey: executionsKeys.bySpec(execution.specId) })
        queryClient.invalidateQueries({ queryKey: executionsKeys.summary(execution.specId) })
        queryClient.invalidateQueries({ queryKey: testCasesKeys.stats(execution.testCaseId) })
      }
      queryClient.invalidateQueries({ queryKey: executionsKeys.all })
    },
  })
}

/**
 * Delete old executions mutation
 */
export function useDeleteOldExecutions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (daysToKeep: number = 30) => api.deleteOldExecutions(daysToKeep),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionsKeys.all })
      queryClient.invalidateQueries({ queryKey: testCasesKeys.all })
      queryClient.invalidateQueries({ queryKey: specsKeys.all })
    },
  })
}

/**
 * Execute test case mutation
 * Runs a test case and creates an execution record
 */
export function useExecuteTestCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (testCaseId: number) => {
      const testCase = await api.getTestCase(testCaseId)
      if (!testCase) {
        throw new Error('Test case not found')
      }

      // Execute the test via Electron IPC
      const result = await window.electron.executeTest(testCase)

      // Create execution record
      const execution = await api.createExecution({
        testCaseId: testCase.id!,
        specId: testCase.specId,
        endpointId: testCase.currentEndpointId!,
        baseUrl: result.baseUrl || 'http://localhost:3000',
        request: {
          method: testCase.method,
          url: result.url || testCase.path,
          headers: testCase.headers || {},
          body: testCase.body
        },
        status: result.passed ? 'pass' : 'fail',
        response: result.response ? {
          statusCode: result.statusCode,
          statusText: result.statusText || '',
          headers: result.responseHeaders || {},
          body: result.responseBody,
          responseTime: result.responseTime
        } : undefined,
        error: result.error,
        assertionResults: result.assertionResults,
        startedAt: new Date(),
      })

      return execution
    },
    onSuccess: (execution) => {
      queryClient.invalidateQueries({ queryKey: executionsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: executionsKeys.byTestCase(execution.testCaseId) })
      queryClient.invalidateQueries({ queryKey: executionsKeys.bySpec(execution.specId) })
      queryClient.invalidateQueries({ queryKey: testCasesKeys.detail(execution.testCaseId) })
      queryClient.invalidateQueries({ queryKey: testCasesKeys.stats(execution.testCaseId) })
    },
  })
}
