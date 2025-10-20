/**
 * Variable Extraction Editor
 * UI for configuring variable extraction from HTTP responses
 */

import type {VariableExtraction} from '@/types/database'
import {X} from 'lucide-react'

interface VariableExtractionEditorProps {
  extractions: VariableExtraction[]
  onExtractionsChange: (extractions: VariableExtraction[]) => void
  mode: 'view' | 'edit'
}

export default function VariableExtractionEditor({
  extractions,
  onExtractionsChange,
  mode
}: VariableExtractionEditorProps) {
  const handleAdd = () => {
    onExtractionsChange([
      ...extractions,
      {
        name: '',
        source: 'response-body',
        path: '',
        defaultValue: undefined,
      }
    ])
  }

  const handleUpdate = (index: number, updates: Partial<VariableExtraction>) => {
    const updated = [...extractions]
    updated[index] = { ...updated[index], ...updates }
    onExtractionsChange(updated)
  }

  const handleDelete = (index: number) => {
    onExtractionsChange(extractions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Extract Variables</h3>
          <p className="text-xs text-gray-600 mt-1">
            Extract values from the response to use in subsequent steps
          </p>
        </div>
      </div>

      {extractions.length === 0 && mode === 'view' && (
        <p className="text-sm text-gray-500 italic">No variable extractions configured</p>
      )}

      {extractions.map((extraction, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-700">
              Extraction {index + 1}
            </h4>
            {mode === 'edit' && (
              <button
                onClick={() => handleDelete(index)}
                className="text-gray-400 hover:text-red-600"
                title="Remove extraction"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Variable Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Variable Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={extraction.name}
                onChange={(e) => handleUpdate(index, { name: e.target.value })}
                placeholder="userId"
                disabled={mode === 'view'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Extract From <span className="text-red-500">*</span>
              </label>
              <select
                value={extraction.source}
                onChange={(e) => handleUpdate(index, { source: e.target.value as any })}
                disabled={mode === 'view'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
              >
                <option value="response-body">Response Body (JSONPath)</option>
                <option value="response-header">Response Header</option>
                <option value="status-code">Status Code</option>
                <option value="response-time">Response Time (ms)</option>
              </select>
            </div>

            {/* JSONPath (if source is response-body) */}
            {extraction.source === 'response-body' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  JSONPath Expression <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={extraction.path || ''}
                  onChange={(e) => handleUpdate(index, { path: e.target.value })}
                  placeholder="$.data.id"
                  disabled={mode === 'view'}
                  className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Examples: <code className="bg-gray-100 px-1 rounded">$.data.user.id</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">$.items[0].name</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">$.results.token</code>
                </p>
              </div>
            )}

            {/* Header Name (if source is response-header) */}
            {extraction.source === 'response-header' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Header Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={extraction.headerName || ''}
                  onChange={(e) => handleUpdate(index, { headerName: e.target.value })}
                  placeholder="X-Auth-Token"
                  disabled={mode === 'view'}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
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
                value={extraction.transform || ''}
                onChange={(e) => handleUpdate(index, { transform: (e.target.value || undefined) as any })}
                disabled={mode === 'view'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
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
                value={extraction.defaultValue || ''}
                onChange={(e) => handleUpdate(index, { defaultValue: e.target.value || undefined })}
                placeholder="(optional)"
                disabled={mode === 'view'}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>
      ))}

      {mode === 'edit' && (
        <button
          onClick={handleAdd}
          className="w-full px-3 py-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
        >
          + Add Variable Extraction
        </button>
      )}
    </div>
  )
}
