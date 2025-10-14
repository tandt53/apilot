/**
 * React Query Hooks for Specs
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import * as api from '@/lib/api'
import type {Spec} from '@/types/database'

/**
 * Query keys for specs
 */
export const specsKeys = {
  all: ['specs'] as const,
  lists: () => [...specsKeys.all, 'list'] as const,
  list: (filters?: any) => [...specsKeys.lists(), filters] as const,
  details: () => [...specsKeys.all, 'detail'] as const,
  detail: (id: number) => [...specsKeys.details(), id] as const,
  stats: (id: number) => [...specsKeys.detail(id), 'stats'] as const,
}

/**
 * Get all specs
 */
export function useSpecs() {
  return useQuery({
    queryKey: specsKeys.lists(),
    queryFn: () => api.getAllSpecs(),
  })
}

/**
 * Get single spec
 */
export function useSpec(id: number) {
  return useQuery({
    queryKey: specsKeys.detail(id),
    queryFn: () => api.getSpec(id),
    enabled: !!id,
  })
}

/**
 * Get spec stats
 */
export function useSpecStats(id: number) {
  return useQuery({
    queryKey: specsKeys.stats(id),
    queryFn: () => api.getSpecStats(id),
    enabled: !!id,
  })
}

/**
 * Search specs
 */
export function useSearchSpecs(query: string) {
  return useQuery({
    queryKey: [...specsKeys.lists(), 'search', query],
    queryFn: () => api.searchSpecs(query),
    enabled: query.length > 0,
  })
}

/**
 * Create spec mutation
 */
export function useCreateSpec() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Spec, 'id' | 'createdAt' | 'updatedAt'>) => api.createSpec(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specsKeys.lists() })
    },
  })
}

/**
 * Update spec mutation
 */
export function useUpdateSpec() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Spec, 'id' | 'createdAt'>> }) =>
      api.updateSpec(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: specsKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: specsKeys.lists() })
    },
  })
}

/**
 * Delete spec mutation
 */
export function useDeleteSpec() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.deleteSpec(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specsKeys.all })
    },
  })
}
