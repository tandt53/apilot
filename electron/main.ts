import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'
import FormData from 'form-data'

// Import AI services
import { OpenAIService } from './ai/openai'
import { AnthropicService } from './ai/anthropic'
import { GeminiService } from './ai/gemini'
import { OllamaService } from './ai/ollama'

// Disable security warnings in development
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// Set app name for macOS menu bar and dock
app.setName('Apilot')

// Set user data path for consistent storage location
// This ensures IndexedDB works properly
if (process.env.NODE_ENV !== 'production') {
  const userDataPath = path.join(app.getPath('userData'), 'dev')
  app.setPath('userData', userDataPath)
  console.log('[Main] User data path:', userDataPath)
}

let mainWindow: BrowserWindow | null = null

// Abort controller for cancelling ongoing test generation
let currentGenerationAbortController: AbortController | null = null

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

    // Use AI service classes for connection testing
    let service

    if (provider === 'openai') {
      service = new OpenAIService(config)
    } else if (provider === 'anthropic') {
      service = new AnthropicService(config)
    } else if (provider === 'gemini') {
      service = new GeminiService(config)
    } else if (provider === 'ollama') {
      service = new OllamaService(config)
    } else {
      return { success: false, message: 'Unknown provider' }
    }

    // Test connection using service's built-in test method
    const result = await service.testConnection()
    return result
  } catch (error: any) {
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
    console.log(`[Main] Reference endpoints count:`, options.referenceEndpoints?.length || 0)
    console.log(`[Main] Custom requirements:`, options.customRequirements ? 'Yes' : 'No')

    const { endpoints, spec, previousMetadata, referenceEndpoints, customRequirements } = options

    if (previousMetadata) {
      console.log('[Main] 📥 RECEIVED previousMetadata:', {
        completeParsedTests: previousMetadata.completeParsedTests?.length || 0,
        tests: previousMetadata.completeParsedTests?.map((t: any) => t.name) || []
      })
    }

    // Create abort controller for this generation session
    currentGenerationAbortController = new AbortController()
    console.log('[Main] Created new abort controller for generation')

    // Create AI service instance based on provider
    let service

    if (provider === 'openai') {
      service = new OpenAIService(config)
    } else if (provider === 'anthropic') {
      service = new AnthropicService(config)
    } else if (provider === 'gemini') {
      service = new GeminiService(config)
    } else if (provider === 'ollama') {
      service = new OllamaService(config)
    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    // Generate tests using the service with abort signal
    const result = await service.generateTests({
      endpoints,
      spec,
      previousMetadata,
      referenceEndpoints,
      customRequirements,
      signal: currentGenerationAbortController.signal,
      onProgress: (progress) => {
        event.sender.send('generate-tests-progress', progress)
      },
      onTestGenerated: (test) => {
        event.sender.send('generate-tests-test-generated', test)
      }
    })

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
  } finally {
    // Clean up abort controller
    currentGenerationAbortController = null
    console.log('[Main] Cleaned up abort controller')
  }
})

// Cancel ongoing test generation
ipcMain.handle('cancel-generation', async () => {
  console.log('[Main] Cancellation requested')
  if (currentGenerationAbortController) {
    console.log('[Main] Aborting ongoing generation...')
    currentGenerationAbortController.abort()
    currentGenerationAbortController = null
    return { success: true, message: 'Generation cancelled' }
  } else {
    console.log('[Main] No ongoing generation to cancel')
    return { success: false, message: 'No ongoing generation' }
  }
})

// Execute HTTP test request
ipcMain.handle('execute-test', async (_event, testRequest) => {
  const startTime = Date.now()

  try {
    console.log('[Main] Executing test request:', {
      method: testRequest.method,
      url: testRequest.url,
      hasFormData: !!testRequest.formData,
      hasBody: !!testRequest.body
    })

    const { url, method, headers, formData, body } = testRequest

    // Build axios config
    const config: any = {
      method: method.toLowerCase(),
      url,
      headers: headers || {},
      validateStatus: () => true, // Accept all status codes
      // Disable SSL verification for development/testing
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    }

    // Handle request body
    if (formData && Object.keys(formData).length > 0) {
      // Handle multipart/form-data with file uploads
      const form = new FormData()

      for (const [key, value] of Object.entries(formData)) {
        if (value && typeof value === 'string' && value.startsWith('/')) {
          // This looks like a file path, try to read the file
          try {
            const fileBuffer = await fs.readFile(value)
            const fileName = path.basename(value)
            form.append(key, fileBuffer, fileName)
            console.log('[Main] Added file to form:', { key, fileName })
          } catch (error) {
            console.error('[Main] Failed to read file:', value, error)
            // If file read fails, append as string value
            form.append(key, value as string)
          }
        } else if (value !== null && value !== undefined) {
          // Regular form field
          form.append(key, value as string)
        }
      }

      config.data = form
      // Let form-data set the correct Content-Type with boundary
      config.headers = {
        ...config.headers,
        ...form.getHeaders()
      }
    } else if (body) {
      // Handle JSON or other body types
      if (typeof body === 'string') {
        config.data = body
      } else {
        config.data = body
      }
    }

    // Execute request
    const response = await axios(config)
    const responseTime = Date.now() - startTime

    console.log('[Main] Test request completed:', {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`
    })

    // Return response in format expected by RequestTester
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      responseTime
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    console.error('[Main] Test request error:', error.message)

    // If error has response (HTTP error), return it
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
        responseTime
      }
    }

    // Network or other error - provide user-friendly message
    let errorMessage = error.message || 'Request failed'

    // DNS resolution errors
    if (error.code === 'ENOTFOUND' || errorMessage.includes('getaddrinfo ENOTFOUND')) {
      const hostname = error.hostname || testRequest.url.replace(/^https?:\/\/([^/]+).*/, '$1')
      errorMessage = `DNS Resolution Failed: Cannot resolve hostname "${hostname}"\n\nThe domain does not exist or cannot be found.\n\nSuggestions:\n• Check if the URL is correct\n• Use a real API endpoint instead of example URLs\n• Configure an environment with the correct base URL`
    }
    // Connection refused errors
    else if (error.code === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = `Connection Refused: Cannot connect to the server\n\nThe server is not accepting connections.\n\nSuggestions:\n• Check if the server is running\n• Verify the port number is correct\n• Check firewall settings`
    }
    // Timeout errors
    else if (error.code === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
      errorMessage = `Request Timeout: The server took too long to respond\n\nSuggestions:\n• Check your internet connection\n• The server might be slow or overloaded\n• Try increasing the request timeout`
    }
    // Certificate errors
    else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
      errorMessage = `SSL Certificate Error: ${error.message}\n\nNote: Self-signed certificates are already allowed in this application.`
    }

    throw new Error(errorMessage)
  }
})
