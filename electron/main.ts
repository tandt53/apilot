const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

// Disable security warnings in development
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// Set app name for macOS menu bar and dock
app.setName('Apilot')

// Set user data path for consistent storage location
// This ensures IndexedDB works properly
if (process.env.NODE_ENV !== 'production') {
  const path = require('path')
  const userDataPath = path.join(app.getPath('userData'), 'dev')
  app.setPath('userData', userDataPath)
  console.log('[Main] User data path:', userDataPath)
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // Set icon path based on platform and environment
  let iconPath
  if (process.platform === 'darwin') {
    // macOS uses .icns
    iconPath = process.env.NODE_ENV === 'production'
      ? path.join(process.resourcesPath, 'build', 'icon.icns')
      : path.join(__dirname, '..', 'build', 'icon.icns')
  } else if (process.platform === 'win32') {
    // Windows uses .ico
    iconPath = process.env.NODE_ENV === 'production'
      ? path.join(process.resourcesPath, 'build', 'icon.ico')
      : path.join(__dirname, '..', 'build', 'icon.ico')
  } else {
    // Linux uses .png
    iconPath = process.env.NODE_ENV === 'production'
      ? path.join(process.resourcesPath, 'build', 'icon.png')
      : path.join(__dirname, '..', 'build', 'icon.png')
  }

  console.log('[Main] Icon path:', iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allow loading preload in dev mode
      allowRunningInsecureContent: true, // Allow loading local content
      // Enable IndexedDB and localStorage
      enableWebSQL: false,
      // Use persistent storage partition
      partition: 'persist:apilot'
    },
    title: 'Apilot',
    titleBarStyle: 'default',
    show: false
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // Use app.getAppPath() to get the correct unpacked path
    const appPath = app.getAppPath().replace('app.asar', 'app.asar.unpacked')
    const htmlPath = path.join(appPath, 'dist/index.html')
    console.log('[Main] App path:', app.getAppPath())
    console.log('[Main] Loading HTML from:', htmlPath)
    mainWindow.loadFile(htmlPath).catch(err => {
      console.error('[Main] Failed to load HTML:', err)
    })
  }

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page finished loading')
  })

  // Log any errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Main] Page failed to load:', errorCode, errorDescription)
  })

  mainWindow.once('ready-to-show', () => {
    console.log('[Main] Window ready to show')
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(() => {
  // Ensure app name is set (for macOS menu bar and dock)
  app.setName('Apilot')

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers (will be expanded in later phases)

// File dialog for importing specs
ipcMain.handle('import-spec', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'API Specs', extensions: ['json', 'yaml', 'yml'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled) {
    return null
  }

  const fs = require('fs/promises')
  const filePath = result.filePaths[0]
  const content = await fs.readFile(filePath, 'utf-8')
  const fileName = path.basename(filePath)

  return {
    fileName,
    content
  }
})

// Get app version
ipcMain.handle('get-version', async () => {
  return app.getVersion()
})

// AI Operations - Test AI Connection
ipcMain.handle('test-ai-connection', async (_event, provider, config) => {
  try {
    console.log(`[Main] Testing ${provider} connection`)

    // Dynamically import AI SDK based on provider
    if (provider === 'openai') {
      const OpenAI = require('openai')
      const client = new OpenAI({ apiKey: config.apiKey })
      await client.models.list()
      return { success: true, message: 'OpenAI connection successful' }
    } else if (provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: config.apiKey })
      // Simple test - just instantiation is enough
      return { success: true, message: 'Anthropic connection successful' }
    } else if (provider === 'gemini') {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const client = new GoogleGenerativeAI(config.apiKey)
      const model = client.getGenerativeModel({ model: config.model || 'gemini-pro' })
      return { success: true, message: 'Gemini connection successful' }
    } else if (provider === 'ollama') {
      const { Ollama } = require('ollama')
      const client = new Ollama({ host: config.baseUrl || 'http://localhost:11434' })
      await client.list()
      return { success: true, message: 'Ollama connection successful' }
    }

    return { success: false, message: 'Unknown provider' }
  } catch (error) {
    console.error('[Main] AI connection test error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed'
    }
  }
})

// AI Operations - Generate Tests
ipcMain.handle('generate-tests', async (event, provider, config, options) => {
  try {
    console.log(`[Main] Generating tests with ${provider}`)
    console.log(`[Main] Config:`, { ...config, apiKey: config.apiKey?.substring(0, 10) + '...' })
    console.log(`[Main] Endpoints count:`, options.endpoints?.length)

    const { endpoints, spec, previousMessages, generatedTestsSummary } = options

    // Load AI service based on provider
    let result

    if (provider === 'openai') {
      // Use inline OpenAI generation with streaming (from generateTestsWithOpenAI below)
      const OpenAI = require('openai')
      const https = require('https')
      const http = require('http')

      const client = new OpenAI({
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: false,
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true })
      })

      result = await generateTestsWithOpenAI(client, config, {
        endpoints,
        spec,
        previousMessages,
        generatedTestsSummary,
        onProgress: (progress) => {
          event.sender.send('generate-tests-progress', progress)
        },
        onTestGenerated: (test) => {
          event.sender.send('generate-tests-test-generated', test)
        }
      })
    } else if (provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: config.apiKey })

      result = await generateTestsWithAnthropic(client, config, {
        endpoints,
        spec,
        previousMessages,
        generatedTestsSummary,
        onProgress: (progress) => {
          event.sender.send('generate-tests-progress', progress)
        },
        onTestGenerated: (test) => {
          event.sender.send('generate-tests-test-generated', test)
        }
      })
    } else if (provider === 'gemini') {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const client = new GoogleGenerativeAI(config.apiKey)

      result = await generateTestsWithGemini(client, config, {
        endpoints,
        spec,
        previousMessages,
        generatedTestsSummary,
        onProgress: (progress) => {
          event.sender.send('generate-tests-progress', progress)
        },
        onTestGenerated: (test) => {
          event.sender.send('generate-tests-test-generated', test)
        }
      })
    } else if (provider === 'ollama') {
      const { Ollama } = require('ollama')
      const client = new Ollama({ host: config.baseUrl || 'http://localhost:11434' })

      result = await generateTestsWithOllama(client, config, {
        endpoints,
        spec,
        previousMessages,
        generatedTestsSummary,
        onProgress: (progress) => {
          event.sender.send('generate-tests-progress', progress)
        },
        onTestGenerated: (test) => {
          event.sender.send('generate-tests-test-generated', test)
        }
      })
    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    return result
  } catch (error: any) {
    console.error('[Main] Generate tests error:', error)
    console.error('[Main] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined
    })

    // Provide user-friendly error messages
    if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      if (provider === 'ollama') {
        throw new Error('Cannot connect to Ollama. Please make sure Ollama is running on your machine. Start it with: ollama serve')
      } else {
        throw new Error(`Cannot connect to ${provider} API. Please check your network connection.`)
      }
    }

    if (error.status === 401 || error.message?.includes('401')) {
      throw new Error(`Invalid API key for ${provider}. Please check your API key in Settings.`)
    }

    if (error.status === 429 || error.message?.includes('429')) {
      throw new Error(`Rate limit exceeded for ${provider}. Please try again later or upgrade your plan.`)
    }

    if (error.status === 500 || error.status === 503 || error.message?.includes('server had an error')) {
      throw new Error(`${provider} API is experiencing issues. Please try again in a few moments. (Error: ${error.message})`)
    }

    if (error.message?.includes('fetch failed')) {
      if (provider === 'ollama') {
        throw new Error('Cannot connect to Ollama. Please make sure Ollama is running (ollama serve).')
      }
      throw new Error(`Network error: Cannot reach ${provider} API. Please check your internet connection.`)
    }

    // Re-throw with original message if no specific handling
    throw error
  }
})

