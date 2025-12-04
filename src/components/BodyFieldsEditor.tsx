import {useState} from 'react'
import {Plus, Trash2} from 'lucide-react'
import type {CanonicalField} from '@/types/canonical'
import {validateParameterName, hasDuplicate} from '@/lib/utils/validation'

interface BodyFieldsEditorProps {
  fields: CanonicalField[]
  onChange: (fields: CanonicalField[]) => void
}

export default function BodyFieldsEditor({fields, onChange}: BodyFieldsEditorProps) {
  const [bodyFields, setBodyFields] = useState<CanonicalField[]>(fields || [])
  const [errors, setErrors] = useState<Record<number, string>>({}) // Map of index -> error message

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

    // Validate field name when it changes
    if (field === 'name') {
      const newErrors = {...errors}

      // Validate field name format (use same validation as parameter names)
      const nameValidation = validateParameterName(value)
      if (!nameValidation.isValid) {
        newErrors[index] = nameValidation.error!
      } else {
        // Check for duplicates
        const isDuplicate = hasDuplicate(
          updated,
          (f) => f.name.toLowerCase().trim(),
          index
        )
        if (isDuplicate) {
          newErrors[index] = 'Field name already exists. Please use a unique name.'
        } else {
          // Clear error if validation passed
          delete newErrors[index]
        }
      }

      setErrors(newErrors)
    }
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
            <div className="col-span-4 text-xs font-semibold text-gray-600 uppercase">Name</div>
            <div className="col-span-2 text-xs font-semibold text-gray-600 uppercase">Type</div>
            <div className="col-span-1 text-xs font-semibold text-gray-600 uppercase text-center">Required</div>
            <div className="col-span-4 text-xs font-semibold text-gray-600 uppercase">Description</div>
            <div className="col-span-1"></div>
          </div>

          {/* Fields */}
          {bodyFields.map((field, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
            >
              {/* Name */}
              <div className="col-span-4">
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${
                    errors[index]
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-purple-500'
                  }`}
                  placeholder="Field name"
                />
                {errors[index] && (
                  <p className="text-xs text-red-600 mt-1">{errors[index]}</p>
                )}
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

              {/* Description */}
              <div className="col-span-4">
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
