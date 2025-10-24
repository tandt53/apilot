/**
 * Step Editor
 * Manage multiple test steps with expandable card layout
 */

import {useState, useRef, useCallback} from 'react'
import {ChevronUp, ChevronDown, ChevronRight, Trash2} from 'lucide-react'
import type {TestStep, Environment} from '@/types/database'
import RequestTester from './RequestTester'

interface StepEditorProps {
  steps: TestStep[]
  onStepsChange: (steps: TestStep[]) => void
  environment?: Environment
  environments?: Environment[]
  selectedEnvId?: string | null
  onEnvChange?: (envId: string | null) => void
  mode: 'view' | 'edit'
  specId?: string
}

export default function StepEditor({
  steps,
  onStepsChange,
  environment,
  environments,
  selectedEnvId,
  onEnvChange,
  mode,
  specId
}: StepEditorProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  // Debounce save to prevent rapid re-renders
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const debouncedSave = useCallback((saveHandler: () => Promise<void>) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      saveHandler()
      saveTimerRef.current = null
    }, 300)
  }, [])

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  const handleDeleteStep = (index: number) => {
    if (!confirm(`Delete ${steps[index].name}?`)) return

    const deletedStepId = steps[index].id
    const updatedSteps = steps.filter((_, i) => i !== index)
    // Reorder remaining steps
    updatedSteps.forEach((step, i) => {
      step.order = i + 1
    })
    onStepsChange(updatedSteps)

    // Remove from expanded set
    setExpandedSteps(prev => {
      const next = new Set(prev)
      next.delete(deletedStepId)
      return next
    })
  }

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= steps.length) return

    const updatedSteps = [...steps]
    const [movedStep] = updatedSteps.splice(index, 1)
    updatedSteps.splice(newIndex, 0, movedStep)

    // Update order numbers
    updatedSteps.forEach((step, i) => {
      step.order = i + 1
    })

    onStepsChange(updatedSteps)
  }

  const handleStepUpdate = (index: number, updatedStep: TestStep) => {
    const updatedSteps = [...steps]
    updatedSteps[index] = updatedStep
    onStepsChange(updatedSteps)
  }

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-700',
      POST: 'bg-green-100 text-green-700',
      PUT: 'bg-orange-100 text-orange-700',
      PATCH: 'bg-purple-100 text-purple-700',
      DELETE: 'bg-red-100 text-red-700',
    }
    return colors[method] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <div className="text-sm text-gray-500 italic text-center py-8 border border-gray-200 rounded-lg">
          {mode === 'edit' ? 'Click "Add" to create your first step' : 'No steps configured'}
        </div>
      )}

      {steps.map((step, index) => {
        const isExpanded = expandedSteps.has(step.id)

        return (
          <div key={step.id} className="border border-gray-200 rounded-lg bg-white">
            {/* Card Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleStep(step.id)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Expand/Collapse Icon */}
                <button
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleStep(step.id)
                  }}
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>

                {/* Step Number */}
                <span className="text-sm font-semibold text-gray-500 flex-shrink-0">
                  {step.order}
                </span>

                {/* Method Badge */}
                <span className={`text-xs font-semibold px-2 py-1 rounded flex-shrink-0 ${getMethodColor(step.method)}`}>
                  {step.method}
                </span>

                {/* Step Name and Path */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {step.name}
                  </div>
                  <div className="text-xs text-gray-600 font-mono truncate">
                    {step.path}
                  </div>
                </div>

                {/* Badges for assertions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {step.assertions && step.assertions.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      ✓ {step.assertions.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {mode === 'edit' && (
                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveStep(index, 'up')
                    }}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveStep(index, 'down')
                    }}
                    disabled={index === steps.length - 1}
                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteStep(index)
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete step"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                {(() => {
                  // Determine content type from headers
                  const contentType = step.headers?.['Content-Type'] ||
                                     step.headers?.['content-type'] ||
                                     'application/json'

                  // Build canonical request body
                  let body = undefined
                  if (step.body) {
                    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
                      // For form data, create fields array
                      const fields: any[] = []
                      if (typeof step.body === 'object') {
                        Object.entries(step.body).forEach(([key, value]) => {
                          // Detect file fields
                          if (key === 'file' || key.toLowerCase().includes('file') || key.toLowerCase().includes('image')) {
                            fields.push({
                              name: key,
                              type: 'file',
                              format: 'binary',
                              required: false,
                              example: value,
                              description: 'File upload'
                            })
                          } else {
                            fields.push({
                              name: key,
                              type: 'string',
                              required: false,
                              example: value
                            })
                          }
                        })
                      }
                      body = {
                        required: true,
                        fields,
                        example: undefined
                      }
                    } else {
                      // For JSON or other types, just provide example
                      body = {
                        required: true,
                        example: step.body
                      }
                    }
                  }

                  return (
                    <RequestTester
                      key={step.id}
                      endpoint={{
                        method: step.method,
                        path: step.path,
                        name: step.description || step.name,
                        request: {
                          contentType,
                          parameters: [
                            // Convert path variables to canonical parameters
                            ...Object.keys(step.pathVariables || {}).map(key => ({
                              name: key,
                              in: 'path' as const,
                              type: 'string',
                              required: true,
                              example: step.pathVariables![key]
                            })),
                            // Convert query params to canonical parameters
                            ...Object.keys(step.queryParams || {}).map(key => ({
                              name: key,
                              in: 'query' as const,
                              type: 'string',
                              required: false,
                              example: step.queryParams![key]
                            }))
                          ],
                          body
                        },
                        assertions: step.assertions
                      } as any}
                      testCase={step as any}
                      onTestUpdate={(updates) => {
                        const updatedStep = {
                          ...step,
                          headers: updates.headers !== undefined ? updates.headers : step.headers,
                          queryParams: updates.queryParams !== undefined ? updates.queryParams : step.queryParams,
                          body: updates.body !== undefined ? updates.body : step.body,
                          assertions: updates.assertions !== undefined ? updates.assertions : step.assertions
                        }
                        handleStepUpdate(index, updatedStep)
                      }}
                      onHasChanges={(hasChanges, saveHandler) => {
                        if (hasChanges) {
                          // Debounced save to prevent rapid re-renders
                          debouncedSave(saveHandler)
                        }
                      }}
                      showSaveButton={false}
                      readOnly={mode === 'view'}
                      specId={specId}
                      selectedEnv={environment}
                      environments={environments}
                      selectedEnvId={selectedEnvId}
                      onEnvChange={onEnvChange}
                      defaultAssertions={step.assertions}
                    />
                  )
                })()}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
