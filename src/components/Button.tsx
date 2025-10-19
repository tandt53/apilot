import React from 'react'
import {LucideIcon} from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'save'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  loading?: boolean
  highlighted?: boolean  // Force highlight state (for Save button with changes)
  children?: React.ReactNode
}

/**
 * Unified Icon-Only Button Component
 *
 * Default behavior: Icon-only, gray by default, highlights on hover
 *
 * Variants:
 * - save: Purple when highlighted (has changes), gray when disabled (no changes)
 * - danger: Gray by default, red on hover
 * - ghost: Gray by default, dark gray on hover (for utility actions)
 * - primary/secondary: Legacy support (not used for icon-only)
 *
 * Sizes:
 * - sm: 18px icon, compact padding
 * - md: 20px icon, default padding
 * - lg: 22px icon, larger padding
 */
export default function Button({
  variant = 'ghost',
  size = 'sm',
  icon: Icon,
  loading = false,
  disabled,
  highlighted = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  // Icon size based on button size
  const iconSizes = {
    sm: 18,
    md: 20,
    lg: 22
  }

  // Padding for icon-only buttons
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-2.5',
    lg: 'p-3'
  }

  // Variant-specific styling
  const getVariantClasses = () => {
    switch (variant) {
      case 'save':
        return highlighted
          ? 'text-white bg-purple-600 hover:bg-purple-700'
          : 'text-gray-400 cursor-not-allowed'

      case 'danger':
        return 'text-gray-400 hover:text-white hover:bg-red-600'

      case 'ghost':
      default:
        return 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
    }
  }

  return (
    <button
      disabled={disabled || loading || (variant === 'save' && !highlighted)}
      className={`
        ${sizeClasses[size]}
        ${getVariantClasses()}
        rounded-lg
        flex items-center justify-center
        transition-all duration-200
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
      )}

      {!loading && Icon && (
        <Icon size={iconSizes[size]} />
      )}

      {children && <span className="ml-2">{children}</span>}
    </button>
  )
}