// Helper function to generate tests with OpenAI
async function generateTestsWithOpenAI(client, config, options) {
  const { endpoints, spec, previousMessages, generatedTestsSummary, onProgress, onTestGenerated } = options

  // Build prompt (simplified version - you'll need the actual prompt from prompts.ts)
  const prompt = buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary)

  console.log('=== OpenAI Request Details ===')
  console.log('[OpenAI] Model:', config.model || 'gpt-4o-mini')
  console.log('[OpenAI] Temperature:', config.temperature || 0.7)
  console.log('[OpenAI] Max Tokens:', config.maxTokens || 4096)
  console.log('[OpenAI] Prompt length:', prompt.length, 'characters')
  console.log('[OpenAI] Prompt preview (first 500 chars):', prompt.substring(0, 500))

  const messages = previousMessages && previousMessages.length > 0
    ? [...previousMessages, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]

  // Use streaming for real-time test generation
  let stream
  try {
    stream = await client.chat.completions.create({
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: config.temperature || 0.7,
      max_completion_tokens: config.maxTokens || 4096,
      stream: true,
    })
  } catch (error) {
    console.error('[OpenAI] Stream creation error:', error)
    console.error('[OpenAI] Error details:', {
      status: error.status,
      message: error.message,
      type: error.type,
      code: error.code,
      body: error.error,
    })
    throw error
  }

  console.log('[OpenAI] Starting streaming response...')

  let fullResponse = ''
  let lastJsonBlockCount = 0
  const testCases = []
  const processedTestNames = new Set() // Track processed tests to avoid duplicates

  // Process stream chunks as they arrive
  try {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      fullResponse += content

    // Try to extract JSON blocks as they arrive
    const jsonBlocks = extractJsonBlocks(fullResponse)

    // If we have new complete JSON blocks, process them immediately
    if (jsonBlocks.length > lastJsonBlockCount) {
      console.log(`[OpenAI Stream] Found ${jsonBlocks.length - lastJsonBlockCount} new test(s)`)

      for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
        const block = jsonBlocks[i]

        // Skip if already processed (prevent duplicates)
        if (processedTestNames.has(block.name)) {
          console.log(`[OpenAI Stream] Skipping duplicate test: ${block.name}`)
          continue
        }

        console.log(`[OpenAI Stream] Processing test ${i + 1}:`, block.name)

        // Find matching endpoint
        let endpoint = endpoints.find(e =>
          e.method === block.method && e.path === block.path
        )

        if (!endpoint) {
          console.log(`[OpenAI Stream] No matching endpoint, using first endpoint as fallback`)
          endpoint = endpoints[0]
        }

        const test = mapResponseToTestCase(block, endpoint?.specId, endpoint?.id)
        testCases.push(test)
        processedTestNames.add(block.name)

        // Send test immediately via IPC for real-time display
        console.log(`[IPC Send] Streaming test ${i + 1} to renderer:`, test.name)
        onTestGenerated(test)

        onProgress({ current: testCases.length, total: endpoints.length })
      }

      lastJsonBlockCount = jsonBlocks.length
    }
  }
  } catch (streamError) {
    console.error('[OpenAI] Stream processing error:', streamError)
    console.error('[OpenAI] Stream error details:', {
      status: streamError.status,
      message: streamError.message,
      type: streamError.type,
      code: streamError.code,
      body: streamError.error,
    })
    throw streamError
  }

  console.log('=== OpenAI Response Details ===')
  console.log('[OpenAI] Response length:', fullResponse.length, 'characters')
  console.log('[OpenAI] Full Response:')
  console.log(fullResponse)
  console.log('=== End Response ===')
  console.log('[OpenAI] Extracted', testCases.length, 'test cases from response')

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [...messages, { role: 'assistant', content: fullResponse }],
    generatedTestsSummary: fullResponse.substring(0, 1000)
  }
}

