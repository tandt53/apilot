import {useNavigate, useParams} from 'react-router-dom'
import {
    useCreateEnvironment,
    useDeleteEnvironment,
    useEndpoints,
    useEnvironments,
    useSpec,
    useTestCasesBySpec,
    useUpdateEnvironment
} from '@/lib/hooks'
import {useEffect, useState} from 'react'
import {ArrowLeft, Download, FileCode, Plus, Settings2, Trash2, Upload, X, Zap} from 'lucide-react'
import EndpointDetail from '@/components/EndpointDetail'
import {getCurrentAIService} from '@/lib/ai'
import * as api from '@/lib/api'
import {
    clearNavigationState,
    getNavigationState,
    setSelectedEndpointId as saveSelectedEndpointId,
    setSelectedSpecId
} from '@/lib/navigationState'

export default function SpecDetail() {
  const { id: idParam } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const id = Number(idParam)

  const { data: spec, isLoading: specLoading } = useSpec(id)
  const { data: endpoints, isLoading: endpointsLoading } = useEndpoints(id)
  const { data: testCases } = useTestCasesBySpec(id)
  const { data: environments } = useEnvironments(id)

  const createEnvironment = useCreateEnvironment()
  const updateEnvironment = useUpdateEnvironment()
  const deleteEnvironment = useDeleteEnvironment()

  // Initialize from saved navigation state
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(() => {
    const navState = getNavigationState();
    return navState.selectedSpecId === id ? (navState.selectedEndpointId ?? null) : null;
  })
  const [generating, setGenerating] = useState(false)
  const [sidebarCollapsed] = useState(false)
  const [selectedEndpoints, setSelectedEndpoints] = useState<number[]>([])
  const [endpointsPanelWidth, setEndpointsPanelWidth] = useState(320) // 320px = w-80
  const [isResizing, setIsResizing] = useState(false)

  // Streaming state
  const [generatedCount, setGeneratedCount] = useState(0)
  const [showTokenLimitError, setShowTokenLimitError] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Environment modal state
  const [showEnvModal, setShowEnvModal] = useState(false)
  const [editingEnv, setEditingEnv] = useState<any>(null)
  const [envForm, setEnvForm] = useState({
    name: '',
    baseUrl: '',
    description: '',
    variables: {} as Record<string, string>,
    headers: {} as Record<string, string>,
  })

  // Global environment selection for this spec
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(() => {
    // Load from localStorage
    const saved = localStorage.getItem(`spec-${id}-selected-env`)
    return saved || null
  })

  // Save selected environment to localStorage
  useEffect(() => {
    if (selectedEnvId) {
      localStorage.setItem(`spec-${id}-selected-env`, selectedEnvId)
    } else {
      localStorage.removeItem(`spec-${id}-selected-env`)
    }
  }, [selectedEnvId, id])

  const selectedEnv = environments?.find(env => env.id === selectedEnvId)

  const selectedEndpoint = endpoints?.find(e => e.id === selectedEndpointId)

  const handleMouseDown = () => {
    setIsResizing(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return

    const minWidth = 240 // Minimum width
    const maxWidth = 600 // Maximum width
    const newWidth = Math.min(Math.max(e.clientX, minWidth), maxWidth)
    setEndpointsPanelWidth(newWidth)
  }

  const handleMouseUp = () => {
    setIsResizing(false)
  }

  // Add event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Save spec ID when component mounts
  useEffect(() => {
    setSelectedSpecId(id);
  }, [id])

  // Save selected endpoint whenever it changes
  useEffect(() => {
    if (selectedEndpointId !== null) {
      saveSelectedEndpointId(selectedEndpointId);
    }
  }, [selectedEndpointId])

  const toggleEndpointSelection = (endpointId: number) => {
    setSelectedEndpoints(prev =>
      prev.includes(endpointId)
        ? prev.filter(id => id !== endpointId)
        : [...prev, endpointId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedEndpoints.length === endpoints?.length) {
      setSelectedEndpoints([])
    } else {
      setSelectedEndpoints(endpoints?.map(e => e.id!).filter(id => id !== undefined) || [])
    }
  }

  const handleGenerateTests = async () => {
    if (!endpoints || !spec) return

    if (selectedEndpoints.length === 0) {
      alert('Please select at least one endpoint to generate tests.')
      return
    }

    const endpointsToGenerate = endpoints.filter(e => selectedEndpoints.includes(e.id!))

    if (!confirm(`Generate tests for ${endpointsToGenerate.length} endpoint${endpointsToGenerate.length > 1 ? 's' : ''}?`)) return

    // Navigate to tests page with generating flag
    navigate('/tests?generating=true')

    // Create abort controller for cancellation
    const controller = new AbortController()
    setAbortController(controller)

    // Track count in closure to get final value
    let finalCount = 0

    try {
      setGenerating(true)
      setGeneratedCount(0)
      setShowTokenLimitError(false)

      // Get AI service
      const aiService = await getCurrentAIService()

      // Parse spec for AI - handle different formats
      let parsedSpec: any
      const specFormat = spec.format || 'openapi' // Default to openapi for backward compatibility
      if (specFormat === 'curl') {
        // For cURL imports, create a minimal spec object from the spec metadata
        parsedSpec = {
          info: {
            title: spec.name,
            version: spec.version,
            description: spec.description,
          },
          servers: spec.baseUrl ? [{ url: spec.baseUrl }] : [],
        }
      } else {
        // For OpenAPI/Swagger/Postman, parse the rawSpec JSON
        try {
          parsedSpec = JSON.parse(spec.rawSpec)
        } catch (error) {
          console.error('[SpecDetail] Failed to parse rawSpec:', error)
          throw new Error('Invalid spec format: could not parse specification')
        }
      }

      // Generate tests with streaming
      await aiService.generateTests({
        endpoints: endpointsToGenerate,
        spec: parsedSpec,
        signal: controller.signal,
        onProgress: (progress) => {
          finalCount = progress.current
          setGeneratedCount(progress.current)
        },
        onTestGenerated: async (test) => {
          // Save test in real-time as it's generated
          console.log('[SpecDetail] Received test from IPC:', {
            name: test.name,
            method: test.method,
            path: test.path,
            testType: test.testType,
            assertions: test.assertions?.length
          })
          await api.createTestCase(test as any)
        }
      })

      // Success - clear selection
      setSelectedEndpoints([])

      // Clear generating flag in URL
      navigate('/tests')

      alert(`Successfully generated ${finalCount} test cases!`)
    } catch (error: any) {
      if (error.message === 'TOKEN_LIMIT_REACHED') {
        // Show continue button instead of alert
        setShowTokenLimitError(true)
      } else if (error.message !== 'ABORTED') {
        // Don't alert on user abort

        // Clear generating flag on error
        navigate('/tests')

        alert(`Failed to generate tests: ${error.message}`)
      }
    } finally {
      setGenerating(false)
      setAbortController(null)
    }
  }

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setGenerating(false)
    }
  }

  const handleContinueGeneration = async () => {
    // Simply restart generation - tests already saved will be in DB
    setShowTokenLimitError(false)
    await handleGenerateTests()
  }

  // Environment handlers
  const handleCreateEnv = async () => {
    if (!envForm.name || !envForm.baseUrl) {
      alert('Name and Base URL are required')
      return
    }

    await createEnvironment.mutateAsync({
      specId: id,
      ...envForm,
    })

    setEnvForm({ name: '', baseUrl: '', description: '', variables: {}, headers: {} })
    setEditingEnv(null)
  }

  const handleUpdateEnv = async () => {
    if (!editingEnv || !envForm.name || !envForm.baseUrl) {
      alert('Name and Base URL are required')
      return
    }

    await updateEnvironment.mutateAsync({
      id: editingEnv.id,
      specId: id,
      data: envForm,
    })

    setEnvForm({ name: '', baseUrl: '', description: '', variables: {}, headers: {} })
    setEditingEnv(null)
  }

  const handleDeleteEnv = async (envId: string) => {
    if (!confirm('Delete this environment?')) return

    await deleteEnvironment.mutateAsync({ id: envId, specId: id })
  }

  const openEditEnv = (env: any) => {
    setEditingEnv(env)
    setEnvForm({
      name: env.name,
      baseUrl: env.baseUrl,
      description: env.description || '',
      variables: env.variables || {},
      headers: env.headers || {},
    })
  }

  if (specLoading || endpointsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading specification...</div>
      </div>
    )
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Specification not found</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                clearNavigationState();
                navigate('/specs');
              }}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{spec.name}</h1>
              <p className="text-sm text-gray-600">
                v{spec.version} • {endpoints?.length || 0} endpoints • {testCases?.length || 0} tests • {environments?.length || 0} environments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Global Environment Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Environment:</label>
              {environments && environments.length > 0 ? (
                <select
                  value={selectedEnvId || ''}
                  onChange={(e) => setSelectedEnvId(e.target.value || null)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">None (default)</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-gray-500 italic">No environments</span>
              )}
            </div>

            <button
              onClick={() => setShowEnvModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings2 size={18} />
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Endpoints List */}
        <div
          className="bg-white relative flex"
          style={{
            width: sidebarCollapsed ? 0 : endpointsPanelWidth,
            transition: isResizing ? 'none' : 'width 300ms'
          }}
        >
          <div className="flex-1 overflow-y-auto border-r border-gray-200">
            <div className={`p-4 ${sidebarCollapsed ? 'hidden' : ''}`}>
            <div className="flex flex-col gap-3 mb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">ENDPOINTS</h2>
                {endpoints && endpoints.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {selectedEndpoints.length === endpoints.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {/* Generation buttons */}
              {!generating && !showTokenLimitError && (
                <button
                  onClick={handleGenerateTests}
                  disabled={selectedEndpoints.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
                >
                  <Zap size={18} />
                  {selectedEndpoints.length > 0 ? `Generate Tests (${selectedEndpoints.length})` : 'Generate Tests'}
                </button>
              )}

              {generating && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                    <Zap size={18} className="animate-pulse" />
                    Generating... ({generatedCount} tests)
                  </div>
                  <button
                    onClick={handleStopGeneration}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Stop Generation
                  </button>
                </div>
              )}

              {showTokenLimitError && (
                <div className="space-y-2">
                  <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                    Token limit reached. {generatedCount} tests saved.
                  </div>
                  <button
                    onClick={handleContinueGeneration}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Zap size={18} />
                    Continue Generating
                  </button>
                </div>
              )}
            </div>
            {selectedEndpoints.length > 0 && (
              <div className="mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                {selectedEndpoints.length} endpoint{selectedEndpoints.length > 1 ? 's' : ''} selected
              </div>
            )}
            {!endpoints || endpoints.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <FileCode size={32} className="mx-auto mb-2 text-gray-400" />
                No endpoints found
              </div>
            ) : (
              <div className="space-y-1">
                {endpoints.map(endpoint => {
                  const isSelected = endpoint.id === selectedEndpointId
                  const isChecked = selectedEndpoints.includes(endpoint.id!)
                  const methodColors: Record<string, string> = {
                    GET: 'bg-green-100 text-green-700',
                    POST: 'bg-blue-100 text-blue-700',
                    PUT: 'bg-orange-100 text-orange-700',
                    DELETE: 'bg-red-100 text-red-700',
                    PATCH: 'bg-purple-100 text-purple-700',
                  }

                  return (
                    <div
                      key={endpoint.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedEndpointId(endpoint.id!)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${methodColors[endpoint.method] || 'bg-gray-100 text-gray-700'}`}>
                            {endpoint.method}
                          </span>
                          <span className="text-xs font-mono text-gray-600 truncate">
                            {endpoint.path}
                          </span>
                        </div>
                        {endpoint.name && (
                          <p className="text-xs text-gray-600 truncate">{endpoint.name}</p>
                        )}
                      </button>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEndpointSelection(endpoint.id!)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 flex-shrink-0 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>

          {/* Resize Handle */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={handleMouseDown}
              className={`w-1 cursor-col-resize hover:bg-purple-500 transition-colors flex-shrink-0 ${
                isResizing ? 'bg-purple-500' : 'bg-gray-200'
              }`}
              style={{ userSelect: 'none' }}
            />
          )}
        </div>

        {/* Right Panel: Endpoint Detail */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {selectedEndpoint ? (
            <EndpointDetail
              key={selectedEndpoint.id}
              endpoint={selectedEndpoint}
              specId={String(id)}
              selectedEnv={selectedEnv}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <FileCode size={48} className="mx-auto mb-4 text-gray-400" />
                <p>Select an endpoint to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Environment Modal */}
      {showEnvModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Environments</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const exported = await api.exportEnvironments(id)
                    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${spec.name}-environments.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  title="Export environments"
                >
                  <Download size={16} />
                  Export
                </button>
                <label className="flex items-center gap-1 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                  <Upload size={16} />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      try {
                        const text = await file.text()
                        const data = JSON.parse(text)

                        if (!data.environments || !Array.isArray(data.environments)) {
                          alert('Invalid environment file format')
                          return
                        }

                        await api.importEnvironments(id, data.environments)
                        alert(`Imported ${data.environments.length} environments successfully!`)
                      } catch (error: any) {
                        alert(`Failed to import: ${error.message}`)
                      }

                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  onClick={() => {
                    setShowEnvModal(false)
                    setEditingEnv(null)
                    setEnvForm({ name: '', baseUrl: '', description: '', variables: {}, headers: {} })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Environment Form */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-900">
                  {editingEnv ? 'Edit Environment' : 'New Environment'}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={envForm.name}
                      onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })}
                      placeholder="e.g., Development, Staging, Production"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base URL *</label>
                    <input
                      type="text"
                      value={envForm.baseUrl}
                      onChange={(e) => setEnvForm({ ...envForm, baseUrl: e.target.value })}
                      placeholder="https://api.example.com"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={envForm.description}
                    onChange={(e) => setEnvForm({ ...envForm, description: e.target.value })}
                    placeholder="Optional description"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>

                {/* Variables Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Variables (use as {`{{variableName}}`} in requests)
                  </label>
                  <div className="space-y-2">
                    {Object.entries(envForm.variables).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newVars = { ...envForm.variables }
                            delete newVars[key]
                            newVars[e.target.value] = value
                            setEnvForm({ ...envForm, variables: newVars })
                          }}
                          placeholder="Variable name"
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => {
                            setEnvForm({
                              ...envForm,
                              variables: { ...envForm.variables, [key]: e.target.value }
                            })
                          }}
                          placeholder="Value"
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => {
                            const newVars = { ...envForm.variables }
                            delete newVars[key]
                            setEnvForm({ ...envForm, variables: newVars })
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newKey = `var${Object.keys(envForm.variables).length + 1}`
                        setEnvForm({
                          ...envForm,
                          variables: { ...envForm.variables, [newKey]: '' }
                        })
                      }}
                      className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                    >
                      <Plus size={14} />
                      Add Variable
                    </button>
                  </div>
                </div>

                {/* Headers Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Headers (automatically added to all requests)
                  </label>
                  <div className="space-y-2">
                    {Object.entries(envForm.headers).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newHeaders = { ...envForm.headers }
                            delete newHeaders[key]
                            newHeaders[e.target.value] = value
                            setEnvForm({ ...envForm, headers: newHeaders })
                          }}
                          placeholder="Header name"
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => {
                            setEnvForm({
                              ...envForm,
                              headers: { ...envForm.headers, [key]: e.target.value }
                            })
                          }}
                          placeholder="Value"
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => {
                            const newHeaders = { ...envForm.headers }
                            delete newHeaders[key]
                            setEnvForm({ ...envForm, headers: newHeaders })
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newKey = 'X-Custom-Header'
                        setEnvForm({
                          ...envForm,
                          headers: { ...envForm.headers, [newKey]: '' }
                        })
                      }}
                      className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                    >
                      <Plus size={14} />
                      Add Header
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingEnv ? (
                    <>
                      <button
                        onClick={handleUpdateEnv}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => {
                          setEditingEnv(null)
                          setEnvForm({ name: '', baseUrl: '', description: '', variables: {}, headers: {} })
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCreateEnv}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                    >
                      <Plus size={16} />
                      Add Environment
                    </button>
                  )}
                </div>
              </div>

              {/* Environments List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Saved Environments</h3>
                {!environments || environments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No environments configured. Add one above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {environments.map((env) => (
                      <div
                        key={env.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{env.name}</h4>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {env.baseUrl}
                            </span>
                          </div>
                          {env.description && (
                            <p className="text-sm text-gray-600 mt-1">{env.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditEnv(env)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <Settings2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteEnv(env.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
