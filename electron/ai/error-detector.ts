/**
 * AI Provider Error Detection and Classification
 * Helps identify specific error types and provide actionable guidance
 */

import type { TestConnectionErrorType } from './base'

export interface ClassifiedError {
  errorType: TestConnectionErrorType
  message: string
  suggestedAction: string
  availableModels?: string[]
}

/**
 * Classify OpenAI errors
 */
export function classifyOpenAIError(error: any, model: string): ClassifiedError {
  const errorMessage = error.message || error.toString()
  const statusCode = error.status || error.response?.status

  // Authentication errors
  if (statusCode === 401 || errorMessage.toLowerCase().includes('invalid api key') || errorMessage.toLowerCase().includes('incorrect api key')) {
    return {
      errorType: 'AUTH_ERROR',
      message: 'Invalid API key',
      suggestedAction: 'Please check your OpenAI API key in Settings. Make sure it starts with "sk-" and is correctly copied.',
    }
  }

  // Model not found
  if (statusCode === 404 || errorMessage.toLowerCase().includes('model') && (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('does not exist'))) {
    return {
      errorType: 'MODEL_NOT_FOUND',
      message: `Model '${model}' not found`,
      suggestedAction: 'The model name is incorrect or not available.',
      availableModels: [
        'gpt-4o (recommended, most capable)',
        'gpt-4o-mini (fastest, cost-effective)',
        'gpt-4-turbo (balanced)',
        'gpt-3.5-turbo (legacy, cheaper)',
      ],
    }
  }

  // Rate limit errors
  if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
    return {
      errorType: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      suggestedAction: 'Your OpenAI account has reached its rate limit. Please wait a few minutes or upgrade your plan at platform.openai.com.',
    }
  }

  // Quota exceeded
  if (statusCode === 429 || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('insufficient_quota')) {
    return {
      errorType: 'MODEL_NOT_AVAILABLE',
      message: 'Quota exceeded',
      suggestedAction: 'Your OpenAI account quota is exhausted. Please add credits at platform.openai.com/account/billing or wait for quota reset.',
    }
  }

  // Network errors
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('econnrefused') || errorMessage.toLowerCase().includes('timeout')) {
    return {
      errorType: 'NETWORK_ERROR',
      message: 'Network connection failed',
      suggestedAction: 'Cannot reach OpenAI servers. Please check your internet connection and firewall settings.',
    }
  }

  // Default unknown error
  return {
    errorType: 'UNKNOWN',
    message: `Connection failed: ${errorMessage}`,
    suggestedAction: 'Please verify your API key and model settings, then try again. If the problem persists, check OpenAI status at status.openai.com.',
  }
}

/**
 * Classify Anthropic errors
 */
export function classifyAnthropicError(error: any, model: string): ClassifiedError {
  const errorMessage = error.message || error.toString()
  const statusCode = error.status || error.response?.status

  // Authentication errors
  if (statusCode === 401 || errorMessage.toLowerCase().includes('invalid') && errorMessage.toLowerCase().includes('api key')) {
    return {
      errorType: 'AUTH_ERROR',
      message: 'Invalid API key',
      suggestedAction: 'Please check your Anthropic API key in Settings. Make sure it starts with "sk-ant-" and is correctly copied from console.anthropic.com.',
    }
  }

  // Model not found
  if (statusCode === 404 || errorMessage.toLowerCase().includes('model_not_found') || (errorMessage.toLowerCase().includes('model') && errorMessage.toLowerCase().includes('not found'))) {
    return {
      errorType: 'MODEL_NOT_FOUND',
      message: `Model '${model}' not found`,
      suggestedAction: 'The model name is incorrect or not available.',
      availableModels: [
        'claude-3-5-sonnet-20241022 (recommended, most capable)',
        'claude-3-opus-20240229 (powerful, slower)',
        'claude-3-haiku-20240307 (fastest, cost-effective)',
      ],
    }
  }

  // Rate limit errors
  if (statusCode === 429 || errorMessage.toLowerCase().includes('rate_limit')) {
    return {
      errorType: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      suggestedAction: 'Your Anthropic account has reached its rate limit. Please wait a few minutes or contact Anthropic support to increase limits.',
    }
  }

  // Network errors
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('econnrefused') || errorMessage.toLowerCase().includes('timeout')) {
    return {
      errorType: 'NETWORK_ERROR',
      message: 'Network connection failed',
      suggestedAction: 'Cannot reach Anthropic servers. Please check your internet connection and firewall settings.',
    }
  }

  // Default unknown error
  return {
    errorType: 'UNKNOWN',
    message: `Connection failed: ${errorMessage}`,
    suggestedAction: 'Please verify your API key and model settings, then try again. Visit console.anthropic.com for more information.',
  }
}

