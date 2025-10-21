/**
 * Variable Extractor
 * Extract values from HTTP responses using JSONPath, headers, status codes, etc.
 */

import jp from 'jsonpath'
import type {VariableExtraction, ExecutionResponse} from '@/types/database'

/**
 * Extract variables from an HTTP response
 */
export function extractVariablesFromResponse(
  extractions: VariableExtraction[],
  response: ExecutionResponse
): Record<string, any> {
  const variables: Record<string, any> = {}

  for (const extraction of extractions) {
    let value: any

    try {
      switch (extraction.source) {
        case 'response-body':
          if (extraction.path) {
            // Use JSONPath to extract from response body
            const results = jp.query(response.body, extraction.path)
            value = results.length > 0 ? results[0] : extraction.defaultValue
          } else {
            value = extraction.defaultValue
          }
          break

        case 'response-header':
          if (extraction.headerName) {
            // Extract from response headers
            value = response.headers[extraction.headerName] ?? extraction.defaultValue
          } else {
            value = extraction.defaultValue
          }
          break

        case 'status-code':
          // Extract status code
          value = response.statusCode
          break

        case 'response-time':
          // Extract response time
          value = response.responseTime
          break

        default:
          value = extraction.defaultValue
      }

      // Apply transform if specified
      if (extraction.transform && value !== undefined && value !== null) {
        value = transformValue(value, extraction.transform)
      }

      variables[extraction.name] = value
    } catch (error) {
      console.error(`[VariableExtractor] Error extracting variable "${extraction.name}":`, error)
      // Fall back to default value on error
      variables[extraction.name] = extraction.defaultValue
    }
  }

  return variables
}

/**
 * Transform extracted value to specified type
 */
function transformValue(value: any, transform: string): any {
  switch (transform) {
    case 'to-string':
      return String(value)

    case 'to-number':
      const num = Number(value)
      return isNaN(num) ? value : num

    case 'to-boolean':
      // Handle common boolean representations
      if (typeof value === 'string') {
        const lower = value.toLowerCase()
        if (lower === 'true' || lower === '1' || lower === 'yes') return true
        if (lower === 'false' || lower === '0' || lower === 'no') return false
      }
      return Boolean(value)

    case 'to-json':
      // Parse JSON string to object
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch (error) {
          console.error('[VariableExtractor] Failed to parse JSON:', error)
          return value
        }
      }
      return value

    default:
      return value
  }
}
