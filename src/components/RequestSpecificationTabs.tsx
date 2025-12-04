import {useState} from 'react'
import {Minimize2, Maximize2} from 'lucide-react'
import SchemaRenderer from './SchemaRenderer'
import SchemaViewer, {Field} from './SchemaViewer'
import SchemaEditor from './SchemaEditor'
import KeyValueEditor from './KeyValueEditor'
import VariableInput from './VariableInput'

interface RequestSpecificationTabsProps {
  endpoint: any
  mode: 'view' | 'edit' | 'test'
  // Edit mode props
  headers?: Record<string, string>
  params?: Record<string, string>
  body?: string
  formData?: Record<string, any>
  queryParams?: Field[]
  headerParams?: Field[]
  bodyFields?: Field[]
  bodyDescription?: string
  onHeadersChange?: (headers: Record<string, string>) => void
  onParamsChange?: (params: Record<string, string>) => void
  onBodyChange?: (body: string) => void
  onFormDataChange?: (formData: Record<string, any>) => void
  onQueryParamsChange?: (params: Field[]) => void
  onHeaderParamsChange?: (headers: Field[]) => void
  onBodyFieldsChange?: (fields: Field[]) => void
  onBodyDescriptionChange?: (description: string) => void
  onContentTypeChange?: (contentType: string) => void
  // Common props
  selectedEnv?: any
  workflowVariables?: Record<string, any> // Variables from previous workflow steps
  readOnly?: boolean
  // Tab control props
  initialActiveTab?: RequestTab
  onActiveTabChange?: (tab: RequestTab) => void
}

type RequestTab = 'headers' | 'params' | 'body' | 'auth'

