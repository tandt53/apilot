/**
 * AI Prompt Templates
 * Templates for generating test cases from OpenAPI specifications
 */

/**
 * Prompt for generating test cases from endpoints
 * This is the main prompt for the desktop app (single-type tests only)
 */
export const TEST_GENERATION_PROMPT = `You are an expert API testing engineer. Given the enhanced endpoint specifications, generate complete, executable test cases.

Enhanced Endpoints:
{endpoints_json}

API Specification:
{spec_json}

Some sample created tests related to enhanced endpoints:
{endpoints_json}

Generate comprehensive test cases per endpoint (including positive and negative scenarios).

**CRITICAL OUTPUT FORMAT:**
- Output ONLY \`\`\`json code blocks, NO explanatory text or titles
- Do NOT write "Here are the test cases..." or "Test Case 1:" or any other prose
- Do NOT number or title the test cases outside the JSON blocks
- Each test case must be in a separate \`\`\`json code block
- Output VALID JSON only (no trailing commas, use double quotes, proper syntax)
- Ensure all JSON is parseable by standard JSON.parse()

Output EACH test case in a separate \`\`\`json code block. DO NOT add any text outside the code blocks.

Format examples:

\`\`\`json
{
  "name": "Test name",
  "description": "Test description",
  "test_type": "single",
  "endpoint_method": "GET",
  "endpoint_path": "/api/resource/{id}",
  "method": "GET",
  "path": "/api/resource/{id}",
  "pathVariables": {"id": "123"},
  "queryParams": {"limit": 10},
  "headers": {"Content-Type": "application/json"},
  "body": null,
  "assertions": [
    {
      "type": "status-code",
      "expected": 200,
      "description": "Status code should be 200"
    },
    {
      "type": "json-path",
      "field": "$.data.length",
      "operator": "less-than-or-equal",
      "expected": 10,
      "description": "Response should have at most 10 items"
    }
  ],
  "category": "Data Retrieval",
  "tags": ["get", "pagination"],
  "priority": "high"
}
\`\`\`

\`\`\`json
{
  "name": "Upload file successfully",
  "description": "Test uploading a file with multipart/form-data",
  "test_type": "single",
  "endpoint_method": "POST",
  "endpoint_path": "/pet/{petId}/uploadImage",
  "method": "POST",
  "path": "/pet/{petId}/uploadImage",
  "pathVariables": {"petId": "123"},
  "queryParams": {},
  "headers": {"Content-Type": "multipart/form-data"},
  "body": {
    "additionalMetadata": "Profile picture",
    "file": "test-image.jpg"
  },
  "assertions": [
    {
      "type": "status-code",
      "expected": 200,
      "description": "Status code should be 200"
    }
  ],
  "category": "File Upload",
  "tags": ["post", "upload"],
  "priority": "high"
}
\`\`\`

\`\`\`json
{
  "name": "User CRUD Workflow",
  "description": "Create, verify, update, and delete user",
  "test_type": "workflow",
  "category": "CRUD Workflow",
  "tags": ["workflow", "crud", "users"],
  "priority": "high",
  "steps": [
    {
      "id": "step-1",
      "order": 1,
      "name": "Create User",
      "method": "POST",
      "path": "/users",
      "headers": {"Content-Type": "application/json"},
      "body": {"name": "John Doe", "email": "john@example.com"},
      "assertions": [
        {
          "type": "status-code",
          "expected": 201,
          "description": "User created successfully"
        }
      ],
      "extractVariables": [
        {
          "name": "userId",
          "source": "response-body",
          "path": "$.id"
        }
      ]
    },
    {
      "id": "step-2",
      "order": 2,
      "name": "Get Created User",
      "method": "GET",
      "path": "/users/{userId}",
      "pathVariables": {"userId": "{{userId}}"},
      "headers": {"Content-Type": "application/json"},
      "assertions": [
        {
          "type": "status-code",
          "expected": 200,
          "description": "User retrieved successfully"
        },
        {
          "type": "json-path",
          "field": "$.name",
          "operator": "equals",
          "expected": "John Doe",
          "description": "User name matches"
        }
      ]
    },
    {
      "id": "step-3",
      "order": 3,
      "name": "Delete User",
      "method": "DELETE",
      "path": "/users/{userId}",
      "pathVariables": {"userId": "{{userId}}"},
      "assertions": [
        {
          "type": "status-code",
          "expected": 204,
          "description": "User deleted successfully"
        }
      ]
    }
  ]
}
\`\`\`

IMPORTANT:
- test_type can be "single" or "workflow"
- Use "single" for testing individual endpoints independently
- Use "workflow" for multi-step scenarios where later steps depend on data from earlier steps
- **CRITICAL**: "path" and "endpoint_path" MUST use the original template format with {curly braces} for path variables (e.g., "/pet/{petId}/uploadImage", NOT "/pet/123/uploadImage")
- The actual path variable values go in the "pathVariables" object (e.g., {"petId": "123"})
- **CRITICAL - Content-Type Headers**:
  - Check the endpoint's requestBody.content to determine the correct Content-Type
  - If requestBody has "application/json", set headers: {"Content-Type": "application/json"} and use JSON in body
  - If requestBody has "multipart/form-data", set headers: {"Content-Type": "multipart/form-data"} and use form fields in body
  - If requestBody has "application/x-www-form-urlencoded", set headers: {"Content-Type": "application/x-www-form-urlencoded"}
  - NEVER mix content types (e.g., don't use multipart/form-data header with JSON body)
- **CRITICAL - Request Body Format**:
  - For multipart/form-data: body should contain form field names as keys with their values
  - For application/json: body should be a JSON object matching the schema
  - For file uploads: use the field name from schema (e.g., "file": "path/to/file.jpg")
- Generate realistic test data that matches the API schema
- Include proper assertions to verify the response
- Do NOT include "id" field in assertions (it will be auto-generated)
- Use JSONPath expressions for field assertions (e.g., $.data.id, $.errors[0].message)
- Include both positive tests (expected success) and negative tests (expected errors)
- For path parameters, use pathVariables object with the variable values
- For query parameters, use queryParams object

For workflow tests:
- steps array contains ordered test steps (each step executes sequentially)
- Each step has same fields as single tests (method, path, headers, body, assertions)
- Each step must have a unique UUID in the "id" field (generate using standard UUID format)
- Use extractVariables to capture values from one step's response to use in later steps
- Reference extracted variables using {{variableName}} syntax in pathVariables, queryParams, headers, or body
- Variable extraction uses JSONPath for response-body source (e.g., "$.data.id" extracts data.id)
- Variable extraction sources: "response-body", "response-header", "status-code", "response-time"
- Example: Extract userId from POST /users response, then use {{userId}} in GET /users/{userId}

Assertion types available:
- status-code: Verify HTTP status code
- response-time: Check response time in ms
- json-path: Extract and verify a field value using JSONPath
- header: Verify response header value
- body-contains: Check if response body contains text
- body-matches: Check if response body matches regex
- schema: Validate against JSON schema

Assertion operators:
- equals, not-equals
- greater-than, less-than, greater-than-or-equal, less-than-or-equal
- contains, not-contains
- matches (regex)
- exists, not-exists
- is-null, is-not-null
- is-array, is-object, is-string, is-number, is-boolean

**Test Generation Strategy:**

**PHASE 1: Single Endpoint Tests**
- Generate individual "single" tests for EACH endpoint
- Include positive scenarios (happy path with valid data)
- Include negative scenarios (invalid inputs, missing required fields, boundary cases, unauthorized access)
- Each test should be independent and self-contained

**PHASE 2: Workflow Tests (Relationship Analysis)**
After generating single tests, analyze relationships across ALL endpoints to identify workflow opportunities:

**What to look for:**
- **Path structure patterns**: Endpoints sharing base paths (e.g., /users and /users/{id}, /orders/{orderId}/items)
- **HTTP method combinations**: Same resource with different methods (POST, GET, PUT/PATCH, DELETE)
- **Schema field overlaps**: Response fields from one endpoint that match request parameters in another (e.g., POST /users returns userId, GET /users/{userId}/profile needs userId)
- **Logical operation sequences**: Authentication flows, multi-step processes, state transitions
- **Parent-child hierarchies**: Nested resources that depend on parent resource creation
- **Data dependencies**: When output from one endpoint is required input for another

**When to generate workflow tests:**
- Multiple endpoints work together to accomplish a business process
- Later steps require data from earlier steps (use variable extraction with {{variableName}} syntax)
- Testing complete operation sequences provides more value than isolated tests
- **Do NOT limit yourself to predefined patterns** - analyze the actual API structure and generate workflows based on relationships you discover

**Output requirements:**
- Each test (single or workflow) must be in its own \`\`\`json block
- Generate single tests FIRST, then workflow tests
- Use extractVariables to capture data from responses and reference with {{variableName}} in subsequent steps

Continue generating test cases for ALL endpoints. Include BOTH comprehensive single tests AND workflow tests where applicable.`

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
 */
export function formatSpecForPrompt(spec: any): string {
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
