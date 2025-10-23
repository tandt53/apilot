/**
 * Spec Edit Dialog
 * Modal dialog for editing spec metadata (name, version, description, baseUrl)
 */

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertCircle, Check } from 'lucide-react'
import type { Spec } from '@/types/database'

interface SpecEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spec: Spec
  onSave: (updates: SpecUpdateData) => Promise<void>
}

export interface SpecUpdateData {
  name: string
  version: string
  description?: string
  baseUrl?: string
}

interface ValidationErrors {
  name?: string
  version?: string
  baseUrl?: string
}

export default function SpecEditDialog({
  open,
  onOpenChange,
  spec,
  onSave,
}: SpecEditDialogProps) {
  const [formData, setFormData] = useState<SpecUpdateData>({
    name: spec.name,
    version: spec.version,
    description: spec.description || '',
    baseUrl: spec.baseUrl || '',
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Reset form when spec changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: spec.name,
        version: spec.version,
        description: spec.description || '',
        baseUrl: spec.baseUrl || '',
      })
      setErrors({})
      setSaveSuccess(false)
    }
  }, [open, spec])

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    // Version validation (semantic versioning)
    if (!formData.version.trim()) {
      newErrors.version = 'Version is required'
    } else if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(formData.version.trim())) {
      newErrors.version = 'Version must be in semantic format (e.g., 1.0.0)'
    }

    // Base URL validation (optional, but must be valid if provided)
    if (formData.baseUrl && formData.baseUrl.trim()) {
      try {
        new URL(formData.baseUrl.trim())
      } catch {
        newErrors.baseUrl = 'Base URL must be a valid URL (e.g., https://api.example.com)'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        name: formData.name.trim(),
        version: formData.version.trim(),
        description: formData.description?.trim() || undefined,
        baseUrl: formData.baseUrl?.trim() || undefined,
      })
      setSaveSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
      }, 500)
    } catch (error: any) {
      setErrors({ name: `Save failed: ${error.message}` })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-panel rounded-3xl shadow-glass-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto z-50"
          onKeyDown={handleKeyDown}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-2xl font-bold text-gray-900">
                Edit Spec
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="My API"
                  autoFocus
                />
                {errors.name && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.name}</span>
                  </div>
                )}
              </div>

              {/* Version Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.version ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="1.0.0"
                />
                {errors.version && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.version}</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Use semantic versioning (e.g., 1.0.0, 2.1.3, 1.0.0-beta)
                </p>
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Optional description of your API"
                  rows={3}
                />
              </div>

              {/* Base URL Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm ${
                    errors.baseUrl ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://api.example.com"
                />
                {errors.baseUrl && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.baseUrl}</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Default base URL for API requests
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                {saveSuccess && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="w-4 h-4" />
                    <span>Saved successfully!</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>

            {/* Keyboard Shortcut Hint */}
            <p className="text-xs text-gray-400 mt-2 text-center">
              Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘/Ctrl + Enter</kbd> to save
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
