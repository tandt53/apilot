/**
 * Test Migration Dialog
 * Handles test case migration when creating a new spec version
 */

import {useEffect, useState} from 'react'
import {AlertTriangle, ArrowRight, CheckCircle, XCircle} from 'lucide-react'
import type {Endpoint, TestCase} from '@/types/database'

interface TestMigrationStatus {
  testCase: TestCase
  matched: boolean
  newEndpoint?: Endpoint
  reason?: string
}

interface TestMigrationDialogProps {
  isOpen: boolean
  oldSpecName: string
  newSpecName: string
  testCases: TestCase[]
  endpointMapping: Map<number, Endpoint>
  onConfirm: () => void
  onCancel: () => void
}

export default function TestMigrationDialog({
  isOpen,
  oldSpecName,
  newSpecName,
  testCases,
  endpointMapping,
  onConfirm,
  onCancel,
}: TestMigrationDialogProps) {
  const [migrationStatus, setMigrationStatus] = useState<TestMigrationStatus[]>([])

  useEffect(() => {
    if (!isOpen) return

    // Calculate migration status for each test case
    const status: TestMigrationStatus[] = testCases.map((testCase) => {
      const oldEndpointId = testCase.currentEndpointId || testCase.sourceEndpointId
      const newEndpoint = oldEndpointId ? endpointMapping.get(oldEndpointId) : undefined

      if (testCase.isCustomEndpoint) {
        return {
          testCase,
          matched: false,
          reason: 'Custom test (not linked to endpoint)',
        }
      }

      if (newEndpoint) {
        return {
          testCase,
          matched: true,
          newEndpoint,
        }
      }

      return {
        testCase,
        matched: false,
        reason: 'No matching endpoint in new version',
      }
    })

    setMigrationStatus(status)
  }, [isOpen, testCases, endpointMapping])

  if (!isOpen) return null

  const matchedCount = migrationStatus.filter((s) => s.matched).length
  const unmatchedCount = migrationStatus.filter((s) => !s.matched).length
  const customCount = migrationStatus.filter((s) => s.testCase.isCustomEndpoint).length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Migrate Test Cases
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Migrating {testCases.length} test case{testCases.length !== 1 ? 's' : ''} from{' '}
            <span className="font-medium">{oldSpecName}</span> to{' '}
            <span className="font-medium">{newSpecName}</span>
          </p>
        </div>

        {/* Summary Stats */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-600" size={20} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{matchedCount}</p>
                <p className="text-xs text-gray-600">Will be migrated</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="text-red-600" size={20} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{unmatchedCount}</p>
                <p className="text-xs text-gray-600">No match found</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-yellow-600" size={20} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{customCount}</p>
                <p className="text-xs text-gray-600">Custom tests</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {migrationStatus.map((status) => (
              <div
                key={status.testCase.id}
                className={`border rounded-lg p-3 ${
                  status.matched
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  {status.matched ? (
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                  ) : (
                    <XCircle className="text-gray-400 flex-shrink-0 mt-0.5" size={18} />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 truncate">
                        {status.testCase.name}
                      </p>
                      {status.testCase.isCustomEndpoint && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded flex-shrink-0">
                          Custom
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-mono text-xs">
                        {status.testCase.method} {status.testCase.path}
                      </span>
                      {status.newEndpoint && (
                        <>
                          <ArrowRight size={14} className="text-gray-400" />
                          <span className="font-mono text-xs text-green-600">
                            {status.newEndpoint.method} {status.newEndpoint.path}
                          </span>
                        </>
                      )}
                    </div>

                    {status.reason && (
                      <p className="text-xs text-gray-500 mt-1">{status.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {unmatchedCount > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-2">
                <AlertTriangle className="text-yellow-600 flex-shrink-0" size={18} />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Note about unmatched tests:</p>
                  <p>
                    Tests that don't match any endpoint in the new version will still be
                    migrated and marked as custom tests. You can manually relink them later
                    or run them as-is.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={onConfirm}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Migrate {testCases.length} Test{testCases.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
