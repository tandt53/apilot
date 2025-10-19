const { contextBridge, ipcRenderer } = require('electron')

// Make this file a module to allow global augmentation
export {}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // File operations
  importSpec: () => ipcRenderer.invoke('import-spec'),

  // AI operations
  testAIConnection: (provider: string, config: any) =>
    ipcRenderer.invoke('test-ai-connection', provider, config),

  generateTests: (provider: string, config: any, options: any) =>
    ipcRenderer.invoke('generate-tests', provider, config, options),

  // Event listeners for test generation progress
  onGenerateTestsProgress: (callback: (progress: any) => void) => {
    console.log('[Preload] Setting up generate-tests-progress listener')
    ipcRenderer.on('generate-tests-progress', (_event, progress) => {
      console.log('[Preload] Received progress event:', progress)
      callback(progress)
    })
  },

  onGenerateTestsTestGenerated: (callback: (test: any) => void) => {
    console.log('[Preload] Setting up generate-tests-test-generated listener')
    ipcRenderer.on('generate-tests-test-generated', (_event, test) => {
      console.log('[Preload] Received test event:', { name: test.name, method: test.method })
      callback(test)
    })
  },

  removeGenerateTestsListeners: () => {
    ipcRenderer.removeAllListeners('generate-tests-progress')
    ipcRenderer.removeAllListeners('generate-tests-test-generated')
  },

  cancelGeneration: () => ipcRenderer.invoke('cancel-generation'),

  // Test operations
  executeTest: (testCase: any) =>
    ipcRenderer.invoke('execute-test', testCase),

  // Platform info
  platform: process.platform,

  // App info
  getVersion: () => ipcRenderer.invoke('get-version')
})

// Type declaration for TypeScript
declare global {
  interface Window {
    electron: {
      importSpec: () => Promise<{ fileName: string; content: string } | null>
      testAIConnection: (provider: string, config: any) => Promise<any>
      generateTests: (provider: string, config: any, options: any) => Promise<any>
      onGenerateTestsProgress: (callback: (progress: any) => void) => void
      onGenerateTestsTestGenerated: (callback: (test: any) => void) => void
      removeGenerateTestsListeners: () => void
      cancelGeneration: () => Promise<{ success: boolean; message: string }>
      executeTest: (testCase: any) => Promise<any>
      platform: string
      getVersion: () => Promise<string>
    }
  }
}
