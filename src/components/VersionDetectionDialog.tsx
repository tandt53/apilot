/**
 * Version Detection Dialog
 * Handles spec version detection and migration when importing OpenAPI specs
 */

import {useState} from 'react'
import {AlertCircle, FileText, GitBranch, PackagePlus} from 'lucide-react'
import type {Spec} from '@/types/database'

interface MatchedVersion {
  spec: Spec
  matchType: 'exact' | 'fuzzy' | 'version-based'
  confidence: number
}

interface VersionDetectionDialogProps {
  isOpen: boolean
  importedSpecName: string
  importedSpecVersion: string
  matchedVersions: MatchedVersion[]
  onCreateNew: () => void
  onCreateVersion: (previousSpecId: number) => void
  onCancel: () => void
}

export default function VersionDetectionDialog({
  isOpen,
  importedSpecName,
  importedSpecVersion,
  matchedVersions,
  onCreateNew,
  onCreateVersion,
  onCancel,
}: VersionDetectionDialogProps) {
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null)

  if (!isOpen) return null

  const hasMatches = matchedVersions.length > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-purple-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Import Specification
              </h2>
              <p className="text-sm text-gray-600">
                {importedSpecName} v{importedSpecVersion}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {hasMatches ? (
            <>
              <p className="text-sm text-gray-700 mb-4">
                We found existing specifications that might be related to this import.
                Would you like to create a new version or import as a new specification?
              </p>

              <div className="space-y-3 mb-6">
                {matchedVersions.map((match) => (
                  <div
                    key={match.spec.id}
                    onClick={() => setSelectedSpecId(match.spec.id!)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedSpecId === match.spec.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {match.spec.displayName || match.spec.name}
                          </h3>
                          {match.matchType === 'exact' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Exact Match
                            </span>
                          )}
                          {match.matchType === 'fuzzy' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              Similar Name
                            </span>
                          )}
                          {match.matchType === 'version-based' && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Version Match
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Current version: v{match.spec.version}
                        </p>
                        {match.spec.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {match.spec.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {Math.round(match.confidence * 100)}% match
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <FileText size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">
                No existing specifications found with a similar name.
              </p>
              <p className="text-sm text-gray-500 mt-1">
                This will be imported as a new specification.
              </p>
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

            <div className="flex gap-2">
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <PackagePlus size={18} />
                Import as New
              </button>

              {hasMatches && (
                <button
                  onClick={() => selectedSpecId && onCreateVersion(selectedSpecId)}
                  disabled={!selectedSpecId}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <GitBranch size={18} />
                  Create New Version
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