// Similar helpers for other providers
async function generateTestsWithAnthropic(client, config, options) {
  const { endpoints, spec, previousMessages, generatedTestsSummary, onProgress, onTestGenerated } = options

  const prompt = buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary)

  const messages = previousMessages && previousMessages.length > 0
    ? [...previousMessages, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]

  console.log('[Anthropic] Starting streaming response...')

  // Use streaming for real-time test generation
  const stream = await client.messages.stream({
    model: config.model || 'claude-3-5-sonnet-20241022',
    max_tokens: config.maxTokens || 4096,
    temperature: config.temperature || 0.7,
    messages,
  })

  let fullResponse = ''
  let lastJsonBlockCount = 0
  const testCases = []
  const processedTestNames = new Set()

  // Process stream events as they arrive
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const content = event.delta.text
      fullResponse += content

      // Try to extract JSON blocks as they arrive
      const jsonBlocks = extractJsonBlocks(fullResponse)

      // If we have new complete JSON blocks, process them immediately
      if (jsonBlocks.length > lastJsonBlockCount) {
        console.log(`[Anthropic Stream] Found ${jsonBlocks.length - lastJsonBlockCount} new test(s)`)

        for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
          const block = jsonBlocks[i]

          // Skip duplicates
          if (processedTestNames.has(block.name)) {
            console.log(`[Anthropic Stream] Skipping duplicate test: ${block.name}`)
            continue
          }

          console.log(`[Anthropic Stream] Processing test ${i + 1}:`, block.name)

          // Find matching endpoint
          let endpoint = endpoints.find(e =>
            e.method === block.method && e.path === block.path
          )

          if (!endpoint) {
            console.log(`[Anthropic Stream] No matching endpoint, using first endpoint as fallback`)
            endpoint = endpoints[0]
          }

          const test = mapResponseToTestCase(block, endpoint?.specId, endpoint?.id)
          testCases.push(test)
          processedTestNames.add(block.name)

          // Send test immediately via IPC for real-time display
          console.log(`[IPC Send] Streaming test ${i + 1} to renderer:`, test.name)
          onTestGenerated(test)

          onProgress({ current: testCases.length, total: endpoints.length })
        }

        lastJsonBlockCount = jsonBlocks.length
      }
    }
  }

  console.log('[Anthropic] Response length:', fullResponse.length, 'characters')
  console.log('[Anthropic] Extracted', testCases.length, 'test cases from response')

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [...messages, { role: 'assistant', content: fullResponse }],
    generatedTestsSummary: fullResponse.substring(0, 1000)
  }
}

