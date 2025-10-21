/**
 * Model Capability Validator
 * Tests if AI models can handle the complex test generation task
 */

export interface ModelCapabilityResult {
  capable: boolean
  score: number // 0-100
  issues: string[]
  warnings: string[]
  recommendation: string
}

/**
 * Capability test prompt - simpler version of actual test generation
 * Tests JSON compliance, instruction-following, and basic reasoning
 */
export const CAPABILITY_TEST_PROMPT = `You are an API testing expert. Given this simple API endpoint, generate ONE test case in the exact JSON format specified.

**ENDPOINT SPECIFICATION:**
\`\`\`json
{
  "method": "POST",
  "path": "/users",
  "request": {
    "contentType": "application/json",
    "body": {
      "required": true,
      "fields": [
        {"name": "email", "type": "string", "required": true, "format": "email"},
        {"name": "name", "type": "string", "required": true}
      ]
    }
  },
  "responses": {
    "success": {"status": 201},
    "errors": [{"status": 422, "reason": "Validation error"}]
  }
}
\`\`\`

**CRITICAL INSTRUCTIONS:**
1. Output ONLY a single \`\`\`json code block
2. Do NOT add any explanatory text before or after the JSON
3. Use VALID JSON syntax (no trailing commas, double quotes only)
4. Follow this EXACT structure:

\`\`\`json
{
  "name": "Create user with valid data",
  "test_type": "single",
  "method": "POST",
  "path": "/users",
  "body": {
    "email": "test@example.com",
    "name": "Test User"
  },
  "assertions": [
    {"type": "status-code", "expected": 201}
  ]
}
\`\`\`

Generate the test case now.`

/**
 * Validate model capability by testing JSON generation
 */
export function validateModelCapability(response: string): ModelCapabilityResult {
  const issues: string[] = []
  const warnings: string[] = []
  let score = 100

  console.log('[Model Validator] Testing response:', response.substring(0, 500))

  // 1. Check for extra prose/explanation (strict instruction-following test)
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g
  const matches = Array.from(response.matchAll(jsonBlockRegex))

  if (matches.length === 0) {
    issues.push('No JSON code block found - model did not follow format instructions')
    score -= 50
  } else if (matches.length > 1) {
    warnings.push(`Generated ${matches.length} JSON blocks instead of 1`)
    score -= 10
  }

  // Check for prose before/after JSON block
  const textBeforeJson = response.substring(0, response.indexOf('```json')).trim()
  const textAfterJson = response.substring(response.lastIndexOf('```') + 3).trim()

  if (textBeforeJson.length > 0) {
    warnings.push('Added explanatory text before JSON (instruction not followed exactly)')
    score -= 15
  }

  if (textAfterJson.length > 0) {
    warnings.push('Added explanatory text after JSON')
    score -= 10
  }

  // 2. Validate JSON syntax
  if (matches.length > 0) {
    const jsonContent = matches[0][1]

    try {
      const parsed = JSON.parse(jsonContent)

      // 3. Validate required fields (reasoning test)
      const requiredFields = ['name', 'test_type', 'method', 'path', 'body', 'assertions']
      const missingFields = requiredFields.filter(field => !(field in parsed))

      if (missingFields.length > 0) {
        issues.push(`Missing required fields: ${missingFields.join(', ')}`)
        score -= 20
      }

      // 4. Validate field correctness (semantic understanding)
      if (parsed.method !== 'POST') {
        issues.push(`Wrong method: "${parsed.method}" (expected "POST")`)
        score -= 10
      }

      if (parsed.path !== '/users') {
        issues.push(`Wrong path: "${parsed.path}" (expected "/users")`)
        score -= 10
      }

      if (parsed.test_type !== 'single') {
        warnings.push(`Wrong test_type: "${parsed.test_type}" (expected "single")`)
        score -= 5
      }

      // 5. Validate request body structure (understanding of API spec)
      if (!parsed.body || typeof parsed.body !== 'object') {
        issues.push('Request body missing or invalid')
        score -= 15
      } else {
        if (!parsed.body.email || !parsed.body.email.includes('@')) {
          warnings.push('Invalid or missing email field in body')
          score -= 10
        }
        if (!parsed.body.name || typeof parsed.body.name !== 'string') {
          warnings.push('Invalid or missing name field in body')
          score -= 10
        }
      }

      // 6. Validate assertions (critical for test generation)
      if (!Array.isArray(parsed.assertions) || parsed.assertions.length === 0) {
        issues.push('Missing or invalid assertions array')
        score -= 20
      } else {
        const statusAssertion = parsed.assertions.find((a: any) => a.type === 'status-code')
        if (!statusAssertion) {
          issues.push('Missing status-code assertion')
          score -= 15
        } else if (statusAssertion.expected !== 201) {
          issues.push(`Wrong status code: ${statusAssertion.expected} (expected 201)`)
          score -= 10
        }
      }

    } catch (parseError: any) {
      issues.push(`Invalid JSON syntax: ${parseError.message}`)
      score -= 40
    }
  }

  // Determine capability
  const capable = score >= 70
  const recommendation = getRecommendation(score, issues, warnings)

  return {
    capable,
    score: Math.max(0, score),
    issues,
    warnings,
    recommendation,
  }
}

