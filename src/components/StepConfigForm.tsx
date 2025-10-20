/**
 * Step Config Form
 * Configuration form for a single test step
 */

import {useState} from 'react'
import type {TestStep, Environment} from '@/types/database'
import AssertionsSection from './AssertionsSection'
import VariableExtractionEditor from './VariableExtractionEditor'

interface StepConfigFormProps {
  step: TestStep
  onStepChange: (step: TestStep) => void
  environment?: Environment
  mode: 'view' | 'edit'
}

type TabType = 'request' | 'assertions' | 'variables' | 'options'

export default function StepConfigForm({
  step,
  onStepChange,
  environment,
  mode
}: StepConfigFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('request')

  const handleUpdate = (updates: Partial<TestStep>) => {
    onStepChange({ ...step, ...updates })
  }

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-500',
      POST: 'bg-green-500',
      PUT: 'bg-orange-500',
      PATCH: 'bg-purple-500',
      DELETE: 'bg-red-500',
    }
    return colors[method] || 'bg-gray-500'
  }

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div className="border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500">Step {step.order}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded text-white ${getMethodColor(step.method)}`}>
            {step.method}
          </span>
          <span className="text-sm font-mono text-gray-700">{step.path}</span>
        </div>

        {/* Step Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Step Name</label>
          <input
            type="text"
            value={step.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            disabled={mode === 'view'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="e.g., Create user, Get user details"
          />
        </div>

        {/* Step Description */}
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={step.description || ''}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            disabled={mode === 'view'}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="Optional description of what this step does"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {(['request', 'assertions', 'variables', 'options'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'assertions' && step.assertions && step.assertions.length > 0 && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 rounded-full">
                  {step.assertions.length}
                </span>
              )}
              {tab === 'variables' && step.extractVariables && step.extractVariables.length > 0 && (
                <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 rounded-full">
                  {step.extractVariables.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Request Tab */}
        {activeTab === 'request' && (
          <div className="space-y-4">
            {/* Method and Path */}
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                <select
                  value={step.method}
                  onChange={(e) => handleUpdate({ method: e.target.value })}
                  disabled={mode === 'view'}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                  <option value="HEAD">HEAD</option>
                  <option value="OPTIONS">OPTIONS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Path</label>
                <input
                  type="text"
                  value={step.path}
                  onChange={(e) => handleUpdate({ path: e.target.value })}
                  disabled={mode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                  placeholder="/users/{{userId}}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code className="bg-gray-100 px-1 rounded">{'{{variable}}'}</code> for variable substitution
                </p>
              </div>
            </div>

            {/* Headers */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Headers</label>
              <textarea
                value={JSON.stringify(step.headers || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value)
                    handleUpdate({ headers })
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                disabled={mode === 'view'}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                placeholder='{\n  "Content-Type": "application/json"\n}'
              />
            </div>

            {/* Query Parameters */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Query Parameters</label>
              <textarea
                value={JSON.stringify(step.queryParams || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const queryParams = JSON.parse(e.target.value)
                    handleUpdate({ queryParams })
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                disabled={mode === 'view'}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                placeholder='{\n  "limit": "10"\n}'
              />
            </div>

            {/* Request Body */}
            {['POST', 'PUT', 'PATCH'].includes(step.method) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Request Body</label>
                <textarea
                  value={step.body ? JSON.stringify(step.body, null, 2) : ''}
                  onChange={(e) => {
                    try {
                      const body = e.target.value ? JSON.parse(e.target.value) : undefined
                      handleUpdate({ body })
                    } catch (error) {
                      // Invalid JSON, don't update
                    }
                  }}
                  disabled={mode === 'view'}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                  placeholder='{\n  "name": "{{userName}}",\n  "email": "user@example.com"\n}'
                />
              </div>
            )}
          </div>
        )}

        {/* Assertions Tab */}
        {activeTab === 'assertions' && (
          <AssertionsSection
            assertions={(step.assertions || []) as any}
            onAssertionsChange={(assertions) => handleUpdate({ assertions: assertions as any })}
            readOnly={mode === 'view'}
            selectedEnv={environment}
          />
        )}

        {/* Variables Tab */}
        {activeTab === 'variables' && (
          <VariableExtractionEditor
            extractions={step.extractVariables || []}
            onExtractionsChange={(extractVariables) => handleUpdate({ extractVariables })}
            mode={mode}
          />
        )}

        {/* Options Tab */}
        {activeTab === 'options' && (
          <div className="space-y-4">
            {/* Timing */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Timing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Delay Before (ms)
                  </label>
                  <input
                    type="number"
                    value={step.delayBefore || 0}
                    onChange={(e) => handleUpdate({ delayBefore: parseInt(e.target.value) || 0 })}
                    disabled={mode === 'view'}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Wait before executing this step</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Delay After (ms)
                  </label>
                  <input
                    type="number"
                    value={step.delayAfter || 0}
                    onChange={(e) => handleUpdate({ delayAfter: parseInt(e.target.value) || 0 })}
                    disabled={mode === 'view'}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Wait after executing this step</p>
                </div>
              </div>
            </div>

            {/* Failure Handling */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Failure Handling</h4>
              <div className="space-y-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={step.skipOnFailure || false}
                    onChange={(e) => handleUpdate({ skipOnFailure: e.target.checked })}
                    disabled={mode === 'view'}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Skip remaining steps if this step fails
                    </div>
                    <div className="text-xs text-gray-600">
                      Stop test execution if assertions fail for this step
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={step.continueOnFailure || false}
                    onChange={(e) => handleUpdate({ continueOnFailure: e.target.checked })}
                    disabled={mode === 'view'}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Continue on HTTP/network error
                    </div>
                    <div className="text-xs text-gray-600">
                      Continue to next step even if this step throws an error
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
