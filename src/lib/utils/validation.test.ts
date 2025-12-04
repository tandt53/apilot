/**
 * Validation Utilities Tests
 */

import { describe, it, expect } from 'vitest'
import {
  validateVariableName,
  validateUrl,
  validateSemver,
  validateJsonPath,
  validateHeaderName,
  validateApiPath,
  validateParameterName,
  validateOpenAIKey,
  validateAnthropicKey,
  validateGeminiKey,
  validateTextLength,
  validateNumberRange,
  validateJson,
  hasDuplicate,
  validateNoDuplicateName,
  validateNotReservedKeyword,
  runValidations,
} from './validation'

describe('Validation Utilities', () => {
  describe('validateVariableName', () => {
    it('should accept valid variable names', () => {
      expect(validateVariableName('userId').isValid).toBe(true)
      expect(validateVariableName('_private').isValid).toBe(true)
      expect(validateVariableName('API_KEY').isValid).toBe(true)
      expect(validateVariableName('value123').isValid).toBe(true)
    })

    it('should reject empty names', () => {
      const result = validateVariableName('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject names starting with numbers', () => {
      const result = validateVariableName('123abc')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('start with a letter or underscore')
    })

    it('should reject names with special characters', () => {
      const result = validateVariableName('user-id')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('letters, numbers, and underscores')
    })

    it('should reject names longer than 50 characters', () => {
      const longName = 'a'.repeat(51)
      const result = validateVariableName(longName)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('too long')
    })

    it('should trim whitespace', () => {
      expect(validateVariableName('  validName  ').isValid).toBe(true)
    })
  })

  describe('validateUrl', () => {
    it('should accept valid HTTP URLs', () => {
      expect(validateUrl('http://example.com').isValid).toBe(true)
      expect(validateUrl('https://api.example.com').isValid).toBe(true)
      expect(validateUrl('https://api.example.com:8080/path').isValid).toBe(true)
    })

    it('should accept empty URLs when not required', () => {
      expect(validateUrl('', false).isValid).toBe(true)
      expect(validateUrl('   ', false).isValid).toBe(true)
    })

    it('should reject empty URLs when required', () => {
      const result = validateUrl('', true)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject invalid URL formats', () => {
      const result = validateUrl('not-a-url')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid URL format')
    })

    it('should reject non-HTTP protocols', () => {
      const result = validateUrl('ftp://example.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('http:// or https://')
    })

    it('should trim whitespace', () => {
      expect(validateUrl('  https://example.com  ').isValid).toBe(true)
    })
  })

  describe('validateSemver', () => {
    it('should accept valid semantic versions', () => {
      expect(validateSemver('1.0.0').isValid).toBe(true)
      expect(validateSemver('2.1.3').isValid).toBe(true)
      expect(validateSemver('1.0.0-beta.1').isValid).toBe(true)
      expect(validateSemver('1.0.0-alpha').isValid).toBe(true)
    })

    it('should reject empty versions', () => {
      const result = validateSemver('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject invalid version formats', () => {
      expect(validateSemver('1.0').isValid).toBe(false)
      expect(validateSemver('v1.0.0').isValid).toBe(false)
      expect(validateSemver('1.0.0.0').isValid).toBe(false)
      expect(validateSemver('abc').isValid).toBe(false)
    })

    it('should trim whitespace', () => {
      expect(validateSemver('  1.0.0  ').isValid).toBe(true)
    })
  })

  describe('validateJsonPath', () => {
    it('should accept valid JSONPath expressions', () => {
      expect(validateJsonPath('$.data').isValid).toBe(true)
      expect(validateJsonPath('$.items[0]').isValid).toBe(true)
      expect(validateJsonPath('$.user.name').isValid).toBe(true)
      expect(validateJsonPath('$.data.items[0].id').isValid).toBe(true)
    })

    it('should reject empty paths', () => {
      const result = validateJsonPath('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject paths not starting with $', () => {
      const result = validateJsonPath('data.id')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('must start with $')
    })

    it('should reject unmatched brackets', () => {
      const result = validateJsonPath('$.items[0')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Unmatched brackets')
    })
  })

  describe('validateHeaderName', () => {
    it('should accept valid header names', () => {
      expect(validateHeaderName('Content-Type').isValid).toBe(true)
      expect(validateHeaderName('Authorization').isValid).toBe(true)
      expect(validateHeaderName('X-API-Key').isValid).toBe(true)
      expect(validateHeaderName('X_Custom_Header').isValid).toBe(true)
    })

    it('should reject empty header names', () => {
      const result = validateHeaderName('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject header names with invalid characters', () => {
      const result = validateHeaderName('Content Type')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('letters, numbers, hyphens, and underscores')
    })
  })

  describe('validateApiPath', () => {
    it('should accept valid API paths', () => {
      expect(validateApiPath('/api/users').isValid).toBe(true)
      expect(validateApiPath('/pet/{petId}').isValid).toBe(true)
      expect(validateApiPath('/users/{userId}/posts/{postId}').isValid).toBe(true)
    })

    it('should reject empty paths', () => {
      const result = validateApiPath('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject paths not starting with /', () => {
      const result = validateApiPath('api/users')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('must start with /')
    })

    it('should reject paths with unmatched braces', () => {
      const result = validateApiPath('/users/{userId')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Unmatched braces')
    })
  })

  describe('validateParameterName', () => {
    it('should accept valid parameter names', () => {
      expect(validateParameterName('userId').isValid).toBe(true)
      expect(validateParameterName('user_id').isValid).toBe(true)
      expect(validateParameterName('user-id').isValid).toBe(true)
      expect(validateParameterName('user.id').isValid).toBe(true)
    })

    it('should reject empty parameter names', () => {
      const result = validateParameterName('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject parameter names starting with numbers', () => {
      const result = validateParameterName('123param')
      expect(result.isValid).toBe(false)
    })

    it('should reject parameter names longer than 100 characters', () => {
      const longName = 'a'.repeat(101)
      const result = validateParameterName(longName)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('too long')
    })
  })

  describe('API Key Validations', () => {
    describe('validateOpenAIKey', () => {
      it('should accept valid OpenAI keys', () => {
        expect(validateOpenAIKey('sk-1234567890abcdefghij').isValid).toBe(true)
        expect(validateOpenAIKey('sk-proj-1234567890abcdefghij').isValid).toBe(true)
      })

      it('should accept empty keys when not required', () => {
        expect(validateOpenAIKey('', false).isValid).toBe(true)
      })

      it('should reject empty keys when required', () => {
        const result = validateOpenAIKey('', true)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('required')
      })

      it('should reject keys not starting with sk-', () => {
        const result = validateOpenAIKey('invalid-key')
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('must start with "sk-"')
      })

      it('should reject keys that are too short', () => {
        const result = validateOpenAIKey('sk-123')
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('too short')
      })
    })

    describe('validateAnthropicKey', () => {
      it('should accept valid Anthropic keys', () => {
        expect(validateAnthropicKey('sk-ant-1234567890abcdefghij').isValid).toBe(true)
      })

      it('should reject keys not starting with sk-ant-', () => {
        const result = validateAnthropicKey('sk-1234567890')
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('must start with "sk-ant-"')
      })
    })

    describe('validateGeminiKey', () => {
      it('should accept valid Gemini keys', () => {
        expect(validateGeminiKey('AI1234567890abcdefghij').isValid).toBe(true)
      })

      it('should reject keys not starting with AI', () => {
        const result = validateGeminiKey('123456789')
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('must start with "AI"')
      })
    })
  })

  describe('validateTextLength', () => {
    it('should accept valid text within constraints', () => {
      expect(
        validateTextLength('Hello', {
          fieldName: 'Name',
          minLength: 1,
          maxLength: 10,
        }).isValid
      ).toBe(true)
    })

    it('should accept empty text when not required', () => {
      expect(
        validateTextLength('', {
          fieldName: 'Description',
          required: false,
        }).isValid
      ).toBe(true)
    })

    it('should reject empty text when required', () => {
      const result = validateTextLength('', {
        fieldName: 'Name',
        required: true,
      })
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject text shorter than minLength', () => {
      const result = validateTextLength('Hi', {
        fieldName: 'Name',
        minLength: 3,
      })
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('at least 3')
    })

    it('should reject text longer than maxLength', () => {
      const result = validateTextLength('This is a very long text', {
        fieldName: 'Name',
        maxLength: 10,
      })
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('at most 10')
    })
  })

  describe('validateNumberRange', () => {
    it('should accept valid numbers within range', () => {
      expect(
        validateNumberRange(5, {
          fieldName: 'Port',
          min: 1,
          max: 10,
        }).isValid
      ).toBe(true)
    })

    it('should accept valid integers when required', () => {
      expect(
        validateNumberRange(5, {
          fieldName: 'Count',
          integer: true,
        }).isValid
      ).toBe(true)
    })

    it('should reject non-numbers', () => {
      const result = validateNumberRange('abc', {
        fieldName: 'Port',
      })
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('valid number')
    })

    it('should reject non-integers when integer is required', () => {
      const result = validateNumberRange(5.5, {
        fieldName: 'Count',
        integer: true,
      })
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('must be an integer')
    })

    it('should reject numbers below min', () => {
      const result = validateNumberRange(0, {
        fieldName: 'Port',
        min: 1,
      })
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('at least 1')
    })

    it('should reject numbers above max', () => {
      const result = validateNumberRange(100, {
        fieldName: 'Port',
        max: 65535,
      })
      expect(result.isValid).toBe(true)

      const result2 = validateNumberRange(70000, {
        fieldName: 'Port',
        max: 65535,
      })
      expect(result2.isValid).toBe(false)
      expect(result2.error).toContain('at most 65535')
    })
  })

  describe('validateJson', () => {
    it('should accept valid JSON', () => {
      expect(validateJson('{"key": "value"}').isValid).toBe(true)
      expect(validateJson('[1, 2, 3]').isValid).toBe(true)
      expect(validateJson('"string"').isValid).toBe(true)
      expect(validateJson('123').isValid).toBe(true)
    })

    it('should accept empty JSON when not required', () => {
      expect(validateJson('', false).isValid).toBe(true)
    })

    it('should reject empty JSON when required', () => {
      const result = validateJson('', true)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject invalid JSON', () => {
      const result = validateJson('{key: value}')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid JSON')
    })
  })

  describe('hasDuplicate', () => {
    it('should detect duplicates', () => {
      const items = [
        { name: 'item1' },
        { name: 'item2' },
        { name: 'item1' },
      ]

      expect(hasDuplicate(items, (item) => item.name, 0)).toBe(true)
      expect(hasDuplicate(items, (item) => item.name, 1)).toBe(false)
      expect(hasDuplicate(items, (item) => item.name, 2)).toBe(true)
    })

    it('should not detect false duplicates', () => {
      const items = [
        { name: 'item1' },
        { name: 'item2' },
        { name: 'item3' },
      ]

      expect(hasDuplicate(items, (item) => item.name, 0)).toBe(false)
      expect(hasDuplicate(items, (item) => item.name, 1)).toBe(false)
      expect(hasDuplicate(items, (item) => item.name, 2)).toBe(false)
    })
  })

  describe('validateNoDuplicateName', () => {
    it('should pass when no duplicates exist', () => {
      const items = [
        { name: 'env1' },
        { name: 'env2' },
        { name: 'env3' },
      ]

      expect(validateNoDuplicateName(items, 0).isValid).toBe(true)
    })

    it('should fail when duplicates exist', () => {
      const items = [
        { name: 'env1' },
        { name: 'env2' },
        { name: 'env1' },
      ]

      const result = validateNoDuplicateName(items, 2, 'Environment')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('already exists')
    })

    it('should be case-insensitive', () => {
      const items = [
        { name: 'ENV1' },
        { name: 'env2' },
        { name: 'env1' },
      ]

      const result = validateNoDuplicateName(items, 2)
      expect(result.isValid).toBe(false)
    })
  })

  describe('validateNotReservedKeyword', () => {
    it('should accept non-reserved names', () => {
      expect(validateNotReservedKeyword('userId').isValid).toBe(true)
      expect(validateNotReservedKeyword('apiKey').isValid).toBe(true)
    })

    it('should reject reserved keywords', () => {
      expect(validateNotReservedKeyword('baseUrl').isValid).toBe(false)
      expect(validateNotReservedKeyword('undefined').isValid).toBe(false)
      expect(validateNotReservedKeyword('null').isValid).toBe(false)
      expect(validateNotReservedKeyword('function').isValid).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(validateNotReservedKeyword('BASEURL').isValid).toBe(false)
      expect(validateNotReservedKeyword('BaseUrl').isValid).toBe(false)
    })
  })

  describe('runValidations', () => {
    it('should pass when all validations pass', () => {
      const result = runValidations(
        () => ({ isValid: true }),
        () => ({ isValid: true }),
        () => ({ isValid: true })
      )
      expect(result.isValid).toBe(true)
    })

    it('should fail and return first error', () => {
      const result = runValidations(
        () => ({ isValid: true }),
        () => ({ isValid: false, error: 'Second validation failed' }),
        () => ({ isValid: false, error: 'Third validation failed' })
      )
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Second validation failed')
    })

    it('should stop at first error', () => {
      let thirdValidatorCalled = false

      runValidations(
        () => ({ isValid: true }),
        () => ({ isValid: false, error: 'Error' }),
        () => {
          thirdValidatorCalled = true
          return { isValid: true }
        }
      )

      expect(thirdValidatorCalled).toBe(false)
    })
  })
})