async function generateTestsWithGemini(client, config, options) {
  const { endpoints, spec, previousMessages, generatedTestsSummary, onProgress, onTestGenerated } = options

  const prompt = buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary)

  const model = client.getGenerativeModel({ model: config.model || 'gemini-2.0-flash-exp' })

  console.log('[Gemini] Starting streaming response...')

  // Use streaming for real-time test generation
  const result = await model.generateContentStream(prompt)

  let fullResponse = ''
  let lastJsonBlockCount = 0
  const testCases = []
  const processedTestNames = new Set()

  // Process stream chunks as they arrive
  for await (const chunk of result.stream) {
    const chunkText = chunk.text()
    fullResponse += chunkText

    // Try to extract JSON blocks as they arrive
    const jsonBlocks = extractJsonBlocks(fullResponse)

    // If we have new complete JSON blocks, process them immediately
    if (jsonBlocks.length > lastJsonBlockCount) {
      console.log(`[Gemini Stream] Found ${jsonBlocks.length - lastJsonBlockCount} new test(s)`)

      for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
        const block = jsonBlocks[i]

        // Skip duplicates
        if (processedTestNames.has(block.name)) {
          console.log(`[Gemini Stream] Skipping duplicate test: ${block.name}`)
          continue
        }

        console.log(`[Gemini Stream] Processing test ${i + 1}:`, block.name)

        // Find matching endpoint
        let endpoint = endpoints.find(e =>
          e.method === block.method && e.path === block.path
        )

        if (!endpoint) {
          console.log(`[Gemini Stream] No matching endpoint, using first endpoint as fallback`)
          endpoint = endpoints[0]
        }

        const test = mapResponseToTestCase(block, endpoint?.specId, endpoint?.id)
        testCases.push(test)
        processedTestNames.add(block.name)

        // Send test immediately via IPC for real-time display
        console.log(`[IPC Send] Streaming test ${i + 1} to renderer:`, test.name)
        onTestGenerated(test)

        onProgress({ current: testCases.length, total: endpoints.length })
      }

      lastJsonBlockCount = jsonBlocks.length
    }
  }

  console.log('[Gemini] Response length:', fullResponse.length, 'characters')
  console.log('[Gemini] Extracted', testCases.length, 'test cases from response')

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [{ role: 'user', content: prompt }, { role: 'assistant', content: fullResponse }],
    generatedTestsSummary: fullResponse.substring(0, 1000)
  }
}

async function generateTestsWithOllama(client, config, options) {
  const { endpoints, spec, previousMessages, generatedTestsSummary, onProgress, onTestGenerated } = options

  const prompt = buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary)

  console.log('[Ollama] Starting streaming response...')

  // Use streaming for real-time test generation
  const stream = await client.generate({
    model: config.model || 'llama3.1:8b',
    prompt,
    stream: true,
    options: {
      temperature: config.temperature || 0.7,
      num_predict: 4096,
    },
  })

  let fullResponse = ''
  let lastJsonBlockCount = 0
  const testCases = []
  const processedTestNames = new Set()

  // Process stream chunks as they arrive
  for await (const chunk of stream) {
    const content = chunk.response
    fullResponse += content

    // Try to extract JSON blocks as they arrive
    const jsonBlocks = extractJsonBlocks(fullResponse)

    // If we have new complete JSON blocks, process them immediately
    if (jsonBlocks.length > lastJsonBlockCount) {
      console.log(`[Ollama Stream] Found ${jsonBlocks.length - lastJsonBlockCount} new test(s)`)

      for (let i = lastJsonBlockCount; i < jsonBlocks.length; i++) {
        const block = jsonBlocks[i]

        // Skip duplicates
        if (processedTestNames.has(block.name)) {
          console.log(`[Ollama Stream] Skipping duplicate test: ${block.name}`)
          continue
        }

        console.log(`[Ollama Stream] Processing test ${i + 1}:`, block.name)

        // Find matching endpoint
        let endpoint = endpoints.find(e =>
          e.method === block.method && e.path === block.path
        )

        if (!endpoint) {
          console.log(`[Ollama Stream] No matching endpoint, using first endpoint as fallback`)
          endpoint = endpoints[0]
        }

        const test = mapResponseToTestCase(block, endpoint?.specId, endpoint?.id)
        testCases.push(test)
        processedTestNames.add(block.name)

        // Send test immediately via IPC for real-time display
        console.log(`[IPC Send] Streaming test ${i + 1} to renderer:`, test.name)
        onTestGenerated(test)

        onProgress({ current: testCases.length, total: endpoints.length })
      }

      lastJsonBlockCount = jsonBlocks.length
    }
  }

  console.log('[Ollama] Response length:', fullResponse.length, 'characters')
  console.log('[Ollama] Extracted', testCases.length, 'test cases from response')

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [{ role: 'user', content: prompt }, { role: 'assistant', content: fullResponse }],
    generatedTestsSummary: fullResponse.substring(0, 1000)
  }
}

