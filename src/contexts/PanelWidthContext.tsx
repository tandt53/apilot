import {createContext, ReactNode, useContext, useEffect, useState} from 'react'

interface PanelWidthContextType {
  panelWidth: number
  setPanelWidth: (width: number) => void
  isResizing: boolean
  setIsResizing: (resizing: boolean) => void
}

const PanelWidthContext = createContext<PanelWidthContextType | undefined>(undefined)

export function PanelWidthProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage, default to 320px
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('panel-width')
    return saved ? parseInt(saved) : 320
  })
  const [isResizing, setIsResizing] = useState(false)

  // Persist to localStorage whenever width changes
  useEffect(() => {
    localStorage.setItem('panel-width', String(panelWidth))
  }, [panelWidth])

  return (
    <PanelWidthContext.Provider value={{ panelWidth, setPanelWidth, isResizing, setIsResizing }}>
      {children}
    </PanelWidthContext.Provider>
  )
}

export function usePanelWidth() {
  const context = useContext(PanelWidthContext)
  if (context === undefined) {
    throw new Error('usePanelWidth must be used within a PanelWidthProvider')
  }
  return context
}
