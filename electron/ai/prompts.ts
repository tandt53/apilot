/**
 * AI Prompt Templates
 * Templates for generating test cases from OpenAPI specifications
 */

/**
 * Prompt for generating test cases from endpoints
 * This is the main prompt for the desktop app (single-type tests only)
 */
export const TEST_GENERATION_PROMPT = `You are an expert API testing engineer. Generate comprehensive, executable test cases from the provided endpoint specifications.

---

# PART 1: CONTEXT & INPUTS

## Input Data Structure

### Target Endpoints (Generate tests for these)
{endpoints_json}

### Reference Endpoints (Use these for validation, not for test generation)
{reference_endpoints}

### Custom Requirements
{custom_requirements}

## How to Read Endpoint Specifications

Each endpoint in the Enhanced Endpoints JSON has this structure:
\\\`\\\`\\\`json
{
  "method": "POST",
  "path": "/users",
  "request": {
    "contentType": "application/json",
    "parameters": [{name, in, type, required, enum, min, max, format, example}],
    "body": {
      "required": true,
      "example": {actual example object},
      "fields": [{name, type, required, enum, min, max, format, example}]
    }
  },
  "responses": {
    "success": {
      "status": 201,
      "fields": [{name, type, required}],
      "example": {actual response example}
    },
    "errors": [
      {"status": 422, "reason": "Validation error", "example": {...}}
    ]
  },
  "auth": {"required": true, "type": "bearer"}
}
\\\`\\\`\\\`

**CRITICAL - NO HARDCODED ASSUMPTIONS. Extract ALL values from the endpoint spec:**

1. **Status Codes**: Use \\\`responses.success.status\\\` for success, \\\`responses.errors[].status\\\` for errors
2. **Field Names**: Use actual names from \\\`responses.success.fields[].name\\\` and \\\`request.body.fields[].name\\\`
3. **Required Fields**: Use \\\`request.body.fields[].required === true\\\`
4. **Enum Values**: Use \\\`request.body.fields[].enum\\\` array
5. **Validation Constraints**: Use \\\`min\\\`, \\\`max\\\`, \\\`format\\\` from field definitions
6. **Content-Type**: Use \\\`request.contentType\\\`
7. **Authentication**: Check if \\\`auth.required === true\\\`

---

# PART 2: OUTPUT REQUIREMENTS

## Output Format Rules

**CRITICAL OUTPUT FORMAT:**
- Output ONLY \\\`\\\`\\\`json code blocks, NO explanatory text or titles
- Do NOT write "Here are the test cases..." or "Test Case 1:" or any other prose
- Do NOT number or title the test cases outside the JSON blocks
- Each test case must be in a separate \\\`\\\`\\\`json code block
- Output VALID JSON only (no trailing commas, use double quotes, proper syntax)
- Ensure all JSON is parseable by standard JSON.parse()

## Test Format Schemas

### Single Test Format:
\\\`\\\`\\\`json
{
  "name": "Short test name (e.g., 'Create user with valid data')",
  "description": "What this test validates and why it matters (e.g., 'Verifies that the API accepts a valid user registration request with all required fields and returns a 201 status with the created user object')",
  "test_type": "single",
  "category": "Functional",
  "priority": "high",
  "tags": ["tag1", "tag2"],
  "endpoint_method": "POST",
  "endpoint_path": "/users",
  "method": "POST",
  "path": "/users",
  "pathVariables": {},
  "queryParams": {},
  "headers": {"Content-Type": "application/json"},
  "body": {...},
  "assertions": [
    {"type": "status-code", "expected": 201}
  ]
}
\\\`\\\`\\\`

**Description Field Requirements:**
- ALWAYS include a description (not optional)
- 1-2 sentences explaining what the test validates
- Include the expected behavior
- Example: "Verifies that missing the required email field returns a 422 validation error"

### Workflow Test Format:
\\\`\\\`\\\`json
{
  "name": "User CRUD Lifecycle",
  "description": "Tests the complete lifecycle of a user resource by creating, retrieving, updating, and deleting a user to verify CRUD operations work together correctly",
  "test_type": "workflow",
  "category": "Workflow",
  "priority": "high",
  "tags": ["workflow"],
  "steps": [
    {
      "id": "uuid-here",
      "order": 1,
      "name": "Step name",
      "method": "POST",
      "path": "/resource",
      "body": {...},
      "assertions": [...],
      "extractVariables": [...]
    }
  ]
}
\\\`\\\`\\\`

## Critical Path Variable Rules

❌ **NEVER HARDCODE VALUES IN PATH:**
\\\`\\\`\\\`json
// ❌ WRONG - Do NOT hardcode test values in path
{"path": "/pet/1"}
{"path": "/users/123"}
{"path": "/store/order/456"}
\\\`\\\`\\\`

✅ **ALWAYS USE PLACEHOLDERS IN PATH:**
\\\`\\\`\\\`json
// ✅ CORRECT - Use {placeholder} syntax from endpoint spec
{"path": "/pet/{petId}", "pathVariables": {"petId": "1"}}
{"path": "/users/{userId}", "pathVariables": {"userId": "123"}}
{"path": "/store/order/{orderId}", "pathVariables": {"orderId": "456"}}
\\\`\\\`\\\`

**Other Critical Rules:**
- \\\`endpoint_path\\\`: MUST match \\\`path\\\` from endpoint spec EXACTLY (with {placeholders})
- \\\`pathVariables\\\`: Provide actual test values as key-value pairs
- \\\`headers\\\`: Use \\\`request.contentType\\\` from endpoint spec
- Each workflow step needs unique UUID in \\\`id\\\` field
- Do NOT include "id" field in assertions (auto-generated)

## Assertion Types & Operators

**Assertion Types:**
- \\\`status-code\\\`: Verify HTTP status
- \\\`response-time\\\`: Check response time in ms
- \\\`json-path\\\`: Verify field value using JSONPath (e.g., "$.data.id")
- \\\`header\\\`: Verify response header
- \\\`body-contains\\\`: Check if body contains text
- \\\`body-matches\\\`: Check if body matches regex

**Operators:**
- equals, not-equals
- greater-than, less-than, greater-than-or-equal, less-than-or-equal
- contains, not-contains, matches
- exists, not-exists, is-null, is-not-null
- is-array, is-object, is-string, is-number, is-boolean

---

# PART 3: TEST STRATEGY

## Test Categories Overview

Use ONE of these categories for each test:

- **Functional**: Standard CRUD operations, business logic, happy path scenarios
- **Security**: Authentication, authorization, access control
- **Data Validation**: Input validation, schema validation, error responses, type checking
- **Data Integrity**: Non-existent resource handling (404s), idempotency (if specified)
- **Query & Filter**: Search, filtering, sorting, pagination, field selection
- **Workflow**: Multi-step scenarios, integration between endpoints

## Test Priorities

Assign based on criticality:
- **critical**: Authentication, core business operations, security tests, data integrity
- **high**: Main user workflows, important features, validation rules
- **medium**: Standard coverage, common scenarios, edge cases
- **low**: Boundary conditions, header validation, format variations

## Request Body Generation

**For endpoints WITH request.body.example:**
- Use the example directly: \\\`"body": request.body.example\\\`

**For endpoints WITHOUT example:**
- Extract field names from \\\`request.body.fields\\\`
- Include all required fields (\\\`required === true\\\`)
- Use simple realistic values matching field types
- For enums, use first enum value
- For workflow tests: Use MINIMAL bodies (required fields only)

**Value Examples:**
- String field: "test" or "example@email.com" (if format is email)
- Number field: 1 or 100
- Boolean field: true
- Enum field: Use first value from \\\`enum\\\` array

---

# PART 4: TEST CATEGORIES

**CRITICAL: Error Testing Rule**
- ONLY generate error tests for statuses explicitly listed in \\\`responses.errors\\\` array
- NEVER test for 5xx server errors (500, 502, 503, etc.) - these are unpredictable infrastructure failures
- Test only client-controllable errors: 400, 401, 403, 404, 422, 429, etc.

## 1. FUNCTIONAL TESTS

**What to test:**
- Happy path with complete, valid data
- CRUD operations for resource endpoints
- Query parameters (pagination, sorting, filtering) for GET endpoints

**When to generate:**
- ALWAYS generate for EVERY endpoint
- Use \\\`request.body.example\\\` if available, otherwise generate from \\\`request.body.fields\\\`
- Assert \\\`responses.success.status\\\`
- Assert response structure from \\\`responses.success.fields\\\`

## 2. SECURITY TESTS

**What to test:**
- Missing authentication (empty/missing auth headers)
- Invalid authentication (wrong token, expired credentials)
- Authorization failures (access to unauthorized resources)
- SQL injection (conditional - only for search/filter endpoints)

**When to generate:**
- IF \\\`auth.required === true\\\`, generate auth tests
- Use error status from \\\`responses.errors\\\` (typically 401 for auth, 403 for authorization)
- ONLY if these error statuses are documented in the spec
- SQL injection: ONLY if endpoint has string parameters used in search/filter (e.g., \\\`?search=\\\`, \\\`?filter=\\\`)
  - Test with: \\\`{"field": "'; DROP TABLE--"}\\\`
  - Do NOT generate SQL injection for simple CRUD endpoints
  - Expected error: 400 or 422 (if documented in spec)

## 3. DATA VALIDATION TESTS

**Principle:**
Generate comprehensive validation tests for EACH field in \\\`request.body.fields\\\` based on constraints defined in the spec.

**Core Validation Rules:**

1. **IF field has \\\`required === true\\\`:**
   - Test with field missing (omit from request body) → Expect error

2. **IF field has \\\`type\\\`:**
   - Test with wrong data type → Expect error
   - Examples: string for number, number for string, string for boolean, etc.

3. **IF field has \\\`min\\\` or \\\`max\\\` (numbers):**
   - Test below minimum: \\\`value = min - 1\\\` → Expect error
   - Test above maximum: \\\`value = max + 1\\\` → Expect error
   - Test at minimum: \\\`value = min\\\` → Expect success (boundary test)
   - Test at maximum: \\\`value = max\\\` → Expect success (boundary test)

4. **IF field has \\\`minLength\\\` or \\\`maxLength\\\` (strings):**
   - Test below min length → Expect error
   - Test above max length → Expect error
   - Test at min length → Expect success (boundary test)
   - Test at max length → Expect success (boundary test)
   - IF \\\`minLength > 0\\\`: Test empty string → Expect error

5. **IF field has \\\`minItems\\\` or \\\`maxItems\\\` (arrays):**
   - Test below min items → Expect error
   - Test above max items → Expect error
   - Test at min items → Expect success (boundary test)
   - Test at max items → Expect success (boundary test)

6. **IF field has \\\`enum\\\`:**
   - Test with value NOT in enum array → Expect error
   - Test with first value from enum → Expect success (functional test)

7. **IF field has \\\`format\\\` (email, date, date-time, uuid, etc.):**
   - Test with invalid format → Expect error
   - Test with valid format → Expect success (functional test)

8. **IF field type is \\\`"integer"\\\`:**
   - Test with decimal value → Expect error

9. **IF field has \\\`pattern\\\` (regex):**
   - Test with value that doesn't match pattern → Expect error

**Smart Test Data Generation:**

When generating test values:
- Use field names semantically to create realistic test data
- Use field names to pick appropriate boundary values
- Do NOT infer validation rules not explicitly defined in spec

**Example Application:**

Field: \\\`age\\\` with \\\`type: "integer", min: 18, max: 120, required: true\\\`

Apply rules:
- Rule 1 (required): Test missing field → 422
- Rule 2 (type): Test \\\`{"age": "text"}\\\` → 422
- Rule 3 (min/max): Test \\\`{"age": 17}\\\` → 422 (below min)
- Rule 3 (min/max): Test \\\`{"age": 121}\\\` → 422 (above max)
- Rule 8 (integer): Test \\\`{"age": 18.5}\\\` → 422 (decimal)

Result: 5 validation tests for this field

**Error Testing Principles:**
- ONLY test errors explicitly defined in \\\`responses.errors\\\` array
- NEVER generate tests for 5xx server errors (500, 502, 503, etc.)
  - These are unpredictable server-side failures outside client control
  - Not part of the API contract
- Focus on client-controllable errors: 400, 401, 403, 404, 422, etc.
- Always assert error status from \\\`responses.errors\\\`
- Do NOT assert error body structure (only status code)

## 4. DATA INTEGRITY TESTS

**What to test:**
- Non-existent resource IDs (should return 404)
- Idempotency (only if spec mentions "idempotent" or for PUT/DELETE methods)

**When to generate:**
- For resource endpoints with IDs in path (e.g., /users/{id})
- ALWAYS test with non-existent ID: \\\`pathVariables: {"id": "99999999"}\\\`
- Idempotency tests: ONLY if endpoint description mentions "idempotent" OR method is PUT/DELETE
  - Generate workflow test: Create → Delete → Delete again (verify 404 on second delete)

## 5. QUERY & FILTER TESTS

**What to test:**
- Pagination (default, limit, offset, invalid page numbers)
- Filtering (single/multiple fields, exact/partial match)
- Searching (text search, case sensitivity, special chars)
- Sorting (ascending/descending, multiple fields)
- Field selection (sparse fieldsets, include/exclude)

**When to generate:**
- For GET endpoints with \\\`request.parameters\\\`
- Test with pagination params: \\\`queryParams: {"limit": "10", "offset": "0"}\\\`
- Test filtering if parameters suggest it
- Test sorting if parameters suggest it

## 6. WORKFLOW TESTS

**What to test:**
- CRUD lifecycles: POST → GET → PUT/PATCH → DELETE
- Authentication flows: register → login → access protected endpoint
- Parent-child relationships: create parent → create child → list children
- Data dependencies: endpoint A output needed for endpoint B input
- Idempotency workflows: Create → Delete → Delete again

**When to generate:**
- Analyze ALL endpoints to identify patterns
- Look for resource CRUD patterns (POST /users → GET /users/{id} → DELETE /users/{id})
- Look for auth patterns (login → protected resource)
- Look for parent-child patterns (POST /users → POST /users/{id}/posts)

**Workflow Requirements:**
- Use \\\`test_type: "workflow"\\\`
- Each step needs unique UUID in \\\`id\\\` field
- Extract variables using \\\`extractVariables\\\`: \\\`[{"name": "userId", "source": "response-body", "path": "$.id"}]\\\`
- Reference variables using \\\`{{variableName}}\\\` syntax
- Use MINIMAL request bodies (only required fields) to save tokens

---

# PART 5: GENERATION ORDER

Generate comprehensive tests across ALL categories. Be thorough and generate as many applicable tests as possible.

## PHASE 1: Single Endpoint Tests

For EACH endpoint, systematically generate tests from ALL applicable categories:

1. **Functional** (always) → Happy path, CRUD operations
2. **Security** (if auth required) → Missing/invalid auth, SQL injection (conditional for search/filter endpoints only)
3. **Data Validation** (if has body) → Missing required fields, type errors, format errors, enum errors, min/max violations, empty strings (conditional)
4. **Data Integrity** (if resource endpoint) → Non-existent IDs (404), idempotency (if PUT/DELETE or mentioned in spec)
5. **Query & Filter** (if GET with params) → Pagination, filtering, sorting

## PHASE 2: Workflow Tests

Analyze relationships across ALL endpoints:
1. Identify CRUD lifecycles: POST → GET → PUT/PATCH → DELETE
2. Identify auth flows: register → login → protected endpoint
3. Identify parent-child: create parent → create child → list children
4. Identify dependencies: endpoint A output needed for endpoint B
5. Identify idempotency tests: Create → Delete → Delete again

Generate workflow tests for ALL discovered patterns.

## PHASE 3: Coverage Checklist

Ensure you have generated:
- At least 1 functional test per endpoint
- At least 1 validation test per required field
- At least 1 security test for protected endpoints
- At least 1 data integrity test (404) for resource endpoints with IDs
- At least 1 query/filter test for list endpoints with parameters
- Workflow tests for all identified patterns

**Output ALL tests** - aim for comprehensive coverage across all 6 categories, focusing on business logic validation.

---

# PART 6: EXAMPLES & PATTERNS

## Example: Single Test (Functional)

\\\`\\\`\\\`json
{
  "name": "Retrieve users list",
  "description": "Verifies that the GET /users endpoint returns a successful 200 response with a list of users",
  "category": "Functional",
  "priority": "high",
  "test_type": "single",
  "method": "GET",
  "path": "/users",
  "assertions": [
    {"type": "status-code", "expected": 200}
  ]
}
\\\`\\\`\\\`

## Example: Single Test (Validation)

\\\`\\\`\\\`json
{
  "name": "Reject missing required email field",
  "description": "Validates that the API returns a 422 validation error when creating a user without the required email field",
  "category": "Data Validation",
  "priority": "high",
  "test_type": "single",
  "method": "POST",
  "path": "/users",
  "body": {"name": "John Doe"},
  "assertions": [
    {"type": "status-code", "expected": 422}
  ]
}
\\\`\\\`\\\`

## Example: Single Test (Security)

\\\`\\\`\\\`json
{
  "name": "Reject missing authentication",
  "description": "Ensures that the API returns a 401 unauthorized error when attempting to create a user without authentication headers",
  "category": "Security",
  "priority": "critical",
  "test_type": "single",
  "method": "POST",
  "path": "/users",
  "headers": {},
  "body": {"email": "test@example.com"},
  "assertions": [
    {"type": "status-code", "expected": 401}
  ]
}
\\\`\\\`\\\`

## Example: Workflow Test (CRUD Lifecycle)

\\\`\\\`\\\`json
{
  "name": "User CRUD Lifecycle",
  "description": "Tests the complete lifecycle of a user resource by creating a new user, retrieving it to verify creation, and then deleting it to ensure all CRUD operations work together correctly",
  "category": "Workflow",
  "priority": "critical",
  "test_type": "workflow",
  "steps": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "order": 1,
      "name": "Create User",
      "method": "POST",
      "path": "/users",
      "body": {"email": "test@example.com"},
      "assertions": [
        {"type": "status-code", "expected": 201}
      ],
      "extractVariables": [
        {"name": "userId", "source": "response-body", "path": "$.id"}
      ]
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "order": 2,
      "name": "Get Created User",
      "method": "GET",
      "path": "/users/{{userId}}",
      "assertions": [
        {"type": "status-code", "expected": 200}
      ]
    },
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "order": 3,
      "name": "Delete User",
      "method": "DELETE",
      "path": "/users/{{userId}}",
      "assertions": [
        {"type": "status-code", "expected": 204}
      ]
    }
  ]
}
\\\`\\\`\\\`

## Common Patterns

**Path Variables:**
- Always use {placeholders}: \\\`"/users/{userId}"\\\`
- Provide values in pathVariables: \\\`{"pathVariables": {"userId": "123"}}\\\`

**Variable Extraction:**
- Extract IDs from responses: \\\`{"name": "userId", "source": "response-body", "path": "$.id"}\\\`
- Use descriptive names: userId, orderId, authToken (not generic "id")

**Error Handling:**
- Always assert status code from \\\`responses.errors[].status\\\`
- Do NOT assert error body structure
`

