import {useEffect, useState} from 'react'
import {Code2, FileText, Play} from 'lucide-react'
import RequestSpecificationTabs from './RequestSpecificationTabs'
import RequestTester, {SessionState} from './RequestTester'
import type {Endpoint} from '@/types/database'

interface EndpointDetailProps {
  endpoint: Endpoint
  specId?: string
  selectedEnv?: any
}

// Helper functions for endpoint session management
const getEndpointSessionKey = (specId: string, endpointId: number) =>
  `endpoint-${specId}-${endpointId}-session`

const loadEndpointSession = (specId: string, endpointId: number): { mode: 'view' | 'test'; session?: Partial<SessionState> } => {
  try {
    const saved = localStorage.getItem(getEndpointSessionKey(specId, endpointId))
    return saved ? JSON.parse(saved) : { mode: 'view' }
  } catch {
    return { mode: 'view' }
  }
}

const saveEndpointSession = (specId: string, endpointId: number, mode: 'view' | 'test', session?: SessionState) => {
  try {
    localStorage.setItem(getEndpointSessionKey(specId, endpointId), JSON.stringify({ mode, session }))
  } catch (error) {
    console.error('Failed to save endpoint session:', error)
  }
}

export default function EndpointDetail({ endpoint, specId, selectedEnv }: EndpointDetailProps) {
  // Load saved session state
  const savedData = specId && endpoint.id ? loadEndpointSession(specId, endpoint.id) : { mode: 'view' as const }
  const [mode, setMode] = useState<'view' | 'test'>(savedData.mode)
  const [testSession, setTestSession] = useState<Partial<SessionState> | undefined>(savedData.session)

  // Save mode when it changes
  useEffect(() => {
    if (specId && endpoint.id) {
      saveEndpointSession(specId, endpoint.id, mode, testSession as SessionState | undefined)
    }
  }, [mode, testSession, specId, endpoint.id])

  // Helper to get method color
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-green-100 text-green-700 border-green-300',
      POST: 'bg-blue-100 text-blue-700 border-blue-300',
      PUT: 'bg-orange-100 text-orange-700 border-orange-300',
      DELETE: 'bg-red-100 text-red-700 border-red-300',
      PATCH: 'bg-purple-100 text-purple-700 border-purple-300',
    }
    return colors[method] || 'bg-gray-100 text-gray-700 border-gray-300'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-3 py-1 rounded-md border font-bold text-sm ${getMethodColor(endpoint.method)}`}>
            {endpoint.method}
          </span>
          <code className="text-sm font-mono text-gray-700">{endpoint.path}</code>
        </div>
        {endpoint.name && (
          <p className="text-sm text-gray-600 mt-2">{endpoint.name}</p>
        )}
        {endpoint.description && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">{endpoint.description}</p>
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('view')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'view'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText size={16} />
          View Spec
        </button>
        <button
          onClick={() => setMode('test')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'test'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Play size={16} />
          Try It
        </button>
      </div>

      {/* View Mode */}
      {mode === 'view' && (
        <>
          {/* Request Specification */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Code2 size={20} className="text-purple-600" />
                Request Specification
              </h3>
            </div>

            {/* Request URL */}
            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded font-semibold text-sm ${getMethodColor(endpoint.method)}`}>
                  {endpoint.method}
                </span>
                <code className="text-sm font-mono text-gray-700">{endpoint.path}</code>
              </div>
            </div>

            {/* Request Specification Tabs - View Mode */}
            <RequestSpecificationTabs
              endpoint={endpoint}
              mode="view"
              selectedEnv={selectedEnv}
            />
          </div>

          {/* Response Specifications */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-purple-600" />
                Response Specifications
              </h3>
            </div>

            <div className="p-4">
              {endpoint.responses ? (
                <div className="space-y-4">
                  {/* Success Response */}
                  {endpoint.responses.success && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="px-4 py-2 flex items-center gap-2 bg-green-50 border-b border-green-200">
                        <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                          {endpoint.responses.success.status || '200'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {endpoint.responses.success.description || 'Success'}
                        </span>
                      </div>

                      {(endpoint.responses.success.contentType ||
                        endpoint.responses.success.example ||
                        (endpoint.responses.success.fields && endpoint.responses.success.fields.length > 0)) && (
                        <div className="p-4">
                          {endpoint.responses.success.contentType && (
                            <div className="mb-3">
                              <span className="text-xs font-semibold text-gray-500 uppercase">Content-Type</span>
                              <div className="mt-1">
                                <span className="text-xs font-mono px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                  {endpoint.responses.success.contentType}
                                </span>
                              </div>
                            </div>
                          )}

                          {endpoint.responses.success.example && (
                            <div className="mb-4">
                              <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Example</h5>
                              <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                                {JSON.stringify(endpoint.responses.success.example, null, 2)}
                              </pre>
                            </div>
                          )}

                          {endpoint.responses.success.fields && endpoint.responses.success.fields.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fields</h5>
                              <div className="space-y-2">
                                {endpoint.responses.success.fields.map((field, idx) => (
                                  <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                                    <div className="flex items-center gap-2 mb-1">
                                      <code className="text-sm font-mono text-gray-900">{field.name}</code>
                                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                        {field.type}
                                      </span>
                                      {field.format && (
                                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                          {field.format}
                                        </span>
                                      )}
                                      {field.required && (
                                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                          required
                                        </span>
                                      )}
                                    </div>
                                    {field.description && (
                                      <p className="text-xs text-gray-600 mt-1">{field.description}</p>
                                    )}
                                    {field.example !== undefined && (
                                      <div className="mt-2 text-xs">
                                        <span className="font-medium text-gray-600">Example:</span>{' '}
                                        <code className="text-purple-600">{JSON.stringify(field.example)}</code>
                                      </div>
                                    )}
                                    {field.enum && (
                                      <div className="mt-2 text-xs">
                                        <span className="font-medium text-gray-600">Allowed values:</span>{' '}
                                        {field.enum.map((v, i) => (
                                          <code key={i} className="text-purple-600 mr-1">{JSON.stringify(v)}</code>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Responses */}
                  {endpoint.responses.errors && endpoint.responses.errors.length > 0 && (
                    endpoint.responses.errors.map((error, idx) => (
                      <div key={idx} className="border rounded-lg overflow-hidden">
                        <div className="px-4 py-2 flex items-center gap-2 bg-red-50 border-b border-red-200">
                          <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">
                            {error.status || '400'}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {error.reason || 'Error'}
                          </span>
                        </div>

                        {error.example && (
                          <div className="p-4">
                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Example</h5>
                            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                              {JSON.stringify(error.example, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No response specifications</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Try It Mode */}
      {mode === 'test' && (
        <RequestTester
          endpoint={endpoint}
          specId={specId}
          selectedEnv={selectedEnv}
          initialSession={testSession}
          onSessionChange={setTestSession}
        />
      )}
    </div>
  )
}
