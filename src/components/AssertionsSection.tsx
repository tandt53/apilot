import {useState} from 'react'
import {CheckCircle2, Edit2, Plus, X} from 'lucide-react'
import VariableHighlight from './VariableHighlight'
import VariableInput from './VariableInput'
import {hasVariables} from '@/lib/utils/variableSubstitution'

interface Assertion {
  type: string
  field: string
  operator: string
  expected: any
  description?: string
}

interface AssertionsSectionProps {
  assertions: Assertion[]
  onAssertionsChange?: (assertions: Assertion[]) => void
  readOnly?: boolean
  selectedEnv?: any
}

export default function AssertionsSection({
  assertions,
  onAssertionsChange,
  readOnly = false,
  selectedEnv
}: AssertionsSectionProps) {
  const [showAssertionForm, setShowAssertionForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [newAssertion, setNewAssertion] = useState<Assertion>({
    type: 'status',
    field: 'status',
    operator: '==',
    expected: 200,
  })

  const handleAddAssertion = () => {
    if (onAssertionsChange) {
      if (editingIndex !== null) {
        // Update existing assertion
        const updated = [...assertions]
        updated[editingIndex] = newAssertion
        onAssertionsChange(updated)
        setEditingIndex(null)
      } else {
        // Add new assertion
        onAssertionsChange([...assertions, newAssertion])
      }
      setNewAssertion({
        type: 'status',
        field: 'status',
        operator: '==',
        expected: 200,
      })
      setShowAssertionForm(false)
    }
  }

  const handleEditAssertion = (index: number) => {
    setNewAssertion(assertions[index])
    setEditingIndex(index)
    setShowAssertionForm(true)
  }

  const handleRemoveAssertion = (index: number) => {
    if (onAssertionsChange) {
      onAssertionsChange(assertions.filter((_, i) => i !== index))
    }
  }

  const handleCancelEdit = () => {
    setShowAssertionForm(false)
    setEditingIndex(null)
    setNewAssertion({
      type: 'status',
      field: 'status',
      operator: '==',
      expected: 200,
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-purple-600" />
            Assertions
          </h3>
          {!readOnly && editingIndex === null && (
            <button
              onClick={() => setShowAssertionForm(true)}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Add Assertion"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {assertions.length > 0 ? (
          <div className="space-y-2">
            {assertions.map((assertion, index) => {
              const fieldHasVars = assertion.field && hasVariables(String(assertion.field))
              const expectedHasVars = assertion.expected !== undefined && hasVariables(String(assertion.expected))

              return (
                <div key={index} className="space-y-1">
                  {editingIndex === index ? (
                    /* Inline Edit Form */
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">Edit Assertion</h4>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                          <select
                            value={newAssertion.type}
                            onChange={(e) => setNewAssertion({ ...newAssertion, type: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          >
                            <option value="status">Status Code</option>
                            <option value="body">Response Body</option>
                            <option value="header">Response Header</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Operator</label>
                          <select
                            value={newAssertion.operator}
                            onChange={(e) => setNewAssertion({ ...newAssertion, operator: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          >
                            <option value="==">Equals (==)</option>
                            <option value="===">Strict Equals (===)</option>
                            <option value="!=">Not Equals (!=)</option>
                            <option value=">">Greater Than (&gt;)</option>
                            <option value=">=">Greater or Equal (&gt;=)</option>
                            <option value="<">Less Than (&lt;)</option>
                            <option value="<=">Less or Equal (&lt;=)</option>
                            <option value="contains">Contains</option>
                            <option value="exists">Exists</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Field Path</label>
                          <VariableInput
                            value={newAssertion.field}
                            onChange={(value) => setNewAssertion({ ...newAssertion, field: value })}
                            variables={selectedEnv?.variables || {}}
                            placeholder="e.g., data.id or status"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Expected Value</label>
                          <VariableInput
                            value={String(newAssertion.expected)}
                            onChange={(value) => setNewAssertion({ ...newAssertion, expected: value })}
                            variables={selectedEnv?.variables || {}}
                            placeholder="e.g., 200 or 'success'"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                        <input
                          type="text"
                          value={newAssertion.description || ''}
                          onChange={(e) => setNewAssertion({ ...newAssertion, description: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          placeholder="e.g., Status code should be 405"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddAssertion}
                          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          Apply
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 text-center mt-2">
                        Click <strong>Save</strong> button above to persist changes
                      </p>
                    </div>
                  ) : (
                    /* Display Mode */
                    <>
                      <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded">
                        <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {assertion.type}
                            </span>
                            {assertion.operator && (
                              <span className="text-xs text-gray-600">{assertion.operator}</span>
                            )}
                            {assertion.expected !== undefined && (
                              <code className="text-xs text-purple-600">{JSON.stringify(assertion.expected)}</code>
                            )}
                          </div>
                          {assertion.field && (
                            <p className="text-xs text-gray-600 font-mono">Field: {assertion.field}</p>
                          )}
                          {assertion.description && (
                            <p className="text-xs text-gray-600 mt-1">{assertion.description}</p>
                          )}
                        </div>
                        {!readOnly && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleEditAssertion(index)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit assertion"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleRemoveAssertion(index)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Remove assertion"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Variable Preview for Assertion */}
                      {(fieldHasVars || expectedHasVars) && selectedEnv && (
                        <div className="ml-10 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                          {fieldHasVars && (
                            <div className="mb-1">
                              <span className="text-gray-500 mr-1.5">Field:</span>
                              <VariableHighlight
                                text={String(assertion.field)}
                                variables={selectedEnv?.variables || {}}
                                className="font-mono"
                                inline
                              />
                            </div>
                          )}
                          {expectedHasVars && (
                            <div>
                              <span className="text-gray-500 mr-1.5">Expected:</span>
                              <VariableHighlight
                                text={String(assertion.expected)}
                                variables={selectedEnv?.variables || {}}
                                className="font-mono"
                                inline
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-sm">No assertions defined</p>
            {!readOnly && <p className="text-xs mt-2">Add assertions to validate the response</p>}
          </div>
        )}

        {/* Add New Assertion Form - only show when not editing existing */}
        {showAssertionForm && !readOnly && editingIndex === null && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">New Assertion</h4>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newAssertion.type}
                  onChange={(e) => setNewAssertion({ ...newAssertion, type: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="status">Status Code</option>
                  <option value="body">Response Body</option>
                  <option value="header">Response Header</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Operator</label>
                <select
                  value={newAssertion.operator}
                  onChange={(e) => setNewAssertion({ ...newAssertion, operator: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="==">Equals (==)</option>
                  <option value="===">Strict Equals (===)</option>
                  <option value="!=">Not Equals (!=)</option>
                  <option value=">">Greater Than (&gt;)</option>
                  <option value=">=">Greater or Equal (&gt;=)</option>
                  <option value="<">Less Than (&lt;)</option>
                  <option value="<=">Less or Equal (&lt;=)</option>
                  <option value="contains">Contains</option>
                  <option value="exists">Exists</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Field Path</label>
                <VariableInput
                  value={newAssertion.field}
                  onChange={(value) => setNewAssertion({ ...newAssertion, field: value })}
                  variables={selectedEnv?.variables || {}}
                  placeholder="e.g., data.id or status"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expected Value</label>
                <VariableInput
                  value={String(newAssertion.expected)}
                  onChange={(value) => setNewAssertion({ ...newAssertion, expected: value })}
                  variables={selectedEnv?.variables || {}}
                  placeholder="e.g., 200 or 'success'"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={newAssertion.description || ''}
                onChange={(e) => setNewAssertion({ ...newAssertion, description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g., Status code should be 405"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAssertion}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center mt-2">
              Click <strong>Save</strong> button above to persist changes
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
