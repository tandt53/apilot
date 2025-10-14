import {createPortal} from 'react-dom'
import {useEffect} from 'react'
import type {Environment} from '@/types/database'
import EnvironmentManager from './EnvironmentManager'

interface EnvironmentInfoPopoverProps {
  specId: number
  specName: string
  environments: Environment[] | undefined
  selectedEnvId: string | null
  onEnvChange: (envId: string | null) => void
  show: boolean
  onClose: () => void
  anchorEl: HTMLElement | null
}

export default function EnvironmentInfoPopover({
  specId,
  specName,
  environments,
  selectedEnvId,
  onEnvChange,
  show,
  onClose,
  anchorEl,
}: EnvironmentInfoPopoverProps) {
  // Close on window resize
  useEffect(() => {
    if (!show) return

    const handleResize = () => {
      onClose()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [show, onClose])

  if (!show || !anchorEl) return null

  const rect = anchorEl.getBoundingClientRect()
  const popoverWidth = 600 // Keep original width for better form layout
  const popoverMaxHeight = 700 // Full height for complete component

  // Position below the info icon, aligned to the right
  let left = rect.right - popoverWidth
  let top = rect.bottom + 8

  // Make sure it doesn't go off the left edge
  if (left < 8) {
    left = 8
  }

  // Make sure it doesn't go off the right edge
  if (left + popoverWidth > window.innerWidth - 8) {
    left = window.innerWidth - popoverWidth - 8
  }

  // If not enough space below, show above
  if (top + popoverMaxHeight > window.innerHeight - 8) {
    top = rect.top - popoverMaxHeight - 8
    // If still not enough space, just position with some margin from bottom
    if (top < 8) {
      top = 8
    }
  }

  const popoverStyle = {
    position: 'fixed' as const,
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 9999,
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
        style={{ background: 'transparent' }}
      />

      {/* Popover */}
      <div
        className="bg-white border border-gray-200 rounded-lg shadow-xl z-[9999]"
        style={{...popoverStyle, width: `${popoverWidth}px`}}
      >
        {/* Content - Scrollable */}
        <div className="max-h-[700px] overflow-y-auto">
          <EnvironmentManager
            specId={specId}
            specName={specName}
            environments={environments}
            selectedEnvId={selectedEnvId}
            onEnvChange={onEnvChange}
          />
        </div>
      </div>
    </>,
    document.body
  )
}
