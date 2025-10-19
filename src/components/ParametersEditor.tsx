import {useState} from 'react'
import {Plus, Trash2} from 'lucide-react'

interface Parameter {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  type: string
  required?: boolean
  description?: string
  example?: any
}

interface ParametersEditorProps {
  parameters: Parameter[]
  onChange: (parameters: Parameter[]) => void
}

export default function ParametersEditor({parameters, onChange}: ParametersEditorProps) {
  const [params, setParams] = useState<Parameter[]>(parameters || [])

  const handleAdd = () => {
    const newParam: Parameter = {
      name: '',
      in: 'query',
      type: 'string',
      required: false,
      description: '',
      example: ''
    }
    const updated = [...params, newParam]
    setParams(updated)
    onChange(updated)
  }

  const handleRemove = (index: number) => {
    const updated = params.filter((_, i) => i !== index)
    setParams(updated)
    onChange(updated)
  }

  const handleUpdate = (index: number, field: keyof Parameter, value: any) => {
    const updated = params.map((param, i) => {
      if (i === index) {
        return {...param, [field]: value}
      }
      return param
    })
    setParams(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      {/* Parameters List */}
      {params.length === 0 ? (
        <div className="text-sm text-gray-500 italic text-center py-4">
          No parameters defined. Click "Add Parameter" to add one.
        </div>
      ) : (
        <div className="space-y-3">
          {params.map((param, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
            >
              {/* Name */}
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={param.name}
                  onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="paramName"
                />
              </div>

              {/* In */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">In</label>
                <select
                  value={param.in}
                  onChange={(e) => handleUpdate(index, 'in', e.target.value as Parameter['in'])}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="query">Query</option>
                  <option value="header">Header</option>
                  <option value="path">Path</option>
                  <option value="cookie">Cookie</option>
                </select>
              </div>

              {/* Type */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={param.type}
                  onChange={(e) => handleUpdate(index, 'type', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="string">String</option>
                  <option value="integer">Integer</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="array">Array</option>
                  <option value="object">Object</option>
                </select>
              </div>

              {/* Required */}
              <div className="col-span-1 flex items-end">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={param.required || false}
                    onChange={(e) => handleUpdate(index, 'required', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="ml-1 text-xs text-gray-600">Req</span>
                </label>
              </div>

              {/* Example */}
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Example</label>
                <input
                  type="text"
                  value={param.example || ''}
                  onChange={(e) => handleUpdate(index, 'example', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="example value"
                />
              </div>

              {/* Delete Button */}
              <div className="col-span-1 flex items-end justify-end">
                <button
                  onClick={() => handleRemove(index)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete parameter"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Description (full width) */}
              <div className="col-span-12">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={param.description || ''}
                  onChange={(e) => handleUpdate(index, 'description', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Parameter description..."
                />
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
        Add Parameter
      </button>
    </div>
  )
}