// Helper functions
function buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary) {
  // Format endpoints for AI (canonical format - already ready!)
  const endpointsJson = JSON.stringify(endpoints.map(e => ({
    method: e.method,
    path: e.path,
    name: e.name,
    description: e.description,
    tags: e.tags,
    request: e.request,
    responses: e.responses,
    auth: e.auth,
  })), null, 2)

  const specJson = JSON.stringify({
    openapi: spec.openapi || spec.swagger,
    info: spec.info,
    servers: spec.servers,
  }, null, 2)

  // Use the detailed prompt template (same as src/lib/ai/prompts.ts TEST_GENERATION_PROMPT)
  let prompt = `You are an expert API testing engineer. Given the enhanced endpoint specifications, generate complete, executable test cases.

Enhanced Endpoints:
${endpointsJson}

API Specification:
${specJson}

Some sample created tests related to enhanced endpoints:
${endpointsJson}

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

  if (generatedTestsSummary) {
    prompt += `\n\nPreviously generated tests:\n${generatedTestsSummary}\n\nContinue generating tests for the remaining endpoints. DO NOT regenerate tests that were already created.`
  }

  return prompt
}

function extractJsonBlocks(text) {
  const jsonBlocks = []
  const regex = /```json\s*([\s\S]*?)```/g
  let match
  let blockIndex = 0

  while ((match = regex.exec(text)) !== null) {
    blockIndex++
    try {
      const jsonString = match[1].trim()
      console.log(`[JSON Parser] Parsing block ${blockIndex}, length: ${jsonString.length} chars`)
      console.log(`[JSON Parser] Block ${blockIndex} content:`, jsonString.substring(0, 200) + '...')
      const json = JSON.parse(jsonString)
      console.log(`[JSON Parser] ✅ Block ${blockIndex} parsed successfully:`, {
        name: json.name,
        test_type: json.test_type,
        method: json.method,
        path: json.path
      })
      jsonBlocks.push(json)
    } catch (error) {
      console.error(`[JSON Parser] ❌ Failed to parse block ${blockIndex}:`, error.message)
      console.error(`[JSON Parser] Problematic JSON:`, match[1].trim().substring(0, 500))
    }
  }

  console.log(`[JSON Parser] Total: Found ${blockIndex} JSON blocks, successfully parsed ${jsonBlocks.length}`)
  return jsonBlocks
}

function mapResponseToTestCase(response, specId, endpointId) {
  const steps = response.steps?.map((step) => ({
    ...step,
    id: step.id || crypto.randomUUID(),
    isCustomEndpoint: false,
    assertions: (step.assertions || []).map((assertion) => ({
      ...assertion,
      id: assertion.id || crypto.randomUUID(),
    })),
  }))

  const assertions = (response.assertions || []).map((assertion) => ({
    ...assertion,
    id: assertion.id || crypto.randomUUID(),
  }))

  return {
    specId,
    sourceEndpointId: endpointId,
    currentEndpointId: endpointId,
    isCustomEndpoint: false,
    name: response.name || 'Untitled Test',
    description: response.description || '',
    method: response.method || response.endpoint_method || 'GET',
    path: response.path || response.endpoint_path || '/',
    pathVariables: response.pathVariables || {},
    queryParams: response.queryParams || {},
    headers: response.headers || { 'Content-Type': 'application/json' },
    body: response.body,
    assertions,
    testType: response.test_type || 'single',
    steps,
    category: response.category || 'API Tests',
    priority: response.priority || 'medium',
    tags: response.tags || [],
    lastResult: 'pending',
    executionCount: 0,
    createdBy: 'ai',
  }
}
