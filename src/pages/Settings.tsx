import {useEffect, useRef, useState} from 'react'
import {useSettings, useUpdateSettings} from '@/lib/hooks'
import {testAIConnection} from '@/lib/ai'
import {Check, CheckCircle2, Cpu, X, AlertCircle, Info, Zap} from 'lucide-react'
import ResizablePanel from '@/components/ResizablePanel'
import PageLayout from '@/components/PageLayout'

export default function Settings() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic' | 'gemini' | 'ollama'>('openai')
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, any>>({}) // Store results per provider
  const hasMigrated = useRef(false)

  // Form states
  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')
  const [openaiTemperature, setOpenaiTemperature] = useState(0.3)
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState(16000)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [anthropicModel, setAnthropicModel] = useState('claude-3-5-sonnet-20241022')
  const [anthropicTemperature, setAnthropicTemperature] = useState(0.7)
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(4096)
  const [geminiKey, setGeminiKey] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash-exp')
  const [geminiTemperature, setGeminiTemperature] = useState(0.7)
  const [geminiMaxTokens, setGeminiMaxTokens] = useState(8192)
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.1:8b')
  const [ollamaTemperature, setOllamaTemperature] = useState(0.7)
  const [ollamaMaxTokens, setOllamaMaxTokens] = useState(4096)

  // Load settings from database when component mounts
  useEffect(() => {
    if (settings) {
      // One-time migration: Switch from ollama to openai if no keys are configured
      // This helps users who have the old default (ollama) but haven't configured it
      if (!hasMigrated.current && settings.aiProvider === 'ollama' && !settings.aiSettings.openai?.apiKey) {
        // Auto-switch to OpenAI as default
        hasMigrated.current = true
        updateSettings.mutate({ aiProvider: 'openai' })
        setSelectedProvider('openai')
      } else {
        // Set active provider from settings
        setSelectedProvider(settings.aiProvider)
      }

      // Load provider-specific settings
      if (settings.aiSettings.openai) {
        setOpenaiModel(settings.aiSettings.openai.model)
        setOpenaiTemperature(settings.aiSettings.openai.temperature ?? 0.3)
        setOpenaiMaxTokens(settings.aiSettings.openai.maxTokens ?? 16000)
        // Show masked API key if it exists
        if (settings.aiSettings.openai.apiKey) {
          setOpenaiKey('••••••••••••••••')
        }
      }

      if (settings.aiSettings.anthropic) {
        setAnthropicModel(settings.aiSettings.anthropic.model)
        setAnthropicTemperature(settings.aiSettings.anthropic.temperature ?? 0.7)
        setAnthropicMaxTokens(settings.aiSettings.anthropic.maxTokens ?? 4096)
        if (settings.aiSettings.anthropic.apiKey) {
          setAnthropicKey('••••••••••••••••')
        }
      }

      if (settings.aiSettings.gemini) {
        setGeminiModel(settings.aiSettings.gemini.model)
        setGeminiTemperature(settings.aiSettings.gemini.temperature ?? 0.7)
        setGeminiMaxTokens(settings.aiSettings.gemini.maxTokens ?? 8192)
        if (settings.aiSettings.gemini.apiKey) {
          setGeminiKey('••••••••••••••••')
        }
      }

      if (settings.aiSettings.ollama) {
        setOllamaUrl(settings.aiSettings.ollama.baseUrl)
        setOllamaModel(settings.aiSettings.ollama.model)
        setOllamaTemperature(settings.aiSettings.ollama.temperature ?? 0.7)
        setOllamaMaxTokens(settings.aiSettings.ollama.maxTokens ?? 4096)
      }
    }
  }, [settings])

  const handleTestConnection = async () => {
    setTesting(true)
    // Clear only the current provider's result
    setTestResults((prev) => ({ ...prev, [selectedProvider]: null }))

    try {
      let config: any = {}
      const maskedValue = '••••••••••••••••'

      switch (selectedProvider) {
        case 'openai': {
          // Use form key if provided and not masked, otherwise load from database
          let apiKey = openaiKey
          if (!apiKey || apiKey === maskedValue) {
            const { getDecryptedAPIKey } = await import('@/lib/api/settings')
            apiKey = await getDecryptedAPIKey('openai') || ''
          }

          if (!apiKey || apiKey === maskedValue) {
            setTestResults((prev) => ({ ...prev, [selectedProvider]: { success: false, message: 'Please enter your API key or save it first' } }))
            setTesting(false)
            return
          }

          config = { apiKey, model: openaiModel }
          break
        }
        case 'anthropic': {
          let apiKey = anthropicKey
          if (!apiKey || apiKey === maskedValue) {
            const { getDecryptedAPIKey } = await import('@/lib/api/settings')
            apiKey = await getDecryptedAPIKey('anthropic') || ''
          }

          if (!apiKey || apiKey === maskedValue) {
            setTestResults((prev) => ({ ...prev, [selectedProvider]: { success: false, message: 'Please enter your API key or save it first' } }))
            setTesting(false)
            return
          }

          config = { apiKey, model: anthropicModel }
          break
        }
        case 'gemini': {
          let apiKey = geminiKey
          if (!apiKey || apiKey === maskedValue) {
            const { getDecryptedAPIKey } = await import('@/lib/api/settings')
            apiKey = await getDecryptedAPIKey('gemini') || ''
          }

          if (!apiKey || apiKey === maskedValue) {
            setTestResults((prev) => ({ ...prev, [selectedProvider]: { success: false, message: 'Please enter your API key or save it first' } }))
            setTesting(false)
            return
          }

          config = { apiKey, model: geminiModel }
          break
        }
        case 'ollama':
          config = { baseUrl: ollamaUrl, model: ollamaModel }
          break
      }

      const result = await testAIConnection(selectedProvider, config)
      setTestResults((prev) => ({ ...prev, [selectedProvider]: result }))
    } catch (error: any) {
      setTestResults((prev) => ({ ...prev, [selectedProvider]: { success: false, message: error.message } }))
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      const aiSettings: any = {}
      const maskedValue = '••••••••••••••••'

      // Only save OpenAI key if it's not the masked placeholder
      if (openaiKey && openaiKey !== maskedValue) {
        const { encryptData } = await import('@/utils/crypto')
        aiSettings.openai = {
          apiKey: await encryptData(openaiKey),
          model: openaiModel,
          temperature: openaiTemperature,
          maxTokens: openaiMaxTokens
        }
      } else if (settings?.aiSettings.openai) {
        // Keep existing settings if key wasn't changed
        aiSettings.openai = {
          ...settings.aiSettings.openai,
          model: openaiModel,
          temperature: openaiTemperature,
          maxTokens: openaiMaxTokens
        }
      }

      // Only save Anthropic key if it's not the masked placeholder
      if (anthropicKey && anthropicKey !== maskedValue) {
        const { encryptData } = await import('@/utils/crypto')
        aiSettings.anthropic = {
          apiKey: await encryptData(anthropicKey),
          model: anthropicModel,
          temperature: anthropicTemperature,
          maxTokens: anthropicMaxTokens
        }
      } else if (settings?.aiSettings.anthropic) {
        // Keep existing settings if key wasn't changed
        aiSettings.anthropic = {
          ...settings.aiSettings.anthropic,
          model: anthropicModel,
          temperature: anthropicTemperature,
          maxTokens: anthropicMaxTokens
        }
      }

      // Only save Gemini key if it's not the masked placeholder
      if (geminiKey && geminiKey !== maskedValue) {
        const { encryptData } = await import('@/utils/crypto')
        aiSettings.gemini = {
          apiKey: await encryptData(geminiKey),
          model: geminiModel,
          temperature: geminiTemperature,
          maxTokens: geminiMaxTokens
        }
      } else if (settings?.aiSettings.gemini) {
        // Keep existing settings if key wasn't changed
        aiSettings.gemini = {
          ...settings.aiSettings.gemini,
          model: geminiModel,
          temperature: geminiTemperature,
          maxTokens: geminiMaxTokens
        }
      }

      aiSettings.ollama = {
        baseUrl: ollamaUrl,
        model: ollamaModel,
        temperature: ollamaTemperature,
        maxTokens: ollamaMaxTokens
      }

      await updateSettings.mutateAsync({
        aiProvider: selectedProvider,
        aiSettings
      })

      alert('Settings saved successfully!')
    } catch (error: any) {
      alert(`Failed to save settings: ${error.message}`)
    }
  }

  const providers = [
    { id: 'openai', name: 'OpenAI', desc: 'GPT-4o', enabled: true },
    { id: 'anthropic', name: 'Anthropic', desc: 'Claude 3.5 Sonnet', enabled: true },
    { id: 'gemini', name: 'Gemini', desc: 'Gemini 2.0 Flash', enabled: true },
    { id: 'ollama', name: 'Custom', desc: 'Ollama, LM Studio, etc.', enabled: true },
  ]

  // Get test result for currently selected provider
  const testResult = testResults[selectedProvider]

  return (
    <PageLayout>
        {/* Left Panel: Provider List */}
        <ResizablePanel defaultWidth={320} minWidth={300} maxWidth={400} className="">
          <div className="p-4 pb-24 space-y-2">
            {providers.map(provider => {
              const isDefault = settings?.aiProvider === provider.id
              const isSelected = selectedProvider === provider.id

              return (
                <div key={provider.id} className="relative">
                  <button
                    onClick={() => provider.enabled && setSelectedProvider(provider.id as any)}
                    disabled={!provider.enabled}
                    className={`w-full p-4 rounded-2xl text-left transition-all ${
                      !provider.enabled
                        ? 'opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-white/60 shadow-md backdrop-blur-sm'
                        : 'hover:bg-white/40 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Cpu size={20} className={isSelected ? 'text-purple-600' : 'text-gray-600'} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900">{provider.name}</div>
                          {!provider.enabled && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                              Coming Soon
                            </span>
                          )}
                          {isDefault && provider.enabled && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">{provider.desc}</div>
                      </div>
                      {isDefault && provider.enabled && (
                        <CheckCircle2 size={18} className="text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </ResizablePanel>

        {/* Right Panel: Provider Configuration */}
        <div className="flex-1 overflow-y-auto glass-card rounded-3xl">
          <div className="p-6 pb-20">
            <h2 className="text-lg font-semibold mb-4">
              {providers.find(p => p.id === selectedProvider)?.name} Configuration
            </h2>

        {/* Provider Configuration Forms */}
        {selectedProvider === 'openai' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-... (leave empty to keep existing)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {openaiKey === '••••••••••••••••' ? 'API key is saved (masked for security)' : 'Leave empty to keep your existing API key'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Examples: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <input
                type="number"
                value={openaiTemperature}
                onChange={(e) => setOpenaiTemperature(parseFloat(e.target.value))}
                min="0"
                max="2"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Controls randomness (0.0 = deterministic, 2.0 = very creative). Default: 0.3</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
              <input
                type="number"
                value={openaiMaxTokens}
                onChange={(e) => setOpenaiMaxTokens(parseInt(e.target.value))}
                min="1"
                max="128000"
                step="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum tokens for response (higher = longer responses). Default: 16000</p>
            </div>
          </div>
        )}

        {selectedProvider === 'anthropic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-... (leave empty to keep existing)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {anthropicKey === '••••••••••••••••' ? 'API key is saved (masked for security)' : 'Leave empty to keep your existing API key'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={anthropicModel}
                onChange={(e) => setAnthropicModel(e.target.value)}
                placeholder="claude-3-5-sonnet-20241022"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Examples: claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <input
                type="number"
                value={anthropicTemperature}
                onChange={(e) => setAnthropicTemperature(parseFloat(e.target.value))}
                min="0"
                max="1"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Controls randomness (0.0 = deterministic, 1.0 = very creative). Default: 0.7</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
              <input
                type="number"
                value={anthropicMaxTokens}
                onChange={(e) => setAnthropicMaxTokens(parseInt(e.target.value))}
                min="1"
                max="200000"
                step="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum tokens for response. Default: 4096</p>
            </div>
          </div>
        )}

        {selectedProvider === 'gemini' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AI... (leave empty to keep existing)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {geminiKey === '••••••••••••••••' ? 'API key is saved (masked for security)' : 'Leave empty to keep your existing API key'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                placeholder="gemini-2.0-flash-exp"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Examples: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <input
                type="number"
                value={geminiTemperature}
                onChange={(e) => setGeminiTemperature(parseFloat(e.target.value))}
                min="0"
                max="2"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Controls randomness (0.0 = deterministic, 2.0 = very creative). Default: 0.7</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
              <input
                type="number"
                value={geminiMaxTokens}
                onChange={(e) => setGeminiMaxTokens(parseInt(e.target.value))}
                min="1"
                max="1000000"
                step="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum tokens for response. Default: 8192</p>
            </div>
          </div>
        )}

        {selectedProvider === 'ollama' && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Custom Provider:</strong> Configure any OpenAI-compatible API endpoint (Ollama, LM Studio, LocalAI, etc.)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Examples: http://localhost:11434 (Ollama), http://localhost:1234/v1 (LM Studio)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="llama3.1:8b"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the exact model name as configured in your local provider</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <input
                type="number"
                value={ollamaTemperature}
                onChange={(e) => setOllamaTemperature(parseFloat(e.target.value))}
                min="0"
                max="2"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Controls randomness (0.0 = deterministic, 2.0 = very creative). Default: 0.7</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
              <input
                type="number"
                value={ollamaMaxTokens}
                onChange={(e) => setOllamaMaxTokens(parseInt(e.target.value))}
                min="512"
                max="32768"
                step="512"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum tokens to generate (depends on model's context window). Default: 4096</p>
            </div>
          </div>
        )}

            {/* Test Connection Button */}
            <div className="mt-6">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50 shadow-lg transition-all"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              {/* Test Result Display */}
              {testResult && (
                <div className={`mt-4 p-4 rounded-xl border-2 ${
                  testResult.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  {/* Success message */}
                  {testResult.success && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Check size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-green-900">{testResult.message}</p>
                          {testResult.latency && (
                            <p className="text-xs text-green-700 mt-1">Response time: {testResult.latency}ms</p>
                          )}
                        </div>
                      </div>

                      {/* Model Capability Results */}
                      {(testResult as any).capabilityTest && (
                        <div className={`p-3 rounded-lg border-2 ${
                          (testResult as any).capabilityTest.capable
                            ? 'bg-green-50 border-green-300'
                            : (testResult as any).capabilityTest.score >= 50
                              ? 'bg-yellow-50 border-yellow-300'
                              : 'bg-orange-50 border-orange-300'
                        }`}>
                          <div className="flex items-start gap-3 mb-2">
                            {(testResult as any).capabilityTest.capable ? (
                              <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle size={16} className={`flex-shrink-0 mt-0.5 ${
                                (testResult as any).capabilityTest.score >= 50 ? 'text-yellow-600' : 'text-orange-600'
                              }`} />
                            )}
                            <div className="flex-1">
                              <p className={`text-xs font-semibold ${
                                (testResult as any).capabilityTest.capable
                                  ? 'text-green-900'
                                  : (testResult as any).capabilityTest.score >= 50
                                    ? 'text-yellow-900'
                                    : 'text-orange-900'
                              }`}>
                                Model Capability: {(testResult as any).capabilityTest.score}/100
                              </p>
                              <p className={`text-xs mt-1 ${
                                (testResult as any).capabilityTest.capable
                                  ? 'text-green-700'
                                  : (testResult as any).capabilityTest.score >= 50
                                    ? 'text-yellow-700'
                                    : 'text-orange-700'
                              }`}>
                                {(testResult as any).capabilityTest.recommendation}
                              </p>
                            </div>
                          </div>

                          {/* Issues */}
                          {(testResult as any).capabilityTest.issues.length > 0 && (
                            <div className="mt-2 pl-2 border-l-2 border-orange-400">
                              <p className="text-xs font-medium text-orange-900 mb-1">Critical issues:</p>
                              <ul className="text-xs text-orange-800 space-y-0.5">
                                {(testResult as any).capabilityTest.issues.map((issue: string, idx: number) => (
                                  <li key={idx}>• {issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Warnings */}
                          {(testResult as any).capabilityTest.warnings.length > 0 && (
                            <div className="mt-2 pl-2 border-l-2 border-yellow-400">
                              <p className="text-xs font-medium text-yellow-900 mb-1">Warnings:</p>
                              <ul className="text-xs text-yellow-800 space-y-0.5">
                                {(testResult as any).capabilityTest.warnings.map((warning: string, idx: number) => (
                                  <li key={idx}>• {warning}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error message */}
                  {!testResult.success && (
                    <div className="space-y-3">
                      {/* Error header */}
                      <div className="flex items-start gap-3">
                        <X size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-900">{testResult.message}</p>
                          {(testResult as any).errorType && (
                            <p className="text-xs text-red-700 mt-1">
                              Error type: {(testResult as any).errorType?.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Suggested action */}
                      {(testResult as any).suggestedAction && (
                        <div className="flex items-start gap-3 pl-2 border-l-2 border-red-300">
                          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-red-800 mb-1">How to fix:</p>
                            <p className="text-xs text-red-700">{(testResult as any).suggestedAction}</p>
                          </div>
                        </div>
                      )}

                      {/* Available models */}
                      {(testResult as any).availableModels && (testResult as any).availableModels.length > 0 && (
                        <div className="flex items-start gap-3 pl-2 border-l-2 border-blue-300 bg-blue-50 p-3 rounded-lg">
                          <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-blue-900 mb-2">Available models:</p>
                            <ul className="text-xs text-blue-800 space-y-1">
                              {(testResult as any).availableModels.map((model: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <Zap size={12} className="flex-shrink-0 mt-0.5 text-blue-600" />
                                  <span>{model}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Technical details (collapsible) */}
                      {testResult.error && testResult.error !== testResult.message && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-red-700 hover:text-red-900 font-medium">
                            Technical details
                          </summary>
                          <pre className="mt-2 p-2 bg-red-100 rounded text-red-800 overflow-x-auto">
                            {testResult.error}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="mt-6 pt-6 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 shadow-lg transition-all"
              >
                Save Settings
              </button>
              {settings?.aiProvider !== selectedProvider && (
                <button
                  onClick={async () => {
                    await updateSettings.mutateAsync({
                      aiProvider: selectedProvider
                    })
                    alert('Default provider updated!')
                  }}
                  className="px-6 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 shadow-lg transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Set as Default
                </button>
              )}
            </div>

            {/* Current Settings Display */}
            {settings && (
              <div className="mt-6 glass-card rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Configuration</h3>
                <div className="text-sm text-gray-600">
                  <p>Active Provider: <span className="font-semibold">{settings.aiProvider}</span></p>
                  <p className="mt-1">Platform: <span className="font-mono">{window.electron?.platform || 'unknown'}</span></p>
                </div>
              </div>
            )}
          </div>
        </div>
    </PageLayout>
  )
}
