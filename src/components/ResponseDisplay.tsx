import {useState} from 'react'
import {FileText} from 'lucide-react'

interface ResponseDisplayProps {
  response: any | null
  error: string | null
  responseTime?: number
  initialActiveTab?: ResponseTab
  onActiveTabChange?: (tab: ResponseTab) => void
}

type ResponseTab = 'body' | 'headers'

export default function ResponseDisplay({ response, error, responseTime, initialActiveTab = 'body', onActiveTabChange }: ResponseDisplayProps) {
  const [responseTab, setResponseTab] = useState<ResponseTab>(initialActiveTab)

  const handleTabChange = (tab: ResponseTab) => {
    setResponseTab(tab)
    onActiveTabChange?.(tab)
  }

  if (!response && !error) {
    return null
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={20} className="text-purple-600" />
          Response
        </h3>
      </div>

      <div className="p-4">
        {response && (
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              response.status >= 200 && response.status < 300 ? 'bg-green-100 text-green-700' :
              response.status >= 400 ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {response.status} {response.statusText}
            </span>
            {responseTime !== undefined && (
              <span className="text-sm text-gray-600">
                {responseTime}ms
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error}
        </div>
      )}

      {response && (
        <div>
          {/* Assertion Summary */}
          {response.assertionResults && (
            <div className="bg-gray-50 rounded p-4 mx-4 mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Assertions: {response.assertionResults.filter(Boolean).length} / {response.assertionResults.length} passed
              </div>
            </div>
          )}

          {/* Response Tabs */}
          <div className="px-4 mb-4">
            <div className="flex gap-4 border-b border-gray-200">
              <button
                onClick={() => handleTabChange('body')}
                className={`px-3 pb-1.5 text-sm font-medium transition-colors -mb-px ${
                  responseTab === 'body'
                    ? 'text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={responseTab === 'body' ? { borderBottom: '3px solid rgb(147, 51, 234)' } : { borderBottom: '3px solid transparent' }}
              >
                Body
              </button>
              <button
                onClick={() => handleTabChange('headers')}
                className={`px-3 pb-1.5 text-sm font-medium transition-colors -mb-px ${
                  responseTab === 'headers'
                    ? 'text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={responseTab === 'headers' ? { borderBottom: '3px solid rgb(147, 51, 234)' } : { borderBottom: '3px solid transparent' }}
              >
                Headers
              </button>
            </div>
          </div>

          {/* Response Tab Content */}
          <div className="p-4">
            {responseTab === 'body' && (
              <div className="bg-gray-50 border border-gray-300 rounded p-3 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-900">
                  {typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            )}

            {responseTab === 'headers' && (
              <div className="bg-white rounded border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Key
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(response.headers || {}).map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {key}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 break-all">
                          {String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
