import {useEffect, useState} from 'react'
import {Save, X} from 'lucide-react'
import type {Endpoint} from '@/types/database'
import {updateEndpoint} from '@/lib/api/endpoints'
import ParametersEditor from './ParametersEditor'
import BodyFieldsEditor from './BodyFieldsEditor'

interface EndpointEditorProps {
  endpoint: Endpoint
  onSave: () => void
  onCancel: () => void
  renderButtons?: (props: { onSave: () => void; onCancel: () => void; isSaving: boolean; hasUnsavedChanges: boolean }) => React.ReactNode
}

export default function EndpointEditor({endpoint, onSave, onCancel}: EndpointEditorProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params')

  // Form state (method, path, operationId are read-only from endpoint)
  const [name, setName] = useState(endpoint.name || '')
  const [description, setDescription] = useState(endpoint.description || '')
  const [parameters, setParameters] = useState(endpoint.request?.parameters || [])
  const [contentType, setContentType] = useState(endpoint.request?.contentType || 'application/json')
  const [bodyDescription, setBodyDescription] = useState(endpoint.request?.body?.description || '')
  const [bodyExample, setBodyExample] = useState(
    endpoint.request?.body?.example ? JSON.stringify(endpoint.request.body.example, null, 2) : ''
  )
  const [bodyFields, setBodyFields] = useState(endpoint.request?.body?.fields || [])

  // Reset state when endpoint changes
  useEffect(() => {
    console.warn('═══════════════════════════════════════════')
    console.warn(`[Endpoint Editor] LOADING ${endpoint.method} ${endpoint.path}`)
    console.warn('  request.body.description:', endpoint.request?.body?.description)
    console.warn('═══════════════════════════════════════════')

    setName(endpoint.name || '')
    setDescription(endpoint.description || '')
    setParameters(endpoint.request?.parameters || [])
    setContentType(endpoint.request?.contentType || 'application/json')
    setBodyDescription(endpoint.request?.body?.description || '')
    setBodyExample(
      endpoint.request?.body?.example ? JSON.stringify(endpoint.request.body.example, null, 2) : ''
    )
    setBodyFields(endpoint.request?.body?.fields || [])
    setActiveTab('params') // Reset to params tab
    setHasUnsavedChanges(false)
    setError(null)
  }, [endpoint.id]) // Only reset when endpoint ID changes

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Separate parameters by type
  const queryParams = parameters.filter(p => p.in === 'query')
  const pathParams = parameters.filter(p => p.in === 'path')
  const headerParams = parameters.filter(p => p.in === 'header')
  const cookieParams = parameters.filter(p => p.in === 'cookie')

  // Track changes (excluding read-only fields: method, path, operationId)
  // Use useEffect to automatically detect changes when state updates
  useEffect(() => {
    const changed =
      name !== (endpoint.name || '') ||
      description !== (endpoint.description || '') ||
      contentType !== (endpoint.request?.contentType || 'application/json') ||
      bodyDescription !== (endpoint.request?.body?.description || '') ||
      bodyExample !== (endpoint.request?.body?.example ? JSON.stringify(endpoint.request.body.example, null, 2) : '') ||
      JSON.stringify(parameters) !== JSON.stringify(endpoint.request?.parameters || []) ||
      JSON.stringify(bodyFields) !== JSON.stringify(endpoint.request?.body?.fields || [])

    setHasUnsavedChanges(changed)
  }, [name, description, contentType, bodyDescription, bodyExample, parameters, bodyFields, endpoint])

  // Handlers for parameter changes
  const handleQueryParamsChange = (newParams: any[]) => {
    const updated = [...headerParams, ...pathParams, ...cookieParams, ...newParams]
    setParameters(updated)
  }

  const handleHeaderParamsChange = (newParams: any[]) => {
    const updated = [...queryParams, ...pathParams, ...cookieParams, ...newParams]
    setParameters(updated)
  }

  const handleContentTypeChange = (value: string) => {
    setContentType(value)
  }

  const handleBodyExampleChange = (value: string) => {
    setBodyExample(value)
  }

  const handleBodyFieldsChange = (fields: any[]) => {
    setBodyFields(fields)
  }

  const handleSave = async () => {
    console.warn('🔴🔴🔴 [Endpoint Editor] SAVE BUTTON CLICKED 🔴🔴🔴')
    console.warn(`  Endpoint: ${endpoint.method} ${endpoint.path}`)
    console.warn(`  Current body description: ${endpoint.request?.body?.description}`)

    setError(null)
    setIsSaving(true)

    try {
      // Parse body example based on content type
      let bodyData = null
      if (bodyExample.trim()) {
        if (contentType === 'application/json') {
          // Parse as JSON
          try {
            bodyData = JSON.parse(bodyExample)
          } catch {
            throw new Error('Invalid JSON in body example')
          }
        } else {
          // For XML, plain text, or other types - store as-is
          bodyData = bodyExample
        }
      }

      // Prepare update data - ONLY update edited fields, preserve everything else
      const updates = {
        name,
        description,
        request: {
          ...endpoint.request,
          parameters,
          contentType,
          // Always preserve body if it exists, never set to undefined
          body: endpoint.request?.body ? {
            ...endpoint.request.body, // Preserve ALL existing body fields first
            required: endpoint.request.body.required, // Preserve original required value
            example: bodyData !== null ? bodyData : endpoint.request.body.example, // Only update if edited
            fields: bodyFields, // Update fields
            description: bodyDescription, // Update description (can be empty string)
          } : (bodyData || bodyFields.length > 0 || bodyDescription ? {
            // Create new body only if one doesn't exist and user added content
            required: true,
            example: bodyData,
            fields: bodyFields,
            description: bodyDescription,
          } : undefined)
        },
        updatedAt: new Date(), // Set timestamp
      }

      // Save to database
      if (!endpoint.id) {
        throw new Error('Endpoint ID is required')
      }

      console.warn('═══════════════════════════════════════════')
      console.warn(`[Endpoint Editor] SAVING ${endpoint.method} ${endpoint.path}`)
      console.warn('  request.body.description:', updates.request.body?.description)
      console.warn('═══════════════════════════════════════════')

      await updateEndpoint(endpoint.id, updates)
      setHasUnsavedChanges(false)
      onSave()
    } catch (err: any) {
      setError(err.message || 'Failed to save endpoint')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return
      }
    }
    onCancel()
  }

  return (
    <div className="space-y-6">
      {/* Header with Save/Cancel */}
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Edit Endpoint</h3>
          <p className="text-sm text-gray-600 mt-1">
            Modify endpoint definition for future test generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Request Specification Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('params')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'params'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Params
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'headers'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Headers
          </button>
          <button
            onClick={() => setActiveTab('body')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'body'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Body
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'auth'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Auth
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Params Tab */}
          {activeTab === 'params' && (
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900">Query & Path Parameters</h4>
              <ParametersEditor
                parameters={[...queryParams, ...pathParams]}
                onChange={handleQueryParamsChange}
              />
            </div>
          )}

          {/* Headers Tab */}
          {activeTab === 'headers' && (
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900">Header Parameters</h4>

              {/* Content-Type Selection */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content-Type
                </label>
                <select
                  value={contentType}
                  onChange={(e) => handleContentTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="application/json">application/json</option>
                  <option value="application/xml">application/xml</option>
                  <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  <option value="multipart/form-data">multipart/form-data</option>
                  <option value="text/plain">text/plain</option>
                </select>
                <p className="text-xs text-gray-600 mt-2">
                  Defines the format of the request body
                </p>
              </div>

              <ParametersEditor
                parameters={headerParams}
                onChange={handleHeaderParamsChange}
              />
            </div>
          )}

          {/* Body Tab */}
          {activeTab === 'body' && (
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900">Request Body</h4>

              {/* Content Type Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">Content-Type:</span>
                  <code className="text-sm text-purple-600 font-mono">{contentType}</code>
                </div>
                <p className="text-xs text-gray-600">
                  {contentType === 'application/json' && '📝 JSON request body - define example and field schema below'}
                  {contentType === 'multipart/form-data' && '📤 Form data with file upload support - use fields to define structure'}
                  {contentType === 'application/x-www-form-urlencoded' && '📋 URL-encoded form data - use fields to define structure'}
                  {contentType === 'application/xml' && '📄 XML request body - define raw XML example below'}
                  {contentType === 'text/plain' && '📄 Plain text request body - define raw text example below'}
                  {!['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded', 'application/xml', 'text/plain'].includes(contentType) &&
                    `Custom content type - configure in Headers tab`}
                </p>
              </div>

              {/* Body Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Body Description
                </label>
                <textarea
                  value={bodyDescription}
                  onChange={(e) => setBodyDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  placeholder="Describe what this request body represents (e.g., User object, Pet data)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional description of the request body purpose
                </p>
              </div>

              {/* Body Example - Content Type Specific */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Body Example
                </label>

                {/* JSON: Show textarea with formatter */}
                {contentType === 'application/json' && (
                  <div>
                    <textarea
                      value={bodyExample}
                      onChange={(e) => handleBodyExampleChange(e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm bg-gray-50"
                      placeholder={'{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter valid JSON for the request body example
                    </p>
                  </div>
                )}

                {/* Form Data: Info message */}
                {(contentType === 'multipart/form-data' || contentType === 'application/x-www-form-urlencoded') && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Form data structure is defined using the <strong>Body Fields Schema</strong> below.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Add fields to define form parameters. Use type "file" for file uploads with multipart/form-data.
                    </p>
                  </div>
                )}

                {/* XML/Plain Text: Show textarea */}
                {(contentType === 'application/xml' || contentType === 'text/plain') && (
                  <div>
                    <textarea
                      value={bodyExample}
                      onChange={(e) => handleBodyExampleChange(e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm bg-gray-50"
                      placeholder={contentType === 'application/xml'
                        ? '<?xml version="1.0"?>\n<root>\n  <item>value</item>\n</root>'
                        : 'Enter plain text content...'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter raw {contentType === 'application/xml' ? 'XML' : 'text'} content
                    </p>
                  </div>
                )}

                {/* Other content types */}
                {!['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded', 'application/xml', 'text/plain'].includes(contentType) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Custom content type detected. Use the <strong>Body Fields Schema</strong> below to define structure.
                    </p>
                  </div>
                )}
              </div>

              {/* Body Fields Schema - Always visible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Body Fields Schema
                </label>
                <BodyFieldsEditor
                  fields={bodyFields}
                  onChange={handleBodyFieldsChange}
                />
                <p className="text-xs text-gray-500 mt-2">
                  {contentType === 'application/json' && 'Define JSON object structure with field types, validation, and documentation'}
                  {contentType === 'multipart/form-data' && 'Define form fields including text inputs and file uploads (use type "file")'}
                  {contentType === 'application/x-www-form-urlencoded' && 'Define form parameters with their types and validation rules'}
                  {!['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'].includes(contentType) &&
                    'Define field structure and validation rules for request body'}
                </p>
              </div>
            </div>
          )}

          {/* Auth Tab */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900">Authentication</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  Authentication configuration coming soon. You can currently set auth headers in the Headers tab.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
