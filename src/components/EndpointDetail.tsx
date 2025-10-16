import {useEffect, useState} from 'react'
import {Code2, Edit3, FileText, Play} from 'lucide-react'
import RequestSpecificationTabs from './RequestSpecificationTabs'
import RequestTester, {SessionState} from './RequestTester'
import ResponseSpecificationEditor from './ResponseSpecificationEditor'
import SaveCancelButtons from './SaveCancelButtons'
import type {Endpoint} from '@/types/database'

interface EndpointDetailProps {
  endpoint: Endpoint
  specId?: string
  selectedEnv?: any
  onEndpointUpdate?: () => void
}

// Helper functions for endpoint session management
const getEndpointSessionKey = (specId: string, endpointId: number) =>
  `endpoint-${specId}-${endpointId}-session`

const loadEndpointSession = (specId: string, endpointId: number): { mode: 'view' | 'test' | 'edit'; session?: Partial<SessionState> } => {
  try {
    const saved = localStorage.getItem(getEndpointSessionKey(specId, endpointId))
    return saved ? JSON.parse(saved) : { mode: 'view' }
  } catch {
    return { mode: 'view' }
  }
}

const saveEndpointSession = (specId: string, endpointId: number, mode: 'view' | 'test' | 'edit', session?: SessionState) => {
  try {
    localStorage.setItem(getEndpointSessionKey(specId, endpointId), JSON.stringify({ mode, session }))
  } catch (error) {
    console.error('Failed to save endpoint session:', error)
  }
}

