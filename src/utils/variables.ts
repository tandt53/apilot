/**
 * Dynamic Variable Generators
 * Built-in variables that auto-generate values at request time
 * Syntax: {{$variableName}}
 */

import { generateUUID } from './crypto'

/**
 * Built-in variable names (without $ prefix)
 */
export type BuiltInVariable =
  | 'timestamp'
  | 'timestampMs'
  | 'isoTimestamp'
  | 'uuid'
  | 'guid'
  | 'randomInt'
  | 'randomString'
  | 'randomBoolean'
  | 'randomEmail'
  | 'randomFirstName'
  | 'randomLastName'
  | 'randomPhoneNumber'
  | 'randomColor'

/**
 * Generate value for a built-in dynamic variable
 * @param varName - Variable name (with or without $ prefix)
 * @returns Generated value as string
 */
export function generateDynamicVariableValue(varName: string): string {
  // Remove $ prefix if present
  const cleanName = varName.startsWith('$') ? varName.slice(1) : varName

  switch (cleanName) {
    // Timestamp variables
    case 'timestamp':
      return getTimestamp()
    case 'timestampMs':
      return getTimestampMs()
    case 'isoTimestamp':
      return getIsoTimestamp()

    // Random UUID/GUID
    case 'uuid':
    case 'guid':
      return getUuid()

    // Random values
    case 'randomInt':
      return getRandomInt()
    case 'randomString':
      return getRandomString()
    case 'randomBoolean':
      return getRandomBoolean()

    // Random personal data
    case 'randomEmail':
      return getRandomEmail()
    case 'randomFirstName':
      return getRandomFirstName()
    case 'randomLastName':
      return getRandomLastName()
    case 'randomPhoneNumber':
      return getRandomPhoneNumber()
    case 'randomColor':
      return getRandomColor()

    default:
      // Not a built-in variable, return original
      return `{{$${cleanName}}}`
  }
}

/**
 * Check if a variable name is a built-in dynamic variable
 */
export function isBuiltInVariable(varName: string): boolean {
  const cleanName = varName.startsWith('$') ? varName.slice(1) : varName
  const builtInVars: BuiltInVariable[] = [
    'timestamp',
    'timestampMs',
    'isoTimestamp',
    'uuid',
    'guid',
    'randomInt',
    'randomString',
    'randomBoolean',
    'randomEmail',
    'randomFirstName',
    'randomLastName',
    'randomPhoneNumber',
    'randomColor',
  ]
  return builtInVars.includes(cleanName as BuiltInVariable)
}

/**
 * Substitute all built-in variables in a string
 * @param text - Text containing {{$variableName}} placeholders
 * @param context - Optional context for environment-aware variables
 * @param context.selectedEnv - Selected environment with baseUrl
 * @param context.defaultBaseUrl - Fallback baseUrl when no environment selected
 * @returns Text with built-in variables replaced with generated values
 */
export function substituteBuiltInVariables(
  text: string,
  context?: {
    selectedEnv?: any
    defaultBaseUrl?: string
  }
): string {
  let result = text

  // First pass: Match {{$variableName}} pattern (dynamic variables)
  result = result.replace(/\{\{\$(\w+)\}\}/g, (match, varName) => {
    if (isBuiltInVariable(varName)) {
      return generateDynamicVariableValue(varName)
    }
    return match // Keep original if not recognized
  })

  // Second pass: Handle {{baseUrl}} (environment-aware variable)
  if (result.includes('{{baseUrl}}') && context) {
    const baseUrl =
      context.selectedEnv?.baseUrl || context.defaultBaseUrl || 'http://localhost:3000'
    result = result.replace(/\{\{baseUrl\}\}/g, baseUrl)
  }

  return result
}

// =============================================================================
// Timestamp Generators
// =============================================================================

/**
 * Get current Unix timestamp in seconds
 */
function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

/**
 * Get current timestamp in milliseconds
 */
function getTimestampMs(): string {
  return Date.now().toString()
}

/**
 * Get current ISO 8601 timestamp
 */
function getIsoTimestamp(): string {
  return new Date().toISOString()
}

// =============================================================================
// UUID/GUID Generator
// =============================================================================

/**
 * Generate random UUID v4
 */
function getUuid(): string {
  return generateUUID()
}

// =============================================================================
// Random Value Generators
// =============================================================================

/**
 * Generate random integer between 0 and 1000
 */
function getRandomInt(min: number = 0, max: number = 1000): string {
  return Math.floor(Math.random() * (max - min + 1) + min).toString()
}

/**
 * Generate random alphanumeric string (10 characters)
 */
function getRandomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate random boolean
 */
function getRandomBoolean(): string {
  return Math.random() < 0.5 ? 'true' : 'false'
}

// =============================================================================
// Random Personal Data Generators
// =============================================================================

const FIRST_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'David',
  'Emma',
  'Frank',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
  'Kate',
  'Leo',
  'Mia',
  'Noah',
  'Olivia',
  'Peter',
  'Quinn',
  'Ryan',
  'Sophia',
  'Tom',
]

const LAST_NAMES = [
  'Anderson',
  'Brown',
  'Clark',
  'Davis',
  'Evans',
  'Foster',
  'Garcia',
  'Harris',
  'Jackson',
  'King',
  'Lee',
  'Martin',
  'Nelson',
  'Owens',
  'Parker',
  'Quinn',
  'Roberts',
  'Smith',
  'Taylor',
  'Wilson',
]

/**
 * Generate random email address
 */
function getRandomEmail(): string {
  const username = getRandomString(8).toLowerCase()
  const domains = ['example.com', 'test.com', 'demo.com', 'mail.com']
  const domain = domains[Math.floor(Math.random() * domains.length)]
  return `${username}@${domain}`
}

/**
 * Generate random first name
 */
function getRandomFirstName(): string {
  return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
}

/**
 * Generate random last name
 */
function getRandomLastName(): string {
  return LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
}

/**
 * Generate random phone number (US format)
 */
function getRandomPhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900 + 100) // 100-999
  const prefix = Math.floor(Math.random() * 900 + 100) // 100-999
  const lineNumber = Math.floor(Math.random() * 9000 + 1000) // 1000-9999
  return `+1-${areaCode}-${prefix}-${lineNumber}`
}

/**
 * Generate random hex color code
 */
function getRandomColor(): string {
  const hex = Math.floor(Math.random() * 16777215).toString(16)
  return `#${hex.padStart(6, '0')}`
}
