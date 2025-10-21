/**
 * Database Type Definitions
 * TypeScript interfaces for IndexedDB schema using Dexie
 */

import type {CanonicalEndpoint} from './canonical'

// ============================================
// API Specification Types
// ============================================

export type SpecFormat = 'openapi' | 'swagger' | 'postman' | 'curl'

/**
 * API Specification - Root entity
 */
export interface Spec {
  id?: number // Auto-increment primary key
  name: string // Display name
  version: string // API version (e.g., "1.0.0")
  description?: string // Optional description
  baseUrl?: string // Base URL for API
  rawSpec: string // Original spec content (JSON for OpenAPI/Swagger/Postman, cURL command for cURL)
  format?: SpecFormat // Import format (openapi/swagger/postman/curl) - optional for backward compatibility

  // V2: Versioning fields
  versionGroup: string // UUID to group versions together
  previousVersionId?: number // Link to previous version (NULL for first)
  isLatest: boolean // Flag to mark latest version

  // V2: Name tracking
  originalName: string // Name from OpenAPI file (immutable)
  displayName?: string // User-customized name (optional)
  nameHistory?: NameChange[] // Track name changes over time

  createdAt: Date
  updatedAt: Date
}

/**
 * Name Change - Track spec name changes
 */
export interface NameChange {
  changedAt: Date
  oldName: string
  newName: string
  reason: 'user-edit' | 'spec-update' | 'import'
  userId?: string // If multi-user in future
}

/**
 * API Endpoint - Uses Canonical Format
 *
 * The Endpoint now uses the canonical format which is universal across
 * all input sources (OpenAPI, cURL, Postman, HAR, manual).
 *
 * This format is optimized for:
 * - Database storage
 * - UI display
 * - AI prompt generation
 * - Test case generation
 */
export interface Endpoint extends CanonicalEndpoint {
  // No versioning - simple single version approach
}

// ============================================
// Test Case Types
// ============================================

/**
 * Test Case - Single test scenario
 */
export interface TestCase {
  id?: number // Auto-increment primary key
  specId: number // Foreign key to Spec (which spec version owns this test)
  name: string // Test name
  description?: string // Test description

  // V2: Flexible endpoint linking (replaces single endpointId)
  sourceEndpointId?: number // Original endpoint (immutable history)
  currentEndpointId?: number // Current matched endpoint (auto-updated)
  isCustomEndpoint: boolean // True if user modified method/path

  // Test configuration (SOURCE OF TRUTH - user editable)
  method: string // HTTP method
  path: string // API path with variables
  pathVariables?: Record<string, any> // Path parameter values
  queryParams?: Record<string, any> // Query parameter values
  headers?: Record<string, string> // HTTP headers
  body?: any // Request body (JSON)

  // AI-generated test metadata
  testType: 'single' | 'workflow' | 'integration' // V2: Extended types
  category?: string // happy-path, edge-case, error-handling, security, etc.
  priority?: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[] // Custom tags

  // Assertions
  assertions: Assertion[]

  // V2: Workflow test support
  steps?: TestStep[] // For workflow tests (testType='workflow')

  // V2: Migration tracking
  migratedFrom?: number // Previous test ID if migrated from another version

  // Execution metadata
  lastExecutedAt?: Date
  lastResult?: 'pass' | 'fail' | 'error' | 'pending'
  executionCount: number // Number of times executed

  // Timestamps
  createdAt: Date
  updatedAt: Date
  createdBy: 'ai' | 'manual' // Source of test
}

/**
 * Test Step - For workflow tests
 */
export interface TestStep {
  id: string // UUID
  order: number // Execution order (1, 2, 3...)
  name: string // Step name
  description?: string

  // Endpoint reference (flexible linking)
  sourceEndpointId?: number // Optional link to original endpoint
  currentEndpointId?: number // Optional link to current endpoint
  isCustomEndpoint: boolean // True if doesn't match any endpoint

  // Request configuration
  method: string // GET, POST, etc.
  path: string // /users/{userId}
  pathVariables?: Record<string, any>
  queryParams?: Record<string, any>
  headers?: Record<string, string>
  body?: any

  // Assertions for this step
  assertions: Assertion[]

  // Variable extraction (pass data between steps)
  extractVariables?: VariableExtraction[]

  // Timing control
  delayBefore?: number // ms to wait before executing
  delayAfter?: number // ms to wait after executing

  // Conditional execution
  skipOnFailure?: boolean // Skip if previous step failed
  continueOnFailure?: boolean // Continue even if this step fails
}

/**
 * Variable Extraction - Extract data from response
 */
export interface VariableExtraction {
  name: string // Variable name (e.g., "userId")
  source: 'response-body' | 'response-header' | 'status-code' | 'response-time'
  path?: string // JSONPath for body extraction (e.g., "$.data.id")
  headerName?: string // Header name if source is header
  defaultValue?: any // Fallback value if extraction fails
  transform?: 'to-string' | 'to-number' | 'to-boolean' | 'to-json'
}

/**
 * Assertion - Expected behavior check
 */
export interface Assertion {
  id: string // UUID for assertion
  type: AssertionType
  field?: string // JSONPath or field name
  operator?: AssertionOperator
  expected?: any // Expected value
  description?: string
}

export type AssertionType =
  | 'status-code' // HTTP status code
  | 'response-time' // Response time in ms
  | 'json-path' // JSONPath assertion
  | 'header' // Header assertion
  | 'body-contains' // Body contains text
  | 'body-matches' // Body matches regex
  | 'schema' // JSON schema validation
  | 'custom' // Custom assertion logic

