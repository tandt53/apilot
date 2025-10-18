import {Save, X} from 'lucide-react'
import Button from './Button'

interface SaveCancelButtonsProps {
  onSave: () => void | Promise<void>
  onCancel?: () => void
  hasUnsavedChanges: boolean
  saveLabel?: string
  cancelLabel?: string
  saveOnly?: boolean
}

/**
 * Unified Save/Cancel button component (Icon-only)
 * Used in EndpointDetail edit mode and Tests page
 * Set saveOnly=true to render only the save button (e.g., Tests page)
 */
export default function SaveCancelButtons({
  onSave,
  onCancel,
  hasUnsavedChanges,
  saveLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  saveOnly = false
}: SaveCancelButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Cancel Button - only show if not saveOnly mode */}
      {!saveOnly && onCancel && (
        <Button
          variant="ghost"
          size="sm"
          icon={X}
          onClick={onCancel}
          title={cancelLabel}
        />
      )}

      {/* Save Button */}
      <Button
        variant="save"
        size="sm"
        icon={Save}
        onClick={onSave}
        highlighted={hasUnsavedChanges}
        title={hasUnsavedChanges ? saveLabel : 'No changes to save'}
      />
    </div>
  )
}
