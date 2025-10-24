import {Plus, X, File} from 'lucide-react'
import VariableInput from './VariableInput'

/**
 * KeyValueEditor - A flexible key-value pair editor
 *
 * Used for:
 * - Test mode: Headers, params, form-data (with optional spec-defined fields)
 * - Environment management: Variables, headers
 *
 * Key features:
 * - Variable substitution support ({{variableName}})
 * - Spec-defined fields (read-only keys) + custom entries (editable keys)
 * - File upload support for form-data
 * - Add/remove entries
 */

export interface KeyValueEntry {
  key: string
  value: any
}

export interface SpecField {
  name: string
  type?: string
  required?: boolean
  example?: any
  description?: string
}

interface KeyValueEditorProps {
  // Data
  entries: KeyValueEntry[]
  onChange: (entries: KeyValueEntry[]) => void

  // Spec-defined fields (optional - shown first with read-only keys)
  specFields?: SpecField[]

  // UI customization
  title?: string
  emptyMessage?: string
  keyPlaceholder?: string
  valuePlaceholder?: string
  addButtonLabel?: string

  // Variable support
  allowVariables?: boolean
  selectedEnv?: {
    variables?: Record<string, string>
    baseUrl?: string
    headers?: Record<string, string>
  }

  // File upload support (for form-data)
  allowFileUpload?: boolean

  // State
  readOnly?: boolean
}

export default function KeyValueEditor({
  entries,
  onChange,
  specFields = [],
  title,
  emptyMessage = 'No entries',
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addButtonLabel = 'Add Entry',
  allowVariables = false,
  selectedEnv,
  allowFileUpload = false,
  readOnly = false,
}: KeyValueEditorProps) {
  // Get spec field names for checking
  const specFieldNames = specFields.map(f => f.name)

  // Check if a key is from spec
  const isSpecField = (key: string) => specFieldNames.includes(key)

  // Get value for a key
  const getEntryValue = (key: string) => {
    return entries.find(e => e.key === key)?.value ?? ''
  }

  // Update entry (existing or new)
  const updateEntry = (key: string, value: any) => {
    const existing = entries.find(e => e.key === key)
    if (existing) {
      // Update existing
      onChange(entries.map(e => e.key === key ? { key, value } : e))
    } else {
      // Add new
      onChange([...entries, { key, value }])
    }
  }

  // Get custom entries (not from spec)
  const customEntries = entries.filter(e => !isSpecField(e.key))

  // Add custom entry
  const addCustomEntry = () => {
    const existingCustomCount = customEntries.length
    const newKey = `key${existingCustomCount + 1}`
    onChange([...entries, { key: newKey, value: '' }])
  }

  // Remove custom entry by key
  const removeCustomEntry = (key: string) => {
    onChange(entries.filter(e => e.key !== key))
  }

  // Update custom entry key
  const updateCustomEntryKey = (oldKey: string, newKey: string) => {
    onChange(entries.map(e => e.key === oldKey ? { ...e, key: newKey } : e))
  }

  // Variables for VariableInput
  const variables: Record<string, string> = {
    ...(selectedEnv?.variables || {}),
    ...(selectedEnv?.baseUrl ? { baseUrl: selectedEnv.baseUrl } : {}),
  }

  // File upload handler
  const handleFileUpload = (key: string, file: File) => {
    // Store file path (desktop) or file name (web)
    const path = (file as any).path || file.name
    updateEntry(key, path)
  }

  return (
    <div>
      {title && <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</h5>}

      <div className="space-y-2">
        {/* SECTION 1: Spec-defined fields (read-only keys, editable values) */}
        {specFields.map(field => {
          const value = getEntryValue(field.name)
          const isFile = allowFileUpload && field.type === 'file'

          return (
            <div key={field.name} className="grid grid-cols-[256px_1fr] gap-2 items-center bg-blue-50 p-2 rounded border border-blue-100">
              {/* Key (read-only) */}
              <div className="text-sm font-medium text-gray-700">
                {field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
                {field.type && <span className="text-xs text-gray-500 ml-1">({field.type})</span>}
              </div>

              {/* Value input */}
              {isFile ? (
                // File upload
                <div className="flex gap-2 items-center">
                  <label className="px-3 py-2 border border-gray-300 rounded-md text-sm text-center cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap bg-white">
                    <File size={14} className="inline mr-1" />
                    Choose File
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileUpload(field.name, file)
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <div className="text-sm text-gray-500 italic truncate flex-1" title={value}>
                    {value || 'No file chosen'}
                  </div>
                </div>
              ) : allowVariables ? (
                // Variable input
                <VariableInput
                  value={value}
                  onChange={(newValue) => updateEntry(field.name, newValue)}
                  variables={variables}
                  placeholder={field.example || `Enter ${field.name}`}
                  className="text-sm"
                />
              ) : (
                // Regular input
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateEntry(field.name, e.target.value)}
                  placeholder={field.example || `Enter ${field.name}`}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              )}
            </div>
          )
        })}

        {/* SECTION 2: Custom entries (editable keys & values) */}
        {customEntries.map((entry, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            {/* Key input */}
            <input
              type="text"
              value={entry.key}
              onChange={(e) => updateCustomEntryKey(entry.key, e.target.value)}
              placeholder={keyPlaceholder}
              disabled={readOnly}
              className="w-64 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            {/* Value input */}
            {allowVariables ? (
              <VariableInput
                value={entry.value}
                onChange={(newValue) => updateEntry(entry.key, newValue)}
                variables={variables}
                placeholder={valuePlaceholder}
                className="text-sm"
                containerClassName="flex-1"
              />
            ) : (
              <input
                type="text"
                value={entry.value}
                onChange={(e) => updateEntry(entry.key, e.target.value)}
                placeholder={valuePlaceholder}
                disabled={readOnly}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            )}

            {/* Delete button */}
            {!readOnly && (
              <button
                onClick={() => removeCustomEntry(entry.key)}
                className="p-2 text-gray-400 hover:text-red-600 rounded transition-colors"
                title="Remove"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}

        {/* Add button */}
        {!readOnly && (
          <button
            onClick={addCustomEntry}
            className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            {addButtonLabel}
          </button>
        )}

        {/* Empty state */}
        {entries.length === 0 && specFields.length === 0 && (
          <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
        )}
      </div>
    </div>
  )
}
