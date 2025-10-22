import { describe, it, expect } from 'vitest'
import { buildBodyFromSchema, validateBodyConsistency, bodyMatchesSchema } from './bodyHelpers'
import type { CanonicalField } from '@/types/canonical'

describe('buildBodyFromSchema', () => {
  it('should build body with default values for all types', () => {
    const fields: CanonicalField[] = [
      { name: 'username', type: 'string', required: true },
      { name: 'age', type: 'integer', required: true },
      { name: 'price', type: 'number', required: true },
      { name: 'active', type: 'boolean', required: true },
      { name: 'tags', type: 'array', required: true },
    ]

    const result = buildBodyFromSchema(fields)

    expect(result).toEqual({
      username: 'username',
      age: 0,
      price: 0,
      active: true,
      tags: [],
    })
  })

  it('should build nested objects recursively', () => {
    const fields: CanonicalField[] = [
      { name: 'userId', type: 'integer', required: true },
      {
        name: 'address',
        type: 'object',
        required: true,
        properties: [
          { name: 'street', type: 'string', required: true },
          { name: 'city', type: 'string', required: true },
          { name: 'zipCode', type: 'integer', required: true },
        ],
      },
    ]

    const result = buildBodyFromSchema(fields)

    expect(result).toEqual({
      userId: 0,
      address: {
        street: 'street',
        city: 'city',
        zipCode: 0,
      },
    })
  })

  it('should build arrays with object items', () => {
    const fields: CanonicalField[] = [
      {
        name: 'items',
        type: 'array',
        required: true,
        items: {
          type: 'object',
          properties: [
            { name: 'productId', type: 'integer', required: true },
            { name: 'quantity', type: 'integer', required: true },
            { name: 'price', type: 'number', required: true },
          ],
        },
      },
    ]

    const result = buildBodyFromSchema(fields)

    expect(result).toEqual({
      items: [
        {
          productId: 0,
          quantity: 0,
          price: 0,
        },
      ],
    })
  })

  it('should handle deeply nested structures', () => {
    const fields: CanonicalField[] = [
      {
        name: 'order',
        type: 'object',
        required: true,
        properties: [
          { name: 'orderId', type: 'integer', required: true },
          {
            name: 'customer',
            type: 'object',
            required: true,
            properties: [
              { name: 'name', type: 'string', required: true },
              {
                name: 'address',
                type: 'object',
                required: true,
                properties: [
                  { name: 'street', type: 'string', required: true },
                  { name: 'city', type: 'string', required: true },
                ],
              },
            ],
          },
        ],
      },
    ]

    const result = buildBodyFromSchema(fields)

    expect(result).toEqual({
      order: {
        orderId: 0,
        customer: {
          name: 'name',
          address: {
            street: 'street',
            city: 'city',
          },
        },
      },
    })
  })

  it('should return empty object for empty fields array', () => {
    const result = buildBodyFromSchema([])
    expect(result).toEqual({})
  })

  it('should handle object type without properties', () => {
    const fields: CanonicalField[] = [
      { name: 'metadata', type: 'object', required: true },
    ]

    const result = buildBodyFromSchema(fields)

    expect(result).toEqual({
      metadata: {},
    })
  })

  it('should handle array type without items', () => {
    const fields: CanonicalField[] = [
      { name: 'tags', type: 'array', required: true },
    ]

    const result = buildBodyFromSchema(fields)

    expect(result).toEqual({
      tags: [],
    })
  })

  it('should handle file type as string placeholder', () => {
    const fields: CanonicalField[] = [
      { name: 'photo', type: 'file', required: true, format: 'binary' },
    ]

    const result = buildBodyFromSchema(fields)

    expect(result).toEqual({
      photo: 'photo',
    })
  })
})

