/**
 * Variable Extraction Editor
 * UI for configuring variable extraction from HTTP responses
 */

import {useState} from 'react'
import type {VariableExtraction} from '@/types/database'
import {X, Edit2, CheckCircle2, XCircle} from 'lucide-react'

interface VariableExtractionEditorProps {
  extractions: VariableExtraction[]
  onExtractionsChange: (extractions: VariableExtraction[]) => void
  mode: 'view' | 'edit'
  extractedValues?: Record<string, any> // Show extracted values after execution
}

export default function VariableExtractionEditor({
  extractions,
  onExtractionsChange,
  mode,
  extractedValues
}: VariableExtractionEditorProps) {
  // Local state for editing (match Assertions pattern)
  const [showExtractionForm, setShowExtractionForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [newExtraction, setNewExtraction] = useState<VariableExtraction>({
    name: '',
    source: 'response-body',
    path: '',
    defaultValue: undefined,
  })

  // Apply changes (add or update extraction)
  const handleApply = () => {
    if (editingIndex !== null) {
      // Update existing extraction
      const updated = [...extractions]
      updated[editingIndex] = newExtraction
      onExtractionsChange(updated)
    } else {
      // Add new extraction
      onExtractionsChange([...extractions, newExtraction])
    }
    handleCancel()
  }

  // Cancel editing
  const handleCancel = () => {
    setShowExtractionForm(false)
    setEditingIndex(null)
    setNewExtraction({
      name: '',
      source: 'response-body',
      path: '',
      defaultValue: undefined,
    })
  }

  // Start editing existing extraction
  const handleEdit = (index: number) => {
    setNewExtraction(extractions[index])
    setEditingIndex(index)
    setShowExtractionForm(true)
  }

  // Update form fields (don't save immediately)
  const handleFormUpdate = (updates: Partial<VariableExtraction>) => {
    setNewExtraction(prev => ({ ...prev, ...updates }))
  }

  const handleDelete = (index: number) => {
    onExtractionsChange(extractions.filter((_, i) => i !== index))
  }

  const hasExecuted = extractedValues !== undefined

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            {hasExecuted && extractions.length > 0 && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                {Object.keys(extractedValues || {}).length}/{extractions.length}
              </span>
            )}
            Extract Variables
          </h3>
          <p className="text-xs text-gray-600 mt-1">
            Extract values from the response to use in subsequent steps
          </p>
        </div>
      </div>

      {extractions.length === 0 && !showExtractionForm && (
        <p className="text-sm text-gray-500 italic">No variable extractions configured</p>
      )}

      {/* Display existing extractions */}
      {extractions.map((extraction, index) => {
        const wasExtracted = extractedValues?.[extraction.name] !== undefined
        const extractionFailed = hasExecuted && !wasExtracted

        return (
          <div
            key={index}
            className={`border rounded-lg p-3 ${
              wasExtracted ? 'border-green-300 bg-green-50' :
              extractionFailed ? 'border-red-300 bg-red-50' :
              'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-purple-600">
                  {extraction.name}
                </code>

                {wasExtracted && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    <CheckCircle2 size={12} />
                    Extracted
                  </span>
                )}

                {extractionFailed && (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                    <XCircle size={12} />
                    Failed
                  </span>
                )}
              </div>

              {mode === 'edit' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(index)}
                    className="text-gray-400 hover:text-purple-600 p-1"
                    title="Edit extraction"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Remove extraction"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Show extraction details */}
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-medium">From:</span> {
                  extraction.source === 'response-body' ? 'Response Body (JSONPath)' :
                  extraction.source === 'response-header' ? 'Response Header' :
                  extraction.source === 'status-code' ? 'Status Code' :
                  'Response Time (ms)'
                }
              </div>
              {extraction.path && (
                <div>
                  <span className="font-medium">Path:</span>{' '}
                  <code className="bg-white px-1 rounded">{extraction.path}</code>
                </div>
              )}
              {extraction.headerName && (
                <div>
                  <span className="font-medium">Header:</span>{' '}
                  <code className="bg-white px-1 rounded">{extraction.headerName}</code>
                </div>
              )}
            </div>

            {/* Show extracted value */}
            {wasExtracted && (
              <div className="mt-2 text-xs">
                <span className="font-medium text-gray-700">Value:</span>{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-green-300">
                  {JSON.stringify(extractedValues![extraction.name])}
                </code>
              </div>
            )}

            {extractionFailed && (
              <div className="mt-2 text-xs text-red-600">
                Failed to extract - check your JSONPath or header name
              </div>
            )}
          </div>
        )
      })}

      {/* Edit/Add Extraction Form */}
      {showExtractionForm && (
        <div className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            {editingIndex !== null ? 'Edit Extraction' : 'Add Extraction'}
          </h4>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Variable Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Variable Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newExtraction.name}
                onChange={(e) => handleFormUpdate({ name: e.target.value })}
                placeholder="userId"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Extract From <span className="text-red-500">*</span>
              </label>
              <select
                value={newExtraction.source}
                onChange={(e) => handleFormUpdate({ source: e.target.value as any })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="response-body">Response Body (JSONPath)</option>
                <option value="response-header">Response Header</option>
                <option value="status-code">Status Code</option>
                <option value="response-time">Response Time (ms)</option>
              </select>
            </div>

            {/* JSONPath (if source is response-body) */}
            {newExtraction.source === 'response-body' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  JSONPath Expression <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newExtraction.path || ''}
                  onChange={(e) => handleFormUpdate({ path: e.target.value })}
                  placeholder="$.data.name"
                  className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Examples: <code className="bg-white px-1 rounded">$.data.user.id</code>,{' '}
                  <code className="bg-white px-1 rounded">$.items[0].name</code>,{' '}
                  <code className="bg-white px-1 rounded">$.results.token</code>
                </p>
              </div>
            )}

            {/* Header Name (if source is response-header) */}
            {newExtraction.source === 'response-header' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Header Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newExtraction.headerName || ''}
                  onChange={(e) => handleFormUpdate({ headerName: e.target.value })}
                  placeholder="X-Auth-Token"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Common examples: Authorization, X-Auth-Token, Set-Cookie, Location
                </p>
              </div>
            )}

            {/* Transform */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Transform
              </label>
              <select
                value={newExtraction.transform || ''}
                onChange={(e) => handleFormUpdate({ transform: (e.target.value || undefined) as any })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">None</option>
                <option value="to-string">To String</option>
                <option value="to-number">To Number</option>
                <option value="to-boolean">To Boolean</option>
                <option value="to-json">Parse JSON</option>
              </select>
            </div>

            {/* Default Value */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Default Value
              </label>
              <input
                type="text"
                value={newExtraction.defaultValue || ''}
                onChange={(e) => handleFormUpdate({ defaultValue: e.target.value || undefined })}
                placeholder="(optional)"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Apply/Cancel Buttons */}
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Apply
            </button>
          </div>

          <p className="text-xs text-gray-600 mt-2">
            Click <strong>Save</strong> button above to persist changes
          </p>
        </div>
      )}

      {/* Add Button */}
      {mode === 'edit' && !showExtractionForm && (
        <button
          onClick={() => setShowExtractionForm(true)}
          className="w-full px-3 py-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
        >
          + Add Variable Extraction
        </button>
      )}
    </div>
  )
}
