import { describe, it, expect } from 'vitest'
import { validateVariables, formatValidationErrors } from './validateVariables'

describe('Variable Validation', () => {
  describe('validateVariables', () => {
    it('should pass validation for valid variables', () => {
      const variables = {
        apiKey: 'abc123',
        baseUrl: 'http://localhost:3000',
        userId: '123'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should pass validation for nested variables', () => {
      const variables = {
        apiUrl: '{{baseUrl}}/api',
        baseUrl: 'http://localhost:3000',
        fullPath: '{{apiUrl}}/users'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should detect direct self-reference cycle', () => {
      const variables = {
        token: 'Bearer {{token}}'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].variable).toBe('token')
      expect(result.errors[0].message).toContain('Cyclic variable reference')
    })

    it('should detect two-variable cycle', () => {
      const variables = {
        apiUrl: '{{baseUrl}}/api',
        baseUrl: '{{apiUrl}}'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes('Cyclic variable reference'))).toBe(true)
    })

    it('should detect three-variable cycle', () => {
      const variables = {
        a: '{{b}}',
        b: '{{c}}',
        c: '{{a}}'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should allow undefined variables (no cycle)', () => {
      const variables = {
        path: '{{baseUrl}}/users'
        // baseUrl not defined - but not a cycle
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(true)
    })

    it('should skip empty values', () => {
      const variables = {
        key1: '',
        key2: 'value'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(true)
    })

    it('should handle multiple independent cycles', () => {
      const variables = {
        a: '{{b}}',
        b: '{{a}}',
        c: '{{d}}',
        d: '{{c}}'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })

    it('should allow same variable used multiple times', () => {
      const variables = {
        base: 'api',
        path1: '{{base}}/users',
        path2: '{{base}}/posts'
      }

      const result = validateVariables(variables)
      expect(result.valid).toBe(true)
    })
  })

  describe('formatValidationErrors', () => {
    it('should return empty string for valid result', () => {
      const result = { valid: true, errors: [] }
      expect(formatValidationErrors(result)).toBe('')
    })

    it('should format self-reference error', () => {
      const result = {
        valid: false,
        errors: [{ variable: 'token', message: 'Cyclic variable reference detected: token' }]
      }

      const formatted = formatValidationErrors(result)
      expect(formatted).toBe('Variable "token" references itself.')
    })

    it('should format multiple variable cycle', () => {
      const result = {
        valid: false,
        errors: [
          { variable: 'key1', message: 'Cyclic variable reference detected: key1' },
          { variable: 'key2', message: 'Cyclic variable reference detected: key2' },
          { variable: 'key3', message: 'Cyclic variable reference detected: key3' }
        ]
      }

      const formatted = formatValidationErrors(result)
      expect(formatted).toContain('Cyclic reference detected')
      expect(formatted).toContain('• key1')
      expect(formatted).toContain('• key2')
      expect(formatted).toContain('• key3')
    })
  })
})
