import {useState} from 'react'
import {File, Upload, X} from 'lucide-react'
import VariableInput from './VariableInput'
import SchemaRenderer from './SchemaRenderer'
import FieldEditor, {Field} from './FieldEditor'

interface RequestSpecificationTabsProps {
  endpoint: any
  mode: 'view' | 'edit'
  // Edit mode props
  headers?: Record<string, string>
  params?: Record<string, string>
  body?: string
  formData?: Record<string, any>
  queryParams?: Field[]
  headerParams?: Field[]
  bodyFields?: Field[]
  onHeadersChange?: (headers: Record<string, string>) => void
  onParamsChange?: (params: Record<string, string>) => void
  onBodyChange?: (body: string) => void
  onFormDataChange?: (formData: Record<string, any>) => void
  onQueryParamsChange?: (params: Field[]) => void
  onHeaderParamsChange?: (headers: Field[]) => void
  onBodyFieldsChange?: (fields: Field[]) => void
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
  formData = {},
  queryParams = [],
  headerParams = [],
  bodyFields = [],
  onFormDataChange,
  onQueryParamsChange,
  onHeaderParamsChange,
  onBodyFieldsChange,
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

  const isEditable = mode === 'edit' && !readOnly

  const method = endpoint.method || 'GET'
  const contentType = mode === 'edit' ? (headers['Content-Type'] || 'application/json') : (endpoint.request?.contentType || 'application/json')

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
              <FieldEditor
                fields={endpoint.request?.parameters?.filter((p: any) => p.in === 'query') || []}
                mode="view"
                title="Query Parameters"
                emptyMessage="No query parameters"
              />
            ) : (
              // Edit mode - editable params using FieldEditor
              <FieldEditor
                fields={queryParams}
                onFieldsChange={onQueryParamsChange}
                mode="edit"
                title="Query Parameters"
                emptyMessage="No parameters defined"
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
                  <FieldEditor
                    fields={endpoint.request.parameters.filter((p: any) => p.in === 'header')}
                    mode="view"
                    title="Headers"
                    emptyMessage="No headers"
                  />
                ) : !endpoint.request?.contentType && (
                  <p className="text-sm text-gray-500 italic">No headers</p>
                )}
              </div>
            ) : (
              // Edit mode - editable headers using FieldEditor
              <FieldEditor
                fields={headerParams}
                onFieldsChange={onHeaderParamsChange}
                mode="edit"
                title="Headers"
                emptyMessage="No headers defined"
              />
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
                    <FieldEditor
                      fields={endpoint.request.body.fields}
                      mode="view"
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
                  // JSON body - Use FieldEditor for editing structure
                  <div>
                    <FieldEditor
                      fields={bodyFields}
                      onFieldsChange={onBodyFieldsChange}
                      mode={mode}
                      title="Body Fields"
                      emptyMessage="No body fields defined"
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
