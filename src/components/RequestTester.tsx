import {useEffect, useRef, useState} from 'react'
import {Code2, Info, Loader2, Play, ListOrdered} from 'lucide-react'
import VariableInput from './VariableInput'
import RequestSpecificationTabs from './RequestSpecificationTabs'
import ResponseDisplay from './ResponseDisplay'
import AssertionsSection from './AssertionsSection'
import EnvironmentInfoPopover from './EnvironmentInfoPopover'
import {getMethodColor} from '@/lib/utils/methodColors'
import {substituteBuiltInVariables} from '@/utils/variables'
import {buildBodyFromSchema, bodyMatchesSchema} from '@/lib/utils/bodyHelpers'

interface Assertion {
    type: string
    field: string
    operator: string
    expected: any
}

export interface SessionState {
    activeRequestTab: 'headers' | 'params' | 'body' | 'auth'
    activeResponseTab: 'body' | 'headers'
    lastResponse: any | null
    lastError: string | null
    lastResponseTime: number
    lastUrl?: string
    lastRequest: {
        headers: Record<string, string>
        params: Record<string, string>
        body: string
        formData: Record<string, any>
    } | null
}

interface RequestTesterProps {
    endpoint: any
    testCase?: any
    onSaveAsTestCase?: (testData: any) => void
    onTestUpdate?: (updates: any) => void
    onHasChanges?: (hasChanges: boolean, saveHandler: () => Promise<void>) => void
    showSaveButton?: boolean
    readOnly?: boolean
    onTryItClick?: () => void
    onCancelClick?: () => void
    specId?: string
    selectedEnv?: any
    environments?: any[]
    selectedEnvId?: string | null
    onEnvChange?: (envId: string | null) => void
    // Session state props
    initialSession?: Partial<SessionState>
    onSessionChange?: (session: SessionState) => void
    // Default assertions (for reset button)
    defaultAssertions?: any[]
}