export default function RequestSpecificationTabs({
  endpoint,
  mode,
  headers = {},
  params = {},
  body = '',
  formData = {},
  queryParams = [],
  headerParams = [],
  bodyFields = [],
  bodyDescription = '',
  onHeadersChange,
  onParamsChange,
  onBodyChange,
  onFormDataChange,
  onQueryParamsChange,
  onHeaderParamsChange,
  onBodyDescriptionChange,
  onBodyFieldsChange,
  onContentTypeChange,
  selectedEnv,
  workflowVariables = {},
  readOnly = false,
  initialActiveTab = 'params',
  onActiveTabChange
}: RequestSpecificationTabsProps) {
  const [activeTab, setActiveTab] = useState<RequestTab>(initialActiveTab)

  const handleTabChange = (tab: RequestTab) => {
    setActiveTab(tab)
    onActiveTabChange?.(tab)
  }

  // Merge environment variables with workflow variables
  // Workflow variables take precedence over environment variables
  const allVariables = {
    ...(selectedEnv?.variables || {}),
    ...(selectedEnv?.baseUrl ? { baseUrl: selectedEnv.baseUrl } : {}),
    ...workflowVariables
  }

  const contentType = (mode === 'edit' || mode === 'test') ? (headers['Content-Type'] || 'application/json') : (endpoint.request?.contentType || 'application/json')

  const handleContentTypeChange = (newContentType: string) => {
    if (onContentTypeChange) {
      onContentTypeChange(newContentType)
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => handleTabChange('params')}
            className={`px-3 pb-1.5 text-sm font-medium transition-colors -mb-px ${
              activeTab === 'params' ? 'text-purple-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'params' ? { borderBottom: '3px solid rgb(147, 51, 234)' } : { borderBottom: '3px solid transparent' }}
          >
            Params
          </button>
          <button
            onClick={() => handleTabChange('headers')}
            className={`px-3 pb-1.5 text-sm font-medium transition-colors -mb-px ${
              activeTab === 'headers' ? 'text-purple-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'headers' ? { borderBottom: '3px solid rgb(147, 51, 234)' } : { borderBottom: '3px solid transparent' }}
          >
            Headers
          </button>
          <button
            onClick={() => handleTabChange('body')}
            className={`px-3 pb-1.5 text-sm font-medium transition-colors -mb-px ${
              activeTab === 'body' ? 'text-purple-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'body' ? { borderBottom: '3px solid rgb(147, 51, 234)' } : { borderBottom: '3px solid transparent' }}
          >
            Body
          </button>
          <button
            onClick={() => handleTabChange('auth')}
            className={`px-3 pb-1.5 text-sm font-medium transition-colors -mb-px ${
              activeTab === 'auth' ? 'text-purple-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'auth' ? { borderBottom: '3px solid rgb(147, 51, 234)' } : { borderBottom: '3px solid transparent' }}
          >
            Auth
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mb-4">
        {/* Params Tab */}
        {activeTab === 'params' && (
          <div>
            {mode === 'view' ? (
              // View mode - show spec parameters
              <SchemaViewer
                fields={endpoint.request?.parameters?.filter((p: any) => p.in === 'query') || []}
                title="Query Parameters"
                emptyMessage="No query parameters"
              />
            ) : mode === 'test' ? (
              // Test mode - custom entries only (full freedom to add/edit/remove)
              <KeyValueEditor
                entries={Object.entries(params || {}).map(([key, value]) => ({ key, value }))}
                onChange={(entries) => {
                  const paramsObj = Object.fromEntries(entries.map(e => [e.key, e.value]))
                  onParamsChange?.(paramsObj)
                }}
                title="Query Parameters"
                emptyMessage="No query parameters"
                keyPlaceholder="Parameter name"
                valuePlaceholder="Value"
                addButtonLabel="Add Parameter"
                allowVariables={true}
                selectedEnv={selectedEnv}
              />
            ) : (
              // Edit mode - editable params schema
              <SchemaEditor
                fields={queryParams}
                onChange={(fields) => {
                  // Ensure all fields have in: 'query'
                  const fieldsWithIn = fields.map(f => ({ ...f, in: 'query' }))
                  onQueryParamsChange?.(fieldsWithIn)
                }}
                title="Query Parameters"
                emptyMessage="No parameters defined"
                context="params"
              />
            )}
          </div>
        )}

        {/* Headers Tab - Similar structure to params */}
        {activeTab === 'headers' && (
          <div>
            {mode === 'view' ? (
              <div className="space-y-4">
                {/* Content-Type Display */}
                {endpoint.request?.contentType && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">Content-Type:</span>
                      <code className="text-sm text-purple-600 font-mono">{endpoint.request.contentType}</code>
                    </div>
                  </div>
                )}

                {/* Header Parameters */}
                {endpoint.request.parameters?.filter((p: any) => p.in === 'header').length > 0 ? (
                  <SchemaViewer
                    fields={endpoint.request.parameters.filter((p: any) => p.in === 'header')}
                    title="Headers"
                    emptyMessage="No headers"
                  />
                ) : !endpoint.request?.contentType && (
                  <p className="text-sm text-gray-500 italic">No headers</p>
                )}
              </div>
            ) : mode === 'test' ? (
              // Test mode - custom entries only (full freedom to add/edit/remove)
              <div className="space-y-4">
                {/* Content-Type Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">Content-Type:</span>
                    <code className="text-sm text-purple-600 font-mono">{contentType}</code>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">💡 Edit in the Body tab</p>
                </div>

                {/* Headers - custom entries only */}
                <KeyValueEditor
                  entries={Object.entries(headers || {}).map(([key, value]) => ({ key, value }))}
                  onChange={(entries) => {
                    const headersObj = Object.fromEntries(entries.map(e => [e.key, e.value]))
                    onHeadersChange?.(headersObj)
                  }}
                  title="Headers"
                  emptyMessage="No headers"
                  keyPlaceholder="Header name"
                  valuePlaceholder="Value"
                  addButtonLabel="Add Header"
                  allowVariables={true}
                  selectedEnv={selectedEnv}
                />
              </div>
            ) : (
              // Edit mode
              <div className="space-y-4">
                {/* Content-Type Display (Read-only in edit mode) */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">Content-Type:</span>
                    <code className="text-sm text-purple-600 font-mono">{contentType}</code>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">💡 Change Content-Type in the Body tab</p>
                </div>

                {/* Editable headers schema */}
                <SchemaEditor
                  fields={headerParams}
                  onChange={(fields) => {
                    // Ensure all fields have in: 'header'
                    const fieldsWithIn = fields.map((f: Field) => ({ ...f, in: 'header' }))
                    onHeaderParamsChange?.(fieldsWithIn)
                  }}
                  title="Custom Headers"
                  emptyMessage="No custom headers defined"
                  context="headers"
                />
              </div>
            )}
          </div>
        )}

        {/* Body Tab */}
        {activeTab === 'body' && (
          <div>
            {mode === 'view' ? (
              // View mode
              endpoint.request?.body ? (
                <div>
                  {endpoint.request.body.description && (
                    <p className="text-sm text-gray-600 mb-3">{endpoint.request.body.description}</p>
                  )}
                  {endpoint.request.body.required && (
                    <span className="inline-block text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded mb-3">required</span>
                  )}
                  {endpoint.request.body.example && (
                    <div className="mb-4">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Example</h5>
                      <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                        {JSON.stringify(endpoint.request.body.example, null, 2)}
                      </pre>
                    </div>
                  )}
                  {endpoint.request.body.fields && endpoint.request.body.fields.length > 0 && (
                    <SchemaViewer
                      fields={endpoint.request.body.fields}
                      title="Fields"
                      emptyMessage="No fields defined"
                    />
                  )}
                  {endpoint.request.body.schema && (
                    <SchemaRenderer schema={endpoint.request.body.schema} />
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No request body</p>
              )
            ) : mode === 'test' ? (
              // Test mode - Show form inputs for filling values
              <div>
                {/* Content-Type Selector (Editable in test mode) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content-Type</label>
                  <select
                    value={contentType}
                    onChange={(e) => {
                      const newContentType = e.target.value
                      handleContentTypeChange(newContentType)

                      // Clear body when switching content types to avoid format mismatch
                      if (contentType.includes('json') && !newContentType.includes('json')) {
                        onBodyChange?.('')
                        onFormDataChange?.({})
                      } else if (!contentType.includes('json') && newContentType.includes('json')) {
                        onFormDataChange?.({})
                        onBodyChange?.('{\n  \n}')
                      }
                    }}
                    disabled={readOnly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="application/json">application/json</option>
                    <option value="multipart/form-data">multipart/form-data</option>
                    <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  </select>
                </div>

                {contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded') ? (
                  // Form data / URL-encoded - custom entries only (full freedom)
                  <KeyValueEditor
                    entries={Object.entries(formData || {}).map(([key, value]) => ({ key, value }))}
                    onChange={(entries) => {
                      const formObj = Object.fromEntries(entries.map(e => [e.key, e.value]))
                      onFormDataChange?.(formObj)
                    }}
                    title={contentType.includes('multipart/form-data') ? 'Form Data' : 'URL-Encoded Data'}
                    emptyMessage="No body fields defined"
                    keyPlaceholder="Field name"
                    valuePlaceholder="Value"
                    addButtonLabel="Add Field"
                    allowVariables={true}
                    allowFileUpload={contentType.includes('multipart/form-data')}
                    selectedEnv={selectedEnv}
                  />
                ) : endpoint.request?.body ? (
                  // JSON body - Show textarea for raw JSON editing (only if body is defined)
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Request Body (JSON)</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(body)
                              onBodyChange?.(JSON.stringify(parsed, null, 2))
                            } catch (e) {
                              // If body is empty or invalid, try to parse example
                              if (endpoint.request.body.example) {
                                onBodyChange?.(JSON.stringify(endpoint.request.body.example, null, 2))
                              }
                            }
                          }}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors flex items-center gap-1"
                          title="Beautify JSON"
                        >
                          <Maximize2 size={14} />
                          Beautify
                        </button>
                        <button
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(body)
                              onBodyChange?.(JSON.stringify(parsed))
                            } catch (e) {
                              // Ignore invalid JSON
                            }
                          }}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors flex items-center gap-1"
                          title="Minify JSON"
                        >
                          <Minimize2 size={14} />
                          Minify
                        </button>
                      </div>
                    </div>
                    <VariableInput
                      value={body}
                      onChange={(value) => onBodyChange?.(value)}
                      variables={allVariables}
                      placeholder={endpoint.request.body.example ? JSON.stringify(endpoint.request.body.example, null, 2) : '{\n  \n}'}
                      multiline={true}
                      rows={10}
                      className="bg-gray-50"
                    />
                  </div>
                ) : (
                  // No body defined
                  <p className="text-sm text-gray-500 italic">No request body</p>
                )}
              </div>
            ) : (
              // Edit mode - Use SchemaEditor for editing structure
              <div>
                {/* Content-Type Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content-Type</label>
                  <select
                    value={contentType}
                    onChange={(e) => handleContentTypeChange(e.target.value)}
                    disabled={readOnly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="application/json">application/json</option>
                    <option value="multipart/form-data">multipart/form-data</option>
                    <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  </select>
                </div>

                {/* Body Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Body Description</label>
                  <input
                    type="text"
                    value={bodyDescription}
                    onChange={(e) => onBodyDescriptionChange?.(e.target.value)}
                    disabled={readOnly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Describe what this request body represents (e.g., User object, Pet data)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional description of the request body purpose
                  </p>
                </div>
                {contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded') ? (
                  // Form data / URL-encoded fields - schema editor
                  <div>
                    <SchemaEditor
                      fields={bodyFields}
                      onChange={onBodyFieldsChange || (() => {})}
                      title={contentType.includes('multipart/form-data') ? 'Form Data Fields' : 'URL-Encoded Fields'}
                      emptyMessage="No body fields defined"
                      context={contentType.includes('multipart/form-data') ? 'body-form' : 'body-urlencoded'}
                    />
                  </div>
                ) : (
                  // JSON body - schema editor for structure
                  <div>
                    <SchemaEditor
                      fields={bodyFields}
                      onChange={onBodyFieldsChange || (() => {})}
                      title="Body Fields"
                      emptyMessage="No body fields defined"
                      context="body-json"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <div>
            {endpoint.auth ? (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-sm font-mono text-gray-900">{endpoint.auth.name || 'Authentication'}</code>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{endpoint.auth.type}</span>
                  {endpoint.auth.required && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">required</span>
                  )}
                </div>
                {endpoint.auth.description && (
                  <p className="text-xs text-gray-600 mb-2">{endpoint.auth.description}</p>
                )}
                <div className="text-xs text-gray-600 space-y-1">
                  {endpoint.auth.in && (
                    <div>
                      <span className="font-medium">Location:</span> {endpoint.auth.in}
                    </div>
                  )}
                  {endpoint.auth.scheme && (
                    <div>
                      <span className="font-medium">Scheme:</span> {endpoint.auth.scheme}
                    </div>
                  )}
                  {endpoint.auth.bearerFormat && (
                    <div>
                      <span className="font-medium">Format:</span> {endpoint.auth.bearerFormat}
                    </div>
                  )}
                  {endpoint.auth.example && (
                    <div className="mt-2">
                      <span className="font-medium">Example:</span>
                      <pre className="mt-1 text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto">
                        {endpoint.auth.example}
                      </pre>
                    </div>
                  )}
                </div>
                {mode === 'edit' && (
                  <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200">
                    💡 Configure authentication credentials in the <strong>Headers</strong> tab
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No authentication required</p>
                {mode === 'edit' && <p className="text-xs mt-2 text-gray-400">You can add custom auth headers in the Headers tab if needed</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
