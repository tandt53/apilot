/**
 * AI Prompt Formatting Tests
 * Tests for prompt assembly and conditional spec inclusion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  formatEndpointsForPrompt,
  formatSpecForPrompt,
  formatReferenceEndpointsForPrompt,
  formatCustomRequirementsForPrompt,
} from './prompts'

// Mock console.log to avoid cluttering test output
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('AI Prompt Formatters', () => {
  describe('formatEndpointsForPrompt', () => {
    it('should format single endpoint correctly', () => {
      const endpoints = [
        {
          method: 'GET',
          path: '/users',
          name: 'Get users',
          description: 'Retrieve all users',
          tags: ['users'],
          request: {
            contentType: 'application/json',
            parameters: [],
            body: null,
          },
          responses: {
            success: { status: 200, fields: [] },
            errors: [],
          },
          auth: { required: false },
        },
      ]

      const result = formatEndpointsForPrompt(endpoints)

      expect(result).toBeTruthy()
      expect(result).toContain('"method": "GET"')
      expect(result).toContain('"path": "/users"')
      expect(result).toContain('"name": "Get users"')
      expect(result).toContain('"description": "Retrieve all users"')
    })

    it('should format multiple endpoints', () => {
      const endpoints = [
        {
          method: 'GET',
          path: '/users',
          name: 'Get users',
          description: 'List users',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: false },
        },
        {
          method: 'POST',
          path: '/users',
          name: 'Create user',
          description: 'Create new user',
          request: {
            contentType: 'application/json',
            parameters: [],
            body: {
              required: true,
              fields: [
                { name: 'email', type: 'string', required: true },
                { name: 'name', type: 'string', required: true },
              ],
            },
          },
          responses: { success: { status: 201, fields: [] }, errors: [] },
          auth: { required: true, type: 'bearer' },
        },
      ]

      const result = formatEndpointsForPrompt(endpoints)

      expect(result).toContain('GET')
      expect(result).toContain('POST')
      expect(result).toContain('/users')
      expect(result).toContain('Create user')
      expect(result).toContain('bearer')
    })

    it('should handle empty endpoints array', () => {
      const result = formatEndpointsForPrompt([])

      expect(result).toBe('[]')
    })

    it('should include authentication info', () => {
      const endpoints = [
        {
          method: 'DELETE',
          path: '/users/{id}',
          name: 'Delete user',
          description: 'Remove user',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 204, fields: [] }, errors: [] },
          auth: { required: true, type: 'bearer' },
        },
      ]

      const result = formatEndpointsForPrompt(endpoints)

      expect(result).toContain('"required": true')
      expect(result).toContain('"type": "bearer"')
    })

    it('should include request body structure', () => {
      const endpoints = [
        {
          method: 'PUT',
          path: '/users/{id}',
          name: 'Update user',
          description: 'Update user details',
          request: {
            contentType: 'application/json',
            parameters: [],
            body: {
              required: true,
              fields: [
                { name: 'email', type: 'string', required: false },
                { name: 'status', type: 'string', required: false, enum: ['active', 'inactive'] },
              ],
            },
          },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: true },
        },
      ]

      const result = formatEndpointsForPrompt(endpoints)

      expect(result).toContain('"email"')
      expect(result).toContain('"status"')
      expect(result).toContain('"active"')
      expect(result).toContain('"inactive"')
    })

    it('should exclude unnecessary fields (only include AI-relevant data)', () => {
      const endpoints = [
        {
          method: 'GET',
          path: '/test',
          name: 'Test endpoint',
          description: 'Test',
          id: 123, // Should not be included
          specId: 456, // Should not be included
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: false },
        },
      ]

      const result = formatEndpointsForPrompt(endpoints)

      expect(result).not.toContain('"id"')
      expect(result).not.toContain('"specId"')
      expect(result).toContain('"method"')
      expect(result).toContain('"path"')
    })
  })

  describe('formatSpecForPrompt - CRITICAL (Recently Fixed)', () => {
    const mockSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test API specification',
      },
      servers: [
        { url: 'https://api.example.com' },
      ],
      paths: {}, // Not included in formatted output
    }

    it('should return empty string when hasReferenceEndpoints is false (selected-only mode)', () => {
      const result = formatSpecForPrompt(mockSpec, false)

      expect(result).toBe('')
    })

    it('should include spec when hasReferenceEndpoints is true (reference mode)', () => {
      const result = formatSpecForPrompt(mockSpec, true)

      expect(result).toBeTruthy()
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('"openapi": "3.0.0"')
      expect(result).toContain('"title": "Test API"')
    })

    it('should include essential spec fields only', () => {
      const result = formatSpecForPrompt(mockSpec, true)

      expect(result).toContain('"openapi"')
      expect(result).toContain('"info"')
      expect(result).toContain('"servers"')
      expect(result).not.toContain('"paths"') // Should exclude paths
    })

    it('should handle Swagger 2.0 specs', () => {
      const swaggerSpec = {
        swagger: '2.0',
        info: {
          title: 'Pet Store',
          version: '1.0.0',
        },
        host: 'petstore.swagger.io',
        basePath: '/v2',
      }

      const result = formatSpecForPrompt(swaggerSpec, true)

      // formatSpecForPrompt normalizes to 'openapi' key
      expect(result).toContain('"openapi"')
      expect(result).toContain('"title": "Pet Store"')
    })

    it('should handle spec with no servers', () => {
      const specNoServers = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
      }

      const result = formatSpecForPrompt(specNoServers, true)

      expect(result).toContain('"openapi"')
      expect(result).toContain('"info"')
    })

    it('should handle null/undefined spec gracefully', () => {
      const result1 = formatSpecForPrompt(null as any, false)
      const result2 = formatSpecForPrompt(undefined as any, false)

      // Should return empty string when no references
      expect(result1).toBe('')
      expect(result2).toBe('')
    })
  })

  describe('formatReferenceEndpointsForPrompt', () => {
    it('should return empty string when no reference endpoints', () => {
      const result = formatReferenceEndpointsForPrompt([])

      expect(result).toBe('')
    })

    it('should format reference endpoints with warning text', () => {
      const referenceEndpoints = [
        {
          method: 'GET',
          path: '/posts',
          name: 'Get posts',
          description: 'Retrieve posts',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: false },
        },
      ]

      const result = formatReferenceEndpointsForPrompt(referenceEndpoints)

      expect(result).toContain('REFERENCE ENDPOINTS')
      expect(result).toContain('do NOT generate single tests for these')
      expect(result).toContain('DO use them in workflow tests')
      expect(result).toContain('"method": "GET"')
      expect(result).toContain('"path": "/posts"')
    })

    it('should include workflow pattern guidance', () => {
      const referenceEndpoints = [
        {
          method: 'POST',
          path: '/orders',
          name: 'Create order',
          description: 'Create new order',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 201, fields: [] }, errors: [] },
          auth: { required: true },
        },
      ]

      const result = formatReferenceEndpointsForPrompt(referenceEndpoints)

      expect(result).toContain('CRUD lifecycles')
      expect(result).toContain('authentication flows')
      expect(result).toContain('parent-child relationships')
    })

    it('should handle multiple reference endpoints', () => {
      const referenceEndpoints = [
        {
          method: 'GET',
          path: '/users',
          name: 'List users',
          description: 'Get all users',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: false },
        },
        {
          method: 'DELETE',
          path: '/users/{id}',
          name: 'Delete user',
          description: 'Remove user',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 204, fields: [] }, errors: [] },
          auth: { required: true },
        },
      ]

      const result = formatReferenceEndpointsForPrompt(referenceEndpoints)

      expect(result).toContain('GET')
      expect(result).toContain('DELETE')
      expect(result).toContain('/users')
      expect(result).toContain('/users/{id}')
    })

    it('should handle undefined/null gracefully', () => {
      const result1 = formatReferenceEndpointsForPrompt(null as any)
      const result2 = formatReferenceEndpointsForPrompt(undefined as any)

      expect(result1).toBe('')
      expect(result2).toBe('')
    })
  })

  describe('formatCustomRequirementsForPrompt', () => {
    it('should return empty string when no custom requirements', () => {
      const result = formatCustomRequirementsForPrompt(undefined)

      expect(result).toBe('')
    })

    it('should return empty string for empty string', () => {
      const result = formatCustomRequirementsForPrompt('')

      expect(result).toBe('')
    })

    it('should return empty string for whitespace-only string', () => {
      const result = formatCustomRequirementsForPrompt('   \n  \t  ')

      expect(result).toBe('')
    })

    it('should format custom requirements with header', () => {
      const requirements = 'Test all edge cases for user email validation'

      const result = formatCustomRequirementsForPrompt(requirements)

      expect(result).toContain('CUSTOM USER REQUIREMENTS')
      expect(result).toContain('Test all edge cases for user email validation')
      expect(result).toContain('incorporate these requirements')
    })

    it('should handle multi-line custom requirements', () => {
      const requirements = `
        1. Test all CRUD operations
        2. Verify authentication on protected endpoints
        3. Check rate limiting
      `

      const result = formatCustomRequirementsForPrompt(requirements)

      expect(result).toContain('Test all CRUD operations')
      expect(result).toContain('Verify authentication')
      expect(result).toContain('Check rate limiting')
    })

    it('should trim whitespace from requirements', () => {
      const requirements = '   Focus on security tests   '

      const result = formatCustomRequirementsForPrompt(requirements)

      expect(result).toContain('Focus on security tests')
      expect(result).not.toContain('   Focus')
    })
  })

  describe('Integration - Complete Prompt Assembly', () => {
    it('should assemble prompt for selected-only mode (no spec, no references)', () => {
      const endpoints = [
        {
          method: 'GET',
          path: '/users',
          name: 'Get users',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: false },
        },
      ]

      const endpointsJson = formatEndpointsForPrompt(endpoints)
      const specJson = formatSpecForPrompt({}, false)
      const referenceJson = formatReferenceEndpointsForPrompt([])
      const customJson = formatCustomRequirementsForPrompt(undefined)

      expect(endpointsJson).toBeTruthy()
      expect(specJson).toBe('') // No spec in selected-only mode
      expect(referenceJson).toBe('') // No references
      expect(customJson).toBe('') // No custom requirements
    })

    it('should assemble prompt for all-reference mode (full spec + all endpoints)', () => {
      const endpoints = [
        {
          method: 'POST',
          path: '/users',
          name: 'Create user',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 201, fields: [] }, errors: [] },
          auth: { required: true },
        },
      ]

      const allEndpoints = [
        ...endpoints,
        {
          method: 'GET',
          path: '/users',
          name: 'Get users',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: false },
        },
      ]

      const spec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
      }

      const endpointsJson = formatEndpointsForPrompt(endpoints)
      const specJson = formatSpecForPrompt(spec, true) // Has references
      const referenceJson = formatReferenceEndpointsForPrompt(allEndpoints)

      expect(endpointsJson).toBeTruthy()
      expect(specJson).toBeTruthy() // Should include spec
      expect(specJson).toContain('openapi')
      expect(referenceJson).toBeTruthy() // Should include references
      expect(referenceJson).toContain('REFERENCE ENDPOINTS')
    })

    it('should assemble prompt for unselected-reference mode (spec + selected references)', () => {
      const targetEndpoints = [
        {
          method: 'POST',
          path: '/orders',
          name: 'Create order',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 201, fields: [] }, errors: [] },
          auth: { required: true },
        },
      ]

      const referenceEndpoints = [
        {
          method: 'GET',
          path: '/users',
          name: 'Get users',
          request: { contentType: 'application/json', parameters: [], body: null },
          responses: { success: { status: 200, fields: [] }, errors: [] },
          auth: { required: false },
        },
      ]

      const spec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
      }

      const endpointsJson = formatEndpointsForPrompt(targetEndpoints)
      const specJson = formatSpecForPrompt(spec, true) // Has references
      const referenceJson = formatReferenceEndpointsForPrompt(referenceEndpoints)

      expect(endpointsJson).toContain('Create order')
      expect(specJson).toBeTruthy()
      expect(referenceJson).toContain('Get users')
      expect(referenceJson).toContain('REFERENCE ENDPOINTS')
    })
  })
})
