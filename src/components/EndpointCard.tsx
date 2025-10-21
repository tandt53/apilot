interface EndpointCardProps {
  method: string
  path: string
  name?: string
  stepCount?: number
  isSelected: boolean
  onClick: () => void
  showCheckbox?: boolean
  isChecked?: boolean
  onCheckboxChange?: (checked: boolean) => void
  disabled?: boolean
  hideEndpointInfo?: boolean // Hide method/path (for grouped display)
}

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
  PATCH: 'bg-purple-100 text-purple-700',
}

export default function EndpointCard({ method, path, name, stepCount, isSelected, onClick, showCheckbox, isChecked, onCheckboxChange, disabled, hideEndpointInfo }: EndpointCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 transition-all ${
        isSelected
          ? 'bg-purple-200 rounded-2xl shadow-md'
          : 'hover:bg-white/40 hover:rounded-2xl hover:shadow-sm'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {/* Show name and step count if available */}
          {name && (
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              {stepCount !== undefined && (
                <span className="text-xs text-gray-500 flex-shrink-0">({stepCount} steps)</span>
              )}
            </div>
          )}

          {/* Only show method/path if not hidden */}
          {!hideEndpointInfo && (
            <div className={`flex items-center gap-2 ${name ? 'mt-1' : ''}`}>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${methodColors[method] || 'bg-gray-100 text-gray-700'}`}>
                {method}
              </span>
              <span className="text-xs font-mono text-gray-600 truncate">
                {path}
              </span>
            </div>
          )}
        </div>
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isChecked}
            disabled={disabled}
            onChange={(e) => {
              e.stopPropagation()
              onCheckboxChange?.(e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
            className={`flex-shrink-0 ml-2 ${disabled ? 'cursor-not-allowed' : ''}`}
          />
        )}
      </div>
    </button>
  )
}