/**
 * Generate recommendation based on validation results
 */
function getRecommendation(score: number, issues: string[], warnings: string[]): string {
  if (score >= 90) {
    return '✅ Excellent - This model should work very well for test generation'
  }

  if (score >= 70) {
    return '⚠️  Acceptable - This model should work but may produce some imperfect tests'
  }

  if (score >= 50) {
    return '⚠️  Marginal - This model may struggle with complex test scenarios. Consider using a more capable model.'
  }

  return '❌ Not Recommended - This model cannot reliably follow instructions or generate structured output. Please choose a different model.'
}

/**
 * Recommended models per provider (known to work well)
 */
export const RECOMMENDED_MODELS = {
  openai: [
    { name: 'gpt-4o', reason: 'Most capable, best for complex workflows' },
    { name: 'gpt-4o-mini', reason: 'Fast and cost-effective, good instruction-following' },
    { name: 'gpt-4-turbo', reason: 'Balanced performance and cost' },
  ],
  anthropic: [
    { name: 'claude-3-5-sonnet-20241022', reason: 'Best reasoning and instruction-following' },
    { name: 'claude-3-5-haiku-20241022', reason: 'Fast and accurate for structured tasks' },
  ],
  gemini: [
    { name: 'gemini-2.0-flash-exp', reason: 'Fast with good reasoning (experimental)' },
    { name: 'gemini-1.5-pro', reason: 'Most capable Gemini model' },
    { name: 'gemini-1.5-flash', reason: 'Fast and cost-effective' },
  ],
  ollama: [
    { name: 'qwen2.5:32b', reason: 'Best instruction-following for local models' },
    { name: 'llama3.3:70b', reason: 'Strong reasoning (requires powerful hardware)' },
    { name: 'mistral-large', reason: 'Good balance of capability and speed' },
  ],
}

/**
 * Known problematic models that should trigger warnings
 */
export const PROBLEMATIC_MODELS = [
  // OpenAI
  { pattern: /gpt-3\.5-turbo/, reason: 'Often struggles with strict JSON formatting and complex instructions' },
  { pattern: /text-davinci/, reason: 'Legacy model, not optimized for instruction-following' },
  { pattern: /babbage|ada|curie/, reason: 'Too weak for structured test generation' },

  // Anthropic
  { pattern: /claude-instant/, reason: 'Limited reasoning capability' },
  { pattern: /claude-2/, reason: 'Older model, less reliable than Claude 3+' },

  // Gemini
  { pattern: /gemini-pro$/, reason: 'Legacy model, use gemini-1.5-pro instead' },

  // Ollama
  { pattern: /llama3\.1:8b|llama3:8b/, reason: '8B parameter models struggle with complex JSON generation' },
  { pattern: /phi/, reason: 'Small models lack reasoning capability' },
  { pattern: /tinyllama/, reason: 'Too small for structured output' },
  { pattern: /gemma:2b|gemma:7b/, reason: 'Insufficient capability for test generation' },
]

/**
 * Check if model name matches known problematic patterns
 */
export function checkModelCompatibility(modelName: string, provider: string): {
  isProblematic: boolean
  warning?: string
  suggestedAlternatives?: Array<{ name: string; reason: string }>
} {
  const problematic = PROBLEMATIC_MODELS.find(p => p.pattern.test(modelName))

  if (problematic) {
    return {
      isProblematic: true,
      warning: problematic.reason,
      suggestedAlternatives: RECOMMENDED_MODELS[provider as keyof typeof RECOMMENDED_MODELS],
    }
  }

  return { isProblematic: false }
}
