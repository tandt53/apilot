import {useState} from 'react'
import {Plus, Trash2} from 'lucide-react'
import type {CanonicalField} from '@/types/canonical'

interface BodyFieldsEditorProps {
  fields: CanonicalField[]
  onChange: (fields: CanonicalField[]) => void
}

export default function BodyFieldsEditor({fields, onChange}: BodyFieldsEditorProps) {
  const [bodyFields, setBodyFields] = useState<CanonicalField[]>(fields || [])

  const handleAdd = () => {
    const newField: CanonicalField = {
      name: '',
      type: 'string',
      required: false,
      description: '',
      example: ''
    }
    const updated = [...bodyFields, newField]
    setBodyFields(updated)
    onChange(updated)
  }

  const handleRemove = (index: number) => {
    const updated = bodyFields.filter((_, i) => i !== index)
    setBodyFields(updated)
    onChange(updated)
  }

  const handleUpdate = (index: number, field: keyof CanonicalField, value: any) => {
    const updated = bodyFields.map((f, i) => {
      if (i === index) {
        return {...f, [field]: value}
      }
      return f
    })
    setBodyFields(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      {/* Fields List */}
      {bodyFields.length === 0 ? (
        <div className="text-sm text-gray-500 italic text-center py-4">
          No fields defined. Click "Add Field" to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-3 pb-2 border-b border-gray-300">
            <div className="col-span-3 text-xs font-semibold text-gray-600 uppercase">Name</div>
            <div className="col-span-2 text-xs font-semibold text-gray-600 uppercase">Type</div>
            <div className="col-span-1 text-xs font-semibold text-gray-600 uppercase text-center">Required</div>
            <div className="col-span-3 text-xs font-semibold text-gray-600 uppercase">Example</div>
            <div className="col-span-2 text-xs font-semibold text-gray-600 uppercase">Description</div>
            <div className="col-span-1"></div>
          </div>

          {/* Fields */}
          {bodyFields.map((field, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
            >
              {/* Name */}
              <div className="col-span-3">
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Field name"
                />
              </div>

              {/* Type */}
              <div className="col-span-2">
                <select
                  value={field.type}
                  onChange={(e) => handleUpdate(index, 'type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="string">String</option>
                  <option value="integer">Integer</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="array">Array</option>
                  <option value="object">Object</option>
                  <option value="file">File</option>
                </select>
              </div>

              {/* Required Checkbox */}
              <div className="col-span-1 flex items-center justify-center">
                <label className="flex items-center cursor-pointer" title="Required field">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => handleUpdate(index, 'required', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="ml-1.5 text-xs text-gray-600">Required</span>
                </label>
              </div>

              {/* Example */}
              <div className="col-span-3">
                <input
                  type="text"
                  value={field.example !== undefined ? String(field.example) : ''}
                  onChange={(e) => {
                    // Try to parse as appropriate type
                    let value: any = e.target.value
                    if (field.type === 'integer' || field.type === 'number') {
                      const num = Number(value)
                      value = isNaN(num) ? value : num
                    } else if (field.type === 'boolean') {
                      value = value === 'true'
                    }
                    handleUpdate(index, 'example', value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Example value"
                />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <input
                  type="text"
                  value={field.description || ''}
                  onChange={(e) => handleUpdate(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Description"
                />
              </div>

              {/* Delete Button */}
              <div className="col-span-1 flex items-center justify-center">
                <button
                  onClick={() => handleRemove(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete field"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      <button
        onClick={handleAdd}
        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded hover:border-purple-500 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        Add Field
      </button>
    </div>
  )
}
