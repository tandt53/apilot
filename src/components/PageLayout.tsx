import {ReactNode} from 'react'

interface PageLayoutProps {
  children: ReactNode
}

/**
 * Shared page layout structure for all main screens (Specs, Tests, Settings)
 * Provides consistent:
 * - Main content area with proper spacing and overflow handling
 * - No header (removed for clean, modern design)
 * - Floating actions handled by individual pages
 */
export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="h-full flex flex-col p-2">
      {/* Main Content Area */}
      <div className="flex-1 flex gap-2 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
