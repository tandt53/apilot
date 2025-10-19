import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'

interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  variables: Record<string, string>
  placeholder?: string
  disabled?: boolean
  className?: string
  multiline?: boolean
  rows?: number
}

interface TooltipState {
  show: boolean
  text: string
  x: number
  y: number
}

/**
 * Input field with inline variable highlighting (like Postman)
 * Shows {{variables}} highlighted as you type
 */
export default function VariableInput({
  value,
  onChange,
  variables,
  placeholder = '',
  disabled = false,
  className = '',
  multiline = false,
  rows = 1
}: VariableInputProps) {
  const [, setIsFocused] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, text: '', x: 0, y: 0 })
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Hide tooltip when value changes (user is typing/deleting)
  useEffect(() => {
    setTooltip({ show: false, text: '', x: 0, y: 0 })
  }, [value])

  // Parse text and highlight variables
  const renderHighlightedText = () => {
    if (!value) return null

    const parts: Array<{ type: 'text' | 'variable'; content: string; varName?: string; resolved?: boolean }> = []
    let lastIndex = 0
    const regex = /\{\{([^}]+)\}\}/g
    let match

    while ((match = regex.exec(value)) !== null) {
      // Add text before variable
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: value.slice(lastIndex, match.index),
        })
      }

      // Add variable
      const varName = match[1].trim()
      const resolved = varName in variables
      parts.push({
        type: 'variable',
        content: match[0],
        varName,
        resolved,
      })

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push({
        type: 'text',
        content: value.slice(lastIndex),
      })
    }

    return (
      <div className="whitespace-pre-wrap break-words text-gray-900" style={{ pointerEvents: 'none', lineHeight: '1.5' }}>
        {parts.map((part, idx) => {
          if (part.type === 'text') {
            // Regular text - visible
            return <span key={idx}>{part.content}</span>
          }

          // Variable part - highlighted with colored background
          const tooltipText = part.resolved ? `${part.varName}: ${variables[part.varName!]}` : 'Undefined variable'

          return (
            <span
              key={idx}
              className={`font-semibold ${
                part.resolved
                  ? 'bg-purple-200 text-purple-800'
                  : 'bg-orange-200 text-orange-800'
              }`}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({
                  show: true,
                  text: tooltipText,
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8
                })
              }}
              onMouseLeave={() => {
                setTooltip({ show: false, text: '', x: 0, y: 0 })
              }}
            >
              {part.content}
            </span>
          )
        })}
      </div>
    )
  }

  const hasVariables = /\{\{[^}]+\}\}/.test(value)

  const baseInputClasses = `w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 ${
    disabled ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
  } ${className}`

  // Render tooltip as portal to escape parent overflow
  const tooltipPortal = tooltip.show && createPortal(
    <div
      className="fixed z-[9999] px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap pointer-events-none"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: 'translate(-50%, -100%)'
      }}
    >
      {tooltip.text}
      <div
        className="absolute w-2 h-2 bg-gray-900 transform rotate-45"
        style={{
          left: '50%',
          bottom: '-4px',
          marginLeft: '-4px'
        }}
      />
    </div>,
    document.body
  )

  // Render tooltip interaction layer (transparent, only for hover events)
  const renderTooltipLayer = () => {
    if (!value) return null

    const parts: Array<{ type: 'text' | 'variable'; content: string; varName?: string; resolved?: boolean }> = []
    let lastIndex = 0
    const regex = /\{\{([^}]+)\}\}/g
    let match

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: value.slice(lastIndex, match.index),
        })
      }

      const varName = match[1].trim()
      const resolved = varName in variables
      parts.push({
        type: 'variable',
        content: match[0],
        varName,
        resolved,
      })

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < value.length) {
      parts.push({
        type: 'text',
        content: value.slice(lastIndex),
      })
    }

    return (
      <div className="whitespace-pre-wrap break-words" style={{ pointerEvents: 'none', lineHeight: '1.5' }}>
        {parts.map((part, idx) => {
          if (part.type === 'text') {
            return <span key={idx} style={{ color: 'transparent' }}>{part.content}</span>
          }

          const tooltipText = part.resolved ? `${part.varName}: ${variables[part.varName!]}` : 'Undefined variable'

          return (
            <span
              key={idx}
              className="font-semibold"
              style={{
                pointerEvents: 'auto',
                cursor: 'text',
                color: 'transparent',
                background: 'transparent'
              }}
              onClick={() => {
                inputRef.current?.focus()
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({
                  show: true,
                  text: tooltipText,
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8
                })
              }}
              onMouseLeave={() => {
                setTooltip({ show: false, text: '', x: 0, y: 0 })
              }}
            >
              {part.content}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {tooltipPortal}
      <div className="relative" ref={containerRef}>

      {/* Highlighted overlay - behind input, shows text with highlights */}
      {hasVariables && (
        <div
          className={`absolute inset-0 overflow-hidden border border-gray-300 rounded px-3 py-2 text-sm font-mono bg-white`}
          style={{
            zIndex: 0,
            pointerEvents: 'none',
            lineHeight: '1.5',
          }}
        >
          {renderHighlightedText()}
        </div>
      )}

      {/* Actual input */}
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          className={baseInputClasses}
          style={hasVariables ? {
            position: 'relative',
            zIndex: 1,
            background: 'transparent',
            color: 'transparent',
            caretColor: '#111827',
            lineHeight: '1.5',
          } : {
            lineHeight: '1.5',
          }}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          className={baseInputClasses}
          style={hasVariables ? {
            position: 'relative',
            zIndex: 1,
            background: 'transparent',
            color: 'transparent',
            caretColor: '#111827',
            lineHeight: '1.5',
          } : {
            lineHeight: '1.5',
          }}
        />
      )}

      {/* Tooltip interaction layer - on top, transparent, only for hover events */}
      {hasVariables && (
        <div
          className={`absolute inset-0 overflow-hidden rounded px-3 py-2 text-sm font-mono`}
          style={{
            zIndex: 2,
            pointerEvents: 'none',
            lineHeight: '1.5',
          }}
        >
          {renderTooltipLayer()}
        </div>
      )}
      </div>
    </>
  )
}
