const { contextBridge, ipcRenderer } = require('electron')

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
    ipcRenderer.on('generate-tests-progress', (_event, progress) => callback(progress))
  },

  onGenerateTestsTestGenerated: (callback: (test: any) => void) => {
    ipcRenderer.on('generate-tests-test-generated', (_event, test) => callback(test))
  },

  removeGenerateTestsListeners: () => {
    ipcRenderer.removeAllListeners('generate-tests-progress')
    ipcRenderer.removeAllListeners('generate-tests-test-generated')
  },

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
      executeTest: (testCase: any) => Promise<any>
      platform: string
      getVersion: () => Promise<string>
    }
  }
}
