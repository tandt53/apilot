/**
 * AI Service - Public API
 * Exports lazy-loaded functions to avoid bundling Node.js modules
 */

export * from './base'
export { getCurrentAIService, testAIConnection } from './client'
