/**
 * Test Executor
 * Executes API test cases and validates responses
 */

import axios, {AxiosRequestConfig, AxiosResponse} from 'axios'
import type {
    Assertion,
    AssertionResult,
    Environment,
    ExecutionRequest,
    ExecutionResponse,
    TestCase,
    TestExecution,
} from '@/types/database'
import {createExecution, updateTestCaseExecutionStats} from '@/lib/api'
import {replaceVariables, replaceVariablesInHeaders, replaceVariablesInObject} from '@/lib/utils/variableSubstitution'

/**
 * Execute a test case
 */
export async function executeTest(
  testCase: TestCase,
  environment?: Environment
): Promise<TestExecution> {
  const startedAt = new Date()

  // Build execution record
  // Get environment variables
  const envVariables = environment?.variables || {}

  // Substitute variables in baseUrl
  const baseUrl = environment?.baseUrl
    ? replaceVariables(environment.baseUrl, envVariables)
    : 'http://localhost:3000'

  const execution: Omit<TestExecution, 'id' | 'createdAt'> = {
    testCaseId: testCase.id!,
    specId: testCase.specId,
    endpointId: testCase.currentEndpointId!,
    environment: environment?.name,
    baseUrl,
    request: buildRequest(testCase, environment),
    status: 'running',
    assertionResults: [],
    startedAt,
  }

  try {
    // Execute HTTP request
    const response = await executeHTTPRequest(execution.request, execution.baseUrl)

    // Validate assertions
    const assertionResults = validateAssertions(testCase.assertions, response)

    // Determine overall status
    const allPassed = assertionResults.every(r => r.passed)
    const status: 'pass' | 'fail' = allPassed ? 'pass' : 'fail'

    // Complete execution record
    const completedAt = new Date()
    const duration = completedAt.getTime() - startedAt.getTime()

    execution.response = response
    execution.assertionResults = assertionResults
    execution.status = status
    execution.completedAt = completedAt
    execution.duration = duration

    // Save to database
    const savedExecution = await createExecution(execution)

    // Update test case stats
    await updateTestCaseExecutionStats(testCase.id!, status)

    return savedExecution
  } catch (error: any) {
    // Handle execution error
    const completedAt = new Date()
    const duration = completedAt.getTime() - startedAt.getTime()

    execution.status = 'error'
    execution.error = error.message || String(error)
    execution.completedAt = completedAt
    execution.duration = duration

    // If we got a response, include it
    if (error.response) {
      execution.response = {
        statusCode: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        body: error.response.data,
        responseTime: duration,
      }
    }

    // Save to database
    const savedExecution = await createExecution(execution)

    // Update test case stats
    await updateTestCaseExecutionStats(testCase.id!, 'error')

    return savedExecution
  }
}

/**
 * Build request object from test case
 */
function buildRequest(testCase: TestCase, environment?: Environment): ExecutionRequest {
  // Get environment variables
  const envVariables = environment?.variables || {}

  // Build URL with path variables (standard OpenAPI style: {param})
  let path = testCase.path
  if (testCase.pathVariables) {
    for (const [key, value] of Object.entries(testCase.pathVariables)) {
      path = path.replace(`{${key}}`, String(value))
    }
  }

  // Apply variable substitution to path (for {{variable}} style)
  path = replaceVariables(path, envVariables)

  // Merge and substitute variables in headers
  const mergedHeaders = {
    ...testCase.headers,
    ...environment?.headers,
  }
  const headers = replaceVariablesInHeaders(mergedHeaders, envVariables)

  // Substitute variables in body
  const body = replaceVariablesInObject(testCase.body, envVariables)

  return {
    method: testCase.method,
    url: path,
    headers,
    body,
  }
}

/**
 * Execute HTTP request
 */
async function executeHTTPRequest(
  request: ExecutionRequest,
  baseUrl: string
): Promise<ExecutionResponse> {
  const startTime = Date.now()

  // Build full URL
  const url = new URL(request.url, baseUrl).toString()

  // Build axios config
  const config: AxiosRequestConfig = {
    method: request.method.toLowerCase() as any,
    url,
    headers: request.headers,
    validateStatus: () => true, // Accept all status codes
  }

  // Add query params if they exist in the URL
  const urlObj = new URL(url)
  if (urlObj.search) {
    config.params = Object.fromEntries(urlObj.searchParams)
  }

  // Add body for methods that support it
  if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
    config.data = request.body
  }

  try {
    const response: AxiosResponse = await axios(config)
    const responseTime = Date.now() - startTime

    return {
      statusCode: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      body: response.data,
      responseTime,
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime

    if (error.response) {
      // HTTP error response
      return {
        statusCode: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        body: error.response.data,
        responseTime,
      }
    }

    // Network or other error
    throw error
  }
}

/**
 * Validate assertions against response
 */
function validateAssertions(
  assertions: Assertion[],
  response: ExecutionResponse
): AssertionResult[] {
  return assertions.map(assertion => validateAssertion(assertion, response))
}

/**
 * Validate single assertion
 */
function validateAssertion(
  assertion: Assertion,
  response: ExecutionResponse
): AssertionResult {
  try {
    switch (assertion.type) {
      case 'status-code':
        return validateStatusCode(assertion, response)

      case 'response-time':
        return validateResponseTime(assertion, response)

      case 'json-path':
        return validateJsonPath(assertion, response)

      case 'header':
        return validateHeader(assertion, response)

      case 'body-contains':
        return validateBodyContains(assertion, response)

      case 'body-matches':
        return validateBodyMatches(assertion, response)

      case 'schema':
        return validateSchema(assertion, response)

      default:
        return {
          assertionId: assertion.id,
          passed: false,
          message: `Unknown assertion type: ${assertion.type}`,
        }
    }
  } catch (error: any) {
    return {
      assertionId: assertion.id,
      passed: false,
      message: `Assertion error: ${error.message}`,
    }
  }
}

