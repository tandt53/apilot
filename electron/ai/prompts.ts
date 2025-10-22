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

## INPUT SPECIFICATIONS

### API Specification
{spec_json}

### Target Endpoints (Generate tests for these)
{endpoints_json}
{reference_endpoints}
{custom_requirements}

---

**CRITICAL OUTPUT FORMAT:**
- Output ONLY \`\`\`json code blocks, NO explanatory text or titles
- Do NOT write "Here are the test cases..." or "Test Case 1:" or any other prose
- Do NOT number or title the test cases outside the JSON blocks
- Each test case must be in a separate \`\`\`json code block
- Output VALID JSON only (no trailing commas, use double quotes, proper syntax)
- Ensure all JSON is parseable by standard JSON.parse()

---

## TEST CATEGORIES

Use ONE of these categories for each test:

- **Functional**: Standard CRUD operations, business logic, happy path scenarios
- **Security**: Authentication, authorization, access control, injection protection
- **Data Validation**: Input validation, schema validation, error responses
- **Workflow**: Multi-step scenarios, integration between endpoints

**Test Priority** - Assign based on criticality:
- **critical**: Authentication, core business operations, security tests
- **high**: Main user workflows, important features, data integrity
- **medium**: Standard coverage, common scenarios
- **low**: Edge cases, boundary conditions

---

## READING FROM ENDPOINT SPECIFICATION

**CRITICAL - NO HARDCODED ASSUMPTIONS. Extract ALL values from the endpoint spec:**

Each endpoint in the Enhanced Endpoints JSON has this structure:
\`\`\`
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
\`\`\`

**Extract these values from the spec:**

1. **Status Codes**: Use \`responses.success.status\` for success, \`responses.errors[].status\` for errors
2. **Field Names**: Use actual names from \`responses.success.fields[].name\` and \`request.body.fields[].name\`
3. **Required Fields**: Use \`request.body.fields[].required === true\`
4. **Enum Values**: Use \`request.body.fields[].enum\` array
5. **Validation Constraints**: Use \`min\`, \`max\`, \`format\` from field definitions
6. **Content-Type**: Use \`request.contentType\`
7. **Authentication**: Check if \`auth.required === true\`

---

## 1. FUNCTIONAL TESTS

Generate happy path and standard operation tests for EVERY endpoint:

**Success Scenarios:**
- Use complete, valid data matching \`request.body.example\` if available
- Otherwise, generate realistic data using field types from \`request.body.fields\`
- Assert success status from \`responses.success.status\`
- Assert response structure using field names from \`responses.success.fields\`

**Query Parameter Tests (for GET endpoints):**
- Test with pagination parameters if endpoint has them
- Test with sorting/filtering if endpoint supports them
- Use parameter names and types from \`request.parameters\`

**Examples:**
\`\`\`json
{
  "name": "Retrieve users list",
  "category": "Functional",
  "priority": "high",
  "test_type": "single",
  "method": "GET",
  "path": "/users",
  "assertions": [
    {"type": "status-code", "expected": 200}
  ]
}
\`\`\`

---

## 2. SECURITY TESTS

Generate security tests for protected endpoints:

**Authentication Tests:**
- Check if \`auth.required === true\`
- If true, test missing/invalid auth
- Find auth error status from \`responses.errors\` (look for 401 status)

**Authorization Tests:**
- Test access control violations
- Find forbidden status from \`responses.errors\` (look for 403 status)

**Injection Tests:**
- SQL injection in string fields: \`{"field": "'; DROP TABLE--"}\`
- XSS in string fields: \`{"field": "<script>alert('xss')</script>"}\`
- Command injection: \`{"field": "; rm -rf /"}\`
- Assert appropriate error status from \`responses.errors\`

**Examples:**
\`\`\`json
{
  "name": "Reject missing authentication",
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
\`\`\`

---

## 3. DATA VALIDATION TESTS

Generate validation tests for endpoints with request bodies:

For EACH field in \`request.body.fields\`, generate appropriate validation tests:

**Required Field Tests:**
- For each field where \`required === true\`, test with that field missing
- Find validation error status from \`responses.errors\` (typically 400 or 422)

**Data Type Tests:**
- If field type is "string", test with number/boolean
- If field type is "number", test with string/boolean
- Assert validation error status

**Enum Tests:**
- If field has \`enum\` array, test with invalid enum value
- Example: field has \`enum: ["active", "inactive"]\`, test with "invalid"

**Length/Boundary Tests:**
- If field has \`min\`, test with value below min
- If field has \`max\`, test with value above max
- Example: \`minLength: 5\`, test with "abc"

**Format Tests:**
- If field has \`format: "email"\`, test with invalid email
- If field has \`format: "date-time"\`, test with invalid date
- If field has \`format: "uuid"\`, test with invalid UUID

**Error Assertions:**
- ALWAYS assert status code from \`responses.errors[].status\`
- Do NOT assert error body structure (only status code)

**Examples:**
\`\`\`json
{
  "name": "Reject missing required email field",
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
\`\`\`

\`\`\`json
{
  "name": "Reject invalid email format",
  "category": "Data Validation",
  "priority": "medium",
  "test_type": "single",
  "method": "POST",
  "path": "/users",
  "body": {"email": "not-an-email", "name": "Test"},
  "assertions": [
    {"type": "status-code", "expected": 422}
  ]
}
\`\`\`

---

## 4. WORKFLOW TESTS

Generate multi-step workflow tests when you identify these patterns:

**Pattern Detection:**
- CRUD lifecycle: POST → GET → PUT/PATCH → DELETE on same resource
- Authentication: register → login → access protected resource
- Nested resources: create parent → create child → list children
- Data dependencies: endpoint A output needed for endpoint B input

**Workflow Requirements:**
- Use \`test_type: "workflow"\`
- Each step needs unique UUID in \`id\` field
- Extract variables using \`extractVariables\`
- Reference variables using \`{{variableName}}\` syntax
- Use MINIMAL request bodies (only required fields) to save tokens

**Variable Extraction:**
- Extract resource IDs from \`responses.success.fields\` (look for ID fields)
- Use descriptive names: userId, orderId, authToken (not generic "id")
- Extraction uses JSONPath: \`"path": "$.fieldName"\`

**Examples:**
\`\`\`json
{
  "name": "User CRUD Lifecycle",
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
\`\`\`

---

## REQUEST BODY GENERATION

**For endpoints WITH request.body.example:**
- Use the example directly: \`"body": request.body.example\`

**For endpoints WITHOUT example:**
- Extract field names from \`request.body.fields\`
- Include all required fields (\`required === true\`)
- Use simple realistic values matching field types
- For enums, use first enum value
- For workflow tests: Use MINIMAL bodies (required fields only)

**Examples:**
- String field: "test" or "example@email.com" (if format is email)
- Number field: 1 or 100
- Boolean field: true
- Enum field: Use first value from \`enum\` array

---

## FORMAT REQUIREMENTS

**Single Test Format:**
\`\`\`json
{
  "name": "Test name describing scenario",
  "description": "Optional detailed description",
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
\`\`\`

**Workflow Test Format:**
\`\`\`json
{
  "name": "Workflow name",
  "description": "Multi-step workflow description",
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
\`\`\`

**CRITICAL PATH VARIABLE RULES:**

❌ **NEVER HARDCODE VALUES IN PATH:**
\`\`\`json
// ❌ WRONG - Do NOT hardcode test values in path
{"path": "/pet/1"}
{"path": "/users/123"}
{"path": "/store/order/456"}
\`\`\`

✅ **ALWAYS USE PLACEHOLDERS IN PATH:**
\`\`\`json
// ✅ CORRECT - Use {placeholder} syntax from endpoint spec
{"path": "/pet/{petId}", "pathVariables": {"petId": "1"}}
{"path": "/users/{userId}", "pathVariables": {"userId": "123"}}
{"path": "/store/order/{orderId}", "pathVariables": {"orderId": "456"}}
\`\`\`

**Other Critical Rules:**
- \`endpoint_path\`: MUST match \`path\` from endpoint spec EXACTLY (with {placeholders})
- \`pathVariables\`: Provide actual test values as key-value pairs
- \`headers\`: Use \`request.contentType\` from endpoint spec
- Each workflow step needs unique UUID in \`id\` field
- Do NOT include "id" field in assertions (auto-generated)

---

## ASSERTION TYPES & OPERATORS

**Assertion Types:**
- \`status-code\`: Verify HTTP status
- \`response-time\`: Check response time in ms
- \`json-path\`: Verify field value using JSONPath (e.g., "$.data.id")
- \`header\`: Verify response header
- \`body-contains\`: Check if body contains text
- \`body-matches\`: Check if body matches regex

**Operators:**
- equals, not-equals
- greater-than, less-than, greater-than-or-equal, less-than-or-equal
- contains, not-contains, matches
- exists, not-exists, is-null, is-not-null
- is-array, is-object, is-string, is-number, is-boolean

---

## TEST GENERATION WORKFLOW

**PHASE 1: Single Endpoint Tests**
For EACH endpoint, generate:
1. Functional test (happy path)
2. Data Validation tests (for each validation rule)
3. Security tests (if \`auth.required\` is true)

**PHASE 2: Workflow Tests**
Analyze relationships across endpoints:
1. Identify CRUD patterns (POST → GET → PUT → DELETE)
2. Identify auth flows (register → login → protected endpoint)
3. Identify parent-child relationships
4. Generate workflow tests for discovered patterns

Output ALL tests - both single and workflow tests.`

