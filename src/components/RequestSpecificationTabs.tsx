import {useState} from 'react'
import {File, Minimize2, Plus, Sparkles, Upload, X} from 'lucide-react'
import VariableInput from './VariableInput'
import SchemaRenderer from './SchemaRenderer'

interface RequestSpecificationTabsProps {
  endpoint: any
  mode: 'view' | 'edit'
  // Edit mode props
  headers?: Record<string, string>
  params?: Record<string, string>
  body?: string
  formData?: Record<string, any>
  onHeadersChange?: (headers: Record<string, string>) => void
  onParamsChange?: (params: Record<string, string>) => void
  onBodyChange?: (body: string) => void
  onFormDataChange?: (formData: Record<string, any>) => void
  // Common props
  selectedEnv?: any
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
  onHeadersChange,
  onParamsChange,
  onBodyChange,
  onFormDataChange,
  selectedEnv,
  readOnly = false,
  initialActiveTab = 'params',
  onActiveTabChange
}: RequestSpecificationTabsProps) {
  const [activeTab, setActiveTab] = useState<RequestTab>(initialActiveTab)

  const handleTabChange = (tab: RequestTab) => {
    setActiveTab(tab)
    onActiveTabChange?.(tab)
  }
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderValue, setNewHeaderValue] = useState('')
  const [newParamKey, setNewParamKey] = useState('')
  const [newParamValue, setNewParamValue] = useState('')

  const isEditable = mode === 'edit' && !readOnly

  const handleAddHeader = () => {
    if (newHeaderKey && newHeaderValue && onHeadersChange) {
      onHeadersChange({ ...headers, [newHeaderKey]: newHeaderValue })
      setNewHeaderKey('')
      setNewHeaderValue('')
    }
  }

  const handleRemoveHeader = (key: string) => {
    if (onHeadersChange) {
      const newHeaders = { ...headers }
      delete newHeaders[key]
      onHeadersChange(newHeaders)
    }
  }

  const handleUpdateHeaderKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !onHeadersChange) return
    const newHeaders = { ...headers }
    const value = newHeaders[oldKey]
    delete newHeaders[oldKey]
    if (!newHeaders[newKey]) {
      newHeaders[newKey] = value
    }
    onHeadersChange(newHeaders)
  }

  const handleAddParam = () => {
    if (newParamKey && newParamValue && onParamsChange) {
      onParamsChange({ ...params, [newParamKey]: newParamValue })
      setNewParamKey('')
      setNewParamValue('')
    }
  }

  const handleRemoveParam = (key: string) => {
    if (onParamsChange) {
      const newParams = { ...params }
      delete newParams[key]
      onParamsChange(newParams)
    }
  }

  const handleUpdateParamKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !onParamsChange) return
    const newParams = { ...params }
    const value = newParams[oldKey]
    delete newParams[oldKey]
    if (!newParams[newKey]) {
      newParams[newKey] = value
    }
    onParamsChange(newParams)
  }

  const handleBeautify = () => {
    if (!onBodyChange) return
    try {
      const parsed = JSON.parse(body)
      const formatted = JSON.stringify(parsed, null, 2)
      onBodyChange(formatted)
    } catch (error: any) {
      alert('Invalid JSON: ' + error.message)
    }
  }

  const handleMinify = () => {
    if (!onBodyChange) return
    try {
      const parsed = JSON.parse(body)
      const minified = JSON.stringify(parsed)
      onBodyChange(minified)
    } catch (error: any) {
      alert('Invalid JSON: ' + error.message)
    }
  }

  const method = endpoint.method || 'GET'
  const contentType = mode === 'edit' ? (headers['Content-Type'] || 'application/json') : (endpoint.request?.contentType || 'application/json')

  return (
    <>
      {/* Tabs */}
      <div className={mode === 'view' ? 'border-b border-gray-200' : 'mb-4'}>
        <div className={`flex gap-1 ${mode === 'view' ? 'px-4' : ''}`}>
          <button
            onClick={() => handleTabChange('params')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'view'
                ? `border-b-2 ${activeTab === 'params' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`
                : `rounded-t ${activeTab === 'params' ? 'bg-purple-200 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`
            }`}
          >
            Params
          </button>
          <button
            onClick={() => handleTabChange('headers')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'view'
                ? `border-b-2 ${activeTab === 'headers' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`
                : `rounded-t ${activeTab === 'headers' ? 'bg-purple-200 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`
            }`}
          >
            Headers
          </button>
          {method !== 'GET' && method !== 'HEAD' && (
            <button
              onClick={() => handleTabChange('body')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'view'
                  ? `border-b-2 ${activeTab === 'body' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`
                  : `rounded-t ${activeTab === 'body' ? 'bg-purple-200 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`
              }`}
            >
              Body
            </button>
          )}
          <button
            onClick={() => handleTabChange('auth')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'view'
                ? `border-b-2 ${activeTab === 'auth' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`
                : `rounded-t ${activeTab === 'auth' ? 'bg-purple-200 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`
            }`}
          >
            Auth
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className={mode === 'view' ? 'p-4' : 'mb-4'}>
        {/* Params Tab */}
        {activeTab === 'params' && (
          <div>
            {mode === 'view' ? (
              // View mode - show spec parameters
              endpoint.request?.parameters && endpoint.request.parameters.filter((p: any) => p.in === 'query').length > 0 ? (
                <div>
                  <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Query Parameters</h5>
                  <div className="space-y-2">
                    {endpoint.request.parameters.filter((p: any) => p.in === 'query').map((param: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-sm font-mono text-gray-900">{param.name}</code>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{param.type}</span>
                          {param.required && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">required</span>
                          )}
                        </div>
                        {param.description && (
                          <p className="text-xs text-gray-600 mt-1">{param.description}</p>
                        )}
                        {param.example !== undefined && (
                          <div className="mt-2 text-xs">
                            <span className="font-medium text-gray-600">Example:</span>{' '}
                            <code className="text-purple-600">{JSON.stringify(param.example)}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No query parameters</p>
              )
            ) : (
              // Edit mode - editable params
              <div className="space-y-2">
                {Object.entries(params).length > 0 ? (
                  <>
                    {Object.entries(params).map(([key, value], index) => (
                      <div key={`${key}-${index}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          defaultValue={key}
                          onBlur={(e) => {
                            if (e.target.value !== key) {
                              handleUpdateParamKey(key, e.target.value)
                            }
                          }}
                          disabled={readOnly}
                          className={`flex-1 border border-gray-300 rounded px-3 py-2 text-sm ${
                            readOnly ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
                          }`}
                          placeholder="Parameter name"
                        />
                        <div className="flex-1">
                          <VariableInput
                            value={value}
                            onChange={(newValue) => onParamsChange?.({ ...params, [key]: newValue })}
                            variables={selectedEnv?.variables || {}}
                            disabled={readOnly}
                            placeholder="Parameter value"
                          />
                        </div>
                        {isEditable && (
                          <button
                            onClick={() => handleRemoveParam(key)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {isEditable && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Parameter name"
                          value={newParamKey}
                          onChange={(e) => setNewParamKey(e.target.value)}
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                        <div className="flex-1">
                          <VariableInput
                            value={newParamValue}
                            onChange={setNewParamValue}
                            variables={selectedEnv?.variables || {}}
                            placeholder="Parameter value"
                          />
                        </div>
                        <button
                          onClick={handleAddParam}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                          disabled={!newParamKey || !newParamValue}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No parameters defined</p>
                    {isEditable && <p className="text-xs mt-2">Add parameters below</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Headers Tab - Similar structure to params */}
        {activeTab === 'headers' && (
          <div>
            {mode === 'view' ? (
              endpoint.request.parameters?.filter((p: any) => p.in === 'header').length ? (
                <div className="space-y-2">
                  {endpoint.request.parameters.filter((p: any) => p.in === 'header').map((param: any, idx: number) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono text-gray-900">{param.name}</code>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{param.type}</span>
                        {param.required && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">required</span>
                        )}
                      </div>
                      {param.description && (
                        <p className="text-xs text-gray-600 mt-1">{param.description}</p>
                      )}
                      {param.example !== undefined && (
                        <div className="mt-2 text-xs">
                          <span className="font-medium text-gray-600">Example:</span>{' '}
                          <code className="text-purple-600">{JSON.stringify(param.example)}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No headers</p>
              )
            ) : (
              <div className="space-y-2">
                {Object.entries(headers).length > 0 ? (
                  <>
                    {Object.entries(headers).map(([key, value], index) => (
                      <div key={`${key}-${index}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          defaultValue={key}
                          onBlur={(e) => {
                            if (e.target.value !== key) {
                              handleUpdateHeaderKey(key, e.target.value)
                            }
                          }}
                          disabled={readOnly}
                          className={`flex-1 border border-gray-300 rounded px-3 py-2 text-sm ${
                            readOnly ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
                          }`}
                          placeholder="Header name"
                        />
                        <div className="flex-1">
                          <VariableInput
                            value={value}
                            onChange={(newValue) => onHeadersChange?.({ ...headers, [key]: newValue })}
                            variables={selectedEnv?.variables || {}}
                            disabled={readOnly}
                            placeholder="Header value"
                          />
                        </div>
                        {isEditable && (
                          <button
                            onClick={() => handleRemoveHeader(key)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {isEditable && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Header name"
                          value={newHeaderKey}
                          onChange={(e) => setNewHeaderKey(e.target.value)}
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                        <div className="flex-1">
                          <VariableInput
                            value={newHeaderValue}
                            onChange={setNewHeaderValue}
                            variables={selectedEnv?.variables || {}}
                            placeholder="Header value"
                          />
                        </div>
                        <button
                          onClick={handleAddHeader}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                          disabled={!newHeaderKey || !newHeaderValue}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No headers defined</p>
                    {isEditable && <p className="text-xs mt-2">Add headers below</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Body Tab */}
        {activeTab === 'body' && method !== 'GET' && method !== 'HEAD' && (
          <div>
            {mode === 'view' ? (
              // View mode
              endpoint.request?.body ? (
                <div>
                  {endpoint.request.contentType && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Content-Type</span>
                      <div className="mt-1">
                        <span className="text-xs font-mono px-2 py-1 bg-gray-100 text-gray-700 rounded">{endpoint.request.contentType}</span>
                      </div>
                    </div>
                  )}
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
                    <div>
                      <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fields</h5>
                      <div className="space-y-2">
                        {endpoint.request.body.fields.map((field: any, idx: number) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono text-gray-900">{field.name}</code>
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{field.type}</span>
                              {field.format && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">{field.format}</span>
                              )}
                              {field.required && (
                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">required</span>
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {endpoint.request.body.schema && (
                    <SchemaRenderer schema={endpoint.request.body.schema} />
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No request body</p>
              )
            ) : (
              // Edit mode
              <div>
                {contentType.includes('multipart/form-data') ? (
                  // Form data fields
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Form Data</label>
                    {endpoint.request?.body?.fields && endpoint.request.body.fields.length > 0 ? (
                      endpoint.request.body.fields.map((field: any) => (
                        <div key={field.name} className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {field.name}
                            {field.type === 'string' && field.format === 'binary' && (
                              <span className="ml-2 text-xs text-gray-500">(file)</span>
                            )}
                          </label>
                          {field.description && (
                            <p className="text-xs text-gray-500 mb-1">{field.description}</p>
                          )}
                          {(field.type === 'string' && field.format === 'binary') || field.type === 'file' ? (
                            <div className="space-y-2">
                              <input
                                id={`file-upload-${field.name}`}
                                type="file"
                                multiple={field.items !== undefined}
                                onChange={(e) => {
                                  const files = e.target.files
                                  if (files && onFormDataChange) {
                                    if (field.items !== undefined) {
                                      onFormDataChange({ ...formData, [field.name]: Array.from(files) })
                                    } else {
                                      onFormDataChange({ ...formData, [field.name]: files[0] })
                                    }
                                  }
                                }}
                                disabled={readOnly}
                                className="hidden"
                              />
                              <label
                                htmlFor={`file-upload-${field.name}`}
                                className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors ${
                                  readOnly ? 'cursor-not-allowed opacity-50' : ''
                                }`}
                              >
                                <Upload size={20} className="text-gray-600" />
                                <span className="text-sm text-gray-700">
                                  {formData[field.name]
                                    ? (Array.isArray(formData[field.name])
                                        ? `${formData[field.name].length} file(s) selected`
                                        : 'Change file')
                                    : `Choose file${field.items !== undefined ? 's' : ''}`}
                                </span>
                              </label>
                              {formData[field.name] && (typeof formData[field.name] === 'object' && 'name' in formData[field.name]) && (
                                <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                                  <File size={16} className="text-purple-600" />
                                  <span className="text-sm text-gray-700 flex-1">{formData[field.name].name}</span>
                                  <span className="text-xs text-gray-500">{(formData[field.name].size / 1024).toFixed(1)} KB</span>
                                  {isEditable && (
                                    <button
                                      onClick={() => onFormDataChange?.({ ...formData, [field.name]: null })}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <VariableInput
                              value={formData[field.name] || ''}
                              onChange={(value) => onFormDataChange?.({ ...formData, [field.name]: value })}
                              variables={selectedEnv?.variables || {}}
                              disabled={readOnly}
                              placeholder={`Enter ${field.name}${field.description ? ` - ${field.description}` : ''}`}
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No form fields defined</p>
                    )}
                  </div>
                ) : (
                  // JSON body
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Request Body (JSON)</label>
                      {isEditable && body.trim() && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleBeautify}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="Format JSON"
                          >
                            <Sparkles size={14} />
                            Beautify
                          </button>
                          <button
                            onClick={handleMinify}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Minify JSON"
                          >
                            <Minimize2 size={14} />
                            Minify
                          </button>
                        </div>
                      )}
                    </div>
                    <VariableInput
                      value={body}
                      onChange={(value) => onBodyChange?.(value)}
                      variables={selectedEnv?.variables || {}}
                      disabled={readOnly}
                      placeholder='{"key": "value"}'
                      multiline={true}
                      rows={8}
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
    </>
  )
}
