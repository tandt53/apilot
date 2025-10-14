/**
 * React Query Hooks for Environments
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import * as api from '@/lib/api'
import type {Environment} from '@/types/database'

/**
 * Query keys for environments
 */
export const environmentsKeys = {
  all: ['environments'] as const,
  lists: () => [...environmentsKeys.all, 'list'] as const,
  list: (specId: number) => [...environmentsKeys.lists(), specId] as const,
  details: () => [...environmentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...environmentsKeys.details(), id] as const,
}

/**
 * Get environments by spec
 */
export function useEnvironments(specId: number) {
  return useQuery({
    queryKey: environmentsKeys.list(specId),
    queryFn: () => api.getEnvironmentsBySpec(specId),
    enabled: !!specId,
    staleTime: 30000, // Cache for 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while loading new data
  })
}

/**
 * Get single environment
 */
export function useEnvironment(id: string) {
  return useQuery({
    queryKey: environmentsKeys.detail(id),
    queryFn: () => api.getEnvironment(id),
    enabled: !!id,
  })
}

/**
 * Create environment mutation
 */
export function useCreateEnvironment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Environment, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.createEnvironment(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: environmentsKeys.list(variables.specId) })
    },
  })
}

/**
 * Update environment mutation
 */
export function useUpdateEnvironment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      specId: _specId,
      data,
    }: {
      id: string
      specId: number
      data: Partial<Omit<Environment, 'id' | 'specId' | 'createdAt' | 'updatedAt'>>
    }) => api.updateEnvironment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: environmentsKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: environmentsKeys.list(variables.specId) })
    },
  })
}

/**
 * Delete environment mutation
 */
export function useDeleteEnvironment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, specId: _specId }: { id: string; specId: number }) => api.deleteEnvironment(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: environmentsKeys.list(variables.specId) })
      queryClient.invalidateQueries({ queryKey: environmentsKeys.all })
    },
  })
}

/**
 * Export environments mutation
 */
export function useExportEnvironments() {
  return useMutation({
    mutationFn: (specId: number) => api.exportEnvironments(specId),
  })
}

/**
 * Import environments mutation
 */
export function useImportEnvironments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      specId,
      environments,
    }: {
      specId: number
      environments: Omit<Environment, 'id' | 'specId' | 'createdAt' | 'updatedAt'>[]
    }) => api.importEnvironments(specId, environments),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: environmentsKeys.list(variables.specId) })
    },
  })
}
