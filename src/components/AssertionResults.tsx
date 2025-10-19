import {useState} from 'react'
import {CheckCircle, XCircle, ChevronDown, ChevronRight} from 'lucide-react'

interface AssertionResultProps {
  assertions: any[]
  results: any[]
}

export default function AssertionResults({assertions, results}: AssertionResultProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set())

  if (!assertions || assertions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No assertions configured</p>
      </div>
    )
  }

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedIndices)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedIndices(newExpanded)
  }

  return (
    <div className="space-y-2">
      {assertions.map((assertion, index) => {
        const result = results?.[index]
        const passed = result?.passed ?? null
        const isExpanded = expandedIndices.has(index)

        // Auto-expand failed assertions
        if (passed === false && !isExpanded) {
          setTimeout(() => toggleExpanded(index), 0)
        }

        return (
          <div
            key={assertion.id || index}
            className={`border rounded-lg overflow-hidden ${
              passed === null
                ? 'border-gray-300 bg-white'
                : passed
                ? 'border-green-300 bg-green-50'
                : 'border-red-300 bg-red-50'
            }`}
          >
            {/* Header - Always visible */}
            <button
              onClick={() => toggleExpanded(index)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-black/5 transition-colors"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {passed === null ? (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                ) : passed ? (
                  <CheckCircle size={20} className="text-green-600" />
                ) : (
                  <XCircle size={20} className="text-red-600" />
                )}
              </div>

              {/* Assertion description */}
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-gray-900">
                  {assertion.description || `${assertion.type} ${assertion.operator || ''} ${assertion.expected || ''}`}
                </div>
                {assertion.field && (
                  <div className="text-xs text-gray-600 mt-0.5">Field: {assertion.field}</div>
                )}
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                {passed !== null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      passed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {passed ? 'Passed' : 'Failed'}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && result && (
              <div className="px-4 pb-3 border-t border-gray-200">
                <div className="space-y-2 pt-3">
                  {/* Type and operator */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Type:</span>{' '}
                      <code className="text-purple-600 font-mono text-xs">{assertion.type}</code>
                    </div>
                    {assertion.operator && (
                      <div>
                        <span className="text-gray-600">Operator:</span>{' '}
                        <code className="text-purple-600 font-mono text-xs">{assertion.operator}</code>
                      </div>
                    )}
                  </div>

                  {/* Expected vs Actual */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600 mb-1">Expected:</div>
                      <div className="bg-white border border-gray-200 rounded px-2 py-1 font-mono text-xs break-all">
                        {typeof result.expected === 'object'
                          ? JSON.stringify(result.expected, null, 2)
                          : String(result.expected)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Actual:</div>
                      <div className={`border rounded px-2 py-1 font-mono text-xs break-all ${
                        passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        {typeof result.actual === 'object'
                          ? JSON.stringify(result.actual, null, 2)
                          : String(result.actual)}
                      </div>
                    </div>
                  </div>

                  {/* Error message for failures */}
                  {!passed && result.error && (
                    <div className="bg-red-100 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
                      {result.error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
