import {Plus, X} from 'lucide-react'
import {useState} from 'react'
import SchemaViewer from './SchemaViewer'
import SchemaEditor from './SchemaEditor'
import type {Field} from './SchemaEditor'

interface ResponseSpec {
  status?: string | number
  description?: string
  contentType?: string
  example?: any
  fields?: Field[]
}

interface ErrorResponse {
  status?: string | number
  reason?: string
  example?: any
}

interface ResponseSpecificationEditorProps {
  responses?: {
    success?: ResponseSpec
    errors?: ErrorResponse[]
  }
  onResponsesChange?: (responses: any) => void
  mode: 'view' | 'edit'
}

// Unified response for internal state
interface UnifiedResponse {
  id: string // temp ID for React keys
  status: string | number
  description: string
  contentType: string
  fields?: Field[]
}

export default function ResponseSpecificationEditor({
  responses,
  onResponsesChange,
  mode
}: ResponseSpecificationEditorProps) {
  const isEditable = mode === 'edit'

  // Convert incoming responses to unified format for editing
  const getUnifiedResponses = (): UnifiedResponse[] => {
    const unified: UnifiedResponse[] = []

    // Add success response
    if (responses?.success || isEditable) {
      unified.push({
        id: 'success',
        status: responses?.success?.status ?? '200',
        description: responses?.success?.description || 'Success',
        contentType: responses?.success?.contentType || 'application/json',
        fields: responses?.success?.fields || []
      })
    }

    // Add error responses
    if (responses?.errors) {
      responses.errors.forEach((error, idx) => {
        unified.push({
          id: `error-${idx}`,
          status: error.status ?? '400',
          description: error.reason || 'Error',
          contentType: 'application/json', // errors typically JSON
          fields: []
        })
      })
    }

    return unified
  }

  const [unifiedResponses, setUnifiedResponses] = useState<UnifiedResponse[]>(getUnifiedResponses())

  // Update parent when unified responses change
  const syncToParent = (newUnified: UnifiedResponse[]) => {
    if (!onResponsesChange) return

    // Convert back to original format
    const success = newUnified.find(r => r.id === 'success')
    const errors = newUnified
      .filter(r => r.id.startsWith('error-'))
      .map(r => ({
        status: r.status,
        reason: r.description,
        example: undefined
      }))

    onResponsesChange({
      success: success ? {
        status: success.status,
        description: success.description,
        contentType: success.contentType,
        fields: success.fields
      } : undefined,
      errors: errors.length > 0 ? errors : undefined
    })
  }

  const handleUpdateResponse = (id: string, updates: Partial<UnifiedResponse>) => {
    const newUnified = unifiedResponses.map(r =>
      r.id === id ? { ...r, ...updates } : r
    )
    setUnifiedResponses(newUnified)
    syncToParent(newUnified)
  }

  const handleAddResponse = () => {
    const newId = `response-${Date.now()}`
    const newResponse: UnifiedResponse = {
      id: newId,
      status: '400',
      description: 'New Response',
      contentType: 'application/json',
      fields: []
    }
    const newUnified = [...unifiedResponses, newResponse]
    setUnifiedResponses(newUnified)
    syncToParent(newUnified)
  }

  const handleRemoveResponse = (id: string) => {
    // Don't allow removing the success response
    if (id === 'success') return

    const newUnified = unifiedResponses.filter(r => r.id !== id)
    setUnifiedResponses(newUnified)
    syncToParent(newUnified)
  }

  // Get status code color based on value
  const getStatusCodeColor = (status?: string | number) => {
    const statusStr = String(status || '')
    if (!statusStr || statusStr.trim() === '') return 'bg-gray-100 text-gray-700 border-gray-300'

    const code = Number(statusStr)
    if (isNaN(code)) return 'bg-gray-100 text-gray-700 border-gray-300'

    if (code >= 100 && code < 200) return 'bg-blue-100 text-blue-700 border-blue-300'
    if (code >= 200 && code < 300) return 'bg-green-100 text-green-700 border-green-300'
    if (code >= 300 && code < 400) return 'bg-purple-100 text-purple-700 border-purple-300'
    if (code >= 400 && code < 500) return 'bg-orange-100 text-orange-700 border-orange-300'
    if (code >= 500 && code < 600) return 'bg-red-100 text-red-700 border-red-300'
    return 'bg-gray-100 text-gray-700 border-gray-300'
  }

  const renderResponseSection = (response: UnifiedResponse) => {
    const contentType = response.contentType || 'application/json'
    const canRemove = response.id !== 'success'

    return (
      <div key={response.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Response Header - Status and Description */}
        {isEditable ? (
          <div className="bg-white">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {/* Status Code Input */}
                <input
                  type="text"
                  value={response.status}
                  onChange={(e) => handleUpdateResponse(response.id, { status: e.target.value })}
                  className={`w-16 px-2 py-1.5 rounded text-xs font-bold border-2 ${getStatusCodeColor(response.status)} text-center flex-shrink-0`}
                  placeholder="200"
                />
                {/* Description Input */}
                <input
                  type="text"
                  value={response.description}
                  onChange={(e) => handleUpdateResponse(response.id, { description: e.target.value })}
                  className="flex-1 text-sm font-medium text-gray-900 bg-gray-50 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Response description"
                />
                {/* Content Type Select */}
                <select
                  value={response.contentType}
                  onChange={(e) => handleUpdateResponse(response.id, { contentType: e.target.value })}
                  className="text-xs font-mono px-3 py-2 bg-gray-50 text-gray-700 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 flex-shrink-0"
                >
                  <option value="application/json">application/json</option>
                  <option value="application/xml">application/xml</option>
                  <option value="text/plain">text/plain</option>
                  <option value="text/html">text/html</option>
                  <option value="application/pdf">application/pdf</option>
                  <option value="application/octet-stream">application/octet-stream</option>
                </select>
                {/* Remove Button */}
                {canRemove && (
                  <button
                    onClick={() => handleRemoveResponse(response.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                    title="Remove response"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-md text-xs font-bold ${getStatusCodeColor(response.status)} shadow-sm`}>
                {String(response.status)}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {response.description}
              </span>
            </div>
            {response.contentType && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Content-Type:</span>
                <code className="text-xs font-mono text-purple-600">{response.contentType}</code>
              </div>
            )}
          </div>
        )}

        <div className="p-4 bg-white">{/* Removed duplicate Content-Type in View Mode - now shown in header */}

          {/* Content Type Specific Rendering */}
          {(() => {
            // Structured formats - show field editor
            if (contentType === 'application/json' || contentType === 'application/xml') {
              return (
                <>
                  {/* Content Type Info in Edit Mode */}
                  {isEditable && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-600">
                        {contentType === 'application/json' && '📝 Define JSON response structure with field types, validation, and documentation'}
                        {contentType === 'application/xml' && '📄 Define XML response structure - fields represent XML elements/attributes'}
                      </p>
                    </div>
                  )}

                  {/* Fields */}
                  {mode === 'view' ? (
                    <SchemaViewer
                      fields={response.fields || []}
                      title="Fields"
                      emptyMessage="No fields defined"
                    />
                  ) : (
                    <SchemaEditor
                      fields={response.fields || []}
                      onChange={(fields) => handleUpdateResponse(response.id, { fields })}
                      title="Fields"
                      emptyMessage="No fields defined"
                      context="body-json"
                    />
                  )}
                </>
              )
            }

            // Binary formats - no field editor
            if (contentType === 'application/pdf' || contentType === 'application/octet-stream') {
              return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Binary Response</strong>
                  </p>
                  <p className="text-xs text-gray-600">
                    {contentType === 'application/pdf'
                      ? '📄 PDF file response - field definitions not applicable for binary content'
                      : '📦 Binary file response - field definitions not applicable for binary content'}
                  </p>
                  {isEditable && (
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Consider documenting file size limits, download headers, and content-disposition in the description
                    </p>
                  )}
                </div>
              )
            }

            // Plain text/HTML formats - no field editor
            if (contentType === 'text/plain' || contentType === 'text/html') {
              return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>{contentType === 'text/html' ? 'HTML' : 'Plain Text'} Response</strong>
                  </p>
                  <p className="text-xs text-gray-600">
                    {contentType === 'text/html'
                      ? '📄 HTML content response - field definitions not applicable for HTML markup'
                      : '📄 Plain text content response - field definitions not applicable for unstructured text'}
                  </p>
                  {isEditable && (
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Consider providing example text content in the response description
                    </p>
                  )}
                </div>
              )
            }

            // Default: show field editor for unknown types
            return (
              <>
                {isEditable && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-600">
                      🔧 Custom content type - define response structure using fields below
                    </p>
                  </div>
                )}

                {mode === 'view' ? (
                  <SchemaViewer
                    fields={response.fields || []}
                    title="Fields"
                    emptyMessage="No fields defined"
                  />
                ) : (
                  <SchemaEditor
                    fields={response.fields || []}
                    onChange={(fields) => handleUpdateResponse(response.id, { fields })}
                    title="Fields"
                    emptyMessage="No fields defined"
                    context="body-json"
                  />
                )}
              </>
            )
          })()}
        </div>
      </div>
    )
  }

  return (
    <div>
      {unifiedResponses.length > 0 ? (
        <div className="space-y-4">
          {unifiedResponses.map(renderResponseSection)}

          {/* Add Response Button - Edit Mode Only */}
          {isEditable && (
            <button
              onClick={handleAddResponse}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 group shadow-sm hover:shadow"
            >
              <Plus size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-semibold">Add Response</span>
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500 mb-3">No response specifications defined</p>
          {isEditable && (
            <button
              onClick={handleAddResponse}
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm hover:shadow-md font-medium text-sm"
            >
              <Plus size={16} className="inline mr-2" />
              Add First Response
            </button>
          )}
        </div>
      )}
    </div>
  )
}
