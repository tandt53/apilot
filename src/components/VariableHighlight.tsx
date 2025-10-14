import {useState} from 'react'

interface VariableHighlightProps {
  text: string
  variables: Record<string, string>
  className?: string
  inline?: boolean // For inline display (like in headers)
}

/**
 * Component that highlights {{variables}} in text and shows their values on hover
 */
export default function VariableHighlight({
  text,
  variables,
  className = '',
  inline = false,
}: VariableHighlightProps) {
  const [hoveredVar, setHoveredVar] = useState<string | null>(null)

  if (!text) return null

  // Split text by variable patterns
  const parts: Array<{ type: 'text' | 'variable'; content: string; varName?: string }> = []
  let lastIndex = 0
  const regex = /\{\{([^}]+)\}\}/g
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before variable
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      })
    }

    // Add variable
    const varName = match[1].trim()
    parts.push({
      type: 'variable',
      content: match[0],
      varName,
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  // If no variables found, return plain text
  if (parts.length === 0 || parts.every(p => p.type === 'text')) {
    return <span className={className}>{text}</span>
  }

  const WrapperTag = inline ? 'span' : 'div'

  return (
    <WrapperTag className={className}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>
        }

        // Variable part
        const varName = part.varName!
        const value = variables[varName]
        const isResolved = varName in variables
        const isHovered = hoveredVar === varName

        return (
          <span
            key={idx}
            className={`relative inline-block px-1 rounded font-mono text-sm ${
              isResolved
                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                : 'bg-orange-100 text-orange-700 border border-orange-300'
            } cursor-help`}
            onMouseEnter={() => setHoveredVar(varName)}
            onMouseLeave={() => setHoveredVar(null)}
          >
            {part.content}
            {/* Tooltip */}
            {isHovered && (
              <span className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                {isResolved ? (
                  <>
                    <span className="text-gray-400">{varName}:</span>{' '}
                    <span className="font-semibold">{value}</span>
                  </>
                ) : (
                  <>
                    <span className="text-orange-400">Undefined variable</span>
                  </>
                )}
                {/* Arrow */}
                <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <span className="block w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                </span>
              </span>
            )}
          </span>
        )
      })}
    </WrapperTag>
  )
}

/**
 * Highlight variables in JSON string (for code blocks)
 */
export function VariableHighlightJSON({
  json,
  variables,
  className = '',
}: {
  json: string
  variables: Record<string, string>
  className?: string
}) {
  const [hoveredVar, setHoveredVar] = useState<string | null>(null)

  if (!json) return null

  // Split JSON by variable patterns
  const parts: Array<{ type: 'text' | 'variable'; content: string; varName?: string }> = []
  let lastIndex = 0
  const regex = /\{\{([^}]+)\}\}/g
  let match

  while ((match = regex.exec(json)) !== null) {
    // Add text before variable
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: json.slice(lastIndex, match.index),
      })
    }

    // Add variable
    const varName = match[1].trim()
    parts.push({
      type: 'variable',
      content: match[0],
      varName,
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < json.length) {
    parts.push({
      type: 'text',
      content: json.slice(lastIndex),
    })
  }

  // If no variables found, return plain text
  if (parts.length === 0 || parts.every(p => p.type === 'text')) {
    return <pre className={className}>{json}</pre>
  }

  return (
    <pre className={className}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>
        }

        // Variable part
        const varName = part.varName!
        const value = variables[varName]
        const isResolved = varName in variables
        const isHovered = hoveredVar === varName

        return (
          <span
            key={idx}
            className={`relative inline-block px-0.5 rounded ${
              isResolved
                ? 'bg-purple-100 text-purple-700'
                : 'bg-orange-100 text-orange-700'
            } cursor-help`}
            onMouseEnter={() => setHoveredVar(varName)}
            onMouseLeave={() => setHoveredVar(null)}
          >
            {part.content}
            {/* Tooltip */}
            {isHovered && (
              <span className="absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none font-sans">
                {isResolved ? (
                  <>
                    <span className="text-gray-400">{varName}:</span>{' '}
                    <span className="font-semibold">{value}</span>
                  </>
                ) : (
                  <>
                    <span className="text-orange-400">Undefined variable</span>
                  </>
                )}
                {/* Arrow */}
                <span className="absolute top-full left-4 transform -translate-x-1/2 -mt-1">
                  <span className="block w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                </span>
              </span>
            )}
          </span>
        )
      })}
    </pre>
  )
}
