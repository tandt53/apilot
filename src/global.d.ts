// Global type definitions for Electron API

interface Window {
  electron: {
    importSpec: () => Promise<{ fileName: string; content: string } | null>
    testAIConnection: (provider: string, config: any) => Promise<any>
    executeTest: (testCase: any) => Promise<any>
    platform: string
    getVersion: () => Promise<string>
  }
}