/**
 * Test connection prompt
 */
export const TEST_CONNECTION_PROMPT = `Say "Hello! I'm ready to help you generate API tests." in one sentence.`

/**
 * Format endpoint data for AI prompt
 * Endpoints are already in canonical format - just use them directly!
 */
export function formatEndpointsForPrompt(endpoints: any[]): string {
  // Endpoints are already in canonical format from the database
  // Just extract the fields AI needs (no conversion required!)
  const formatted = endpoints.map(endpoint => ({
    method: endpoint.method,
    path: endpoint.path,
    name: endpoint.name,
    description: endpoint.description,
    tags: endpoint.tags,
    request: endpoint.request,
    responses: endpoint.responses,
    auth: endpoint.auth,
  }))

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
 */
export function formatSpecForPrompt(spec: any, hasReferenceEndpoints: boolean): string {
  // If no reference endpoints, return empty string (selected-only mode)
  if (!hasReferenceEndpoints) {
    console.log('[Prompt Formatter] API Specification: SKIPPED (no reference endpoints)')
    return ''
  }

  const formatted = {
    openapi: spec.openapi || spec.swagger,
    info: spec.info,
    servers: spec.servers,
    // Include only essential parts to keep context small
  }

  const result = JSON.stringify(formatted, null, 2)

  console.log('[Prompt Formatter] API Specification:', {
    version: formatted.openapi,
    title: formatted.info?.title,
    servers: formatted.servers,
    preview: result.substring(0, 500),
  })

  return result
}

/**
 * Format reference endpoints for AI prompt
 * These endpoints provide additional context but should NOT have tests generated for them
 */
export function formatReferenceEndpointsForPrompt(referenceEndpoints: any[]): string {
  if (!referenceEndpoints || referenceEndpoints.length === 0) {
    return ''
  }

  const formatted = referenceEndpoints.map(endpoint => ({
    method: endpoint.method,
    path: endpoint.path,
    name: endpoint.name,
    description: endpoint.description,
    request: endpoint.request,
    responses: endpoint.responses,
    auth: endpoint.auth,
  }))

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
