/**
 * React Query Hooks for Settings
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import * as api from '@/lib/api'
import type {Environment, Settings} from '@/types/database'

/**
 * Query keys for settings
 */
export const settingsKeys = {
  all: ['settings'] as const,
  detail: () => [...settingsKeys.all, 'detail'] as const,
  environments: () => [...settingsKeys.all, 'environments'] as const,
}

/**
 * Get settings
 */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: () => api.getSettings(),
  })
}

/**
 * Update settings mutation
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Omit<Settings, 'id'>>) => api.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Update AI provider mutation
 */
export function useUpdateAIProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (provider: 'openai' | 'anthropic' | 'gemini' | 'ollama') =>
      api.updateAIProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Update OpenAI settings mutation
 */
export function useUpdateOpenAISettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: {
      apiKey: string
      model?: string
      temperature?: number
      maxTokens?: number
    }) => api.updateOpenAISettings(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Update Anthropic settings mutation
 */
export function useUpdateAnthropicSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: {
      apiKey: string
      model?: string
      temperature?: number
      maxTokens?: number
    }) => api.updateAnthropicSettings(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Update Gemini settings mutation
 */
export function useUpdateGeminiSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: {
      apiKey: string
      model?: string
      temperature?: number
      maxTokens?: number
    }) => api.updateGeminiSettings(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Update Ollama settings mutation
 */
export function useUpdateOllamaSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: { baseUrl?: string; model?: string; temperature?: number }) =>
      api.updateOllamaSettings(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Add environment mutation
 */
export function useAddEnvironment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (env: Omit<Environment, 'id' | 'createdAt' | 'updatedAt'>) => api.createEnvironment(env),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      queryClient.invalidateQueries({ queryKey: settingsKeys.environments() })
    },
  })
}

/**
 * Update default headers mutation
 */
export function useUpdateDefaultHeaders() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (headers: Record<string, string>) => api.updateDefaultHeaders(headers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Update default timeout mutation
 */
export function useUpdateDefaultTimeout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (timeout: number) => api.updateDefaultTimeout(timeout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Update theme mutation
 */
export function useUpdateTheme() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (theme: 'light' | 'dark' | 'system') => api.updateTheme(theme),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Reset settings mutation
 */
export function useResetSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.resetSettings(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

/**
 * Get decrypted API key (use cautiously)
 */
export function useDecryptedAPIKey(provider: 'openai' | 'anthropic' | 'gemini') {
  return useQuery({
    queryKey: [...settingsKeys.all, 'decrypted', provider],
    queryFn: () => api.getDecryptedAPIKey(provider),
    enabled: false, // Only fetch when explicitly refetch() is called
    staleTime: 0, // Never cache decrypted keys
    gcTime: 0, // Don't keep in cache
  })
}