export type AssertionOperator =
  | 'equals'
  | 'not-equals'
  | 'greater-than'
  | 'less-than'
  | 'greater-than-or-equal'
  | 'less-than-or-equal'
  | 'contains'
  | 'not-contains'
  | 'matches' // Regex
  | 'exists'
  | 'not-exists'
  | 'is-null'
  | 'is-not-null'
  | 'is-array'
  | 'is-object'
  | 'is-string'
  | 'is-number'
  | 'is-boolean'

// ============================================
// Test Execution Types
// ============================================

/**
 * Test Execution - Single test run record
 */
export interface TestExecution {
  id?: number // Auto-increment primary key
  testCaseId: number // Foreign key to TestCase
  specId: number // Foreign key to Spec (denormalized for queries)
  endpointId: number // Foreign key to Endpoint (denormalized)

  // Execution configuration
  environment?: string // Environment name (e.g., "dev", "staging", "prod")
  baseUrl: string // Actual base URL used

  // Request details
  request: ExecutionRequest

  // Response details
  response?: ExecutionResponse

  // Results
  status: 'pending' | 'running' | 'pass' | 'fail' | 'error'
  assertionResults: AssertionResult[]
  error?: string // Error message if status is "error"

  // Multi-step test results
  stepResults?: StepExecutionResult[]

  // Timing
  startedAt: Date
  completedAt?: Date
  duration?: number // Duration in milliseconds

  // Metadata
  createdAt: Date
}

/**
 * Execution Request - Actual HTTP request sent
 */
export interface ExecutionRequest {
  method: string
  url: string // Full URL
  headers: Record<string, string>
  body?: any
}

/**
 * Execution Response - Actual HTTP response received
 */
export interface ExecutionResponse {
  statusCode: number
  statusText: string
  headers: Record<string, string>
  body?: any
  responseTime: number // In milliseconds
}

/**
 * Assertion Result - Result of single assertion check
 */
export interface AssertionResult {
  assertionId: string // Links to Assertion.id
  passed: boolean
  actual?: any // Actual value received
  expected?: any // Expected value
  message?: string // Error or success message
}

/**
 * Step Execution Result - Result of single step in multi-step test
 */
export interface StepExecutionResult {
  stepId: string // Links to TestStep.id
  stepOrder: number // Step order number
  stepName: string // Step name for display
  request: ExecutionRequest // Actual request sent
  response?: ExecutionResponse // Response received
  assertionResults: AssertionResult[] // Assertions for this step
  extractedVariables?: Record<string, any> // Variables extracted from response
  error?: string // Error message if step failed
  startedAt: Date // When step started
  completedAt?: Date // When step completed
  duration?: number // Step duration in milliseconds
}

// ============================================
// Settings Types
// ============================================

/**
 * AI Provider Type
 */
export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama'

/**
 * Settings - Application configuration (singleton)
 */
export interface Settings {
  id: number // Always 1 (singleton)

  // AI Provider Configuration
  aiProvider: AIProvider
  aiSettings: AISettings

  // Default Test Execution Settings
  defaultTimeout: number // Request timeout in milliseconds
  defaultHeaders: Record<string, string> // Default headers for all requests
  environments: EnvironmentTemplate[] // Global environment templates

  // UI Preferences
  theme?: 'light' | 'dark' | 'system'

  updatedAt: Date
}

/**
 * AI Provider Settings
 */
export interface AISettings {
  // OpenAI
  openai?: {
    apiKey: string // Encrypted
    model: string // Default: "gpt-4o-mini"
    temperature: number // 0-1
    maxTokens: number
  }

  // Anthropic Claude
  anthropic?: {
    apiKey: string // Encrypted
    model: string // Default: "claude-3-5-sonnet-20241022"
    temperature: number
    maxTokens: number
  }

  // Google Gemini
  gemini?: {
    apiKey: string // Encrypted
    model: string // Default: "gemini-2.0-flash-exp"
    temperature: number
    maxTokens: number
  }

  // Ollama (local)
  ollama?: {
    baseUrl: string // Default: "http://localhost:11434"
    model: string // Default: "llama3.1:8b"
    temperature: number
    maxTokens: number // Default: 4096
  }
}

/**
 * Environment - Saved test environment (per-spec)
 */
export interface Environment {
  id: string // UUID
  specId: number // Foreign key to Spec
  name: string // e.g., "Development", "Staging", "Production"
  baseUrl: string
  headers?: Record<string, string> // Environment-specific headers
  variables?: Record<string, string> // Environment variables
  description?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Environment Template - Global environment presets (in Settings)
 * Simpler than Environment (no specId, no timestamps)
 */
export interface EnvironmentTemplate {
  id: string // UUID
  name: string // e.g., "Development", "Staging", "Production"
  baseUrl: string
  description?: string
}

// ============================================
// Utility Types
// ============================================

/**
 * Database Statistics
 */
export interface DatabaseStats {
  specs: number
  endpoints: number
  testCases: number
  executions: number
  lastUpdated: Date
}

/**
 * Export/Import Format
 */
export interface ExportData {
  version: string // Export format version
  exportedAt: Date
  specs: Spec[]
  endpoints: Endpoint[]
  testCases: TestCase[]
  settings?: Settings
}

/**
 * Test Generation Options
 */
export interface TestGenerationOptions {
  includeHappyPath: boolean // Generate success scenario tests
  includeEdgeCases: boolean // Generate edge case tests
  includeErrorCases: boolean // Generate error/negative tests
  includeSecurity: boolean // Generate security tests
  maxTestsPerEndpoint?: number // Limit tests per endpoint
  customInstructions?: string // Additional AI instructions
}

/**
 * AI Provider Status
 */
export interface AIProviderStatus {
  provider: AIProvider
  connected: boolean
  model?: string
  error?: string
  latency?: number // Connection test latency in ms
}
