import {File, Plus, Upload, X} from 'lucide-react'
import VariableInput from './VariableInput'

export interface Field {
  name: string
  type: string
  required?: boolean
  description?: string
  example?: any
  format?: string
  enum?: any[]
  properties?: Field[]  // For nested objects
  items?: {             // For arrays
    type: string
    example?: any
  }
}

type FieldContext = 'params' | 'headers' | 'body-json' | 'body-form' | 'body-urlencoded'

/**
 * Get allowed field types based on context
 */
function getAllowedTypes(context: FieldContext): string[] {
  switch (context) {
    case 'params':
    case 'headers':
      // Params and headers support primitives and arrays, NO objects
      return ['string', 'number', 'integer', 'boolean', 'array']

    case 'body-json':
      // JSON body supports all types including nested objects
      return ['string', 'number', 'integer', 'boolean', 'array', 'object']

    case 'body-form':
      // Form-data supports primitives and files, NO arrays or objects
      return ['string', 'number', 'integer', 'boolean', 'file']

    case 'body-urlencoded':
      // URL-encoded supports primitives and arrays, NO objects
      return ['string', 'number', 'integer', 'boolean', 'array']

    default:
      return ['string', 'number', 'integer', 'boolean', 'array', 'object']
  }
}

/**
 * Get allowed item types for arrays based on context
 */
function getAllowedItemTypes(context: FieldContext): string[] {
  switch (context) {
    case 'params':
    case 'headers':
    case 'body-urlencoded':
      // Array items in params/headers/urlencoded: primitives only
      return ['string', 'number', 'integer', 'boolean']

    case 'body-form':
      // Array items in form-data: primitives + files (for multiple file upload)
      return ['string', 'number', 'integer', 'boolean', 'file']

    case 'body-json':
      // Array items in JSON: primitives + nested objects
      return ['string', 'number', 'integer', 'boolean', 'object']

    default:
      return ['string', 'number', 'integer', 'boolean']
  }
}

interface FieldEditorProps {
  fields: Field[]
  onFieldsChange?: (fields: Field[]) => void
  mode: 'view' | 'edit' | 'test'
  title?: string
  emptyMessage?: string
  depth?: number
  maxDepth?: number
  context?: FieldContext
  // Test mode props
  testValues?: Record<string, any>
  onTestValuesChange?: (values: Record<string, any>) => void
  selectedEnv?: any
}