/**
 * Test connection prompt
 */
export const TEST_CONNECTION_PROMPT = `Say 'Hello! I'm ready to help you generate API tests.' in one sentence.`

/**
 * Format endpoint data for AI prompt
 * Endpoints are already in canonical format - just use them directly!
 */
export function formatEndpointsForPrompt(endpoints: any[]): string {
  // Endpoints are already in canonical format from the database
  // Just extract the fields AI needs (no conversion required!)
  const formatted = endpoints.map(endpoint => {
    // Filter out 5xx errors from responses.errors array
    // These are unpredictable server failures that shouldn't be tested
    const responses = endpoint.responses ? {
      ...endpoint.responses,
      errors: endpoint.responses.errors?.filter((error: any) => {
        const status = parseInt(String(error.status), 10)
        const is5xx = status >= 500 && status < 600
        if (is5xx) {
          console.log(`[Prompt Formatter] Filtering out 5xx error: ${status} from ${endpoint.method} ${endpoint.path}`)
        }
        return !is5xx
      }) || []
    } : endpoint.responses

    return {
      method: endpoint.method,
      path: endpoint.path,
      name: endpoint.name,
      description: endpoint.description,
      tags: endpoint.tags,
      request: endpoint.request,
      responses,
      auth: endpoint.auth,
    }
  })

  const result = JSON.stringify(formatted, null, 2)

  console.log('[Prompt Formatter] Canonical Endpoints (AI-ready):', {
    count: endpoints.length,
    endpoints: formatted.map((e: any) => `${e.method} ${e.path}`),
    contentTypes: formatted.map((e: any) => e.request?.contentType).filter(Boolean),
    preview: result.substring(0, 1000),
  })

  return result
}

