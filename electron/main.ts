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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
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
    // Open DevTools in production to see errors
    mainWindow.webContents.openDevTools()
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
      const OpenAI = require('openai')
      const https = require('https')
      const http = require('http')

      // Create client with http agents
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

  const messages = previousMessages && previousMessages.length > 0
    ? [...previousMessages, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages,
    temperature: config.temperature || 0.7,
    max_tokens: config.maxTokens || 4096,
  })

  const content = response.choices[0]?.message?.content || ''
  const tests = extractJsonBlocks(content)

  // Notify about each test
  const testCases = []
  for (let i = 0; i < tests.length; i++) {
    const test = mapResponseToTestCase(tests[i], endpoints[0]?.specId, endpoints[0]?.id)
    testCases.push(test)
    onTestGenerated(test)
    onProgress({ current: i + 1, total: endpoints.length })
  }

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [...messages, { role: 'assistant', content }],
    generatedTestsSummary: content.substring(0, 1000)
  }
}

// Similar helpers for other providers (simplified for now)
async function generateTestsWithAnthropic(client, config, options) {
  const { endpoints, spec, previousMessages, generatedTestsSummary, onProgress, onTestGenerated } = options

  const prompt = buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary)

  const messages = previousMessages && previousMessages.length > 0
    ? [...previousMessages, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]

  const response = await client.messages.create({
    model: config.model || 'claude-3-5-sonnet-20241022',
    max_tokens: config.maxTokens || 4096,
    messages,
  })

  const content = response.content[0]?.text || ''
  const tests = extractJsonBlocks(content)

  const testCases = []
  for (let i = 0; i < tests.length; i++) {
    const test = mapResponseToTestCase(tests[i], endpoints[0]?.specId, endpoints[0]?.id)
    testCases.push(test)
    onTestGenerated(test)
    onProgress({ current: i + 1, total: endpoints.length })
  }

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [...messages, { role: 'assistant', content }],
    generatedTestsSummary: content.substring(0, 1000)
  }
}

async function generateTestsWithGemini(client, config, options) {
  const { endpoints, spec, previousMessages, generatedTestsSummary, onProgress, onTestGenerated } = options

  const prompt = buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary)

  const model = client.getGenerativeModel({ model: config.model || 'gemini-2.0-flash-exp' })
  const result = await model.generateContent(prompt)
  const content = result.response.text()

  const tests = extractJsonBlocks(content)

  const testCases = []
  for (let i = 0; i < tests.length; i++) {
    const test = mapResponseToTestCase(tests[i], endpoints[0]?.specId, endpoints[0]?.id)
    testCases.push(test)
    onTestGenerated(test)
    onProgress({ current: i + 1, total: endpoints.length })
  }

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [{ role: 'user', content: prompt }, { role: 'assistant', content }],
    generatedTestsSummary: content.substring(0, 1000)
  }
}

async function generateTestsWithOllama(client, config, options) {
  const { endpoints, spec, previousMessages, generatedTestsSummary, onProgress, onTestGenerated } = options

  const prompt = buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary)

  const response = await client.chat({
    model: config.model || 'llama3.1:8b',
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.message.content
  const tests = extractJsonBlocks(content)

  const testCases = []
  for (let i = 0; i < tests.length; i++) {
    const test = mapResponseToTestCase(tests[i], endpoints[0]?.specId, endpoints[0]?.id)
    testCases.push(test)
    onTestGenerated(test)
    onProgress({ current: i + 1, total: endpoints.length })
  }

  return {
    tests: testCases,
    completed: true,
    completedEndpointIds: endpoints.map(e => e.id),
    remainingEndpointIds: [],
    conversationMessages: [{ role: 'user', content: prompt }, { role: 'assistant', content }],
    generatedTestsSummary: content.substring(0, 1000)
  }
}

// Helper functions
function buildTestGenerationPrompt(endpoints, spec, previousMessages, generatedTestsSummary) {
  // This is a simplified version - you'll need the actual prompt template
  const endpointsJson = JSON.stringify(endpoints.map(e => ({
    method: e.method,
    path: e.path,
    name: e.name,
    description: e.description,
    request: e.request,
    responses: e.responses,
  })), null, 2)

  const specJson = JSON.stringify({
    openapi: spec.openapi || spec.swagger,
    info: spec.info,
    servers: spec.servers,
  }, null, 2)

  let prompt = `You are an expert API testing engineer. Generate comprehensive test cases for the following endpoints.\n\n`
  prompt += `Endpoints:\n${endpointsJson}\n\n`
  prompt += `API Specification:\n${specJson}\n\n`

  if (generatedTestsSummary) {
    prompt += `\nPreviously generated tests:\n${generatedTestsSummary}\n\n`
    prompt += `Continue generating tests for the remaining endpoints. DO NOT regenerate tests that were already created.\n\n`
  }

  prompt += `Output EACH test case in a separate \`\`\`json code block. Format:\n\`\`\`json\n{...}\n\`\`\`\n\n`

  return prompt
}

function extractJsonBlocks(text) {
  const jsonBlocks = []
  const regex = /```json\s*([\s\S]*?)```/g
  let match

  while ((match = regex.exec(text)) !== null) {
    try {
      const jsonString = match[1].trim()
      const json = JSON.parse(jsonString)
      jsonBlocks.push(json)
    } catch (error) {
      console.error('Failed to parse JSON block:', error)
    }
  }

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