export default function EndpointDetail({ endpoint, specId, selectedEnv, onEndpointUpdate }: EndpointDetailProps) {
  // Load saved session state
  const savedData = specId && endpoint.id ? loadEndpointSession(specId, endpoint.id) : { mode: 'view' as const }
  const [mode, setMode] = useState<'view' | 'test' | 'edit'>(savedData.mode)
  const [testSession, setTestSession] = useState<Partial<SessionState> | undefined>(savedData.session)

  // Edit mode state
  const [editHeaders, setEditHeaders] = useState<Record<string, string>>({})
  const [editParams, setEditParams] = useState<Record<string, string>>({})
  const [editBody, setEditBody] = useState('')
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [editResponses, setEditResponses] = useState<any>(null)
  const [editQueryParams, setEditQueryParams] = useState<any[]>([])
  const [editHeaderParams, setEditHeaderParams] = useState<any[]>([])
  const [editBodyFields, setEditBodyFields] = useState<any[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Reload mode when endpoint changes
  useEffect(() => {
    if (specId && endpoint.id) {
      const savedData = loadEndpointSession(specId, endpoint.id)
      setMode(savedData.mode)
      setTestSession(savedData.session)
    }
  }, [endpoint.id, specId])

  // Function to reset edit state from endpoint data
  const resetEditState = () => {
    // Initialize headers from endpoint
    const initialHeaders: Record<string, string> = {}
    if (endpoint.request?.contentType) {
      initialHeaders['Content-Type'] = endpoint.request.contentType
    }
    endpoint.request?.parameters?.filter((p: any) => p.in === 'header').forEach((p: any) => {
      initialHeaders[p.name] = p.example || ''
    })
    setEditHeaders(initialHeaders)

    // Initialize params from endpoint
    const initialParams: Record<string, string> = {}
    endpoint.request?.parameters?.filter((p: any) => p.in === 'query').forEach((p: any) => {
      initialParams[p.name] = p.example || ''
    })
    setEditParams(initialParams)

    // Initialize body from endpoint example
    if (endpoint.request?.body?.example) {
      setEditBody(JSON.stringify(endpoint.request.body.example, null, 2))
    } else {
      setEditBody('')
    }

    // Initialize form data
    setEditFormData({})

    // Initialize responses
    setEditResponses(endpoint.responses ? { ...endpoint.responses } : null)

    // Initialize query parameters
    const queryParamsFromEndpoint = endpoint.request?.parameters?.filter((p: any) => p.in === 'query') || []
    setEditQueryParams(queryParamsFromEndpoint)

    // Initialize header parameters
    const headerParamsFromEndpoint = endpoint.request?.parameters?.filter((p: any) => p.in === 'header') || []
    setEditHeaderParams(headerParamsFromEndpoint)

    // Initialize body fields
    const bodyFieldsFromEndpoint = endpoint.request?.body?.fields || []
    setEditBodyFields(bodyFieldsFromEndpoint)
  }

  // Initialize edit mode data when entering edit mode
  useEffect(() => {
    if (mode === 'edit') {
      resetEditState()
    }
  }, [mode, endpoint])

  // Save mode when it changes
  useEffect(() => {
    if (specId && endpoint.id) {
      saveEndpointSession(specId, endpoint.id, mode, testSession as SessionState | undefined)
    }
  }, [mode, testSession, specId, endpoint.id])

  // Detect changes in edit mode
  useEffect(() => {
    if (mode !== 'edit') {
      setHasUnsavedChanges(false)
      return
    }

    // Compare current edit state with original endpoint data
    const originalQueryParams = endpoint.request?.parameters?.filter((p: any) => p.in === 'query') || []
    const originalHeaderParams = endpoint.request?.parameters?.filter((p: any) => p.in === 'header') || []
    const originalBodyFields = endpoint.request?.body?.fields || []
    const originalResponses = endpoint.responses

    const queryParamsChanged = JSON.stringify(editQueryParams) !== JSON.stringify(originalQueryParams)
    const headerParamsChanged = JSON.stringify(editHeaderParams) !== JSON.stringify(originalHeaderParams)
    const bodyFieldsChanged = JSON.stringify(editBodyFields) !== JSON.stringify(originalBodyFields)
    const responsesChanged = JSON.stringify(editResponses) !== JSON.stringify(originalResponses)

    setHasUnsavedChanges(queryParamsChanged || headerParamsChanged || bodyFieldsChanged || responsesChanged)
  }, [mode, editQueryParams, editHeaderParams, editBodyFields, editResponses, endpoint])

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
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

        {/* Save/Cancel Buttons - Only show in Edit mode */}
        {mode === 'edit' && (
          <SaveCancelButtons
            onSave={() => {
              // TODO: Implement save logic
              setMode('view')
            }}
            onCancel={resetEditState}
            hasUnsavedChanges={hasUnsavedChanges}
          />
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
        <button
          onClick={() => setMode('edit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'edit'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Edit3 size={16} />
          Edit
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

            <div className="p-4">
              {/* Request URL */}
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-2 rounded font-semibold text-sm ${getMethodColor(endpoint.method)}`}>
                    {endpoint.method}
                  </span>
                  <div className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-700 bg-gray-50">
                    {endpoint.path}
                  </div>
                </div>
              </div>

              {/* Request Specification Tabs - View Mode */}
              <RequestSpecificationTabs
                endpoint={endpoint}
                mode="view"
                selectedEnv={selectedEnv}
              />
            </div>
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
              <ResponseSpecificationEditor
                responses={endpoint.responses}
                mode="view"
              />
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

      {/* Edit Mode */}
      {mode === 'edit' && (
        <>
          {/* Request Specification - Editable */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Code2 size={20} className="text-purple-600" />
                Request Specification
              </h3>
            </div>

            <div className="p-4">
              {/* Request URL */}
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-2 rounded font-semibold text-sm ${getMethodColor(endpoint.method)}`}>
                    {endpoint.method}
                  </span>
                  <div className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-700 bg-gray-50">
                    {endpoint.path}
                  </div>
                </div>
              </div>

              {/* Request Specification Tabs - Edit Mode */}
              <RequestSpecificationTabs
                endpoint={endpoint}
                mode="edit"
                selectedEnv={selectedEnv}
                headers={editHeaders}
                params={editParams}
                body={editBody}
                formData={editFormData}
                queryParams={editQueryParams}
                headerParams={editHeaderParams}
                bodyFields={editBodyFields}
                onHeadersChange={setEditHeaders}
                onParamsChange={setEditParams}
                onBodyChange={setEditBody}
                onFormDataChange={setEditFormData}
                onQueryParamsChange={setEditQueryParams}
                onHeaderParamsChange={setEditHeaderParams}
                onBodyFieldsChange={setEditBodyFields}
              />
            </div>
          </div>

          {/* Response Specifications - Editable */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-purple-600" />
                Response Specifications
              </h3>
            </div>

            <div className="p-4">
              <ResponseSpecificationEditor
                responses={editResponses}
                onResponsesChange={setEditResponses}
                mode="edit"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