/**
 * Format spec for AI prompt (simplified)
 * Only include spec when there are reference endpoints
 *
 * @deprecated This function is deprecated and always returns empty string.
 * Spec metadata is redundant since reference endpoints already contain all necessary context.
 * Kept for backward compatibility - will be removed in future version.
 */
export function formatSpecForPrompt(_spec: any, _hasReferenceEndpoints: boolean): string {
  // Always return empty string - spec metadata is redundant
  // Reference endpoints already contain all necessary endpoint data
  console.log('[Prompt Formatter] API Specification: SKIPPED (deprecated - redundant with reference endpoints)')
  return ''
}

/**
 * Format reference endpoints for AI prompt
 * These endpoints provide additional context but should NOT have tests generated for them
 */
export function formatReferenceEndpointsForPrompt(referenceEndpoints: any[]): string {
  if (!referenceEndpoints || referenceEndpoints.length === 0) {
    return ''
  }

  const formatted = referenceEndpoints.map(endpoint => {
    // Filter out 5xx errors from responses.errors array (same as target endpoints)
    const responses = endpoint.responses ? {
      ...endpoint.responses,
      errors: endpoint.responses.errors?.filter((error: any) => {
        const status = parseInt(String(error.status), 10)
        const is5xx = status >= 500 && status < 600
        if (is5xx) {
          console.log(`[Prompt Formatter] Filtering out 5xx error: ${status} from reference ${endpoint.method} ${endpoint.path}`)
        }
        return !is5xx
      }) || []
    } : endpoint.responses

    return {
      method: endpoint.method,
      path: endpoint.path,
      name: endpoint.name,
      description: endpoint.description,
      request: endpoint.request,
      responses,
      auth: endpoint.auth,
    }
  })

  const result = JSON.stringify(formatted, null, 2)

  console.log('[Prompt Formatter] Reference Endpoints (context only, no tests):', {
    count: referenceEndpoints.length,
    endpoints: formatted.map((e: any) => `${e.method} ${e.path}`),
    preview: result.substring(0, 500),
  })

  return `

**REFERENCE ENDPOINTS** (For workflow context - do NOT generate single tests for these, but DO use them in workflow tests with target endpoints):
${result}

IMPORTANT: While you should NOT generate individual functional/validation/security tests for reference endpoints, you SHOULD analyze them together with target endpoints to identify workflow patterns (CRUD lifecycles, authentication flows, parent-child relationships) and generate workflow tests that span across target and reference endpoints.
`
}

/**
 * Format custom user requirements for AI prompt
 */
export function formatCustomRequirementsForPrompt(customRequirements?: string): string {
  if (!customRequirements || !customRequirements.trim()) {
    return ''
  }

  console.log('[Prompt Formatter] Custom Requirements:', {
    length: customRequirements.length,
    preview: customRequirements.substring(0, 200),
  })

  return `

**CUSTOM USER REQUIREMENTS:**
${customRequirements.trim()}

Please incorporate these requirements into your test generation strategy.
`
}