/**
 * Classify Gemini errors
 */
export function classifyGeminiError(error: any, model: string): ClassifiedError {
  const errorMessage = error.message || error.toString()
  const statusCode = error.status || error.response?.status

  // Authentication errors
  if (statusCode === 401 || statusCode === 403 || errorMessage.toLowerCase().includes('api key') && errorMessage.toLowerCase().includes('invalid')) {
    return {
      errorType: 'AUTH_ERROR',
      message: 'Invalid API key',
      suggestedAction: 'Please check your Google Gemini API key in Settings. Get your key from aistudio.google.com/app/apikey.',
    }
  }

  // Model not found
  if (statusCode === 404 || errorMessage.toLowerCase().includes('model') && errorMessage.toLowerCase().includes('not found')) {
    return {
      errorType: 'MODEL_NOT_FOUND',
      message: `Model '${model}' not found`,
      suggestedAction: 'The model name is incorrect or not available.',
      availableModels: [
        'gemini-2.0-flash-exp (recommended, fastest)',
        'gemini-1.5-pro (most capable)',
        'gemini-1.5-flash (balanced)',
      ],
    }
  }

  // Rate limit / quota errors
  if (statusCode === 429 || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
    return {
      errorType: 'RATE_LIMIT',
      message: 'Rate limit or quota exceeded',
      suggestedAction: 'Your Gemini API quota is exhausted. Check your quota at aistudio.google.com/app/apikey or wait for quota reset.',
    }
  }

  // Network errors
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('econnrefused') || errorMessage.toLowerCase().includes('timeout')) {
    return {
      errorType: 'NETWORK_ERROR',
      message: 'Network connection failed',
      suggestedAction: 'Cannot reach Google AI servers. Please check your internet connection and firewall settings.',
    }
  }

  // Default unknown error
  return {
    errorType: 'UNKNOWN',
    message: `Connection failed: ${errorMessage}`,
    suggestedAction: 'Please verify your API key and model settings, then try again. Visit aistudio.google.com for more information.',
  }
}

/**
 * Classify Ollama errors
 */
export function classifyOllamaError(error: any, model: string, baseUrl: string): ClassifiedError {
  const errorMessage = error.message || error.toString()

  // Ollama not running
  if (errorMessage.toLowerCase().includes('econnrefused') || errorMessage.toLowerCase().includes('connection refused')) {
    return {
      errorType: 'NETWORK_ERROR',
      message: 'Cannot connect to Ollama',
      suggestedAction: `Ollama is not running at ${baseUrl}. Please start Ollama or check the base URL. Run 'ollama serve' to start Ollama.`,
    }
  }

  // Model not found (already checked in ollama.ts, but handle here too)
  if (errorMessage.toLowerCase().includes('model') && (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('pull'))) {
    return {
      errorType: 'MODEL_NOT_FOUND',
      message: `Model '${model}' not found`,
      suggestedAction: `The model is not downloaded. Run: ollama pull ${model}`,
      availableModels: [
        'llama3.1:8b (recommended)',
        'llama3.1:70b (most capable)',
        'codellama:7b (code generation)',
        'mistral:7b (fast, balanced)',
      ],
    }
  }

  // Network/timeout errors
  if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('network')) {
    return {
      errorType: 'NETWORK_ERROR',
      message: 'Connection timeout',
      suggestedAction: `Cannot reach Ollama at ${baseUrl}. Please verify the URL and check if Ollama is running.`,
    }
  }

  // Invalid URL
  if (errorMessage.toLowerCase().includes('invalid url') || errorMessage.toLowerCase().includes('malformed')) {
    return {
      errorType: 'INVALID_CONFIG',
      message: 'Invalid base URL',
      suggestedAction: `The base URL "${baseUrl}" is invalid. Common formats: http://localhost:11434 (Ollama), http://localhost:1234/v1 (LM Studio)`,
    }
  }

  // Default unknown error
  return {
    errorType: 'UNKNOWN',
    message: `Connection failed: ${errorMessage}`,
    suggestedAction: 'Please verify Ollama is running and the base URL is correct. Run "ollama list" to see available models.',
  }
}
