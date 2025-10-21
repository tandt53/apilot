/**
 * Test Generation Configuration Modal (Redesigned)
 * Allows users to configure test generation options before starting
 */

import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Info, Search, Sparkles, Zap, Database, Target } from 'lucide-react'
import type { Endpoint } from '@/types/database'

export type ContextMode = 'selected-only' | 'all-reference' | 'unselected-reference'

export interface TestGenerationConfig {
  contextMode: ContextMode
  customRequirements?: string
  selectedReferenceIds?: number[] // Specific reference endpoint IDs
}

interface TestGenerationConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEndpointsCount: number
  totalEndpointsCount: number
  unselectedEndpoints: Endpoint[] // New: list of unselected endpoints
  onConfirm: (config: TestGenerationConfig) => void
}

export default function TestGenerationConfigModal({
  open,
  onOpenChange,
  selectedEndpointsCount,
  totalEndpointsCount,
  unselectedEndpoints,
  onConfirm,
}: TestGenerationConfigModalProps) {
  const [contextMode, setContextMode] = useState<ContextMode>('selected-only')
  const [customRequirements, setCustomRequirements] = useState('')
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<number>>(new Set())
  const [referenceSearchQuery, setReferenceSearchQuery] = useState('')
  const [showReferenceList, setShowReferenceList] = useState(false)

  // Filter endpoints based on search query
  const filteredReferenceEndpoints = useMemo(() => {
    if (!referenceSearchQuery.trim()) return unselectedEndpoints

    const query = referenceSearchQuery.toLowerCase()
    return unselectedEndpoints.filter(e =>
      e.name?.toLowerCase().includes(query) ||
      e.path.toLowerCase().includes(query) ||
      e.method.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query)
    )
  }, [unselectedEndpoints, referenceSearchQuery])

  // Get method color
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-500 text-white',
      POST: 'bg-green-500 text-white',
      PUT: 'bg-orange-500 text-white',
      PATCH: 'bg-purple-500 text-white',
      DELETE: 'bg-red-500 text-white',
    }
    return colors[method.toUpperCase()] || 'bg-gray-500 text-white'
  }

  // Toggle individual reference endpoint
  const toggleReferenceEndpoint = (endpointId: number) => {
    const newSet = new Set(selectedReferenceIds)
    if (newSet.has(endpointId)) {
      newSet.delete(endpointId)
    } else {
      newSet.add(endpointId)
    }
    setSelectedReferenceIds(newSet)
  }

  // Select all filtered endpoints
  const selectAllReferences = () => {
    const newSet = new Set(selectedReferenceIds)
    filteredReferenceEndpoints.forEach(e => {
      if (e.id) newSet.add(e.id)
    })
    setSelectedReferenceIds(newSet)
  }

  // Clear all selections
  const clearAllReferences = () => {
    setSelectedReferenceIds(new Set())
  }

  // Handle context mode change
  const handleContextModeChange = (mode: ContextMode) => {
    setContextMode(mode)
    // If switching away from unselected-reference, clear selections
    if (mode !== 'unselected-reference') {
      setSelectedReferenceIds(new Set())
      setReferenceSearchQuery('')
    }
  }

  const handleConfirm = () => {
    // Validate unselected-reference mode has at least one selection
    if (contextMode === 'unselected-reference' && selectedReferenceIds.size === 0) {
      alert('Please select at least one reference endpoint, or choose a different context mode.')
      return
    }

    onConfirm({
      contextMode,
      customRequirements: customRequirements.trim() || undefined,
      selectedReferenceIds: contextMode === 'unselected-reference'
        ? Array.from(selectedReferenceIds)
        : undefined,
    })
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const unselectedCount = unselectedEndpoints.length

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 p-6">
            <div className="flex items-center justify-between">
              <div>
                <Dialog.Title className="text-2xl font-bold text-white flex items-center gap-2">
                  <Sparkles size={24} />
                  Configure Test Generation
                </Dialog.Title>
                <p className="text-purple-100 text-sm mt-1">
                  Optimize AI context for better test quality
                </p>
              </div>
              <Dialog.Close asChild>
                <button
                  className="text-white/80 hover:text-white transition-colors hover:bg-white/10 rounded-full p-1"
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Info Banner */}
            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-4 flex gap-3">
              <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Choose Your Strategy</p>
                <p className="text-blue-700">
                  More context improves test quality but uses more tokens. Select the right balance for your API.
                </p>
              </div>
            </div>

            {/* Context Mode - Card Based Selection */}
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Endpoint Context Mode</h3>
                <p className="text-xs text-gray-500 mt-1">Choose which endpoints to send to AI for context</p>
              </div>
              <div className="space-y-3">
                {/* Option 1: Selected only */}
                <button
                  type="button"
                  onClick={() => handleContextModeChange('selected-only')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    contextMode === 'selected-only'
                      ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      contextMode === 'selected-only' ? 'border-purple-500' : 'border-gray-300'
                    }`}>
                      {contextMode === 'selected-only' && (
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={18} className="text-purple-600" />
                        <span className="font-semibold text-gray-900 text-base">Selected endpoints only</span>
                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm">
                          Most Efficient
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Send only {selectedEndpointsCount} selected endpoint{selectedEndpointsCount !== 1 ? 's' : ''} to AI.
                        Best for simple APIs and reducing token usage.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Option 2: All as reference */}
                <button
                  type="button"
                  onClick={() => handleContextModeChange('all-reference')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    contextMode === 'all-reference'
                      ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      contextMode === 'all-reference' ? 'border-purple-500' : 'border-gray-300'
                    }`}>
                      {contextMode === 'all-reference' && (
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Database size={18} className="text-purple-600" />
                        <span className="font-semibold text-gray-900 text-base">All endpoints as reference</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Generate for {selectedEndpointsCount} selected, include all {totalEndpointsCount} endpoints as context.
                        Best for complex interdependent APIs.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Option 3: Unselected as reference */}
                {unselectedCount > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => handleContextModeChange('unselected-reference')}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        contextMode === 'unselected-reference'
                          ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-purple-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          contextMode === 'unselected-reference' ? 'border-purple-500' : 'border-gray-300'
                        }`}>
                          {contextMode === 'unselected-reference' && (
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Target size={18} className="text-purple-600" />
                            <span className="font-semibold text-gray-900 text-base">Choose reference endpoints</span>
                            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm">
                              Balanced
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            Generate for {selectedEndpointsCount} selected, pick specific endpoints from {unselectedCount} available.
                            Perfect balance between context and efficiency.
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Reference Endpoint Selector */}
                    {contextMode === 'unselected-reference' && (
                      <div className="mt-3 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                        <div className="space-y-3">
                          {/* Compact Summary - No Chips */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Reference Endpoints
                            </span>
                            <span className="text-sm text-purple-600 font-semibold">
                              {selectedReferenceIds.size} of {unselectedCount} selected
                            </span>
                          </div>

                          {/* Add More Button / Search */}
                          {!showReferenceList ? (
                            <button
                              type="button"
                              onClick={() => setShowReferenceList(true)}
                              className="w-full px-4 py-3 border-2 border-dashed border-purple-400 rounded-lg text-purple-600 hover:bg-purple-100 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                            >
                              <Search size={16} />
                              {selectedReferenceIds.size === 0 ? 'Select Reference Endpoints' : `Manage Selection (${selectedReferenceIds.size})`}
                            </button>
                          ) : (
                            <div className="space-y-3">
                              {/* Search and bulk actions */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Search endpoints..."
                                    value={referenceSearchQuery}
                                    onChange={(e) => setReferenceSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={selectAllReferences}
                                  className="px-3 py-2 text-sm text-purple-600 hover:bg-purple-100 rounded-lg transition-colors whitespace-nowrap font-medium"
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={clearAllReferences}
                                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                >
                                  Clear
                                </button>
                              </div>

                              {/* Endpoint list */}
                              <div className="max-h-64 overflow-y-auto border-2 border-purple-200 rounded-lg bg-white">
                                {filteredReferenceEndpoints.length === 0 ? (
                                  <div className="p-4 text-center text-sm text-gray-500">
                                    {referenceSearchQuery ? 'No endpoints match your search' : 'No unselected endpoints available'}
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-100">
                                    {filteredReferenceEndpoints.map((endpoint) => (
                                      <label
                                        key={endpoint.id}
                                        className="flex items-center gap-3 p-3 hover:bg-purple-50 cursor-pointer transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedReferenceIds.has(endpoint.id!)}
                                          onChange={() => toggleReferenceEndpoint(endpoint.id!)}
                                          className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                        />
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${getMethodColor(endpoint.method)}`}>
                                          {endpoint.method}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-mono text-gray-900 truncate font-medium">
                                            {endpoint.path}
                                          </div>
                                          {endpoint.name && endpoint.name !== endpoint.path && (
                                            <div className="text-xs text-gray-500 truncate">
                                              {endpoint.name}
                                            </div>
                                          )}
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => setShowReferenceList(false)}
                                className="w-full px-4 py-2 text-sm text-purple-600 hover:bg-purple-100 rounded-lg transition-colors font-medium"
                              >
                                Done Selecting
                              </button>
                            </div>
                          )}

                          {/* Validation warning */}
                          {selectedReferenceIds.size === 0 && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-lg">
                              <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-amber-900">
                                Please select at least one reference endpoint, or choose a different context mode.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Requirements */}
            <div>
              <label htmlFor="customRequirements" className="block text-sm font-semibold text-gray-900 mb-2">
                Additional Requirements <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <textarea
                id="customRequirements"
                value={customRequirements}
                onChange={(e) => setCustomRequirements(e.target.value)}
                placeholder="E.g., Focus on error cases, include authentication tests, use specific data formats..."
                rows={4}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Provide custom instructions to guide test generation
              </p>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Generation Summary</p>
                  <div className="space-y-1.5 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span><strong className="font-semibold">{selectedEndpointsCount}</strong> endpoint{selectedEndpointsCount !== 1 ? 's' : ''} for testing</span>
                    </div>
                    {contextMode !== 'selected-only' && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>
                          <strong className="font-semibold">
                            {contextMode === 'all-reference' ? totalEndpointsCount : selectedReferenceIds.size}
                          </strong> reference endpoint{(contextMode === 'all-reference' ? totalEndpointsCount : selectedReferenceIds.size) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {customRequirements.trim() && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-green-700 font-medium">Custom requirements included</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="group relative px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Sparkles size={16} />
                Generate Tests
              </span>
              <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
