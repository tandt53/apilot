import {useEffect, useState} from 'react'
import {Download, Plus, Trash2, Upload} from 'lucide-react'
import * as api from '@/lib/api'
import {useCreateEnvironment, useDeleteEnvironment, useUpdateEnvironment} from '@/lib/hooks'
import type {Environment} from '@/types/database'
import KeyValueEditor from './KeyValueEditor'
import {validateVariables, formatValidationErrors} from '@/lib/utils/validateVariables'
import {validateUrl, validateTextLength} from '@/lib/utils/validation'

interface EnvironmentManagerProps {
  specId: number
  specName: string
  environments: Environment[] | undefined
  selectedEnvId: string | null
  onEnvChange: (envId: string | null) => void
  hideTitle?: boolean
  compact?: boolean
}

export default function EnvironmentManager({
  specId,
  specName,
  environments,
  selectedEnvId,
  onEnvChange,
  hideTitle = false,
  compact = false,
}: EnvironmentManagerProps) {
  const selectedEnv = environments?.find(env => env.id === selectedEnvId)

  // Environment form state
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [envForm, setEnvForm] = useState({
    name: '',
    baseUrl: '',
    description: '',
    variables: {} as Record<string, string>,
    headers: {} as Record<string, string>,
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [errors, setErrors] = useState<{
    name?: string
    baseUrl?: string
    description?: string
  }>({})

  // Environment mutations
  const createEnvironment = useCreateEnvironment()
  const updateEnvironment = useUpdateEnvironment()
  const deleteEnvironment = useDeleteEnvironment()

  // Auto-load selected environment into form
  useEffect(() => {
    if (selectedEnv) {
      setEditingEnv(selectedEnv)
      setEnvForm({
        name: selectedEnv.name,
        baseUrl: selectedEnv.baseUrl,
        description: selectedEnv.description || '',
        variables: selectedEnv.variables || {},
        headers: selectedEnv.headers || {},
      })
      setHasUnsavedChanges(false)
      setErrors({})
    } else {
      setEditingEnv(null)
      setEnvForm({ name: '', baseUrl: '', description: '', variables: {}, headers: {} })
      setHasUnsavedChanges(false)
      setErrors({})
    }
  }, [selectedEnv])

  // Detect form changes
  useEffect(() => {
    if (editingEnv) {
      const hasChanges =
        envForm.name !== editingEnv.name ||
        envForm.baseUrl !== editingEnv.baseUrl ||
        envForm.description !== (editingEnv.description || '') ||
        JSON.stringify(envForm.variables) !== JSON.stringify(editingEnv.variables || {}) ||
        JSON.stringify(envForm.headers) !== JSON.stringify(editingEnv.headers || {})
      setHasUnsavedChanges(hasChanges)
    } else {
      const hasContent =
        envForm.name.trim() !== '' ||
        envForm.baseUrl.trim() !== '' ||
        envForm.description.trim() !== '' ||
        Object.keys(envForm.variables).length > 0 ||
        Object.keys(envForm.headers).length > 0
      setHasUnsavedChanges(hasContent)
    }
  }, [envForm, editingEnv])

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    // Validate name
    const nameValidation = validateTextLength(envForm.name, {
      fieldName: 'Environment name',
      required: true,
      minLength: 1,
      maxLength: 100
    })
    if (!nameValidation.isValid) {
      newErrors.name = nameValidation.error
    }

    // Check for duplicate environment names (case-insensitive)
    if (environments) {
      const existingEnvs = editingEnv
        ? environments.filter(env => env.id !== editingEnv.id)
        : environments

      const isDuplicate = existingEnvs.some(
        env => env.name.toLowerCase().trim() === envForm.name.toLowerCase().trim()
      )

      if (isDuplicate) {
        newErrors.name = 'Environment name already exists. Please use a unique name.'
      }
    }

    // Validate base URL
    const urlValidation = validateUrl(envForm.baseUrl, true)
    if (!urlValidation.isValid) {
      newErrors.baseUrl = urlValidation.error
    }

    // Validate description length (optional field)
    if (envForm.description) {
      const descValidation = validateTextLength(envForm.description, {
        fieldName: 'Description',
        required: false,
        maxLength: 500
      })
      if (!descValidation.isValid) {
        newErrors.description = descValidation.error
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handlers
  const handleCreateEnv = async () => {
    // Validate form inputs
    if (!validateForm()) {
      return
    }

    // Validate variables for cyclic references
    const validation = validateVariables(envForm.variables)
    if (!validation.valid) {
      alert(`Cannot save environment:\n\n${formatValidationErrors(validation)}`)
      return
    }

    const newEnv = await createEnvironment.mutateAsync({
      specId,
      name: envForm.name,
      baseUrl: envForm.baseUrl,
      description: envForm.description,
      variables: envForm.variables,
      headers: envForm.headers,
    })

    onEnvChange(newEnv.id)
    setHasUnsavedChanges(false)
    setErrors({})
  }

  const handleUpdateEnv = async () => {
    if (!editingEnv) return

    // Validate form inputs
    if (!validateForm()) {
      return
    }

    // Validate variables for cyclic references
    const validation = validateVariables(envForm.variables)
    if (!validation.valid) {
      alert(`Cannot save environment:\n\n${formatValidationErrors(validation)}`)
      return
    }

    await updateEnvironment.mutateAsync({
      id: editingEnv.id,
      specId,
      data: envForm,
    })

    onEnvChange(editingEnv.id)
    setHasUnsavedChanges(false)
    setErrors({})
  }

  const handleDeleteEnv = async (envId: string) => {
    if (!confirm('Delete this environment?')) return
    await deleteEnvironment.mutateAsync({ id: envId, specId })
    onEnvChange(null)
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${compact ? 'p-0 space-y-4' : 'p-6 space-y-6'}`}>
      {!hideTitle && (
        <h3 className="text-lg font-semibold text-gray-900">Environments</h3>
      )}

      {/* Active Environment Selector */}
      <div>
        <label className={`block text-sm font-medium text-gray-700 ${compact ? 'mb-1.5' : 'mb-2'}`}>Active Environment</label>
        {environments && environments.length > 0 ? (
          <select
            value={selectedEnvId || ''}
            onChange={(e) => onEnvChange(e.target.value || null)}
            className={`w-full border border-gray-300 rounded text-sm ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
          >
            <option value="">None (default)</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name} - {env.baseUrl}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-gray-500">No environments configured. Add one below.</p>
        )}
      </div>

      {/* Environment Form */}
      <div className={`border-t border-gray-200 ${compact ? 'pt-4' : 'pt-6'}`}>
        <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-4'}`}>
          <h4 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : ''}`}>
            {selectedEnv ? 'Edit Environment' : 'Add Environment'}
          </h4>
          <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
            <button
              onClick={() => {
                onEnvChange(null)
                setEditingEnv(null)
                setEnvForm({ name: '', baseUrl: '', description: '', variables: {}, headers: {} })
                setErrors({})
              }}
              className={`flex items-center gap-1 text-xs text-purple-600 hover:bg-purple-50 rounded ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
              title="Add New Environment"
            >
              <Plus size={compact ? 12 : 14} />
              New
            </button>
            {selectedEnv && (
              <button
                onClick={() => handleDeleteEnv(selectedEnv.id)}
                className={`flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 rounded ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
                title="Delete Selected Environment"
              >
                <Trash2 size={compact ? 12 : 14} />
                Delete
              </button>
            )}
            {!compact && <div className="h-4 border-l border-gray-300 mx-1"></div>}
            <button
              onClick={async () => {
                const exported = await api.exportEnvironments(specId)
                const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${specName}-environments.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className={`flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 rounded ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
              title="Export All"
            >
              <Download size={compact ? 12 : 14} />
              Export
            </button>
            <label className={`flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 rounded cursor-pointer ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}`} title="Import">
              <Upload size={compact ? 12 : 14} />
              Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const text = await file.text()
                    const data = JSON.parse(text)
                    if (!data.environments || !Array.isArray(data.environments)) {
                      alert('Invalid environment file format')
                      return
                    }
                    await api.importEnvironments(specId, data.environments)
                    alert(`Imported ${data.environments.length} environments successfully!`)
                  } catch (error: any) {
                    alert(`Failed to import: ${error.message}`)
                  }
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>

        <div className={`bg-gray-50 rounded-lg ${compact ? 'p-3 space-y-3' : 'p-4 space-y-4'}`}>
          <div className={`grid grid-cols-2 ${compact ? 'gap-3' : 'gap-4'}`}>
            <div>
              <label className={`block text-sm font-medium text-gray-700 ${compact ? 'mb-1 text-xs' : 'mb-1'}`}>Name *</label>
              <input
                type="text"
                value={envForm.name}
                onChange={(e) => {
                  setEnvForm({ ...envForm, name: e.target.value })
                  if (errors.name) {
                    setErrors(prev => ({ ...prev, name: undefined }))
                  }
                }}
                placeholder="e.g., Development"
                className={`w-full border rounded text-sm ${compact ? 'px-2 py-1' : 'px-3 py-2'} focus:outline-none focus:ring-2 ${
                  errors.name
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>
            <div>
              <label className={`block text-sm font-medium text-gray-700 ${compact ? 'mb-1 text-xs' : 'mb-1'}`}>Base URL *</label>
              <input
                type="text"
                value={envForm.baseUrl}
                onChange={(e) => {
                  setEnvForm({ ...envForm, baseUrl: e.target.value })
                  if (errors.baseUrl) {
                    setErrors(prev => ({ ...prev, baseUrl: undefined }))
                  }
                }}
                placeholder="https://api.example.com"
                className={`w-full border rounded text-sm ${compact ? 'px-2 py-1' : 'px-3 py-2'} focus:outline-none focus:ring-2 ${
                  errors.baseUrl
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
              />
              {errors.baseUrl && (
                <p className="text-xs text-red-600 mt-1">{errors.baseUrl}</p>
              )}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-gray-700 ${compact ? 'mb-1 text-xs' : 'mb-1'}`}>Description</label>
            <input
              type="text"
              value={envForm.description}
              onChange={(e) => {
                setEnvForm({ ...envForm, description: e.target.value })
                if (errors.description) {
                  setErrors(prev => ({ ...prev, description: undefined }))
                }
              }}
              placeholder="Optional description"
              className={`w-full border rounded text-sm ${compact ? 'px-2 py-1' : 'px-3 py-2'} focus:outline-none focus:ring-2 ${
                errors.description
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-purple-500'
              }`}
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description}</p>
            )}
          </div>

          {/* Variables */}
          <div>
            <label className={`block text-sm font-medium text-gray-700 ${compact ? 'mb-1.5 text-xs' : 'mb-2'}`}>
              Variables (use as {`{{variableName}}`} in requests)
            </label>
            <KeyValueEditor
              entries={Object.entries(envForm.variables).map(([key, value]) => ({ key, value }))}
              onChange={(entries) => {
                const variables = Object.fromEntries(entries.map(e => [e.key, e.value]))
                setEnvForm({ ...envForm, variables })
              }}
              keyPlaceholder="Variable name"
              valuePlaceholder="Value"
              addButtonLabel="Add Variable"
              emptyMessage="No variables defined"
              allowVariables={true}
              selectedEnv={{ variables: envForm.variables, baseUrl: envForm.baseUrl, headers: envForm.headers }}
            />
          </div>

          {/* Headers */}
          <div>
            <label className={`block text-sm font-medium text-gray-700 ${compact ? 'mb-1.5 text-xs' : 'mb-2'}`}>
              Headers (automatically added to all requests)
            </label>
            <KeyValueEditor
              entries={Object.entries(envForm.headers).map(([key, value]) => ({ key, value }))}
              onChange={(entries) => {
                const headers = Object.fromEntries(entries.map(e => [e.key, e.value]))
                setEnvForm({ ...envForm, headers })
              }}
              keyPlaceholder="Header name"
              valuePlaceholder="Value"
              addButtonLabel="Add Header"
              emptyMessage="No headers defined"
              allowVariables={true}
              selectedEnv={selectedEnv}
            />
          </div>

          {/* Form Actions */}
          <div className={compact ? 'flex gap-1.5' : 'flex gap-2'}>
            {editingEnv ? (
              <>
                <button
                  onClick={handleUpdateEnv}
                  disabled={!hasUnsavedChanges}
                  className={`rounded transition-colors ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'} ${
                    hasUnsavedChanges
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    onEnvChange(null)
                    setEditingEnv(null)
                    setEnvForm({ name: '', baseUrl: '', description: '', variables: {}, headers: {} })
                    setErrors({})
                  }}
                  className={`bg-gray-200 text-gray-700 rounded hover:bg-gray-300 ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleCreateEnv}
                disabled={!hasUnsavedChanges}
                className={`rounded transition-colors ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'} ${
                  hasUnsavedChanges
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