describe('validateBodyConsistency', () => {
  it('should return valid when keys match perfectly', () => {
    const example = { name: 'John', email: 'john@example.com' }
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
    ]

    const result = validateBodyConsistency(example, fields)

    expect(result.isValid).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual([])
  })

  it('should detect missing keys in example', () => {
    const example = { name: 'John' }
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'age', type: 'integer', required: true },
    ]

    const result = validateBodyConsistency(example, fields)

    expect(result.isValid).toBe(false)
    expect(result.missing).toEqual(['email', 'age'])
    expect(result.extra).toEqual([])
  })

  it('should detect extra keys in example', () => {
    const example = { name: 'John', email: 'john@example.com', extra: 'value' }
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
    ]

    const result = validateBodyConsistency(example, fields)

    expect(result.isValid).toBe(false)
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual(['extra'])
  })

  it('should detect both missing and extra keys', () => {
    const example = { oldField: 'value', extra: 'data' }
    const fields: CanonicalField[] = [
      { name: 'newField', type: 'string', required: true },
      { name: 'another', type: 'string', required: true },
    ]

    const result = validateBodyConsistency(example, fields)

    expect(result.isValid).toBe(false)
    expect(result.missing).toEqual(['newField', 'another'])
    expect(result.extra).toEqual(['oldField', 'extra'])
  })

  it('should handle empty example object', () => {
    const example = {}
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
    ]

    const result = validateBodyConsistency(example, fields)

    expect(result.isValid).toBe(false)
    expect(result.missing).toEqual(['name'])
    expect(result.extra).toEqual([])
  })

  it('should handle empty fields array', () => {
    const example = { name: 'John' }
    const fields: CanonicalField[] = []

    const result = validateBodyConsistency(example, fields)

    expect(result.isValid).toBe(false)
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual(['name'])
  })

  it('should return valid for both empty', () => {
    const example = {}
    const fields: CanonicalField[] = []

    const result = validateBodyConsistency(example, fields)

    expect(result.isValid).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual([])
  })

  it('should handle null or undefined example', () => {
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
    ]

    const resultNull = validateBodyConsistency(null, fields)
    expect(resultNull.isValid).toBe(false)
    expect(resultNull.missing).toEqual(['name'])

    const resultUndefined = validateBodyConsistency(undefined, fields)
    expect(resultUndefined.isValid).toBe(false)
    expect(resultUndefined.missing).toEqual(['name'])
  })

  it('should handle non-object example', () => {
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
    ]

    const result = validateBodyConsistency('invalid', fields)

    expect(result.isValid).toBe(false)
    expect(result.missing).toEqual(['name'])
    expect(result.extra).toEqual([])
  })
})

describe('bodyMatchesSchema', () => {
  it('should return true when all schema fields present in example', () => {
    const example = { name: 'John', email: 'john@example.com', extra: 'allowed' }
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
    ]

    const result = bodyMatchesSchema(example, fields)
    expect(result).toBe(true)
  })

  it('should return false when schema fields missing in example', () => {
    const example = { name: 'John' }
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
    ]

    const result = bodyMatchesSchema(example, fields)
    expect(result).toBe(false)
  })

  it('should return false for empty example with non-empty schema', () => {
    const example = {}
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
    ]

    const result = bodyMatchesSchema(example, fields)
    expect(result).toBe(false)
  })

  it('should return false for empty schema', () => {
    const example = { name: 'John' }
    const fields: CanonicalField[] = []

    const result = bodyMatchesSchema(example, fields)
    expect(result).toBe(false)
  })

  it('should return false for null/undefined example', () => {
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
    ]

    expect(bodyMatchesSchema(null, fields)).toBe(false)
    expect(bodyMatchesSchema(undefined, fields)).toBe(false)
  })

  it('should return false for non-object example', () => {
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
    ]

    expect(bodyMatchesSchema('invalid', fields)).toBe(false)
    expect(bodyMatchesSchema(123, fields)).toBe(false)
  })

  it('should allow extra keys in example', () => {
    const example = { name: 'John', email: 'john@example.com', age: 30, city: 'NYC' }
    const fields: CanonicalField[] = [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
    ]

    const result = bodyMatchesSchema(example, fields)
    expect(result).toBe(true) // Extra keys are allowed
  })
})
