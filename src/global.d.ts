// Global type definitions for Electron API

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
