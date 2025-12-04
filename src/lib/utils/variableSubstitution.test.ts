import { describe, it, expect } from 'vitest'
import {
  replaceVariables,
  replaceVariablesInObject,
  replaceVariablesInHeaders,
  extractVariableNames,
  hasVariables,
  findMissingVariables
} from './variableSubstitution'

describe('Variable Substitution', () => {
  describe('replaceVariables', () => {
    it('should replace single variable', () => {
      const result = replaceVariables('Hello {{name}}', { name: 'World' })
      expect(result).toBe('Hello World')
    })

    it('should replace multiple variables', () => {
      const result = replaceVariables('{{baseUrl}}/users/{{userId}}', {
        baseUrl: 'http://api.example.com',
        userId: '123'
      })
      expect(result).toBe('http://api.example.com/users/123')
    })

    it('should keep unresolved variables by default', () => {
      const result = replaceVariables('{{baseUrl}}/users/{{userId}}', {
        baseUrl: 'http://api.example.com'
      })
      expect(result).toBe('http://api.example.com/users/{{userId}}')
    })

    it('should replace unresolved variables with "undefined" when keepUnresolved is false', () => {
      const result = replaceVariables(
        '{{baseUrl}}/users/{{userId}}',
        { baseUrl: 'http://api.example.com' },
        { keepUnresolved: false }
      )
      expect(result).toBe('http://api.example.com/users/undefined')
    })

    it('should handle nested variables (recursive resolution)', () => {
      const result = replaceVariables('{{apiUrl}}', {
        apiUrl: '{{baseUrl}}/api',
        baseUrl: 'http://localhost:3000'
      })
      expect(result).toBe('http://localhost:3000/api')
    })

    it('should handle deep nested variables', () => {
      const result = replaceVariables('{{level1}}', {
        level1: '{{level2}}/path',
        level2: '{{level3}}',
        level3: 'http://example.com'
      })
      expect(result).toBe('http://example.com/path')
    })

    it('should trim whitespace in variable names', () => {
      const result = replaceVariables('{{ name }}', { name: 'World' })
      expect(result).toBe('World')
    })
  })

  describe('Cycle Detection', () => {
    it('should detect direct self-reference cycle', () => {
      expect(() => {
        replaceVariables('{{token}}', {
          token: 'Bearer {{token}}'
        })
      }).toThrow('Cyclic variable reference detected: token')
    })

    it('should detect two-variable cycle', () => {
      expect(() => {
        replaceVariables('{{apiUrl}}', {
          apiUrl: '{{baseUrl}}/api',
          baseUrl: '{{apiUrl}}'
        })
      }).toThrow('Cyclic variable reference detected: apiUrl')
    })

    it('should detect three-variable cycle', () => {
      expect(() => {
        replaceVariables('{{a}}', {
          a: '{{b}}',
          b: '{{c}}',
          c: '{{a}}'
        })
      }).toThrow('Cyclic variable reference detected: a')
    })

    it('should allow same variable used multiple times (not a cycle)', () => {
      const result = replaceVariables('{{base}}/{{base}}', {
        base: 'api'
      })
      expect(result).toBe('api/api')
    })

    it('should allow complex nested non-cyclic references', () => {
      const result = replaceVariables('{{final}}', {
        final: '{{path1}}/{{path2}}',
        path1: '{{base}}/users',
        path2: '{{base}}/posts',
        base: 'http://api.example.com'
      })
      expect(result).toBe('http://api.example.com/users/http://api.example.com/posts')
    })
  })

  describe('replaceVariablesInObject', () => {
    it('should replace variables in nested object', () => {
      const obj = {
        url: '{{baseUrl}}/users',
        headers: {
          Authorization: 'Bearer {{token}}'
        },
        data: {
          name: '{{userName}}'
        }
      }

      const result = replaceVariablesInObject(obj, {
        baseUrl: 'http://api.example.com',
        token: 'abc123',
        userName: 'John'
      })

      expect(result).toEqual({
        url: 'http://api.example.com/users',
        headers: {
          Authorization: 'Bearer abc123'
        },
        data: {
          name: 'John'
        }
      })
    })

    it('should handle arrays', () => {
      const obj = {
        urls: ['{{baseUrl}}/users', '{{baseUrl}}/posts']
      }

      const result = replaceVariablesInObject(obj, {
        baseUrl: 'http://api.example.com'
      })

      expect(result).toEqual({
        urls: ['http://api.example.com/users', 'http://api.example.com/posts']
      })
    })

    it('should return primitives as-is', () => {
      expect(replaceVariablesInObject(123, {})).toBe(123)
      expect(replaceVariablesInObject(true, {})).toBe(true)
      expect(replaceVariablesInObject(null, {})).toBe(null)
    })

    it('should handle nested variable resolution in objects', () => {
      const obj = {
        apiUrl: '{{fullUrl}}'
      }

      const result = replaceVariablesInObject(obj, {
        fullUrl: '{{baseUrl}}/api',
        baseUrl: 'http://localhost:3000'
      })

      expect(result).toEqual({
        apiUrl: 'http://localhost:3000/api'
      })
    })
  })

  describe('replaceVariablesInHeaders', () => {
    it('should replace variables in headers', () => {
      const headers = {
        Authorization: 'Bearer {{token}}',
        'X-API-Key': '{{apiKey}}'
      }

      const result = replaceVariablesInHeaders(headers, {
        token: 'abc123',
        apiKey: 'xyz789'
      })

      expect(result).toEqual({
        Authorization: 'Bearer abc123',
        'X-API-Key': 'xyz789'
      })
    })
  })

  describe('extractVariableNames', () => {
    it('should extract all variable names', () => {
      const names = extractVariableNames('{{baseUrl}}/users/{{userId}}')
      expect(names).toEqual(['baseUrl', 'userId'])
    })

    it('should deduplicate variable names', () => {
      const names = extractVariableNames('{{base}}/{{base}}')
      expect(names).toEqual(['base'])
    })

    it('should return empty array for no variables', () => {
      const names = extractVariableNames('http://example.com')
      expect(names).toEqual([])
    })

    it('should trim whitespace in variable names', () => {
      const names = extractVariableNames('{{ name }} and {{ age }}')
      expect(names).toEqual(['name', 'age'])
    })
  })

  describe('hasVariables', () => {
    it('should return true for strings with variables', () => {
      expect(hasVariables('{{name}}')).toBe(true)
      expect(hasVariables('Hello {{name}}')).toBe(true)
    })

    it('should return false for strings without variables', () => {
      expect(hasVariables('Hello World')).toBe(false)
      expect(hasVariables('')).toBe(false)
    })
  })

  describe('findMissingVariables', () => {
    it('should find missing variables', () => {
      const missing = findMissingVariables('{{baseUrl}}/users/{{userId}}', {
        baseUrl: 'http://api.example.com'
      })
      expect(missing).toEqual(['userId'])
    })

    it('should return empty array when all variables are present', () => {
      const missing = findMissingVariables('{{baseUrl}}/users/{{userId}}', {
        baseUrl: 'http://api.example.com',
        userId: '123'
      })
      expect(missing).toEqual([])
    })
  })
})
