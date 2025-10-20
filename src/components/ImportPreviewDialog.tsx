/**
 * Import Preview Dialog
 * Unified dialog for importing API specs with git-style endpoint comparison
 */

import {useState, useEffect, useMemo} from 'react'
import {
  AlertTriangle,
  ChevronDown,
  FileWarning,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type {Endpoint, Spec} from '@/types/database'
import type {ImportAnalysis, ImportOptions} from '@/lib/api/imports'
import {useAnalyzeImport, useImportEndpoints} from '@/lib/hooks'
import * as api from '@/lib/api'

interface ImportPreviewDialogProps {
  isOpen: boolean
  parsedData: {
    name: string
    version: string
    description?: string
    baseUrl?: string
    endpoints: Endpoint[]
    variables?: Record<string, string>
    rawSpec: string
  }
  detection: {
    format: 'openapi' | 'swagger' | 'postman' | 'curl'
    version?: string
  }
  specs: Spec[]
  onSuccess: () => void
  onCancel: () => void
}

type TargetSpecMode = 'new' | 'existing'

interface EndpointComparison {
  path: string
  method: string
  existingEndpoint?: Endpoint
  importedEndpoint?: Endpoint
  status: 'new' | 'modified' | 'unchanged' | 'deprecated'
  affectedTests: number
  hasSchemaChanges: boolean
  changes?: {
    field: string
    oldValue?: any
    newValue?: any
    added?: any[]
    removed?: any[]
    type?: string
    parameter?: string
    location?: string
    fieldName?: string
    differences?: any[]
  }[]
}

export default function ImportPreviewDialog({
  isOpen,
  parsedData,
  detection,
  specs,
  onSuccess,
  onCancel,
}: ImportPreviewDialogProps) {
  const [targetMode, setTargetMode] = useState<TargetSpecMode>('new')
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null)
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const analyzeImportMutation = useAnalyzeImport()
  const importEndpointsMutation = useImportEndpoints()

  const selectedSpec = useMemo(
    () => specs.find((s) => s.id === selectedSpecId),
    [specs, selectedSpecId]
  )

  // Run analysis when existing spec is selected
  useEffect(() => {
    if (targetMode === 'existing' && selectedSpecId && parsedData.endpoints.length > 0) {
      analyzeImportMutation.mutate(
        { endpoints: parsedData.endpoints, targetSpecId: selectedSpecId },
        {
          onSuccess: (data) => {
            setAnalysis(data)
          },
        }
      )
    } else {
      setAnalysis(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMode, selectedSpecId, parsedData.endpoints])

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTargetMode('new')
      setSelectedSpecId(null)
      setAnalysis(null)
    }
  }, [isOpen])

  // Generate comparison view
  const comparison = useMemo((): EndpointComparison[] => {
    if (!analysis) return []

    const pathMap = new Map<string, EndpointComparison>()

    // Get existing endpoints for the spec
    const existingEndpoints = analysis.duplicates.map((d) => d.existing)
    existingEndpoints.forEach((ep) => {
      const key = `${ep.method}:${ep.path}`
      pathMap.set(key, {
        path: ep.path,
        method: ep.method,
        existingEndpoint: ep,
        status: 'deprecated', // Will be updated if found in imported
        affectedTests: 0,
        hasSchemaChanges: false,
      })
    })

    // Process duplicates (modified or unchanged endpoints)
    analysis.duplicates.forEach((dup) => {
      const key = `${dup.existing.method}:${dup.existing.path}`
      pathMap.set(key, {
        path: dup.existing.path,
        method: dup.existing.method,
        existingEndpoint: dup.existing,
        importedEndpoint: dup.incoming,
        status: dup.hasChanges ? 'modified' : 'unchanged',
        affectedTests: dup.affectedTests,
        hasSchemaChanges: dup.hasChanges,
        changes: dup.changes,
      })
    })

    // Process new endpoints
    analysis.newEndpoints.forEach((ep) => {
      const key = `${ep.method}:${ep.path}`
      if (!pathMap.has(key)) {
        pathMap.set(key, {
          path: ep.path,
          method: ep.method,
          importedEndpoint: ep,
          status: 'new',
          affectedTests: 0,
          hasSchemaChanges: false,
        })
      }
    })

    // Sort by path
    return Array.from(pathMap.values()).sort((a, b) => a.path.localeCompare(b.path))
  }, [analysis])

  const handleTargetSpecChange = (value: string) => {
    if (value === 'new') {
      setTargetMode('new')
      setSelectedSpecId(null)
    } else {
      setTargetMode('existing')
      setSelectedSpecId(parseInt(value))
    }
  }

  const handleCreateNewSpec = async () => {
    console.warn('🆕🆕🆕 [ImportPreviewDialog] handleCreateNewSpec CALLED 🆕🆕🆕')
    console.warn('  parsedData.endpoints:', parsedData.endpoints.length)

    setIsCreating(true)
    try {
      // Create spec
      const spec = await api.createSpec({
        name: parsedData.name || 'Imported Spec',
        version: parsedData.version || '1.0.0',
        description: parsedData.description,
        baseUrl: parsedData.baseUrl || '',
        rawSpec: parsedData.rawSpec,
        format: detection.format as any,
        versionGroup: crypto.randomUUID(),
        isLatest: true,
        originalName: parsedData.name || 'Imported Spec',
      })

      console.warn('✅ [ImportPreviewDialog] Spec created, ID:', spec.id)

      // Import endpoints
      const endpointsData = parsedData.endpoints.map((endpoint) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { specId: _, ...endpointData } = endpoint
        return {
          specId: spec.id!,
          ...endpointData,
          updatedAt: new Date(),
          createdBy: 'import' as const,
        }
      })

      // DEBUG: Log some endpoint descriptions
      console.warn('📝 [ImportPreviewDialog] Sample endpoint data before bulkCreate:')
      const postPet = endpointsData.find(e => e.method === 'POST' && e.path === '/pet')
      if (postPet) {
        console.warn('  POST /pet - request.body.description:', postPet.request?.body?.description)
        console.warn('  POST /pet - full body:', postPet.request?.body)
      }

      if (endpointsData.length > 0) {
        console.warn(`🔄 [ImportPreviewDialog] Calling bulkCreateEndpoints with ${endpointsData.length} endpoints...`)
        await api.bulkCreateEndpoints(endpointsData)
        console.warn('✅ [ImportPreviewDialog] bulkCreateEndpoints complete')
      }

      // Import variables as environment if present
      if (parsedData.variables && Object.keys(parsedData.variables).length > 0) {
        await api.createEnvironment({
          specId: spec.id!,
          name: 'Imported Variables',
          baseUrl: parsedData.baseUrl || '',
          variables: parsedData.variables,
        })
      }

      onSuccess()
    } catch (err: any) {
      alert(`Failed to import: ${err.message}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleImportToExisting = async () => {
    console.warn('💾💾💾 [ImportPreviewDialog] handleImportToExisting CALLED 💾💾💾')
    console.warn('  selectedSpecId:', selectedSpecId)
    console.warn('  analysis:', analysis)

    if (!selectedSpecId || !analysis) {
      console.warn('❌ [ImportPreviewDialog] Early return - missing selectedSpecId or analysis')
      return
    }

    // Always replace - spec file is source of truth
    const options: ImportOptions = {
      onDuplicate: 'replace',
      replacements: analysis.duplicates.map(d => d.existing.id!),
      markAsDeprecated: true,
    }

    console.warn('  Options:', options)
    console.warn('  Endpoints to import:', parsedData.endpoints.length)
    console.warn('  Calling importEndpointsMutation.mutate()...')

    importEndpointsMutation.mutate(
      { endpoints: parsedData.endpoints, targetSpecId: selectedSpecId, options },
      {
        onSuccess: () => {
          console.warn('✅ [ImportPreviewDialog] Import SUCCESS')
          onSuccess()
        },
        onError: (err: any) => {
          console.warn('❌ [ImportPreviewDialog] Import ERROR:', err)
          alert(`Failed to import: ${err.message}`)
        },
      }
    )
  }

  const handleImport = () => {
    console.warn('🔵🔵🔵 [ImportPreviewDialog] handleImport CLICKED 🔵🔵🔵')
    console.warn('  targetMode:', targetMode)

    if (targetMode === 'new') {
      console.warn('  → Calling handleCreateNewSpec()')
      handleCreateNewSpec()
    } else {
      console.warn('  → Calling handleImportToExisting()')
      handleImportToExisting()
    }
  }


  if (!isOpen) return null

  const isAnalyzing = analyzeImportMutation.isPending
  const isImporting = importEndpointsMutation.isPending || isCreating

  // Calculate import count
  const modifiedCount = comparison.filter(c => c.status === 'modified' && c.hasSchemaChanges).length
  const importCount =
    targetMode === 'new'
      ? parsedData.endpoints.length
      : (analysis?.summary.new || 0) + modifiedCount

  return (
    <>
      {/* Main Dialog */}
      <div className="fixed inset-0 bg-gray-100 bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import API Specification</h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                <span className="font-medium">{parsedData.name || 'Untitled'}</span>
                <span>•</span>
                <span>v{parsedData.version || '1.0.0'}</span>
                <span>•</span>
                <span className="uppercase text-xs font-semibold text-purple-600">
                  {detection.format} {detection.version}
                </span>
                <span>•</span>
                <span>{parsedData.endpoints.length} endpoints</span>
              </div>
            </div>
          </div>
        </div>

        {/* Target Spec Selection */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Target Specification:
          </label>
          <div className="relative">
            <select
              value={targetMode === 'new' ? 'new' : String(selectedSpecId)}
              onChange={(e) => handleTargetSpecChange(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
              disabled={isAnalyzing || isImporting}
            >
              <option value="new">⭐ Create New Spec</option>
              {specs.length > 0 && <option disabled>──────────────────</option>}
              {specs.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name} v{spec.version}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Simple Preview Mode (Create New) */}
          {targetMode === 'new' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Sparkles size={20} className="text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-purple-900">Creating New Specification</p>
                    <p className="text-purple-700 mt-1">
                      All {parsedData.endpoints.length} endpoints will be imported as a new spec.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Endpoints Preview ({parsedData.endpoints.length}):
                </h3>
                <div className="space-y-1 max-h-96 overflow-y-auto border rounded-lg">
                  {parsedData.endpoints
                    .sort((a, b) => a.path.localeCompare(b.path))
                    .map((ep, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 border-b last:border-b-0">
                        <MethodBadge method={ep.method} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-gray-900 truncate">{ep.path}</p>
                          {ep.name && <p className="text-xs text-gray-600 truncate">{ep.name}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Git-Style Comparison Mode (Existing Spec) */}
          {targetMode === 'existing' && selectedSpec && (
            <div className="space-y-4">
              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
                  <p className="text-gray-600">Analyzing import...</p>
                  <p className="text-sm text-gray-500 mt-2">Comparing with {selectedSpec.name}</p>
                </div>
              )}

              {!isAnalyzing && analysis && (
                <>
                  {/* Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">Summary:</span>
                      </div>
                      {analysis.summary.new > 0 && (
                        <>
                          <div className="flex items-center gap-2">
                            <Plus size={16} className="text-green-600" />
                            <span className="font-medium text-green-700">{analysis.summary.new} New</span>
                          </div>
                          <span className="text-gray-300">•</span>
                        </>
                      )}
                      {(() => {
                        const changedCount = comparison.filter(c => c.status === 'modified' && c.hasSchemaChanges).length
                        return changedCount > 0 && (
                          <>
                            <div className="flex items-center gap-2">
                              <RefreshCw size={16} className="text-blue-600" />
                              <span className="font-medium text-blue-700">
                                {changedCount} Changed
                              </span>
                            </div>
                            <span className="text-gray-300">•</span>
                          </>
                        )
                      })()}
                      {(() => {
                        const unchangedCount = comparison.filter(c => c.status === 'unchanged').length
                        return unchangedCount > 0 && (
                          <div className="flex items-center gap-2">
                            <RefreshCw size={16} className="text-gray-400" />
                            <span className="font-medium text-gray-600">
                              {unchangedCount} Unchanged
                            </span>
                          </div>
                        )
                      })()}
                    </div>

                    {analysis.summary.duplicatesWithTests > 0 && (
                      <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3">
                        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-semibold text-amber-900">
                            {analysis.summary.duplicatesWithTests} endpoint(s) with existing tests
                          </p>
                          <p className="text-amber-700 mt-1">
                            Tests will remain linked to old endpoints (safe - no data loss).
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comparison View */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Comparison View:</h3>
                    <div className="border rounded-lg overflow-hidden">
                      {/* Header */}
                      <div className="grid grid-cols-2 bg-gray-100 border-b font-semibold text-sm text-gray-700">
                        <div className="px-4 py-2 border-r">Existing Spec ({selectedSpec.name})</div>
                        <div className="px-4 py-2">Imported Spec ({parsedData.name})</div>
                      </div>

                      {/* Rows */}
                      <div className="max-h-80 overflow-y-auto">
                        {comparison.map((item, idx) => (
                          <ComparisonRow
                            key={idx}
                            item={item}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={onCancel}
            disabled={isImporting || isAnalyzing}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleImport}
            disabled={
              isImporting ||
              isAnalyzing ||
              (targetMode === 'existing' && !analysis) ||
              importCount === 0
            }
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting && <Loader2 className="animate-spin" size={16} />}
            {isImporting
              ? 'Importing...'
              : targetMode === 'new'
              ? `Import as New (${importCount})`
              : `Import to ${selectedSpec?.name} (${importCount})`}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

/**
 * Categorize and summarize changes
 */
interface ChangesSummary {
  total: number
  categories: {
    basicInfo: number
    parameters: number
    requestBody: number
    responses: number
    auth: number
  }
  briefText: string
}

function summarizeChanges(changes?: any[]): ChangesSummary {
  if (!changes || changes.length === 0) {
    return {
      total: 0,
      categories: { basicInfo: 0, parameters: 0, requestBody: 0, responses: 0, auth: 0 },
      briefText: ''
    }
  }

  const categories = {
    basicInfo: 0,
    parameters: 0,
    requestBody: 0,
    responses: 0,
    auth: 0
  }

  changes.forEach(change => {
    if (['name', 'description', 'tags', 'operationId', 'deprecated'].includes(change.field)) {
      categories.basicInfo++
    } else if (change.field === 'parameters' || change.field.startsWith('parameters')) {
      categories.parameters++
    } else if (change.field.startsWith('request.body') || change.field === 'request.contentType') {
      categories.requestBody++
    } else if (change.field.startsWith('responses')) {
      categories.responses++
    } else if (change.field === 'auth' || change.field.startsWith('auth.')) {
      categories.auth++
    }
  })

  // Generate brief text
  const parts: string[] = []
  if (categories.basicInfo > 0) parts.push(categories.basicInfo === 1 ? 'info' : `${categories.basicInfo} info`)
  if (categories.parameters > 0) parts.push(categories.parameters === 1 ? '1 param' : `${categories.parameters} params`)
  if (categories.requestBody > 0) parts.push('body')
  if (categories.responses > 0) parts.push('responses')
  if (categories.auth > 0) parts.push('auth')

  return {
    total: changes.length,
    categories,
    briefText: parts.join(', ')
  }
}

/**
 * Change Details Component - Expandable change viewer
 */
function ChangeDetails({
  changes,
  side,
  isExpanded,
  onToggle
}: {
  changes?: any[]
  side: 'existing' | 'imported'
  isExpanded: boolean
  onToggle: () => void
}) {
  if (!changes || changes.length === 0) return null

  const summary = summarizeChanges(changes)

  // Group changes by category
  const grouped = {
    basicInfo: changes.filter(c => ['name', 'description', 'tags', 'operationId', 'deprecated'].includes(c.field)),
    parameters: changes.filter(c => c.field === 'parameters' || c.field.startsWith('parameters')),
    requestBody: changes.filter(c => c.field.startsWith('request.body') || c.field === 'request.contentType'),
    responses: changes.filter(c => c.field.startsWith('responses')),
    auth: changes.filter(c => c.field === 'auth' || c.field.startsWith('auth.'))
  }

  const renderChangeValue = (value: any) => {
    if (value === undefined) return <span className="text-gray-400 italic">none</span>
    if (value === null) return <span className="text-gray-400">null</span>
    if (typeof value === 'boolean') return <span className="text-purple-600">{value.toString()}</span>
    if (typeof value === 'number') return <span className="text-blue-600">{value}</span>
    if (typeof value === 'string') return <span className="text-green-700">"{value}"</span>
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400">[]</span>
      if (value.length <= 3) return <span className="text-gray-700">[{value.map(v => JSON.stringify(v)).join(', ')}]</span>
      return <span className="text-gray-700">[{value.length} items]</span>
    }
    if (typeof value === 'object') return <span className="text-gray-700">{'{...}'}</span>
    return <span>{String(value)}</span>
  }

  const renderChange = (change: any, index: number) => {
    // Determine which value to show based on side
    const getValue = (change: any) => side === 'existing' ? change.oldValue : change.newValue

    // Parameter changes (added/removed/modified)
    if (change.field === 'parameters') {
      if (change.type === 'added') {
        // Only show on imported side
        if (side === 'imported') {
          return (
            <div key={index} className="text-xs text-gray-700 ml-2">
              <span className="text-green-600">+ Added:</span> {change.parameter} ({change.location})
            </div>
          )
        }
        return null
      }
      if (change.type === 'removed') {
        // Only show on existing side
        if (side === 'existing') {
          return (
            <div key={index} className="text-xs text-gray-700 ml-2">
              <span className="text-red-600">- Removed:</span> {change.parameter} ({change.location})
            </div>
          )
        }
        return null
      }
      if (change.type === 'modified' && change.differences) {
        return (
          <div key={index} className="text-xs text-gray-700 ml-2">
            <span className="text-blue-600">⚠ Modified:</span> {change.parameter}
            <div className="ml-4 text-gray-600">
              {change.differences.map((diff: any, i: number) => (
                <div key={i}>
                  {diff.property}: {renderChangeValue(side === 'existing' ? diff.oldValue : diff.newValue)}
                </div>
              ))}
            </div>
          </div>
        )
      }
    }

    // Body field changes (added/removed/modified)
    if (change.field === 'request.body.fields') {
      if (change.type === 'added') {
        // Only show on imported side
        if (side === 'imported') {
          return (
            <div key={index} className="text-xs text-gray-700 ml-2">
              <span className="text-green-600">+ Field added:</span> {change.fieldName} ({change.newValue?.type || 'unknown'})
            </div>
          )
        }
        return null
      }
      if (change.type === 'removed') {
        // Only show on existing side
        if (side === 'existing') {
          return (
            <div key={index} className="text-xs text-gray-700 ml-2">
              <span className="text-red-600">- Field removed:</span> {change.fieldName} ({change.oldValue?.type || 'unknown'})
            </div>
          )
        }
        return null
      }
      if (change.type === 'modified' && change.differences) {
        return (
          <div key={index} className="text-xs text-gray-700 ml-2">
            <span className="text-amber-600">⚠ Field "{change.fieldName}" differs:</span>
            <div className="ml-4 text-gray-600">
              {change.differences.map((diff: any, i: number) => (
                <div key={i}>
                  <span className="font-medium">{diff.property}:</span> {renderChangeValue(side === 'existing' ? diff.oldValue : diff.newValue)}
                </div>
              ))}
            </div>
            {side === 'existing' && (
              <div className="ml-4 text-xs text-amber-700 italic">
                ⚠️ Importing will overwrite your changes
              </div>
            )}
          </div>
        )
      }
    }

    // Simple field changes
    if (change.type === 'added' && change.newValue !== undefined) {
      // Only show on imported side
      if (side === 'imported') {
        return (
          <div key={index} className="text-xs text-gray-700 ml-2">
            <span className="text-green-600">+ Added</span> <span className="font-medium">{change.field}:</span>{' '}
            {renderChangeValue(change.newValue)}
          </div>
        )
      }
      return null
    }
    if (change.type === 'removed' && change.oldValue !== undefined) {
      // Only show on existing side
      if (side === 'existing') {
        return (
          <div key={index} className="text-xs text-gray-700 ml-2">
            <span className="text-red-600">- Removed</span> <span className="font-medium">{change.field}:</span>{' '}
            {renderChangeValue(change.oldValue)}
          </div>
        )
      }
      return null
    }
    if (change.type === 'modified' || (change.oldValue !== undefined && change.newValue !== undefined)) {
      const value = getValue(change)
      if (value === undefined) return null

      return (
        <div key={index} className="text-xs text-gray-700 ml-2">
          <span className="font-medium">{change.field}:</span>{' '}
          {renderChangeValue(value)}
        </div>
      )
    }

    return null
  }

  return (
    <div className="mt-2">
      {/* Summary Badge - Only show on left side to avoid duplicate buttons */}
      {side === 'existing' && (
        <button
          onClick={onToggle}
          className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-700"
        >
          <FileWarning size={12} />
          <span>{summary.total} {summary.total === 1 ? 'change' : 'changes'}: {summary.briefText}</span>
          <ChevronDown
            size={12}
            className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
      {/* On right side, just show the summary text without button */}
      {side === 'imported' && (
        <div className="text-xs text-blue-600 flex items-center gap-1">
          <FileWarning size={12} />
          <span>{summary.total} {summary.total === 1 ? 'change' : 'changes'}: {summary.briefText}</span>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border-l-2 border-blue-200 pl-2">
          {grouped.basicInfo.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                ✏️ Basic Info
              </div>
              {grouped.basicInfo.map(renderChange).filter(Boolean)}
            </div>
          )}

          {grouped.parameters.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                📋 Parameters
              </div>
              {grouped.parameters.map(renderChange).filter(Boolean)}
            </div>
          )}

          {grouped.requestBody.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                📦 Request Body
              </div>
              {grouped.requestBody.map(renderChange).filter(Boolean)}
            </div>
          )}

          {grouped.responses.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                📬 Responses
              </div>
              {grouped.responses.map(renderChange).filter(Boolean)}
            </div>
          )}

          {grouped.auth.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                🔐 Authentication
              </div>
              {grouped.auth.map(renderChange).filter(Boolean)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Method Badge Component
 */
function MethodBadge({ method }: { method: string}) {
  const colors = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-green-100 text-green-700',
    PUT: 'bg-orange-100 text-orange-700',
    PATCH: 'bg-purple-100 text-purple-700',
    DELETE: 'bg-red-100 text-red-700',
  }

  return (
    <span
      className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
        colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {method}
    </span>
  )
}

/**
 * Comparison Row Component
 */
function ComparisonRow({
  item,
}: {
  item: EndpointComparison
}) {
  // Shared expand/collapse state for both sides
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="grid grid-cols-2 border-b last:border-b-0 hover:bg-gray-50">
      {/* Existing Endpoint */}
      <div className="px-4 py-3 border-r">
        {item.existingEndpoint ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MethodBadge method={item.method} />
              <span className="text-sm font-mono text-gray-900">{item.path}</span>
            </div>
            {item.existingEndpoint.name && (
              <p className="text-xs text-gray-600">{item.existingEndpoint.name}</p>
            )}
            {item.affectedTests > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle size={12} />
                {item.affectedTests} test(s)
              </p>
            )}
            {/* Show changes on existing side */}
            {item.hasSchemaChanges && (
              <ChangeDetails
                changes={item.changes}
                side="existing"
                isExpanded={isExpanded}
                onToggle={() => setIsExpanded(!isExpanded)}
              />
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">—</div>
        )}
      </div>

      {/* Imported Endpoint */}
      <div className="px-4 py-3">
        {item.importedEndpoint ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {item.status === 'new' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                  <Plus size={10} />
                  New
                </span>
              )}
              {item.status === 'modified' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1">
                  <RefreshCw size={10} />
                  Modified
                </span>
              )}
              {item.status === 'unchanged' && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                  <RefreshCw size={10} />
                  Unchanged
                </span>
              )}
              <MethodBadge method={item.method} />
              <span className="text-sm font-mono text-gray-900">{item.path}</span>
            </div>
            {item.importedEndpoint.name && (
              <p className="text-xs text-gray-600">{item.importedEndpoint.name}</p>
            )}
            {/* Show changes on imported side - shares same expand state */}
            {item.hasSchemaChanges && (
              <ChangeDetails
                changes={item.changes}
                side="imported"
                isExpanded={isExpanded}
                onToggle={() => setIsExpanded(!isExpanded)}
              />
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">—</div>
        )}
      </div>
    </div>
  )
}