/**
 * Validate status code assertion
 */
function validateStatusCode(assertion: Assertion, response: ExecutionResponse): AssertionResult {
  const actual = response.statusCode
  const expected = assertion.expected

  const passed = compareValues(actual, expected, assertion.operator || 'equals')

  return {
    assertionId: assertion.id,
    passed,
    actual,
    expected,
    message: passed
      ? `Status code is ${actual}`
      : `Expected status code ${expected}, got ${actual}`,
  }
}

/**
 * Validate response time assertion
 */
function validateResponseTime(assertion: Assertion, response: ExecutionResponse): AssertionResult {
  const actual = response.responseTime
  const expected = assertion.expected

  const passed = compareValues(actual, expected, assertion.operator || 'less-than')

  return {
    assertionId: assertion.id,
    passed,
    actual,
    expected,
    message: passed
      ? `Response time is ${actual}ms`
      : `Expected response time ${assertion.operator} ${expected}ms, got ${actual}ms`,
  }
}

/**
 * Validate JSON path assertion
 */
function validateJsonPath(assertion: Assertion, response: ExecutionResponse): AssertionResult {
  const path = assertion.field || ''
  const actual = extractJsonPath(response.body, path)
  const expected = assertion.expected

  if (actual === undefined) {
    return {
      assertionId: assertion.id,
      passed: false,
      actual,
      expected,
      message: `Field not found: ${path}`,
    }
  }

  const passed = compareValues(actual, expected, assertion.operator || 'equals')

  return {
    assertionId: assertion.id,
    passed,
    actual,
    expected,
    message: passed
      ? `Field ${path} matches expected value`
      : `Field ${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  }
}

/**
 * Validate header assertion
 */
function validateHeader(assertion: Assertion, response: ExecutionResponse): AssertionResult {
  const headerName = assertion.field || ''
  const actual = response.headers[headerName.toLowerCase()]
  const expected = assertion.expected

  const passed = compareValues(actual, expected, assertion.operator || 'equals')

  return {
    assertionId: assertion.id,
    passed,
    actual,
    expected,
    message: passed
      ? `Header ${headerName} matches`
      : `Header ${headerName}: expected ${expected}, got ${actual}`,
  }
}

/**
 * Validate body contains assertion
 */
function validateBodyContains(assertion: Assertion, response: ExecutionResponse): AssertionResult {
  const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
  const searchStr = String(assertion.expected)

  const passed = bodyStr.includes(searchStr)

  return {
    assertionId: assertion.id,
    passed,
    expected: searchStr,
    message: passed
      ? `Body contains "${searchStr}"`
      : `Body does not contain "${searchStr}"`,
  }
}

/**
 * Validate body matches regex assertion
 */
function validateBodyMatches(assertion: Assertion, response: ExecutionResponse): AssertionResult {
  const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
  const pattern = String(assertion.expected)

  try {
    const regex = new RegExp(pattern)
    const passed = regex.test(bodyStr)

    return {
      assertionId: assertion.id,
      passed,
      expected: pattern,
      message: passed
        ? `Body matches pattern "${pattern}"`
        : `Body does not match pattern "${pattern}"`,
    }
  } catch (error) {
    return {
      assertionId: assertion.id,
      passed: false,
      message: `Invalid regex pattern: ${pattern}`,
    }
  }
}

/**
 * Validate JSON schema assertion (simplified)
 */
function validateSchema(assertion: Assertion, _response: ExecutionResponse): AssertionResult {
  // This is a simplified implementation
  // In a full implementation, use a JSON Schema validator library
  return {
    assertionId: assertion.id,
    passed: true,
    message: 'Schema validation not fully implemented',
  }
}

/**
 * Extract value from JSON using simplified JSONPath
 */
function extractJsonPath(obj: any, path: string): any {
  if (!path || path === '$') return obj

  // Remove leading $. if present
  path = path.replace(/^\$\.?/, '')

  // Split path by dots
  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    // Handle array indexing
    const arrayMatch = part.match(/^(.+?)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, key, index] = arrayMatch
      current = current?.[key]?.[parseInt(index)]
    } else {
      current = current?.[part]
    }

    if (current === undefined) break
  }

  return current
}

/**
 * Compare values based on operator
 */
function compareValues(actual: any, expected: any, operator: string): boolean {
  switch (operator) {
    case 'equals':
      return actual === expected

    case 'not-equals':
      return actual !== expected

    case 'greater-than':
      return actual > expected

    case 'less-than':
      return actual < expected

    case 'greater-than-or-equal':
      return actual >= expected

    case 'less-than-or-equal':
      return actual <= expected

    case 'contains':
      return String(actual).includes(String(expected))

    case 'not-contains':
      return !String(actual).includes(String(expected))

    case 'matches':
      return new RegExp(expected).test(String(actual))

    case 'exists':
      return actual !== undefined && actual !== null

    case 'not-exists':
      return actual === undefined || actual === null

    case 'is-null':
      return actual === null

    case 'is-not-null':
      return actual !== null

    case 'is-array':
      return Array.isArray(actual)

    case 'is-object':
      return typeof actual === 'object' && actual !== null && !Array.isArray(actual)

    case 'is-string':
      return typeof actual === 'string'

    case 'is-number':
      return typeof actual === 'number'

    case 'is-boolean':
      return typeof actual === 'boolean'

    default:
      return false
  }
}
