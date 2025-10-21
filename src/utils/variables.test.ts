/**
 * Tests for Dynamic Variable Generators
 */

import { describe, it, expect } from 'vitest'
import {
  generateDynamicVariableValue,
  isBuiltInVariable,
  substituteBuiltInVariables,
} from './variables'

describe('Dynamic Variables', () => {
  describe('isBuiltInVariable', () => {
    it('should recognize built-in variables with $ prefix', () => {
      expect(isBuiltInVariable('$timestamp')).toBe(true)
      expect(isBuiltInVariable('$uuid')).toBe(true)
      expect(isBuiltInVariable('$randomEmail')).toBe(true)
    })

    it('should recognize built-in variables without $ prefix', () => {
      expect(isBuiltInVariable('timestamp')).toBe(true)
      expect(isBuiltInVariable('uuid')).toBe(true)
      expect(isBuiltInVariable('randomEmail')).toBe(true)
    })

    it('should not recognize non-built-in variables', () => {
      expect(isBuiltInVariable('customVar')).toBe(false)
      expect(isBuiltInVariable('userId')).toBe(false)
      expect(isBuiltInVariable('$notAVariable')).toBe(false)
    })
  })

  describe('Timestamp Variables', () => {
    it('should generate Unix timestamp in seconds', () => {
      const value = generateDynamicVariableValue('$timestamp')
      const timestamp = parseInt(value, 10)

      expect(timestamp).toBeGreaterThan(1000000000) // After year 2001
      expect(timestamp).toBeLessThan(2000000000) // Before year 2033
      expect(value.length).toBeLessThanOrEqual(10) // Unix timestamp in seconds
    })

    it('should generate timestamp in milliseconds', () => {
      const value = generateDynamicVariableValue('$timestampMs')
      const timestamp = parseInt(value, 10)

      expect(timestamp).toBeGreaterThan(1000000000000) // After year 2001
      expect(value.length).toBe(13) // Milliseconds timestamp
    })

    it('should generate ISO 8601 timestamp', () => {
      const value = generateDynamicVariableValue('$isoTimestamp')

      // Should match ISO 8601 format: 2025-01-20T12:34:56.789Z
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

      // Should be parseable as valid date
      const date = new Date(value)
      expect(date.toString()).not.toBe('Invalid Date')
    })
  })

  describe('UUID/GUID Variables', () => {
    it('should generate valid UUID for $uuid', () => {
      const value = generateDynamicVariableValue('$uuid')

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should generate valid UUID for $guid', () => {
      const value = generateDynamicVariableValue('$guid')

      // $guid should work the same as $uuid
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should generate unique UUIDs', () => {
      const uuid1 = generateDynamicVariableValue('$uuid')
      const uuid2 = generateDynamicVariableValue('$uuid')

      expect(uuid1).not.toBe(uuid2)
    })
  })

  describe('Random Value Variables', () => {
    it('should generate random integer', () => {
      const value = generateDynamicVariableValue('$randomInt')
      const num = parseInt(value, 10)

      expect(num).toBeGreaterThanOrEqual(0)
      expect(num).toBeLessThanOrEqual(1000)
    })

    it('should generate different random integers', () => {
      const values = new Set()
      for (let i = 0; i < 10; i++) {
        values.add(generateDynamicVariableValue('$randomInt'))
      }

      // Should have some variation (not all the same)
      expect(values.size).toBeGreaterThan(1)
    })

    it('should generate random string', () => {
      const value = generateDynamicVariableValue('$randomString')

      expect(value.length).toBe(10)
      expect(value).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should generate different random strings', () => {
      const str1 = generateDynamicVariableValue('$randomString')
      const str2 = generateDynamicVariableValue('$randomString')

      expect(str1).not.toBe(str2)
    })

    it('should generate random boolean', () => {
      const value = generateDynamicVariableValue('$randomBoolean')

      expect(['true', 'false']).toContain(value)
    })
  })

  describe('Random Personal Data Variables', () => {
    it('should generate random email', () => {
      const value = generateDynamicVariableValue('$randomEmail')

      expect(value).toMatch(/^[a-z0-9]+@(example|test|demo|mail)\.com$/)
    })

    it('should generate random first name', () => {
      const value = generateDynamicVariableValue('$randomFirstName')

      expect(value.length).toBeGreaterThan(0)
      expect(value[0]).toMatch(/[A-Z]/) // Should be capitalized
    })

    it('should generate random last name', () => {
      const value = generateDynamicVariableValue('$randomLastName')

      expect(value.length).toBeGreaterThan(0)
      expect(value[0]).toMatch(/[A-Z]/) // Should be capitalized
    })

    it('should generate random phone number', () => {
      const value = generateDynamicVariableValue('$randomPhoneNumber')

      // US format: +1-XXX-XXX-XXXX
      expect(value).toMatch(/^\+1-\d{3}-\d{3}-\d{4}$/)
    })

    it('should generate random color', () => {
      const value = generateDynamicVariableValue('$randomColor')

      // Hex color format: #RRGGBB
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  describe('substituteBuiltInVariables', () => {
    it('should substitute single built-in variable', () => {
      const text = 'User ID: {{$uuid}}'
      const result = substituteBuiltInVariables(text)

      expect(result).not.toContain('{{$uuid}}')
      expect(result).toMatch(/^User ID: [0-9a-f-]{36}$/i)
    })

    it('should substitute multiple built-in variables', () => {
      const text = 'Email: {{$randomEmail}}, Name: {{$randomFirstName}}'
      const result = substituteBuiltInVariables(text)

      expect(result).not.toContain('{{$randomEmail}}')
      expect(result).not.toContain('{{$randomFirstName}}')
      expect(result).toContain('@')
    })

    it('should substitute same variable multiple times with different values', () => {
      const text = 'ID1: {{$uuid}}, ID2: {{$uuid}}'
      const result = substituteBuiltInVariables(text)

      const uuids = result.match(/[0-9a-f-]{36}/gi)
      expect(uuids).toBeDefined()
      expect(uuids!.length).toBe(2)

      // Each occurrence should generate a fresh value
      expect(uuids![0]).not.toBe(uuids![1])
    })

    it('should leave unknown variables unchanged', () => {
      const text = 'Custom: {{$unknownVariable}}'
      const result = substituteBuiltInVariables(text)

      expect(result).toBe('Custom: {{$unknownVariable}}')
    })

    it('should handle text with no variables', () => {
      const text = 'No variables here'
      const result = substituteBuiltInVariables(text)

      expect(result).toBe(text)
    })

    it('should handle empty string', () => {
      const result = substituteBuiltInVariables('')

      expect(result).toBe('')
    })

    it('should work with JSON strings', () => {
      const json = JSON.stringify({
        id: '{{$uuid}}',
        email: '{{$randomEmail}}',
        timestamp: '{{$timestamp}}',
      })

      const result = substituteBuiltInVariables(json)

      expect(result).not.toContain('{{$uuid}}')
      expect(result).not.toContain('{{$randomEmail}}')
      expect(result).not.toContain('{{$timestamp}}')

      // Should still be valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
    })

    it('should preserve regular environment variable syntax', () => {
      const text = 'User: {{userId}}, ID: {{$uuid}}'
      const result = substituteBuiltInVariables(text)

      // Should substitute built-in variable
      expect(result).not.toContain('{{$uuid}}')

      // Should preserve environment variable (no $ prefix)
      expect(result).toContain('{{userId}}')
    })
  })

  describe('Edge Cases', () => {
    it('should handle variable names without $ prefix', () => {
      const value = generateDynamicVariableValue('timestamp')

      expect(parseInt(value, 10)).toBeGreaterThan(1000000000)
    })

    it('should handle variable names with $ prefix', () => {
      const value = generateDynamicVariableValue('$timestamp')

      expect(parseInt(value, 10)).toBeGreaterThan(1000000000)
    })

    it('should return original for unknown variables', () => {
      const value = generateDynamicVariableValue('$notAVariable')

      expect(value).toBe('{{$notAVariable}}')
    })
  })
})