export default function FieldEditor({
  fields,
  onFieldsChange,
  mode,
  title = 'Fields',
  emptyMessage = 'No fields defined',
  depth = 0,
  maxDepth = 4,
  context = 'body-json',
  testValues = {},
  onTestValuesChange,
  selectedEnv
}: FieldEditorProps) {
  const isEditable = mode === 'edit' && !!onFieldsChange
  const canNest = depth < maxDepth

  const handleAddField = (newField: Omit<Field, 'name' | 'type'> & { name: string; type: string }) => {
    if (!onFieldsChange) return
    onFieldsChange([...fields, newField])
  }

  const handleUpdateField = (index: number, updates: Partial<Field>) => {
    if (!onFieldsChange) return
    const updatedFields = [...fields]
    updatedFields[index] = { ...updatedFields[index], ...updates }
    onFieldsChange(updatedFields)
  }

  const handleRemoveField = (index: number) => {
    if (!onFieldsChange) return
    const updatedFields = fields.filter((_, i) => i !== index)
    onFieldsChange(updatedFields)
  }

  return (
    <div>
      {title && <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</h5>}

      <div className="space-y-2">
        {fields.length > 0 ? (
          <>
            {fields.map((field, idx) => (
              <FieldRow
                key={idx}
                field={field}
                mode={mode}
                onUpdate={(updates) => handleUpdateField(idx, updates)}
                onRemove={() => handleRemoveField(idx)}
                depth={depth}
                maxDepth={maxDepth}
                canNest={canNest}
                context={context}
                testValue={testValues[field.name]}
                onTestValueChange={(value) => {
                  if (onTestValuesChange) {
                    onTestValuesChange({ ...testValues, [field.name]: value })
                  }
                }}
                selectedEnv={selectedEnv}
              />
            ))}

            {/* Add new field row */}
            {isEditable && (
              <AddFieldRow onAdd={handleAddField} canNest={canNest} context={context} />
            )}
          </>
        ) : (
          <>
            {mode === 'view' ? (
              <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
            ) : (
              // Edit mode with no fields - just show the add row
              isEditable && <AddFieldRow onAdd={handleAddField} canNest={canNest} context={context} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface FieldRowProps {
  field: Field
  mode: 'view' | 'edit' | 'test'
  onUpdate?: (updates: Partial<Field>) => void
  onRemove?: () => void
  depth?: number
  maxDepth?: number
  canNest?: boolean
  context?: FieldContext
  testValue?: any
  onTestValueChange?: (value: any) => void
  selectedEnv?: any
}

function FieldRow({ field, mode, onUpdate, onRemove, depth = 0, maxDepth = 4, canNest = true, context = 'body-json', testValue, onTestValueChange, selectedEnv }: FieldRowProps) {
  const allowedTypes = getAllowedTypes(context)
  const allowedItemTypes = getAllowedItemTypes(context)

  // Test mode - simple key-value input
  if (mode === 'test') {
    const value = testValue !== undefined ? testValue : (field.example || '')

    if (field.type === 'file') {
      // File upload: 2 columns - name, upload button + file path (no delete in test mode)
      // testValue stores the file path string
      const filePath = testValue || ''

      return (
        <div className="grid grid-cols-[200px_1fr] gap-2 items-center">
          <div className="text-sm font-medium text-gray-700">
            {field.name}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </div>
          <div className="flex gap-2 items-center">
            <label className="px-3 py-2 border border-gray-300 rounded-md text-sm text-center cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap">
              <File size={14} className="inline mr-1" />
              Choose File
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    // Store the file path (or name for web, full path for desktop)
                    const path = (file as any).path || file.name
                    onTestValueChange?.(path)
                  }
                }}
                className="hidden"
              />
            </label>
            <div className="text-sm text-gray-500 italic truncate flex-1" title={filePath}>
              {filePath || 'No file chosen'}
            </div>
          </div>
        </div>
      )
    }

    // Regular input: 2 columns - name, value input (no delete in test mode)
    return (
      <div className="grid grid-cols-[200px_1fr] gap-2 items-center">
        <div className="text-sm font-medium text-gray-700">
          {field.name}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </div>
        <VariableInput
          value={value}
          onChange={(newValue) => onTestValueChange?.(newValue)}
          variables={selectedEnv?.variables || {}}
          placeholder={field.example || `Enter ${field.name}`}
          className="text-sm"
        />
      </div>
    )
  }

  if (mode === 'view') {
    return (
      <div className="p-3 bg-gray-50 rounded border border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-sm font-mono text-gray-900">{field.name}</code>
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
            {field.type}
          </span>
          {field.format && (
            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
              {field.format}
            </span>
          )}
          {field.required && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
              required
            </span>
          )}
          {field.type === 'file' && (
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
              <Upload size={12} /> file upload
            </span>
          )}
        </div>
        {field.description && (
          <p className="text-xs text-gray-600 mt-1">{field.description}</p>
        )}
        {/* Array item type info */}
        {field.type === 'array' && field.items && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Items:</span>
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
              {field.items.type}
            </span>
            {field.items.type === 'file' || field.items.format === 'binary' && (
              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                <Upload size={12} /> multiple file upload
              </span>
            )}
          </div>
        )}
        {field.example !== undefined && field.type !== 'file' && (
          <div className="mt-2 text-xs">
            <span className="font-medium text-gray-600">Example:</span>{' '}
            <code className="text-purple-600">{JSON.stringify(field.example)}</code>
          </div>
        )}
        {field.enum && field.enum.length > 0 && (
          <div className="mt-2 text-xs">
            <span className="font-medium text-gray-600">Allowed values:</span>{' '}
            {field.enum.map((v, i) => (
              <code key={i} className="text-purple-600 mr-1">{JSON.stringify(v)}</code>
            ))}
          </div>
        )}
        {/* Nested properties for object type */}
        {field.type === 'object' && field.properties && field.properties.length > 0 && (
          <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-300">
            <p className="text-xs font-semibold text-gray-600 mb-2">Properties:</p>
            <div className="space-y-2">
              {field.properties.map((prop, idx) => (
                <FieldRow
                  key={idx}
                  field={prop}
                  mode="view"
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  canNest={depth + 1 < maxDepth}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="bg-gray-50 rounded border border-gray-200">
      <div className="p-3">
        <div className="flex items-start gap-2">
          <input
            type="text"
            value={field.name}
            onChange={(e) => onUpdate?.({ name: e.target.value })}
            className="w-32 text-sm font-mono text-gray-900 border border-gray-300 rounded px-2 py-1.5"
            placeholder="key"
          />
          <select
            value={field.type}
            onChange={(e) => {
              const newType = e.target.value
              const updates: Partial<Field> = { type: newType }
              // Initialize properties for object type
              if (newType === 'object' && !field.properties) {
                updates.properties = []
              }
              // Initialize items for array type
              if (newType === 'array' && !field.items) {
                updates.items = { type: 'string' }
              }
              // Set format for file type
              if (newType === 'file') {
                updates.format = 'binary'
              }
              onUpdate?.(updates)
            }}
            className="w-24 text-xs px-2 py-1.5 bg-blue-100 text-blue-700 rounded border border-blue-300"
          >
            {allowedTypes.includes('string') && <option value="string">string</option>}
            {allowedTypes.includes('number') && <option value="number">number</option>}
            {allowedTypes.includes('integer') && <option value="integer">integer</option>}
            {allowedTypes.includes('boolean') && <option value="boolean">boolean</option>}
            {allowedTypes.includes('array') && <option value="array">array</option>}
            {allowedTypes.includes('object') && (
              <option value="object" disabled={!canNest}>
                object {!canNest && '(max depth)'}
              </option>
            )}
            {allowedTypes.includes('file') && <option value="file">file</option>}
          </select>
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={(e) => onUpdate?.({ required: e.target.checked })}
            className="mt-2 rounded"
            title="Required"
          />
          <input
            type="text"
            value={field.description || ''}
            onChange={(e) => onUpdate?.({ description: e.target.value })}
            className="flex-1 text-sm text-gray-600 border border-gray-300 rounded px-2 py-1.5"
            placeholder="Description"
          />
          <button
            onClick={onRemove}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
            title="Remove field"
          >
            <X size={16} />
          </button>
        </div>

        {/* Array item type selector */}
        {field.type === 'array' && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Array Items:</span>
            <select
              value={field.items?.type || 'string'}
              onChange={(e) => {
                const itemType = e.target.value
                const updates: Partial<Field> = {
                  items: {
                    type: itemType,
                    ...(itemType === 'file' && { format: 'binary' })
                  }
                }
                onUpdate?.(updates)
              }}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded border border-green-300"
            >
              {allowedItemTypes.includes('string') && <option value="string">string</option>}
              {allowedItemTypes.includes('number') && <option value="number">number</option>}
              {allowedItemTypes.includes('integer') && <option value="integer">integer</option>}
              {allowedItemTypes.includes('boolean') && <option value="boolean">boolean</option>}
              {allowedItemTypes.includes('object') && <option value="object">object</option>}
              {allowedItemTypes.includes('file') && <option value="file">file</option>}
            </select>
            {field.items?.type === 'file' && (
              <span className="text-xs text-purple-600 flex items-center gap-1">
                <Upload size={12} /> Multiple file uploads
              </span>
            )}
          </div>
        )}

        {/* File type preview/info */}
        {field.type === 'file' && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded">
            <Upload size={16} className="text-purple-600" />
            <span className="text-xs text-purple-700">
              This field will accept file uploads in the request tester
            </span>
          </div>
        )}
      </div>

      {/* Nested properties editor for object type */}
      {field.type === 'object' && (
        <div className="ml-4 pl-4 border-l-2 border-gray-300 pb-3 pr-3">
          <FieldEditor
            fields={field.properties || []}
            onFieldsChange={(newProps) => onUpdate?.({ properties: newProps })}
            mode="edit"
            title="Properties"
            emptyMessage="No properties"
            depth={depth + 1}
            maxDepth={maxDepth}
          />
        </div>
      )}
    </div>
  )
}

interface AddFieldRowProps {
  onAdd: (field: Field) => void
  canNest?: boolean
  context?: FieldContext
}

function AddFieldRow({ onAdd, canNest = true, context = 'body-json' }: AddFieldRowProps) {
  const allowedTypes = getAllowedTypes(context)
  const allowedItemTypes = getAllowedItemTypes(context)
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState('string')
  const [required, setRequired] = React.useState(false)
  const [description, setDescription] = React.useState('')
  const [arrayItemType, setArrayItemType] = React.useState('string')

  const handleAdd = () => {
    if (!name) return

    const newField: Field = {
      name,
      type,
      required,
      description: description || undefined
    }

    // Initialize items for array type
    if (type === 'array') {
      newField.items = {
        type: arrayItemType,
        ...(arrayItemType === 'file' && { format: 'binary' })
      }
    }

    // Initialize properties for object type
    if (type === 'object') {
      newField.properties = []
    }

    // Set format for file type
    if (type === 'file') {
      newField.format = 'binary'
    }

    onAdd(newField)

    // Reset form
    setName('')
    setType('string')
    setRequired(false)
    setDescription('')
    setArrayItemType('string')
  }

  return (
    <div className="p-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-32 text-sm font-mono border border-gray-300 rounded px-2 py-1.5"
          placeholder="key"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-24 text-xs px-2 py-1.5 bg-blue-100 text-blue-700 rounded border border-blue-300"
        >
          {allowedTypes.includes('string') && <option value="string">string</option>}
          {allowedTypes.includes('number') && <option value="number">number</option>}
          {allowedTypes.includes('integer') && <option value="integer">integer</option>}
          {allowedTypes.includes('boolean') && <option value="boolean">boolean</option>}
          {allowedTypes.includes('array') && <option value="array">array</option>}
          {allowedTypes.includes('object') && (
            <option value="object" disabled={!canNest}>
              object {!canNest && '(max depth)'}
            </option>
          )}
          {allowedTypes.includes('file') && <option value="file">file</option>}
        </select>
        {type === 'array' && (
          <select
            value={arrayItemType}
            onChange={(e) => setArrayItemType(e.target.value)}
            className="w-20 text-xs px-2 py-1.5 bg-green-100 text-green-700 rounded border border-green-300"
            title="Array item type"
          >
            {allowedItemTypes.includes('string') && <option value="string">string</option>}
            {allowedItemTypes.includes('number') && <option value="number">number</option>}
            {allowedItemTypes.includes('integer') && <option value="integer">integer</option>}
            {allowedItemTypes.includes('boolean') && <option value="boolean">boolean</option>}
            {allowedItemTypes.includes('object') && <option value="object">object</option>}
            {allowedItemTypes.includes('file') && <option value="file">file</option>}
          </select>
        )}
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="mt-2 rounded"
          title="Required"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5"
          placeholder="Description (optional)"
        />
        <button
          onClick={handleAdd}
          disabled={!name}
          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          title="Add field"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

// Need to import React for useState hook
import React from 'react'
