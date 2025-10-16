import {Save, X} from 'lucide-react'

interface SaveCancelButtonsProps {
  onSave: () => void | Promise<void>
  onCancel?: () => void
  hasUnsavedChanges: boolean
  saveLabel?: string
  cancelLabel?: string
  compact?: boolean
  saveOnly?: boolean
}

/**
 * Unified Save/Cancel button component
 * Used in EndpointDetail edit mode and Tests page
 * Set saveOnly=true to render only the save button (e.g., Tests page)
 */
export default function SaveCancelButtons({
  onSave,
  onCancel,
  hasUnsavedChanges,
  saveLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  compact = false,
  saveOnly = false
}: SaveCancelButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Cancel Button - only show if not saveOnly mode */}
      {!saveOnly && onCancel && (
        <button
          onClick={onCancel}
          className={`border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center gap-2 ${
            compact ? 'p-2' : 'px-4 py-2'
          }`}
          title={cancelLabel}
        >
          <X size={compact ? 18 : 16} />
          {!compact && cancelLabel}
        </button>
      )}

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={!hasUnsavedChanges}
        className={`rounded ${compact ? 'rounded-lg' : ''} transition-colors flex items-center gap-2 ${
          compact ? 'p-2' : 'px-4 py-2'
        } ${
          hasUnsavedChanges
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : compact
              ? 'text-gray-300 cursor-not-allowed'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={hasUnsavedChanges ? saveLabel : 'No changes to save'}
      >
        <Save size={compact ? 18 : 16} />
        {!compact && (hasUnsavedChanges ? saveLabel : 'Save')}
        {compact && hasUnsavedChanges && <span className="text-sm font-medium">Save</span>}
      </button>
    </div>
  )
}
