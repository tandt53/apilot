import {Upload} from 'lucide-react'

/**
 * SchemaViewer - Display field schema/metadata in read-only format
 *
 * Used for viewing endpoint specifications (params, headers, body fields)
 * Supports nested objects and arrays
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

interface SchemaViewerProps {
  fields: Field[]
  title?: string
  emptyMessage?: string
  depth?: number
  maxDepth?: number
}

export default function SchemaViewer({
  fields,
  title = 'Fields',
  emptyMessage = 'No fields defined',
  depth = 0,
  maxDepth = 4,
}: SchemaViewerProps) {
  if (fields.length === 0) {
    return <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
  }

  return (
    <div>
      {title && depth === 0 && (
        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</h5>
      )}

      <div className="space-y-2">
        {fields.map((field, idx) => (
          <FieldView
            key={idx}
            field={field}
            depth={depth}
            maxDepth={maxDepth}
          />
        ))}
      </div>
    </div>
  )
}

interface FieldViewProps {
  field: Field
  depth: number
  maxDepth: number
}

function FieldView({ field, depth, maxDepth }: FieldViewProps) {
  return (
    <div className="p-3 bg-gray-50 rounded border border-gray-200">
      {/* Field name and type badges */}
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

      {/* Description */}
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
          {field.items.type === 'file' && (
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
              <Upload size={12} /> multiple file upload
            </span>
          )}
        </div>
      )}

      {/* Example value */}
      {field.example !== undefined && field.type !== 'file' && (
        <div className="mt-2 text-xs">
          <span className="font-medium text-gray-600">Example:</span>{' '}
          <code className="text-purple-600">{JSON.stringify(field.example)}</code>
        </div>
      )}

      {/* Enum values */}
      {field.enum && field.enum.length > 0 && (
        <div className="mt-2 text-xs">
          <span className="font-medium text-gray-600">Allowed values:</span>{' '}
          {field.enum.map((v, i) => (
            <code key={i} className="text-purple-600 mr-1">{JSON.stringify(v)}</code>
          ))}
        </div>
      )}

      {/* Nested properties for object type */}
      {field.type === 'object' && field.properties && field.properties.length > 0 && depth < maxDepth && (
        <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-300">
          <p className="text-xs font-semibold text-gray-600 mb-2">Properties:</p>
          <div className="space-y-2">
            {field.properties.map((prop, idx) => (
              <FieldView
                key={idx}
                field={prop}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
