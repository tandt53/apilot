import {ReactNode, useEffect, useState} from 'react'
import {usePanelWidth} from '@/contexts/PanelWidthContext'

interface ResizablePanelProps {
  children: ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  className?: string
}

export default function ResizablePanel({
  children,
  minWidth = 240,
  maxWidth = 600,
  className = '',
}: ResizablePanelProps) {
  const { panelWidth: globalPanelWidth, setPanelWidth: setGlobalPanelWidth, setIsResizing: setGlobalIsResizing } = usePanelWidth()
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(globalPanelWidth)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    setGlobalIsResizing(true)
    setResizeStartX(e.clientX)
    setResizeStartWidth(globalPanelWidth)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return

    const delta = e.clientX - resizeStartX
    const newWidth = Math.min(Math.max(resizeStartWidth + delta, minWidth), maxWidth)
    // Update global width directly - no local state
    setGlobalPanelWidth(newWidth)
  }

  const handleMouseUp = () => {
    setIsResizing(false)
    setGlobalIsResizing(false)
  }

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing])

  return (
    <div className="relative flex" style={{ width: globalPanelWidth }}>
      <div className={`flex-1 overflow-auto glass-card rounded-3xl ${className}`}>
        {children}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-400/50 transition-colors rounded-r-3xl ${
          isResizing ? 'bg-purple-500/70' : 'bg-transparent'
        }`}
      />
    </div>
  )
}