export default function RequestTester({
                                          endpoint,
                                          testCase,
                                          onTestUpdate,
                                          onHasChanges,
                                          readOnly = false,
                                          specId,
                                          selectedEnv,
                                          environments,
                                          selectedEnvId,
                                          onEnvChange,
                                          initialSession,
                                          onSessionChange,
                                          defaultAssertions
                                      }: RequestTesterProps) {
    // Session state for tabs
    const [activeRequestTab, setActiveRequestTab] = useState<'headers' | 'params' | 'body' | 'auth'>(
        initialSession?.activeRequestTab || 'params'
    )
    const [activeResponseTab, setActiveResponseTab] = useState<'body' | 'headers'>(
        initialSession?.activeResponseTab || 'body'
    )
    const [url, setUrl] = useState(() => {
        // Try to load from session first
        if (initialSession?.lastUrl) {
            return initialSession.lastUrl
        }

        // Use {{baseUrl}} template to show environment-aware URL
        let path = endpoint.path

        if (endpoint.request?.parameters) {
            endpoint.request.parameters.forEach((param: any) => {
                if (param.in === 'path') {
                    const exampleValue = param.example || (param.type === 'integer' ? '1' : 'example')
                    path = path.replace(`{${param.name}}`, String(exampleValue))
                }
            })
        }

        // Return template with {{baseUrl}} variable (e.g., "{{baseUrl}}/api/users/1")
        return `{{baseUrl}}${path}`
    })

    const [method] = useState(endpoint.method || 'GET')

    const [headers, setHeaders] = useState<Record<string, string>>(() => {
        // Try to load from session first
        if (initialSession?.lastRequest?.headers) {
            return initialSession.lastRequest.headers
        }

        const initialHeaders: Record<string, string> = {}

        if (endpoint.request?.contentType) {
            initialHeaders['Content-Type'] = endpoint.request.contentType
        } else {
            initialHeaders['Content-Type'] = 'application/json'
        }

        if (endpoint.request?.parameters) {
            endpoint.request.parameters
                .filter((p: any) => p.in === 'header')
                .forEach((param: any) => {
                    const value = param.example || (param.type === 'string' ? 'example-value' : '')
                    if (value) {
                        initialHeaders[param.name] = String(value)
                    }
                })
        }

        return initialHeaders
    })

    const [params, setParams] = useState<Record<string, string>>(() => {
        // Try to load from session first
        if (initialSession?.lastRequest?.params) {
            return initialSession.lastRequest.params
        }

        const initialParams: Record<string, string> = {}

        if (endpoint.request?.parameters) {
            endpoint.request.parameters
                .filter((p: any) => p.in === 'query')
                .forEach((param: any) => {
                    const value = param.example ||
                        (param.type === 'integer' ? '1' :
                            param.type === 'boolean' ? 'true' : 'example')
                    initialParams[param.name] = String(value)
                })
        }

        return initialParams
    })

    const [body, setBody] = useState(() => {
        // Try to load from session first
        if (initialSession?.lastRequest?.body) {
            return initialSession.lastRequest.body
        }

        if (endpoint.request?.body) {
            const contentType = endpoint.request.contentType

            // Skip body for form data types (handled by formData state)
            if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
                return ''
            }

            const example = endpoint.request.body.example
            const fields = endpoint.request.body.fields || []

            // SMART FALLBACK: Check if example matches schema
            // If mismatch detected, build from schema with defaults
            if (example && fields.length > 0 && contentType === 'application/json') {
                const exampleMatches = bodyMatchesSchema(example, fields)

                if (!exampleMatches) {
                    // Mismatch detected! Build from schema with defaults
                    console.warn('[RequestTester] Schema/example mismatch detected, using schema defaults')
                    const defaultBody = buildBodyFromSchema(fields)
                    return JSON.stringify(defaultBody, null, 2)
                }
            }

            // Use example if it exists and matches (or no schema to compare)
            if (example) {
                return JSON.stringify(example, null, 2)
            }

            // Build from schema if no example exists
            if (fields.length > 0) {
                const defaultBody = buildBodyFromSchema(fields)
                return JSON.stringify(defaultBody, null, 2)
            }
        }

        return ''
    })

    // Watch for endpoint changes and re-apply smart fallback logic
    useEffect(() => {
        if (endpoint.request?.body) {
            const contentType = endpoint.request.contentType

            // Skip body for form data types
            if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
                return
            }

            const example = endpoint.request.body.example
            const fields = endpoint.request.body.fields || []

            // Check if saved session body matches current schema
            if (initialSession?.lastRequest?.body) {
                try {
                    const savedBody = JSON.parse(initialSession.lastRequest.body)
                    const sessionMatches = bodyMatchesSchema(savedBody, fields)

                    if (sessionMatches) {
                        // Saved body matches schema, keep it (preserve user's manual edits)
                        return
                    }
                    // Saved body doesn't match schema, continue to rebuild
                    console.warn('[RequestTester] Session body doesn\'t match schema, rebuilding from schema defaults')
                } catch (e) {
                    // Invalid JSON in session, continue to rebuild
                    console.warn('[RequestTester] Invalid JSON in session, rebuilding from schema defaults')
                }
            }

            // SMART FALLBACK: Check if example matches schema
            if (example && fields.length > 0 && contentType === 'application/json') {
                const exampleMatches = bodyMatchesSchema(example, fields)

                if (!exampleMatches) {
                    // Mismatch detected! Build from schema with defaults
                    console.warn('[RequestTester] Schema/example mismatch detected (useEffect), using schema defaults')
                    const defaultBody = buildBodyFromSchema(fields)
                    setBody(JSON.stringify(defaultBody, null, 2))
                    return
                }
            }

            // Use example if it exists and matches
            if (example) {
                setBody(JSON.stringify(example, null, 2))
                return
            }

            // Build from schema if no example exists
            if (fields.length > 0) {
                const defaultBody = buildBodyFromSchema(fields)
                setBody(JSON.stringify(defaultBody, null, 2))
            }
        }
    }, [endpoint.request?.body, endpoint.id, initialSession?.lastRequest?.body])

    const [formData, setFormData] = useState<Record<string, any>>(() => {
        // Try to load from session first
        if (initialSession?.lastRequest?.formData) {
            return initialSession.lastRequest.formData
        }

        const initialFormData: Record<string, any> = {}

        const contentType = endpoint.request?.contentType
        if ((contentType === 'multipart/form-data' || contentType === 'application/x-www-form-urlencoded') &&
            endpoint.request?.body?.fields) {
            endpoint.request.body.fields.forEach((field: any) => {
                if (field.format === 'binary' || field.type === 'file') {
                    initialFormData[field.name] = null
                } else {
                    initialFormData[field.name] = field.example || ''
                }
            })
        }

        return initialFormData
    })

    // Wrap setFormData to also update cache
    const setFormDataWithCache = (data: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
        setFormData(prevData => {
            const newData = typeof data === 'function' ? data(prevData) : data
            if (testCase?.id) {
                formDataCacheRef.current.set(testCase.id, newData)
            }
            return newData
        })
    }

    const [assertions, setAssertions] = useState<Assertion[]>(() => {
        return endpoint.assertions || []
    })

    const originalValuesRef = useRef({
        headers,
        params,
        body,
        formData,
        assertions: endpoint.assertions || []
    })

    // Cache for form data including files (persists across test switches)
    const formDataCacheRef = useRef<Map<number, Record<string, any>>>(new Map())

    const [hasChanges, setHasChanges] = useState(false)
    const [_saving, setSaving] = useState(false)

    const [isExecuting, setIsExecuting] = useState(false)
    const [response, setResponse] = useState<any>(initialSession?.lastResponse || null)
    const [error, setError] = useState<string | null>(initialSession?.lastError || null)
    const [responseTime, setResponseTime] = useState<number>(initialSession?.lastResponseTime || 0)

    // Environment info popover state
    const [showEnvInfo, setShowEnvInfo] = useState(false)
    const envInfoButtonRef = useRef<HTMLButtonElement>(null)

    // Save session state whenever relevant state changes
    useEffect(() => {
        if (onSessionChange) {
            const session: SessionState = {
                activeRequestTab,
                activeResponseTab,
                lastResponse: response,
                lastError: error,
                lastResponseTime: responseTime,
                lastUrl: url,
                lastRequest: {
                    headers,
                    params,
                    body,
                    formData
                }
            }
            console.log('[RequestTester] Session state changed, saving:', {
                hasResponse: !!response,
                hasError: !!error,
                responseTime,
                url,
                session
            })
            onSessionChange(session)
        }
    }, [activeRequestTab, activeResponseTab, response, error, responseTime, url, headers, params, body, formData, onSessionChange])

    // Reset state when testCase changes (switching between different tests)
    useEffect(() => {
        if (!testCase) return

        // Skip reset if we have a saved session (to preserve user edits)
        if (initialSession?.lastRequest) {
            console.log('[RequestTester] Skipping reset - session exists')
            return
        }

        console.log('[RequestTester] No session found, initializing from defaults')

        // Reset URL with {{baseUrl}} template
        let path = endpoint.path
        if (endpoint.request?.parameters) {
            endpoint.request.parameters.forEach((param: any) => {
                if (param.in === 'path') {
                    const exampleValue = param.example || (param.type === 'integer' ? '1' : 'example')
                    path = path.replace(`{${param.name}}`, String(exampleValue))
                }
            })
        }
        setUrl(`{{baseUrl}}${path}`)

        // Reset headers from testCase or endpoint
        const initialHeaders: Record<string, string> = testCase.headers || {}
        if (Object.keys(initialHeaders).length === 0) {
            if (endpoint.request?.contentType) {
                initialHeaders['Content-Type'] = endpoint.request.contentType
            } else {
                initialHeaders['Content-Type'] = 'application/json'
            }
            if (endpoint.request?.parameters) {
                endpoint.request.parameters
                    .filter((p: any) => p.in === 'header')
                    .forEach((param: any) => {
                        const value = param.example || (param.type === 'string' ? 'example-value' : '')
                        if (value) {
                            initialHeaders[param.name] = String(value)
                        }
                    })
            }
        }
        setHeaders(initialHeaders)

        // Reset params from testCase or endpoint
        const initialParams: Record<string, string> = testCase.queryParams || {}
        if (Object.keys(initialParams).length === 0 && endpoint.request?.parameters) {
            endpoint.request.parameters
                .filter((p: any) => p.in === 'query')
                .forEach((param: any) => {
                    const value = param.example ||
                        (param.type === 'integer' ? '1' :
                            param.type === 'boolean' ? 'true' : 'example')
                    initialParams[param.name] = String(value)
                })
        }
        setParams(initialParams)

        // Reset body from testCase or endpoint
        let initialBody = ''
        if (testCase.body) {
            const contentType = testCase.headers?.['Content-Type'] || endpoint.request?.contentType
            if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
                initialBody = ''
            } else {
                initialBody = typeof testCase.body === 'string' ? testCase.body : JSON.stringify(testCase.body, null, 2)
            }
        } else if (endpoint.request?.body) {
            const contentType = endpoint.request.contentType
            if (!(contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded'))) {
                const example = endpoint.request.body.example
                const fields = endpoint.request.body.fields || []

                // SMART FALLBACK: Check if example matches schema
                if (example && fields.length > 0 && contentType === 'application/json') {
                    const exampleMatches = bodyMatchesSchema(example, fields)

                    if (!exampleMatches) {
                        // Mismatch detected! Build from schema with defaults
                        console.warn('[RequestTester] Schema/example mismatch detected in reset, using schema defaults')
                        const defaultBody = buildBodyFromSchema(fields)
                        initialBody = JSON.stringify(defaultBody, null, 2)
                    } else if (example) {
                        initialBody = JSON.stringify(example, null, 2)
                    }
                } else if (example) {
                    initialBody = JSON.stringify(example, null, 2)
                } else if (fields.length > 0) {
                    const defaultBody = buildBodyFromSchema(fields)
                    initialBody = JSON.stringify(defaultBody, null, 2)
                }
            }
        }
        setBody(initialBody)

        // Reset form data - check cache first, then testCase, then endpoint
        const cachedFormData = testCase.id ? formDataCacheRef.current.get(testCase.id) : null
        let initialFormData: Record<string, any> = {}

        if (cachedFormData) {
            // Restore from cache (includes uploaded files)
            initialFormData = cachedFormData
        } else {
            const contentType = testCase.headers?.['Content-Type'] || endpoint.request?.contentType
            if ((contentType === 'multipart/form-data' || contentType === 'application/x-www-form-urlencoded')) {
                if (testCase.body && typeof testCase.body === 'object') {
                    Object.entries(testCase.body).forEach(([key, value]) => {
                        initialFormData[key] = value
                    })
                } else if (endpoint.request?.body?.fields) {
                    endpoint.request.body.fields.forEach((field: any) => {
                        if (field.format === 'binary' || field.type === 'file') {
                            initialFormData[field.name] = null
                        } else {
                            initialFormData[field.name] = field.example || ''
                        }
                    })
                }
            }
        }
        setFormData(initialFormData)

        // Reset assertions
        const initialAssertions = testCase.assertions || endpoint.assertions || []
        setAssertions(initialAssertions)

        // Reset original values
        originalValuesRef.current = {
            headers: {...initialHeaders},
            params: {...initialParams},
            body: initialBody,
            formData: {...initialFormData},
            assertions: [...initialAssertions]
        }

        // Only reset response state if there's no saved session
        // This preserves response/error/responseTime when switching between tests
        if (!initialSession?.lastResponse && !initialSession?.lastError) {
            setResponse(null)
            setError(null)
            setResponseTime(0)
        }

        setHasChanges(false)
    }, [testCase?.id, initialSession]) // Only depend on testCase ID and initialSession

    const handleSaveChanges = async () => {
        if (!testCase || !onTestUpdate || !hasChanges) return

        setSaving(true)
        try {
            const updates: any = {
                headers,
                queryParams: params,
                assertions
            }

            if (method !== 'GET' && method !== 'HEAD') {
                if (headers['Content-Type']?.includes('multipart/form-data') ||
                    headers['Content-Type']?.includes('application/x-www-form-urlencoded')) {
                    updates.body = formData
                } else {
                    try {
                        updates.body = body ? JSON.parse(body) : undefined
                    } catch {
                        updates.body = body
                    }
                }
            }

            await onTestUpdate(updates)

            originalValuesRef.current = {
                headers: {...headers},
                params: {...params},
                body,
                formData: {...formData},
                assertions: [...assertions]
            }
            setHasChanges(false)
        } catch (error: any) {
            alert(`Failed to save changes: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    const saveHandlerRef = useRef(handleSaveChanges)
    saveHandlerRef.current = handleSaveChanges

    useEffect(() => {
        const headersChanged = JSON.stringify(headers) !== JSON.stringify(originalValuesRef.current.headers)
        const paramsChanged = JSON.stringify(params) !== JSON.stringify(originalValuesRef.current.params)
        const bodyChanged = body !== originalValuesRef.current.body
        const formDataChanged = JSON.stringify(formData) !== JSON.stringify(originalValuesRef.current.formData)
        const assertionsChanged = JSON.stringify(assertions) !== JSON.stringify(originalValuesRef.current.assertions)

        const changed = headersChanged || paramsChanged || bodyChanged || formDataChanged || assertionsChanged

        setHasChanges(changed)
    }, [headers, params, body, formData, assertions])

    useEffect(() => {
        if (onHasChanges) {
            onHasChanges(hasChanges, () => saveHandlerRef.current())
        }
    }, [hasChanges, onHasChanges])

    const substituteVariables = (text: string, variables: Record<string, string>): string => {
        // First pass: substitute built-in variables ({{$variableName}}) and {{baseUrl}}
        let result = substituteBuiltInVariables(text, {
            selectedEnv,
            defaultBaseUrl: 'http://localhost:3000'
        })

        // Second pass: substitute environment variables ({{variableName}})
        Object.entries(variables).forEach(([key, value]) => {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
        })
        return result
    }

    const executeRequest = async () => {
        setIsExecuting(true)
        setError(null)
        setResponse(null)

        let requestUrl = url // Define outside try block for error handling

        try {
            const startTime = Date.now()

            // Combine environment variables with baseUrl
            const envVariables = {
                ...(selectedEnv?.variables || {}),
                ...(selectedEnv?.baseUrl ? { baseUrl: selectedEnv.baseUrl } : {}),
            }

            // Always substitute variables (built-in + environment)
            // This now includes {{baseUrl}} substitution
            requestUrl = substituteVariables(requestUrl, envVariables)

            if (Object.keys(params).length > 0) {
                const substitutedParams: Record<string, string> = {}
                Object.entries(params).forEach(([key, value]) => {
                    substitutedParams[key] = substituteVariables(value, envVariables)
                })

                const queryString = new URLSearchParams(substitutedParams).toString()
                requestUrl = `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}${queryString}`
            }

            const substitutedHeaders: Record<string, string> = {}
            Object.entries(headers).forEach(([key, value]) => {
                substitutedHeaders[key] = substituteVariables(value, envVariables)
            })

            // Substitute variables in environment headers as well
            const substitutedEnvHeaders: Record<string, string> = {}
            if (selectedEnv?.headers) {
                Object.entries(selectedEnv.headers).forEach(([key, value]) => {
                    substitutedEnvHeaders[key] = substituteVariables(String(value), envVariables)
                })
            }

            const finalHeaders = {...substitutedHeaders, ...substitutedEnvHeaders}

            // Log request details for debugging
            console.group('🚀 API Request')
            console.log('Method:', method)
            console.log('URL:', requestUrl)
            console.log('Headers:', finalHeaders)
            console.log('Params:', params)
            if (body) console.log('Body:', body)
            if (Object.keys(formData).length > 0) console.log('Form Data:', formData)
            console.groupEnd()

            // Prepare request data for IPC
            let requestBody = undefined
            let requestFormData = undefined

            if (method !== 'GET' && method !== 'HEAD') {
                const contentType = finalHeaders['Content-Type'] || ''

                if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
                    // Use form data for multipart/urlencoded
                    requestFormData = formData
                    // Remove Content-Type to let the backend set it with boundary
                    delete finalHeaders['Content-Type']
                } else if (body) {
                    // Use JSON or other body types
                    requestBody = substituteVariables(body, envVariables)
                }
            }

            // Use IPC to execute test in main process (better security, no CORS, file upload support)
            if (window.electron) {
                const result = await window.electron.executeTest({
                    url: requestUrl,
                    method,
                    headers: finalHeaders,
                    formData: requestFormData,
                    body: requestBody
                })

                const endTime = Date.now()
                const responseTime = result.responseTime || (endTime - startTime)
                setResponseTime(responseTime)

                // Log response details for debugging
                console.group('✅ API Response (IPC)')
                console.log('Status:', result.status, result.statusText)
                console.log('Response Time:', responseTime, 'ms')
                console.log('Headers:', result.headers)
                console.log('Data:', result.data)
                console.groupEnd()

                setResponse(result)
                return
            }

            // Fallback to fetch if Electron API is not available (web mode)
            console.warn('[RequestTester] Electron API not available, falling back to fetch')
            const fetchOptions: RequestInit = {
                method,
                headers: finalHeaders,
            }

            if (requestFormData && Object.keys(requestFormData).length > 0) {
                const formDataObj = new FormData()
                Object.entries(requestFormData).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        formDataObj.append(key, String(value))
                    }
                })
                fetchOptions.body = formDataObj
            } else if (requestBody) {
                fetchOptions.body = requestBody
            }

            const res = await fetch(requestUrl, fetchOptions)
            const endTime = Date.now()
            setResponseTime(endTime - startTime)

            const contentType = res.headers.get('content-type')
            let responseData

            if (contentType?.includes('application/json')) {
                responseData = await res.json()
            } else {
                responseData = await res.text()
            }

            const responseObj = {
                status: res.status,
                statusText: res.statusText,
                headers: Object.fromEntries(res.headers.entries()),
                data: responseData,
            }

            // Log response details for debugging
            console.group('✅ API Response (Fetch)')
            console.log('Status:', res.status, res.statusText)
            console.log('Response Time:', endTime - startTime, 'ms')
            console.log('Headers:', responseObj.headers)
            console.log('Data:', responseData)
            console.groupEnd()

            setResponse(responseObj)

            if (assertions.length > 0) {
                // Normalize assertion type to handle both old and new formats
                const normalizeAssertionType = (type: string): string => {
                    const typeMap: Record<string, string> = {
                        'status-code': 'status',
                        'json-path': 'body',
                        'response-header': 'header'
                    }
                    return typeMap[type] || type
                }

                const results = assertions.map((assertion) => {
                    try {
                        let actual: any
                        let passed: boolean
                        const normalizedType = normalizeAssertionType(assertion.type)

                        if (normalizedType === 'status') {
                            actual = res.status
                            passed = evaluateAssertion(actual, assertion.operator, assertion.expected)
                        } else if (normalizedType === 'body') {
                            actual = getNestedValue(responseData, assertion.field)
                            passed = evaluateAssertion(actual, assertion.operator, assertion.expected)
                        } else if (normalizedType === 'header') {
                            actual = res.headers.get(assertion.field)
                            passed = evaluateAssertion(actual, assertion.operator, assertion.expected)
                        } else {
                            return {
                                passed: false,
                                expected: assertion.expected,
                                actual: undefined,
                                error: 'Unknown assertion type'
                            }
                        }

                        return {
                            passed,
                            expected: assertion.expected,
                            actual,
                            error: passed ? null : `Expected ${assertion.operator} ${assertion.expected}, got ${actual}`
                        }
                    } catch (e: any) {
                        return {
                            passed: false,
                            expected: assertion.expected,
                            actual: undefined,
                            error: e.message || 'Assertion evaluation failed'
                        }
                    }
                })

                setResponse({...responseObj, assertionResults: results})
            }
        } catch (err: any) {
            // Log error details for debugging
            console.group('❌ API Request Failed')
            console.log('Error:', err.message)
            console.log('URL:', requestUrl)
            console.log('Method:', method)
            console.groupEnd()

            // Provide more meaningful error messages
            let errorMessage = 'Request failed'

            if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                errorMessage = `Network Error: Unable to connect to ${requestUrl}\n\nPossible causes:\n• The server is not running or unreachable\n• Invalid domain name (e.g., api.example.com is not a real domain)\n• CORS policy blocking the request\n• No internet connection`
            } else if (err.message.includes('ERR_NAME_NOT_RESOLVED')) {
                errorMessage = `DNS Resolution Failed: Cannot resolve hostname\n\nThe domain "${new URL(requestUrl).hostname}" does not exist or cannot be found.\n\nSuggestions:\n• Check if the URL is correct\n• Use a real API endpoint instead of example URLs\n• Configure an environment with the correct base URL`
            } else if (err.message.includes('CORS')) {
                errorMessage = `CORS Error: Cross-Origin Request Blocked\n\nThe server at ${requestUrl} does not allow requests from this origin.\n\nSolutions:\n• Enable CORS on the server\n• Use a proxy or backend service\n• Test with a CORS-enabled API`
            } else if (err.message.includes('timeout')) {
                errorMessage = `Request Timeout: The server took too long to respond\n\nThe request to ${requestUrl} exceeded the timeout limit.\n\nSuggestions:\n• Check if the server is slow or overloaded\n• Verify the endpoint exists and is working\n• Increase timeout settings if needed`
            } else if (err.name === 'AbortError') {
                errorMessage = `Request Aborted: The request was cancelled`
            } else {
                errorMessage = `Error: ${err.message}\n\nRequest URL: ${requestUrl}`
            }

            setError(errorMessage)
        } finally {
            setIsExecuting(false)
        }
    }

    const evaluateAssertion = (actual: any, operator: string, expected: any): boolean => {
        switch (operator) {
            case '==':
                return actual == expected
            case '===':
                return actual === expected
            case '!=':
                return actual != expected
            case '>':
                return actual > expected
            case '>=':
                return actual >= expected
            case '<':
                return actual < expected
            case '<=':
                return actual <= expected
            case 'contains':
                return String(actual).includes(String(expected))
            case 'exists':
                return actual !== undefined && actual !== null
            default:
                return false
        }
    }

    const getNestedValue = (obj: any, path: string): any => {
        return path.split('.').reduce((current, key) => current?.[key], obj)
    }

    return (
        <div className="space-y-6">
            {/* Request Section */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Code2 size={20} className="text-purple-600"/>
                            Request Specification
                        </h3>
                        {/* Environment Selector */}
                        {environments && onEnvChange && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Environment:</label>
                                <select
                                    value={selectedEnvId || ''}
                                    onChange={(e) => onEnvChange(e.target.value || null)}
                                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">None (default)</option>
                                    {environments?.map((env) => (
                                        <option key={env.id} value={env.id}>
                                            {env.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    ref={envInfoButtonRef}
                                    onClick={() => setShowEnvInfo(!showEnvInfo)}
                                    className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                    title={selectedEnvId ? "Environment Details" : "Manage Environments"}
                                >
                                    <Info size={16}/>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4">
                    {/* URL and Method */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded font-semibold text-sm ${getMethodColor(method)}`}>
                {method}
              </span>
                            <div className="flex-1">
                                <VariableInput
                                    value={url}
                                    onChange={setUrl}
                                    variables={{
                                        ...(selectedEnv?.variables || {}),
                                        ...(selectedEnv?.baseUrl ? { baseUrl: selectedEnv.baseUrl } : {}),
                                    }}
                                    disabled={readOnly}
                                    placeholder="Enter URL"
                                />
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={executeRequest}
                                    disabled={isExecuting}
                                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isExecuting ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}
                                    {isExecuting ? 'Sending...' : 'Send'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Request Specification Tabs */}
                    <RequestSpecificationTabs
                        endpoint={endpoint}
                        mode="test"
                        headers={headers}
                        params={params}
                        body={body}
                        formData={formData}
                        onHeadersChange={setHeaders}
                        onParamsChange={setParams}
                        onBodyChange={setBody}
                        onFormDataChange={setFormDataWithCache}
                        onContentTypeChange={(contentType) => {
                            setHeaders({ ...headers, 'Content-Type': contentType })
                        }}
                        selectedEnv={selectedEnv}
                        readOnly={readOnly}
                        initialActiveTab={activeRequestTab}
                        onActiveTabChange={setActiveRequestTab}
                    />
                </div>
            </div>

            {/* Response Section */}
            <ResponseDisplay
                response={response}
                error={error}
                responseTime={responseTime}
                assertions={assertions}
                initialActiveTab={activeResponseTab}
                onActiveTabChange={setActiveResponseTab}
            />

            {/* Multi-Step Execution Results */}
            {response?.stepResults && response.stepResults.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="border-b border-gray-200 px-4 py-3">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <ListOrdered size={20} className="text-purple-600"/>
                            Step Execution Results
                        </h3>
                    </div>

                    <div className="p-4 space-y-4">
                        {response.stepResults.map((stepResult: any) => (
                            <div key={stepResult.stepId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                {/* Step Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900">
                                            Step {stepResult.stepOrder}: {stepResult.stepName}
                                        </span>
                                        {stepResult.response && (
                                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                                stepResult.response.statusCode >= 200 && stepResult.response.statusCode < 300
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                            }`}>
                                                {stepResult.response.statusCode}
                                            </span>
                                        )}
                                        {stepResult.duration && (
                                            <span className="text-xs text-gray-500">
                                                {stepResult.duration}ms
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Extracted Variables */}
                                {stepResult.extractedVariables && Object.keys(stepResult.extractedVariables).length > 0 && (
                                    <div className="mb-3">
                                        <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                            📤 Extracted Variables
                                        </h4>
                                        <div className="bg-white border border-gray-200 rounded p-2">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left py-1 px-2 font-semibold text-gray-700">Variable</th>
                                                        <th className="text-left py-1 px-2 font-semibold text-gray-700">Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(stepResult.extractedVariables).map(([key, value]) => (
                                                        <tr key={key} className="border-b border-gray-100 last:border-0">
                                                            <td className="py-1 px-2 font-mono text-purple-600">{key}</td>
                                                            <td className="py-1 px-2 font-mono text-gray-800">
                                                                {typeof value === 'object'
                                                                    ? JSON.stringify(value)
                                                                    : String(value)
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Assertion Results */}
                                {stepResult.assertionResults && stepResult.assertionResults.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                            ✓ Assertions ({stepResult.assertionResults.filter((a: any) => a.passed).length}/{stepResult.assertionResults.length} passed)
                                        </h4>
                                        <div className="space-y-1">
                                            {stepResult.assertionResults.map((result: any, i: number) => (
                                                <div
                                                    key={i}
                                                    className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${
                                                        result.passed
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'bg-red-50 text-red-700'
                                                    }`}
                                                >
                                                    <span>{result.passed ? '✓' : '✗'}</span>
                                                    <span>{result.error || 'Passed'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Error */}
                                {stepResult.error && (
                                    <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                                        <p className="text-xs text-red-700 font-mono">{stepResult.error}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Assertions Section */}
            <AssertionsSection
                assertions={assertions}
                onAssertionsChange={setAssertions}
                readOnly={readOnly}
                selectedEnv={selectedEnv}
                results={response?.assertionResults || []}
                hasResponse={!!response}
                defaultAssertions={defaultAssertions || endpoint.assertions || []}
                onResetResponse={() => {
                    setResponse(null)
                    setError(null)
                    setResponseTime(0)
                }}
            />

            {/* Environment Info Popover */}
            <EnvironmentInfoPopover
                specId={Number(specId) || 0}
                specName="spec"
                environments={environments}
                selectedEnvId={selectedEnvId || null}
                onEnvChange={onEnvChange || (() => {
                })}
                show={showEnvInfo}
                onClose={() => setShowEnvInfo(false)}
                anchorEl={envInfoButtonRef.current}
            />
        </div>
    )
}
