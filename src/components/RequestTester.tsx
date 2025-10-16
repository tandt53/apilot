import {useEffect, useRef, useState} from 'react'
import {Code2, Info, Loader2, Play} from 'lucide-react'
import VariableInput from './VariableInput'
import RequestSpecificationTabs from './RequestSpecificationTabs'
import ResponseDisplay from './ResponseDisplay'
import AssertionsSection from './AssertionsSection'
import EnvironmentInfoPopover from './EnvironmentInfoPopover'
import {getMethodColor} from '@/lib/utils/methodColors'

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
    lastRequest: {
        headers: Record<string, string>
        params: Record<string, string>
        body: string
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
                                          onSessionChange
                                      }: RequestTesterProps) {
    // Session state for tabs
    const [activeRequestTab, setActiveRequestTab] = useState<'headers' | 'params' | 'body' | 'auth'>(
        initialSession?.activeRequestTab || 'params'
    )
    const [activeResponseTab, setActiveResponseTab] = useState<'body' | 'headers'>(
        initialSession?.activeResponseTab || 'body'
    )
    const [url, setUrl] = useState(() => {
        const baseUrl = selectedEnv?.baseUrl || 'https://api.example.com'
        let path = endpoint.path

        if (endpoint.request?.parameters) {
            endpoint.request.parameters.forEach((param: any) => {
                if (param.in === 'path') {
                    const exampleValue = param.example || (param.type === 'integer' ? '1' : 'example')
                    path = path.replace(`{${param.name}}`, String(exampleValue))
                }
            })
        }

        return `${baseUrl}${path}`
    })

    const [method] = useState(endpoint.method || 'GET')

    const [headers, setHeaders] = useState<Record<string, string>>(() => {
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
        if (endpoint.request?.body) {
            const contentType = endpoint.request.contentType

            if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
                return ''
            }

            if (endpoint.request.body.example) {
                return JSON.stringify(endpoint.request.body.example, null, 2)
            }

            if (endpoint.request.body.fields && endpoint.request.body.fields.length > 0) {
                const obj: any = {}
                endpoint.request.body.fields.forEach((field: any) => {
                    obj[field.name] = field.example !== undefined ? field.example : null
                })
                return JSON.stringify(obj, null, 2)
            }
        }

        return ''
    })

    const [formData, setFormData] = useState<Record<string, any>>(() => {
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

    const [hasChanges, setHasChanges] = useState(false)
    const [_saving, setSaving] = useState(false)

    const [isExecuting, setIsExecuting] = useState(false)
    const [response, setResponse] = useState<any>(initialSession?.lastResponse || null)
    const [error, setError] = useState<string | null>(null)
    const [responseTime, setResponseTime] = useState<number>(0)

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
                lastRequest: response ? {
                    headers,
                    params,
                    body
                } : null
            }
            onSessionChange(session)
        }
    }, [activeRequestTab, activeResponseTab, response, headers, params, body, onSessionChange])

    // Reset state when testCase changes (switching between different tests)
    useEffect(() => {
        if (!testCase) return

        // Reset URL
        const baseUrl = selectedEnv?.baseUrl || 'https://api.example.com'
        let path = endpoint.path
        if (endpoint.request?.parameters) {
            endpoint.request.parameters.forEach((param: any) => {
                if (param.in === 'path') {
                    const exampleValue = param.example || (param.type === 'integer' ? '1' : 'example')
                    path = path.replace(`{${param.name}}`, String(exampleValue))
                }
            })
        }
        setUrl(`${baseUrl}${path}`)

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
                if (endpoint.request.body.example) {
                    initialBody = JSON.stringify(endpoint.request.body.example, null, 2)
                } else if (endpoint.request.body.fields && endpoint.request.body.fields.length > 0) {
                    const obj: any = {}
                    endpoint.request.body.fields.forEach((field: any) => {
                        obj[field.name] = field.example !== undefined ? field.example : null
                    })
                    initialBody = JSON.stringify(obj, null, 2)
                }
            }
        }
        setBody(initialBody)

        // Reset form data from testCase or endpoint
        const initialFormData: Record<string, any> = {}
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

        // Reset response state
        setResponse(null)
        setError(null)
        setResponseTime(0)
        setHasChanges(false)
    }, [testCase?.id]) // Only depend on testCase ID, not endpoint (which changes every render)

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
        let result = text
        Object.entries(variables).forEach(([key, value]) => {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
        })
        return result
    }

    const executeRequest = async () => {
        setIsExecuting(true)
        setError(null)
        setResponse(null)

        try {
            const startTime = Date.now()

            const envVariables = selectedEnv?.variables || {}

            let requestUrl = url
            if (Object.keys(envVariables).length > 0) {
                requestUrl = substituteVariables(requestUrl, envVariables)
            }

            if (selectedEnv?.baseUrl) {
                const urlObj = new URL(requestUrl)
                requestUrl = `${selectedEnv.baseUrl}${urlObj.pathname}${urlObj.search}`
            }

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

            const finalHeaders = {...substitutedHeaders, ...(selectedEnv?.headers || {})}

            const fetchOptions: RequestInit = {
                method,
                headers: finalHeaders,
            }

            if (method !== 'GET' && method !== 'HEAD' && body) {
                const substitutedBody = substituteVariables(body, envVariables)
                fetchOptions.body = substitutedBody
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

            setResponse(responseObj)

            if (assertions.length > 0) {
                const results = assertions.map((assertion) => {
                    try {
                        if (assertion.type === 'status') {
                            const actual = res.status
                            return evaluateAssertion(actual, assertion.operator, assertion.expected)
                        } else if (assertion.type === 'body') {
                            const actual = getNestedValue(responseData, assertion.field)
                            return evaluateAssertion(actual, assertion.operator, assertion.expected)
                        } else if (assertion.type === 'header') {
                            const actual = res.headers.get(assertion.field)
                            return evaluateAssertion(actual, assertion.operator, assertion.expected)
                        }
                    } catch (e) {
                        return false
                    }
                    return false
                })

                setResponse({...responseObj, assertionResults: results})
            }
        } catch (err: any) {
            setError(err.message || 'Request failed')
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
                        {environments && environments.length > 0 && onEnvChange && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Environment:</label>
                                <select
                                    value={selectedEnvId || ''}
                                    onChange={(e) => onEnvChange(e.target.value || null)}
                                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">None (default)</option>
                                    {environments.map((env) => (
                                        <option key={env.id} value={env.id}>
                                            {env.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedEnvId && (
                                    <button
                                        ref={envInfoButtonRef}
                                        onClick={() => setShowEnvInfo(!showEnvInfo)}
                                        className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                        title="Environment Details"
                                    >
                                        <Info size={16}/>
                                    </button>
                                )}
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
                                    variables={selectedEnv?.variables || {}}
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
                        mode="edit"
                        headers={headers}
                        params={params}
                        body={body}
                        formData={formData}
                        onHeadersChange={setHeaders}
                        onParamsChange={setParams}
                        onBodyChange={setBody}
                        onFormDataChange={setFormData}
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
                initialActiveTab={activeResponseTab}
                onActiveTabChange={setActiveResponseTab}
            />

            {/* Assertions Section */}
            <AssertionsSection
                assertions={assertions}
                onAssertionsChange={setAssertions}
                readOnly={readOnly}
                selectedEnv={selectedEnv}
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
