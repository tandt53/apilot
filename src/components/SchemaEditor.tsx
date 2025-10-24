import {useState} from 'react'
import {Plus, X, Upload} from 'lucide-react'

/**
 * SchemaEditor - Define/edit field structure (API contract definition)
 *
 * Used for editing endpoint specifications (params, headers, body fields)
 * Supports nested objects and arrays with type validation per context
 */

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

interface SchemaEditorProps {
  fields: Field[]
  onChange: (fields: Field[]) => void

  title?: string
  emptyMessage?: string
  depth?: number
  maxDepth?: number
  context?: FieldContext
  readOnly?: boolean
}

export default function SchemaEditor({
  fields,
  onChange,
  title = 'Fields',
  emptyMessage = 'No fields defined',
  depth = 0,
  maxDepth = 4,
  context = 'body-json',
  readOnly = false,
}: SchemaEditorProps) {
  const canNest = depth < maxDepth

  const handleAddField = (newField: Field) => {
    onChange([...fields, newField])
  }

  const handleUpdateField = (index: number, updates: Partial<Field>) => {
    const updatedFields = [...fields]
    updatedFields[index] = { ...updatedFields[index], ...updates }
    onChange(updatedFields)
  }

  const handleRemoveField = (index: number) => {
    const updatedFields = fields.filter((_, i) => i !== index)
    onChange(updatedFields)
  }

  return (
    <div>
      {title && depth === 0 && (
        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</h5>
      )}

      <div className="space-y-2">
        {fields.length > 0 ? (
          <>
            {fields.map((field, idx) => (
              <FieldEditRow
                key={idx}
                field={field}
                onUpdate={(updates) => handleUpdateField(idx, updates)}
                onRemove={() => handleRemoveField(idx)}
                depth={depth}
                maxDepth={maxDepth}
                canNest={canNest}
                context={context}
                readOnly={readOnly}
              />
            ))}

            {/* Add new field row */}
            {!readOnly && (
              <AddFieldRow onAdd={handleAddField} canNest={canNest} context={context} />
            )}
          </>
        ) : (
          <>
            {!readOnly ? (
              <AddFieldRow onAdd={handleAddField} canNest={canNest} context={context} />
            ) : (
              <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface FieldEditRowProps {
  field: Field
  onUpdate: (updates: Partial<Field>) => void
  onRemove: () => void
  depth: number
  maxDepth: number
  canNest: boolean
  context: FieldContext
  readOnly: boolean
}

function FieldEditRow({
  field,
  onUpdate,
  onRemove,
  depth,
  maxDepth,
  canNest,
  context,
  readOnly,
}: FieldEditRowProps) {
  const allowedTypes = getAllowedTypes(context)
  const allowedItemTypes = getAllowedItemTypes(context)

  return (
    <div className="bg-gray-50 rounded border border-gray-200">
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Name input */}
          <input
            type="text"
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            disabled={readOnly}
            className="w-32 text-sm font-mono text-gray-900 border border-gray-300 rounded px-2 py-1.5"
            placeholder="key"
          />

          {/* Type selector */}
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
              onUpdate(updates)
            }}
            disabled={readOnly}
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

          {/* Required checkbox */}
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            disabled={readOnly}
            className="mt-2 rounded"
            title="Required"
          />

          {/* Description input */}
          <input
            type="text"
            value={field.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={readOnly}
            className="flex-1 text-sm text-gray-600 border border-gray-300 rounded px-2 py-1.5"
            placeholder="Description"
          />

          {/* Remove button */}
          {!readOnly && (
            <button
              onClick={onRemove}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
              title="Remove field"
            >
              <X size={16} />
            </button>
          )}
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
                onUpdate(updates)
              }}
              disabled={readOnly}
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
          <SchemaEditor
            fields={field.properties || []}
            onChange={(newProps) => onUpdate({ properties: newProps })}
            title="Properties"
            emptyMessage="No properties"
            depth={depth + 1}
            maxDepth={maxDepth}
            context={context}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  )
}

interface AddFieldRowProps {
  onAdd: (field: Field) => void
  canNest: boolean
  context: FieldContext
}

function AddFieldRow({ onAdd, canNest, context }: AddFieldRowProps) {
  const allowedTypes = getAllowedTypes(context)
  const allowedItemTypes = getAllowedItemTypes(context)

  const [name, setName] = useState('')
  const [type, setType] = useState('string')
  const [required, setRequired] = useState(false)
  const [description, setDescription] = useState('')
  const [arrayItemType, setArrayItemType] = useState('string')

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
        {/* Name input */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-32 text-sm font-mono border border-gray-300 rounded px-2 py-1.5"
          placeholder="key"
        />

        {/* Type selector */}
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

        {/* Array item type selector (conditional) */}
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

        {/* Required checkbox */}
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="mt-2 rounded"
          title="Required"
        />

        {/* Description input */}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5"
          placeholder="Description (optional)"
        />

        {/* Add button */}
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
