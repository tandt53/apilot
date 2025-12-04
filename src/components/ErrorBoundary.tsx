/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 */

import { Component, ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state if resetKeys change
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      prevProps.resetKeys &&
      this.props.resetKeys.some((key, index) => key !== prevProps.resetKeys![index])
    ) {
      this.resetError()
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full">
            <div className="bg-white shadow-lg rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    Something went wrong
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    The application encountered an unexpected error
                  </p>
                </div>
              </div>

              {this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                  <p className="text-sm font-medium text-red-900 mb-2">
                    Error Details:
                  </p>
                  <p className="text-xs text-red-700 font-mono break-all">
                    {this.state.error.message}
                  </p>
                  {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-700 cursor-pointer hover:underline">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={this.resetError}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Try Again
                </button>
                <button
                  onClick={() => {
                    this.resetError()
                    window.location.href = '/'
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <p className="mt-4 text-xs text-gray-500 text-center">
                  This detailed error message is only shown in development mode
                </p>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Lightweight error boundary for specific features
 * Shows minimal error UI without full-page takeover
 */
interface FeatureErrorBoundaryProps {
  children: ReactNode
  featureName: string
  onReset?: () => void
}

export function FeatureErrorBoundary({ children, featureName, onReset }: FeatureErrorBoundaryProps) {
  return (
    <ErrorBoundary children={children}
      fallback={
        <div className="border border-red-200 rounded-lg p-6 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-900">
                {featureName} Error
              </h3>
              <p className="text-sm text-red-700 mt-1">
                This feature encountered an error. Try refreshing the page or contact support if the problem persists.
              </p>
              {onReset && (
                <button
                  onClick={onReset}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white text-red-700 text-sm font-medium rounded border border-red-300 hover:bg-red-50"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      }
    />
  )
}
