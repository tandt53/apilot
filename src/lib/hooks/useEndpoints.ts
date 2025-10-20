/**
 * React Query Hooks for Endpoints
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import * as api from '@/lib/api'
import * as importApi from '@/lib/api/imports'
import type {Endpoint} from '@/types/database'
import type {ImportOptions} from '@/lib/api/imports'
import {specsKeys} from './useSpecs'

/**
 * Query keys for endpoints
 */
export const endpointsKeys = {
  all: ['endpoints'] as const,
  lists: () => [...endpointsKeys.all, 'list'] as const,
  list: (specId: number) => [...endpointsKeys.lists(), specId] as const,
  details: () => [...endpointsKeys.all, 'detail'] as const,
  detail: (id: number) => [...endpointsKeys.details(), id] as const,
  stats: (id: number) => [...endpointsKeys.detail(id), 'stats'] as const,
  tags: (specId: number) => [...endpointsKeys.list(specId), 'tags'] as const,
}

/**
 * Get endpoints by spec
 */
export function useEndpoints(specId: number) {
  return useQuery({
    queryKey: endpointsKeys.list(specId),
    queryFn: () => api.getEndpointsBySpec(specId),
    enabled: !!specId,
  })
}

/**
 * Get single endpoint
 */
export function useEndpoint(id: number) {
  return useQuery({
    queryKey: endpointsKeys.detail(id),
    queryFn: () => api.getEndpoint(id),
    enabled: !!id,
  })
}

/**
 * Get endpoint stats
 */
export function useEndpointStats(id: number) {
  return useQuery({
    queryKey: endpointsKeys.stats(id),
    queryFn: () => api.getEndpointStats(id),
    enabled: !!id,
  })
}

/**
 * Get spec tags
 */
export function useSpecTags(specId: number) {
  return useQuery({
    queryKey: endpointsKeys.tags(specId),
    queryFn: () => api.getSpecTags(specId),
    enabled: !!specId,
  })
}

/**
 * Search endpoints
 */
export function useSearchEndpoints(specId: number, query: string) {
  return useQuery({
    queryKey: [...endpointsKeys.list(specId), 'search', query],
    queryFn: () => api.searchEndpoints(specId, query),
    enabled: !!specId && query.length > 0,
  })
}

/**
 * Get endpoints by method
 */
export function useEndpointsByMethod(specId: number, method: string) {
  return useQuery({
    queryKey: [...endpointsKeys.list(specId), 'method', method],
    queryFn: () => api.getEndpointsByMethod(specId, method),
    enabled: !!specId && !!method,
  })
}

/**
 * Get endpoints by tag
 */
export function useEndpointsByTag(specId: number, tag: string) {
  return useQuery({
    queryKey: [...endpointsKeys.list(specId), 'tag', tag],
    queryFn: () => api.getEndpointsByTag(specId, tag),
    enabled: !!specId && !!tag,
  })
}

/**
 * Create endpoint mutation
 */
export function useCreateEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Endpoint, 'id' | 'createdAt'>) => api.createEndpoint(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: endpointsKeys.list(variables.specId) })
      queryClient.invalidateQueries({ queryKey: specsKeys.stats(variables.specId) })
    },
  })
}

/**
 * Bulk create endpoints mutation
 */
export function useBulkCreateEndpoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      specId: _specId,
      endpoints,
    }: {
      specId: number
      endpoints: Omit<Endpoint, 'id' | 'createdAt'>[]
    }) => api.bulkCreateEndpoints(endpoints),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: endpointsKeys.list(variables.specId) })
      queryClient.invalidateQueries({ queryKey: specsKeys.stats(variables.specId) })
    },
  })
}

/**
 * Update endpoint mutation
 */
export function useUpdateEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: Partial<Omit<Endpoint, 'id' | 'specId' | 'createdAt'>>
    }) => api.updateEndpoint(id, data),
    onSuccess: async (_, variables) => {
      const endpoint = await api.getEndpoint(variables.id)
      if (endpoint) {
        // Invalidate spec-groups (used by SpecsNew.tsx)
        await queryClient.refetchQueries({ queryKey: ['spec-groups'] })

        // Also invalidate endpoints list (in case used elsewhere)
        await queryClient.refetchQueries({ queryKey: endpointsKeys.list(endpoint.specId) })

        // Update detail cache
        queryClient.setQueryData(endpointsKeys.detail(variables.id), endpoint)
      }
    },
  })
}

/**
 * Delete endpoint mutation
 */
export function useDeleteEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.deleteEndpoint(id),
    onSuccess: async (_, id) => {
      const endpoint = await api.getEndpoint(id)
      if (endpoint) {
        queryClient.invalidateQueries({ queryKey: endpointsKeys.list(endpoint.specId) })
        queryClient.invalidateQueries({ queryKey: specsKeys.stats(endpoint.specId) })
      }
      queryClient.invalidateQueries({ queryKey: endpointsKeys.all })
    },
  })
}

// ============================================
// Import Hooks
// ============================================

/**
 * Analyze import to detect duplicates
 */
export function useAnalyzeImport() {
  return useMutation({
    mutationFn: ({
      endpoints,
      targetSpecId,
    }: {
      endpoints: Omit<Endpoint, 'id' | 'createdAt'>[]
      targetSpecId: number
    }) => importApi.analyzeImport(endpoints, targetSpecId),
  })
}

/**
 * Import endpoints to existing spec
 */
export function useImportEndpoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      endpoints,
      targetSpecId,
      options,
    }: {
      endpoints: Omit<Endpoint, 'id' | 'createdAt'>[]
      targetSpecId: number
      options: ImportOptions
    }) => importApi.importEndpoints(endpoints, targetSpecId, options),
    onSuccess: (_, variables) => {
      // Invalidate endpoints list for the target spec
      queryClient.invalidateQueries({ queryKey: endpointsKeys.list(variables.targetSpecId) })

      // Invalidate spec stats
      queryClient.invalidateQueries({ queryKey: specsKeys.stats(variables.targetSpecId) })

      // Invalidate all endpoints (in case deprecated endpoints need updating)
      queryClient.invalidateQueries({ queryKey: endpointsKeys.all })
    },
  })
}

/**
 * Get quick import stats
 */
export function useImportStats() {
  return useMutation({
    mutationFn: ({
      endpoints,
      targetSpecId,
    }: {
      endpoints: Omit<Endpoint, 'id' | 'createdAt'>[]
      targetSpecId: number
    }) => importApi.getImportStats(endpoints, targetSpecId),
  })
}
