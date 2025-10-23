/**
 * Environment API Tests
 * Tests for environment creation from parsed specs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import {
  createEnvironmentFromParsedSpec,
  getEnvironmentsBySpec,
} from './environments'
import { createSpec } from './specs'

describe('createEnvironmentFromParsedSpec', () => {
  let testSpecId: number

  beforeEach(async () => {
    // Create a test spec
    const spec = await createSpec({
      name: 'Test API',
      version: '1.0.0',
      description: 'Test spec for environment tests',
      baseUrl: 'https://api.example.com',
      rawSpec: '{}',
      format: 'openapi',
      versionGroup: crypto.randomUUID(),
      isLatest: true,
      originalName: 'Test API',
    })
    testSpecId = spec.id!
  })

  afterEach(async () => {
    // Clean up test data
    await db.specs.clear()
    await db.environments.clear()
  })

  describe('Environment Creation Logic', () => {
    it('should create environment with baseUrl only', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
      })

      expect(env).toBeDefined()
      expect(env!.baseUrl).toBe('https://api.example.com')
      expect(env!.specId).toBe(testSpecId)
      // 'api.' pattern triggers Production naming
      expect(env!.name).toBe('Production')
    })

    it('should create environment with variables only', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        variables: { apiKey: 'secret123', userId: '42' },
      })

      expect(env).toBeDefined()
      expect(env!.variables).toEqual({ apiKey: 'secret123', userId: '42' })
      expect(env!.name).toBe('Imported Variables')
      expect(env!.baseUrl).toBe('')
    })

    it('should create environment with both baseUrl and variables', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://staging.example.com',
        variables: { apiKey: 'key123' },
      })

      expect(env).toBeDefined()
      expect(env!.baseUrl).toBe('https://staging.example.com')
      expect(env!.variables).toEqual({ apiKey: 'key123' })
      expect(env!.name).toBe('Staging')
    })

    it('should return undefined when no baseUrl and no variables', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
      })

      expect(env).toBeUndefined()
    })

    it('should return undefined when baseUrl is empty string', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: '',
      })

      expect(env).toBeUndefined()
    })

    it('should return undefined when baseUrl is whitespace only', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: '   ',
      })

      expect(env).toBeUndefined()
    })

    it('should return undefined when variables is empty object', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        variables: {},
      })

      expect(env).toBeUndefined()
    })
  })

  describe('Postman Placeholder Variable Filtering', () => {
    it('should filter out Postman placeholder variables ({{variableName}})', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Postman Collection',
        baseUrl: 'https://api.example.com',
        variables: {
          apiKey: '{{apiKey}}', // Placeholder - should be filtered
          baseUrl: '{{baseUrl}}', // Placeholder - should be filtered
          userId: 'user123', // Actual value - should be kept
          token: 'abc123', // Actual value - should be kept
        },
      })

      expect(env).toBeDefined()
      expect(env!.variables).toEqual({
        userId: 'user123',
        token: 'abc123',
      })
    })

    it('should return undefined if all variables are placeholders', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Postman Collection',
        variables: {
          apiKey: '{{apiKey}}',
          baseUrl: '{{baseUrl}}',
          token: '{{token}}',
        },
      })

      expect(env).toBeUndefined()
    })

    it('should create environment with baseUrl even if all variables are placeholders', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Postman Collection',
        baseUrl: 'https://api.example.com',
        variables: {
          apiKey: '{{apiKey}}',
          token: '{{token}}',
        },
      })

      expect(env).toBeDefined()
      expect(env!.baseUrl).toBe('https://api.example.com')
      expect(env!.variables).toBeUndefined()
    })

    it('should keep variables with curly braces in middle (not placeholders)', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
        variables: {
          jsonData: '{"key": "value"}', // Has braces but not placeholder format
          template: 'Hello {{name}}!', // Has braces but not full placeholder
          placeholder: '{{value}}', // Full placeholder - should be filtered
        },
      })

      expect(env).toBeDefined()
      expect(env!.variables).toEqual({
        jsonData: '{"key": "value"}',
        template: 'Hello {{name}}!',
      })
    })

    it('should convert non-string variable values to strings', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
        variables: {
          count: 42,
          enabled: true,
          ratio: 3.14,
          nullValue: null,
        } as any,
      })

      expect(env).toBeDefined()
      expect(env!.variables).toEqual({
        count: '42',
        enabled: 'true',
        ratio: '3.14',
        nullValue: 'null',
      })
    })
  })

  describe('Smart Environment Naming', () => {
    it('should name environment "Local Development" for localhost', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'http://localhost:3000',
      })

      expect(env!.name).toBe('Local Development')
    })

    it('should name environment "Local Development" for 127.0.0.1', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'http://127.0.0.1:8080',
      })

      expect(env!.name).toBe('Local Development')
    })

    it('should name environment "Development" for URLs with "dev"', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://dev.example.com',
      })

      expect(env!.name).toBe('Development')
    })

    it('should name environment "Staging" for URLs with "staging"', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://staging.example.com',
      })

      expect(env!.name).toBe('Staging')
    })

    it('should name environment "Staging" for URLs with "stg"', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api-stg.example.com',
      })

      expect(env!.name).toBe('Staging')
    })

    it('should name environment "Testing" for URLs with "test"', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://test.example.com',
      })

      expect(env!.name).toBe('Testing')
    })

    it('should name environment "Testing" for URLs with "qa"', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://qa.example.com',
      })

      expect(env!.name).toBe('Testing')
    })

    it('should name environment "Production" for URLs with "prod"', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://prod.example.com',
      })

      expect(env!.name).toBe('Production')
    })

    it('should name environment "Production" for URLs with "api."', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
      })

      expect(env!.name).toBe('Production')
    })

    it('should use hostname as name for other URLs', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://custom-server.mycompany.io',
      })

      expect(env!.name).toBe('custom-server.mycompany.io')
    })

    it('should handle invalid URLs gracefully', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'not-a-valid-url',
      })

      expect(env!.name).toBe('Test API')
    })

    it('should name "Imported Variables" when only variables (no baseUrl)', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        variables: { key: 'value' },
      })

      expect(env!.name).toBe('Imported Variables')
    })
  })

  describe('Environment Description', () => {
    it('should include variable count in description when variables present', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
        variables: { key1: 'val1', key2: 'val2', key3: 'val3' },
      })

      expect(env!.description).toContain('Test API')
      expect(env!.description).toContain('3 variables')
    })

    it('should not mention variables when only baseUrl present', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
      })

      expect(env!.description).toContain('Test API')
      expect(env!.description).not.toContain('variables')
    })
  })

  describe('Database Persistence', () => {
    it('should persist environment to database', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
      })

      // Fetch from database
      const environments = await getEnvironmentsBySpec(testSpecId)

      expect(environments).toHaveLength(1)
      expect(environments[0].id).toBe(env!.id)
      expect(environments[0].baseUrl).toBe('https://api.example.com')
    })

    it('should set createdAt and updatedAt timestamps', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
      })

      expect(env!.createdAt).toBeInstanceOf(Date)
      expect(env!.updatedAt).toBeInstanceOf(Date)
    })

    it('should generate UUID for environment ID', async () => {
      const env = await createEnvironmentFromParsedSpec(testSpecId, {
        name: 'Test API',
        baseUrl: 'https://api.example.com',
      })

      // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(env!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })
})
