import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {
    AlertCircle,
    Clock,
    FileText,
    FolderClosed,
    FolderOpen,
    Loader2,
    RefreshCw,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react'
import * as api from '@/lib/api'
import RequestTester, {SessionState} from '@/components/RequestTester'
import EnvironmentManager from '@/components/EnvironmentManager'
import ResizablePanel from '@/components/ResizablePanel'
import EndpointCard from '@/components/EndpointCard'
import PageLayout from '@/components/PageLayout'
import {useEnvironments} from '@/lib/hooks'
import type {Spec, TestCase} from '@/types/database'

// Group tests by spec
interface TestGroup {
  spec: Spec
  singleTests: TestCase[]
  workflowTests: TestCase[]
}

// Helper functions for session management
const getSessionKey = (testId: number, stepIndex?: number) => {
  return stepIndex !== undefined
    ? `test-${testId}-step-${stepIndex}-session`
    : `test-${testId}-session`
}

const loadSession = (testId: number, stepIndex?: number): Partial<SessionState> | undefined => {
  try {
    const saved = localStorage.getItem(getSessionKey(testId, stepIndex))
    return saved ? JSON.parse(saved) : undefined
  } catch {
    return undefined
  }
}

const saveSession = (testId: number, session: SessionState, stepIndex?: number) => {
  try {
    localStorage.setItem(getSessionKey(testId, stepIndex), JSON.stringify(session))
  } catch (error) {
    console.error('Failed to save session:', error)
  }
}

export default function Tests() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isGenerating, setIsGenerating] = useState(searchParams.get('generating') === 'true')
  const [generatingSpecId, setGeneratingSpecId] = useState<number | null>(() => {
    const saved = localStorage.getItem('tests-generating-spec-id')
    return saved ? parseInt(saved) : null
  })
  const [tokenLimitReached, setTokenLimitReached] = useState(false)
  const [remainingEndpointIds, setRemainingEndpointIds] = useState<number[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const testListRef = useRef<HTMLDivElement>(null)
  const [selectedTestId, setSelectedTestId] = useState<number | null>(() => {
    const saved = localStorage.getItem('tests-selected-test-id')
    return saved ? parseInt(saved) : null
  })
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null)
  const [expandedSpecs, setExpandedSpecs] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('tests-expanded-specs')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('tests-expanded-sections')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveHandler, setSaveHandler] = useState<(() => Promise<void>) | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(() => {
    const saved = localStorage.getItem('tests-selected-spec-id')
    return saved ? parseInt(saved) : null
  })

  // Editable test name and description
  const [testName, setTestName] = useState('')
  const [testDescription, setTestDescription] = useState('')
  const [originalTestName, setOriginalTestName] = useState('')
  const [originalTestDescription, setOriginalTestDescription] = useState('')

  // Memoized callback for handling changes
  const handleHasChanges = useCallback((hasChanges: boolean, handler: () => Promise<void>) => {
    console.log('[Tests] handleHasChanges called with:', hasChanges);
    setHasUnsavedChanges(hasChanges);
    setSaveHandler(() => handler);
  }, []);

  // Reset unsaved changes when switching tests
  useEffect(() => {
    console.log('[Tests] Selected test changed, resetting unsaved changes');
    setHasUnsavedChanges(false);
    setSaveHandler(null);
  }, [selectedTestId, selectedStepIndex]);

  // Monitor URL params and localStorage for generating flag
  useEffect(() => {
    const urlGenerating = searchParams.get('generating') === 'true'
    const storageGenerating = localStorage.getItem('tests-generating') === 'true'
    const shouldBeGenerating = urlGenerating || storageGenerating

    if (shouldBeGenerating !== isGenerating) {
      setIsGenerating(shouldBeGenerating)
    }
  }, [searchParams])

  // Poll localStorage for generating flag and spec ID changes
  useEffect(() => {
    const checkGenerating = () => {
      const storageGenerating = localStorage.getItem('tests-generating') === 'true'
      const storageSpecId = localStorage.getItem('tests-generating-spec-id')
      const storageTokenLimit = localStorage.getItem('tests-token-limit-reached') === 'true'
      const storageRemainingIds = localStorage.getItem('tests-remaining-endpoint-ids')
      const storageCompletedCount = localStorage.getItem('tests-completed-count')
      const storageTotalCount = localStorage.getItem('tests-total-count')

      if (storageGenerating !== isGenerating) {
        setIsGenerating(storageGenerating)
        if (!storageGenerating) {
          // Clear URL param when generation stops
          setSearchParams(params => {
            params.delete('generating')
            return params
          })
          setGeneratingSpecId(null)
        }
      }

      if (storageSpecId) {
        const specId = parseInt(storageSpecId)
        if (specId !== generatingSpecId) {
          setGeneratingSpecId(specId)
        }
      }

      // Check token limit state
      if (storageTokenLimit !== tokenLimitReached) {
        setTokenLimitReached(storageTokenLimit)
      }

      if (storageRemainingIds) {
        try {
          const ids = JSON.parse(storageRemainingIds)
          if (JSON.stringify(ids) !== JSON.stringify(remainingEndpointIds)) {
            setRemainingEndpointIds(ids)
          }
        } catch (e) {
          console.error('Failed to parse remaining endpoint IDs:', e)
        }
      }

      if (storageCompletedCount) {
        const count = parseInt(storageCompletedCount)
        if (count !== completedCount) {
          setCompletedCount(count)
        }
      }

      if (storageTotalCount) {
        const count = parseInt(storageTotalCount)
        if (count !== totalCount) {
          setTotalCount(count)
        }
      }
    }

    // Check every 500ms
    const interval = setInterval(checkGenerating, 500)
    return () => clearInterval(interval)
  }, [isGenerating, generatingSpecId, tokenLimitReached, remainingEndpointIds, completedCount, totalCount, setSearchParams])

  // Get all test cases grouped by spec
  const { data: testGroups, refetch } = useQuery({
    queryKey: ['test-groups'],
    queryFn: async () => {
      console.log('[Tests Page] Fetching all test cases...')
      const specs = await api.getAllSpecs()
      console.log('[Tests Page] Found', specs.length, 'specs:', specs.map(s => ({ id: s.id, name: s.name })))

      const groups: TestGroup[] = []
      for (const spec of specs) {
        const tests = await api.getTestCasesBySpec(spec.id!)
        console.log('[Tests Page] Spec', spec.id, 'has', tests.length, 'tests')

        const singleTests = tests.filter(t => t.testType === 'single')
        const workflowTests = tests.filter(t => t.testType === 'workflow')

        groups.push({
          spec,
          singleTests,
          workflowTests
        })
      }

      const totalTests = groups.reduce((sum, g) => sum + g.singleTests.length + g.workflowTests.length, 0)
      console.log('[Tests Page] Fetched', totalTests, 'test cases total')
      return groups
    },
    // Disable caching during generation
    staleTime: isGenerating ? 0 : 30000,
    refetchInterval: isGenerating ? 2000 : false, // Auto-refetch every 2s while generating
    refetchOnWindowFocus: false, // Prevent refetch when switching between windows
  })

  // Get all tests (flat list for convenience) - memoized to prevent recalculation
  const allTestCases = useMemo(
    () => testGroups?.flatMap(g => [...g.singleTests, ...g.workflowTests]) || [],
    [testGroups]
  )

  const selectedTest = useMemo(
    () => allTestCases.find(t => t.id === selectedTestId),
    [allTestCases, selectedTestId]
  )

  // Auto-expand the generating spec and its sections when generation starts
  useEffect(() => {
    if (isGenerating && generatingSpecId) {
      setExpandedSpecs(prev => {
        const newSet = new Set(prev)
        newSet.add(generatingSpecId)
        return newSet
      })
      setExpandedSections(prev => {
        const newSet = new Set(prev)
        newSet.add(`${generatingSpecId}-single`)
        return newSet
      })
    }
  }, [isGenerating, generatingSpecId])

  // Auto-scroll to bottom of generating spec's test list when tests are added
  useEffect(() => {
    if (isGenerating && generatingSpecId && testListRef.current) {
      testListRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [testGroups, isGenerating, generatingSpecId])

  // Sync test name and description when selectedTest changes
  useEffect(() => {
    if (selectedTest) {
      setTestName(selectedTest.name)
      setTestDescription(selectedTest.description || '')
      setOriginalTestName(selectedTest.name)
      setOriginalTestDescription(selectedTest.description || '')
    } else {
      setTestName('')
      setTestDescription('')
      setOriginalTestName('')
      setOriginalTestDescription('')
    }
  }, [selectedTest?.id])

  // Track changes in name/description
  const [hasHeaderChanges, setHasHeaderChanges] = useState(false)
  useEffect(() => {
    const nameChanged = testName !== originalTestName
    const descChanged = testDescription !== originalTestDescription
    setHasHeaderChanges(nameChanged || descChanged)
  }, [testName, testDescription, originalTestName, originalTestDescription])

  // Combine header changes with request changes
  useEffect(() => {
    // Update hasUnsavedChanges based on both header and request changes
    setHasUnsavedChanges((prevHasChanges) => {
      // If there are header changes, we have unsaved changes
      // Otherwise, respect the existing state from RequestTester
      return hasHeaderChanges || prevHasChanges
    })
  }, [hasHeaderChanges])

  // Get selected spec - memoized to prevent recalculation
  const selectedSpec = useMemo(
    () => testGroups?.find(g => g.spec.id === selectedSpecId)?.spec,
    [testGroups, selectedSpecId]
  )

  // Load environments for selected test's spec OR selected spec
  const { data: environments } = useEnvironments(selectedTest?.specId || selectedSpecId || 0)

  // Global environment selection (per spec)
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(() => {
    const activeSpecId = selectedTest?.specId || selectedSpecId
    if (activeSpecId) {
      return localStorage.getItem(`spec-${activeSpecId}-selected-env`) || null
    }
    return null
  })

  // Update selected env when test or spec changes
  useEffect(() => {
    const activeSpecId = selectedTest?.specId || selectedSpecId
    if (activeSpecId) {
      const saved = localStorage.getItem(`spec-${activeSpecId}-selected-env`)
      setSelectedEnvId(saved || null)
    }
  }, [selectedTest?.specId, selectedSpecId])

  // Save selected environment
  useEffect(() => {
    const activeSpecId = selectedTest?.specId || selectedSpecId
    if (activeSpecId) {
      if (selectedEnvId) {
        localStorage.setItem(`spec-${activeSpecId}-selected-env`, selectedEnvId)
      } else {
        localStorage.removeItem(`spec-${activeSpecId}-selected-env`)
      }
    }
  }, [selectedEnvId, selectedTest?.specId, selectedSpecId])

  const selectedEnv = environments?.find(env => env.id === selectedEnvId)

  // Safety timeout to stop auto-refetch after 5 minutes
  useEffect(() => {
    if (!isGenerating) return

    const timeout = setTimeout(() => {
      console.log('[Tests Page] Generation timeout - stopping auto-refresh')
      setIsGenerating(false)
      searchParams.delete('generating')
      setSearchParams(searchParams)
    }, 5 * 60 * 1000)

    return () => clearTimeout(timeout)
  }, [isGenerating, searchParams, setSearchParams])

  // Update isGenerating when searchParams change
  useEffect(() => {
    setIsGenerating(searchParams.get('generating') === 'true')
  }, [searchParams])

  // Reset selected step when test changes
  useEffect(() => {
    setSelectedStepIndex(null)
  }, [selectedTestId])

  // Persist selected test ID
  useEffect(() => {
    if (selectedTestId) {
      localStorage.setItem('tests-selected-test-id', String(selectedTestId))
    } else {
      localStorage.removeItem('tests-selected-test-id')
    }
  }, [selectedTestId])

  // Persist selected spec ID
  useEffect(() => {
    if (selectedSpecId) {
      localStorage.setItem('tests-selected-spec-id', String(selectedSpecId))
    } else {
      localStorage.removeItem('tests-selected-spec-id')
    }
  }, [selectedSpecId])

  // Auto-expand parent spec and section when a test is selected from localStorage
  useEffect(() => {
    if (selectedTestId && testGroups) {
      // Find the spec and section for this test
      for (const group of testGroups) {
        const isSingleTest = group.singleTests.some(t => t.id === selectedTestId)
        const isWorkflowTest = group.workflowTests.some(t => t.id === selectedTestId)

        if (isSingleTest || isWorkflowTest) {
          // Auto-expand the spec
          setExpandedSpecs(prev => new Set(prev).add(group.spec.id!))

          // Auto-expand the section
          if (isSingleTest) {
            setExpandedSections(prev => new Set(prev).add(`${group.spec.id}-single`))
          } else {
            setExpandedSections(prev => new Set(prev).add(`${group.spec.id}-workflow`))
          }
          break
        }
      }
    }
  }, [selectedTestId, testGroups])

  // Auto-expand spec when selectedSpecId is restored from localStorage
  useEffect(() => {
    if (selectedSpecId) {
      setExpandedSpecs(prev => new Set(prev).add(selectedSpecId))
    }
  }, [selectedSpecId])

  // Persist expanded specs
  useEffect(() => {
    localStorage.setItem('tests-expanded-specs', JSON.stringify(Array.from(expandedSpecs)))
  }, [expandedSpecs])

  // Persist expanded sections
  useEffect(() => {
    localStorage.setItem('tests-expanded-sections', JSON.stringify(Array.from(expandedSections)))
  }, [expandedSections])

  // Toggle spec folder
  const toggleSpec = (specId: number) => {
    setExpandedSpecs(prev => {
      const next = new Set(prev)
      if (next.has(specId)) {
        next.delete(specId)
      } else {
        next.add(specId)
      }
      return next
    })
  }

  // Toggle section (single tests / workflow tests)
  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Delete test "${name}"?`)) {
      await api.deleteTestCase(id)
      if (selectedTestId === id) {
        setSelectedTestId(null)
      }
      await refetch()
    }
  }


  const handleTestUpdate = async (testId: number, updates: any) => {
    try {
      await api.updateTestCase(testId, updates)
      await refetch() // Refresh test data
      // Show success feedback (optional toast notification could be added later)
      alert('Test case updated successfully!')
    } catch (error: any) {
      throw new Error(`Failed to update test: ${error.message}`)
    }
  }

  const handleStepUpdate = async (testId: number, stepIndex: number, updates: any) => {
    try {
      // Get current test case
      const testCase = testGroups
        ?.flatMap(g => [...g.singleTests, ...g.workflowTests])
        .find(t => t.id === testId);

      if (!testCase || !testCase.steps) {
        throw new Error('Test case or steps not found');
      }

      // Update the specific step
      const updatedSteps = [...testCase.steps];
      updatedSteps[stepIndex] = {
        ...updatedSteps[stepIndex],
        headers: updates.headers,
        queryParams: updates.queryParams,
        body: updates.body,
        assertions: updates.assertions
      };

      // Save updated steps back to test case
      await api.updateTestCase(testId, { steps: updatedSteps });
      await refetch();
      alert('Step updated successfully!');
    } catch (error: any) {
      throw new Error(`Failed to update step: ${error.message}`);
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200'
      case 'fail':
        return 'bg-red-50 border-red-200'
      case 'error':
        return 'bg-orange-50 border-orange-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <>
      <PageLayout>
        {/* Left Panel: Tree View */}
        <ResizablePanel defaultWidth={320} minWidth={300} maxWidth={600} className="">
          <div className="flex flex-col h-full">
            {/* Search Bar with Refresh Button */}
            <div className="m-4 mb-2 flex items-center gap-2 flex-shrink-0">
              <div className="flex-1 glass-card rounded-full px-4 py-2 flex items-center gap-2">
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 hover:bg-white/50 rounded-full transition-colors"
                  >
                    <X size={14} className="text-gray-500" />
                  </button>
                )}
              </div>
              <button
                onClick={async () => {
                  console.log('[Tests Page] Manual refresh triggered')
                  await refetch()
                }}
                className="glass-panel rounded-full p-2.5 hover:shadow-lg transition-all flex-shrink-0 active:scale-95"
                title="Refresh Tests"
              >
                <RefreshCw size={18} className="text-purple-600" />
              </button>
            </div>

            {/* Generating Banner */}
            {isGenerating && (
              <div className="m-4 mb-2 p-3 glass-card rounded-2xl flex items-center gap-3 flex-shrink-0">
                <Loader2 size={18} className="text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-blue-900">Generating Tests</h3>
                  <p className="text-xs text-blue-700">Auto-refreshing...</p>
                </div>
                <button
                  onClick={() => {
                    setIsGenerating(false)
                    searchParams.delete('generating')
                    setSearchParams(searchParams)
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex-shrink-0"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Token Limit Banner with Continue/Stop Buttons */}
            {tokenLimitReached && !isGenerating && (
              <div className="m-4 mb-2 p-3 glass-card rounded-2xl flex items-center gap-3 flex-shrink-0 border-l-4 border-orange-500">
                <AlertCircle size={18} className="text-orange-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-orange-900">Generation Paused</h3>
                  <p className="text-xs text-orange-700">
                    The AI reached its response limit. Would you like to continue generating more tests?
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Stop generation - clear all state and hide banner
                    console.log('[Tests] User stopped generation')
                    setTokenLimitReached(false)
                    setRemainingEndpointIds([])
                    setCompletedCount(0)
                    setTotalCount(0)
                    localStorage.removeItem('tests-token-limit-reached')
                    localStorage.removeItem('tests-remaining-endpoint-ids')
                    localStorage.removeItem('tests-completed-count')
                    localStorage.removeItem('tests-total-count')
                    localStorage.removeItem('tests-conversation-messages')
                    localStorage.removeItem('tests-generated-summary')
                    localStorage.removeItem('tests-generating-spec-id')
                  }}
                  className="px-3 py-1 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all flex-shrink-0"
                >
                  Stop
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Import necessary modules
                      const { getCurrentAIService } = await import('@/lib/ai')
                      const { getEndpointsBySpec, createTestCase } = await import('@/lib/api')

                      // Set generating state
                      setIsGenerating(true)
                      setTokenLimitReached(false)
                      localStorage.setItem('tests-generating', 'true')
                      searchParams.set('generating', 'true')
                      setSearchParams(searchParams)

                      // Get spec data
                      const specId = generatingSpecId
                      if (!specId) {
                        alert('Spec not found')
                        return
                      }

                      // Get all endpoints and filter to remaining ones
                      const allEndpoints = await getEndpointsBySpec(specId)
                      const endpointsToGenerate = allEndpoints.filter(e => remainingEndpointIds.includes(e.id!))

                      console.log('[Tests] Continuing generation for', endpointsToGenerate.length, 'remaining endpoints')

                      // Get spec for AI
                      const spec = testGroups?.find(g => g.spec.id === specId)?.spec
                      if (!spec) {
                        alert('Spec not found')
                        return
                      }
                      const parsedSpec = JSON.parse(spec.rawSpec)

                      // Get AI service
                      const aiService = await getCurrentAIService()

                      // Get conversation history for continuation
                      const previousMessagesStr = localStorage.getItem('tests-conversation-messages')
                      const previousSummary = localStorage.getItem('tests-generated-summary')
                      const previousMessages = previousMessagesStr ? JSON.parse(previousMessagesStr) : undefined

                      console.log('[Tests] Continuing with history:', previousMessages ? 'Yes' : 'No')

                      // Generate tests for remaining endpoints with conversation history
                      const result = await aiService.generateTests({
                        endpoints: endpointsToGenerate,
                        spec: parsedSpec,
                        previousMessages,
                        generatedTestsSummary: previousSummary || undefined,
                        onTestGenerated: async (test) => {
                          await createTestCase(test as any)
                          refetch()
                        },
                      })

                      // Handle result
                      if (!result.completed && result.error === 'TOKEN_LIMIT_REACHED') {
                        console.log('[Tests] Token limit reached again')
                        // Update state for another continuation, including conversation
                        localStorage.setItem('tests-token-limit-reached', 'true')
                        localStorage.setItem('tests-remaining-endpoint-ids', JSON.stringify(result.remainingEndpointIds))
                        localStorage.setItem('tests-completed-count', String(result.completedEndpointIds.length))
                        localStorage.setItem('tests-total-count', String(result.remainingEndpointIds.length))
                        localStorage.setItem('tests-conversation-messages', JSON.stringify(result.conversationMessages))
                        localStorage.setItem('tests-generated-summary', result.generatedTestsSummary)
                        localStorage.removeItem('tests-generating')
                      } else {
                        // All done - clear everything including conversation
                        console.log('[Tests] All tests generated successfully')
                        localStorage.removeItem('tests-generating')
                        localStorage.removeItem('tests-generating-spec-id')
                        localStorage.removeItem('tests-token-limit-reached')
                        localStorage.removeItem('tests-remaining-endpoint-ids')
                        localStorage.removeItem('tests-completed-count')
                        localStorage.removeItem('tests-total-count')
                        localStorage.removeItem('tests-conversation-messages')
                        localStorage.removeItem('tests-generated-summary')
                        setTokenLimitReached(false)
                      }
                    } catch (error: any) {
                      console.error('Continue generation error:', error)
                      alert(`Failed to continue: ${error.message}`)
                    } finally {
                      setIsGenerating(false)
                      localStorage.removeItem('tests-generating')
                      searchParams.delete('generating')
                      setSearchParams(searchParams)
                    }
                  }}
                  className="px-3 py-1 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex-shrink-0"
                >
                  Continue Generation
                </button>
              </div>
            )}

            {/* Test List */}
            {!testGroups || allTestCases.length === 0 ? (
            <div className="text-center py-12 px-4 flex-1">
              <Clock size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No test cases yet</h3>
              <p className="text-sm text-gray-600">Generate tests from your API specifications</p>
            </div>
          ) : (
            <div className="p-4 pb-24 space-y-2 flex-1 overflow-auto">
              {testGroups
                .map(group => {
                  const query = searchQuery.toLowerCase()

                  // Filter tests by search query
                  const filteredSingleTests = searchQuery
                    ? group.singleTests.filter(test =>
                        test.name.toLowerCase().includes(query)
                      )
                    : group.singleTests

                  const filteredWorkflowTests = searchQuery
                    ? group.workflowTests.filter(test =>
                        test.name.toLowerCase().includes(query)
                      )
                    : group.workflowTests

                  return {
                    ...group,
                    singleTests: filteredSingleTests,
                    workflowTests: filteredWorkflowTests
                  }
                })
                .filter(group => {
                  // Show spec if it matches search or has matching tests
                  const specMatch = !searchQuery || group.spec.name.toLowerCase().includes(searchQuery.toLowerCase())
                  const hasTests = group.singleTests.length > 0 || group.workflowTests.length > 0
                  return specMatch || hasTests
                })
                .map(group => {
                const specId = group.spec.id!
                const isExpanded = expandedSpecs.has(specId)
                const totalTests = group.singleTests.length + group.workflowTests.length

                if (totalTests === 0) return null

                return (
                  <div key={specId}>
                    {/* Spec Folder */}
                    <div className={`w-full flex items-center gap-2 px-3 py-2 transition-colors ${
                      selectedSpecId === specId && !selectedTestId
                        ? 'bg-purple-200 rounded-lg'
                        : 'hover:bg-gray-50 hover:rounded-lg'
                    }`}>
                      {/* Folder icon - toggle collapse/expand */}
                      <button
                        onClick={() => toggleSpec(specId)}
                        className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <FolderOpen size={16} className="text-purple-600" /> : <FolderClosed size={16} className="text-purple-600" />}
                      </button>

                      {/* Spec info - select spec */}
                      <button
                        onClick={() => {
                          setSelectedSpecId(specId)
                          setSelectedTestId(null)
                          // Auto-expand if collapsed
                          if (!isExpanded) {
                            toggleSpec(specId)
                          }
                        }}
                        className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{group.spec.name}</h3>
                          <p className="text-xs text-gray-500">v{group.spec.version}</p>
                        </div>
                        <span className="text-xs text-gray-500">({totalTests})</span>
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="ml-2 mt-1 space-y-1">
                        {/* Single Tests Section */}
                        {group.singleTests.length > 0 && (
                          <div>
                            <div className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                              {/* Folder icon - toggle */}
                              <button
                                onClick={() => toggleSection(`${specId}-single`)}
                                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                title={expandedSections.has(`${specId}-single`) ? "Collapse" : "Expand"}
                              >
                                {expandedSections.has(`${specId}-single`) ?
                                  <FolderOpen size={14} className="text-blue-600" /> : <FolderClosed size={14} className="text-blue-600" />}
                              </button>

                              {/* Section label */}
                              <div className="flex-1 flex items-center gap-2">
                                <span className="text-sm text-gray-700 font-medium">Single Tests</span>
                                <span className="text-xs text-gray-500">({group.singleTests.length})</span>
                              </div>
                            </div>

                            {expandedSections.has(`${specId}-single`) && (
                              <div className="ml-2 mt-1 space-y-1">
                                {group.singleTests.map(test => (
                                  <EndpointCard
                                    key={test.id}
                                    method={test.method}
                                    path={test.path}
                                    name={test.name}
                                    isSelected={test.id === selectedTestId}
                                    onClick={() => setSelectedTestId(test.id!)}
                                  />
                                ))}
                                {/* Loading skeleton when generating tests for this spec */}
                                {isGenerating && generatingSpecId === specId && (
                                  <div ref={testListRef} className="space-y-1">
                                    {[1, 2, 3].map(i => (
                                      <div key={i} className="p-3 rounded-lg border border-gray-200 bg-white animate-pulse">
                                        <div className="flex items-center gap-2">
                                          <div className="h-5 w-12 bg-gray-200 rounded"></div>
                                          <div className="h-4 flex-1 bg-gray-200 rounded"></div>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
                                      <Loader2 size={16} className="animate-spin" />
                                      <span>Generating tests...</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Workflow Tests Section */}
                        {group.workflowTests.length > 0 && (
                          <div>
                            <div className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                              {/* Folder icon - toggle */}
                              <button
                                onClick={() => toggleSection(`${specId}-workflow`)}
                                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                title={expandedSections.has(`${specId}-workflow`) ? "Collapse" : "Expand"}
                              >
                                {expandedSections.has(`${specId}-workflow`) ?
                                  <FolderOpen size={14} className="text-green-600" /> : <FolderClosed size={14} className="text-green-600" />}
                              </button>

                              {/* Section label */}
                              <div className="flex-1 flex items-center gap-2">
                                <span className="text-sm text-gray-700 font-medium">Workflow Tests</span>
                                <span className="text-xs text-gray-500">({group.workflowTests.length})</span>
                              </div>
                            </div>

                            {expandedSections.has(`${specId}-workflow`) && (
                              <div className="ml-2 mt-1 space-y-1">
                                {group.workflowTests.map(test => (
                                  <EndpointCard
                                    key={test.id}
                                    method={test.method}
                                    path={test.path}
                                    name={test.name}
                                    stepCount={test.steps?.length || 0}
                                    isSelected={test.id === selectedTestId}
                                    onClick={() => setSelectedTestId(test.id!)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </ResizablePanel>

        {/* Right Panel: Test Detail or Spec Detail */}
        <div className="flex-1 overflow-y-auto glass-card rounded-3xl">
          {!selectedTest && !selectedSpec ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                <p>Select a spec or test case to view details</p>
              </div>
            </div>
          ) : !selectedTest && selectedSpec ? (
            /* Spec Detail View */
            <div className="p-6 pb-20 space-y-6">
              {/* Spec Info */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedSpec.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">Version {selectedSpec.version}</p>
                    {selectedSpec.description && (
                      <p className="text-sm text-gray-600 mt-2">{selectedSpec.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Test Cases:</span>{' '}
                    <span className="font-medium">
                      {testGroups?.find(g => g.spec.id === selectedSpecId)?.singleTests.length || 0} single, {' '}
                      {testGroups?.find(g => g.spec.id === selectedSpecId)?.workflowTests.length || 0} workflow
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Base URL:</span>{' '}
                    <span className="font-medium font-mono text-xs">{selectedSpec.baseUrl || 'Not set'}</span>
                  </div>
                </div>
              </div>

              {/* Environment Section */}
              <EnvironmentManager
                specId={selectedSpecId!}
                specName={selectedSpec.name}
                environments={environments || []}
                selectedEnvId={selectedEnvId}
                onEnvChange={setSelectedEnvId}
              />
            </div>
          ) : selectedTest ? (
            <div className="p-4 pb-20">
              {/* Test Header */}
              <div className={`border rounded-lg p-3 mb-4 ${getStatusColor(selectedTest.lastResult)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {/* Editable Test Name */}
                    <div className="mb-2">
                      <input
                        type="text"
                        value={testName}
                        onChange={(e) => setTestName(e.target.value)}
                        className="w-full text-lg font-bold text-gray-900 bg-transparent border-none outline-none px-0 py-0 focus:ring-0 focus:border-b focus:border-purple-500"
                        placeholder="Test name"
                      />
                    </div>
                    {/* Editable Test Description */}
                    <div className="mb-2">
                      <textarea
                        value={testDescription}
                        onChange={(e) => setTestDescription(e.target.value)}
                        className="w-full text-sm text-gray-600 bg-transparent border-none outline-none px-0 py-0 focus:ring-0 focus:border-b focus:border-purple-500 resize-none"
                        placeholder="Test description (optional)"
                        rows={testDescription ? Math.max(1, testDescription.split('\n').length) : 1}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="font-mono">{selectedTest.method} {selectedTest.path}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Save button - only enabled if changes detected */}
                    <button
                      onClick={async () => {
                        try {
                          const updates: any = {}

                          // Save name/description changes
                          if (hasHeaderChanges) {
                            if (testName !== originalTestName) {
                              updates.name = testName
                            }
                            if (testDescription !== originalTestDescription) {
                              updates.description = testDescription
                            }
                          }

                          // Save request changes via RequestTester's save handler
                          if (saveHandler) {
                            await saveHandler()
                          }

                          // Save header changes if any
                          if (Object.keys(updates).length > 0 && selectedTest) {
                            await handleTestUpdate(selectedTest.id!, updates)
                            setOriginalTestName(testName)
                            setOriginalTestDescription(testDescription)
                          }

                          // Reset change tracking
                          setHasHeaderChanges(false)
                        } catch (error) {
                          console.error('Failed to save changes:', error)
                        }
                      }}
                      disabled={!hasUnsavedChanges}
                      className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                        hasUnsavedChanges
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                      title={hasUnsavedChanges ? "Save changes" : "No changes to save"}
                    >
                      <Save size={18} />
                      {hasUnsavedChanges && <span className="text-sm font-medium">Save</span>}
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(selectedTest.id!, selectedTest.name)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Delete test"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Test Details */}
              {selectedTest.testType === 'single' ? (
                /* Single Test View - Use RequestTester with Canonical Format */
                (() => {
                  // Determine content type from headers
                  const contentType = selectedTest.headers?.['Content-Type'] ||
                                     selectedTest.headers?.['content-type'] ||
                                     'application/json'

                  // Build canonical request body
                  let body = undefined
                  if (selectedTest.body) {
                    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
                      // For form data, create fields array
                      const fields: any[] = []
                      if (typeof selectedTest.body === 'object') {
                        Object.entries(selectedTest.body).forEach(([key, value]) => {
                          // Detect file fields
                          if (key === 'file' || key.toLowerCase().includes('file') || key.toLowerCase().includes('image')) {
                            fields.push({
                              name: key,
                              type: 'string',
                              format: 'binary',
                              required: false,
                              example: undefined,
                              description: 'File upload'
                            })
                          } else {
                            fields.push({
                              name: key,
                              type: 'string',
                              required: false,
                              example: value
                            })
                          }
                        })
                      }
                      body = {
                        required: true,
                        fields,
                        example: undefined  // No JSON example for form data
                      }
                    } else {
                      // For JSON or other types, just provide example
                      body = {
                        required: true,
                        example: selectedTest.body
                      }
                    }
                  }

                  return (
                    <RequestTester
                      key={selectedTest.id}
                      endpoint={{
                        method: selectedTest.method,
                        path: selectedTest.path,
                        name: selectedTest.description || selectedTest.name,
                        request: {
                          contentType,
                          parameters: [
                            // Convert path variables to canonical parameters
                            ...Object.keys(selectedTest.pathVariables || {}).map(key => ({
                              name: key,
                              in: 'path' as const,
                              type: 'string',
                              required: true,
                              example: selectedTest.pathVariables![key]
                            })),
                            // Convert query params to canonical parameters
                            ...Object.keys(selectedTest.queryParams || {}).map(key => ({
                              name: key,
                              in: 'query' as const,
                              type: 'string',
                              required: false,
                              example: selectedTest.queryParams![key]
                            }))
                          ],
                          body
                        },
                        // Add assertions for display
                        assertions: selectedTest.assertions
                      } as any}
                      testCase={selectedTest}
                      onTestUpdate={(updates) => handleTestUpdate(selectedTest.id!, updates)}
                      onHasChanges={handleHasChanges}
                      showSaveButton={false}
                      readOnly={false}
                      specId={String(selectedTest.specId)}
                      selectedEnv={selectedEnv}
                      environments={environments}
                      selectedEnvId={selectedEnvId}
                      onEnvChange={setSelectedEnvId}
                      initialSession={loadSession(selectedTest.id!)}
                      onSessionChange={(session) => saveSession(selectedTest.id!, session)}
                    />
                  )
                })()
              ) : (
                /* Workflow Test View */
                <div className="space-y-4">
                  {/* Steps List */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Workflow Steps ({selectedTest.steps?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {selectedTest.steps?.map((step, idx) => (
                        <button
                          key={step.id}
                          onClick={() => setSelectedStepIndex(selectedStepIndex === idx ? null : idx)}
                          className={`w-full border rounded-lg p-4 text-left transition-colors ${
                            selectedStepIndex === idx
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full">
                              {step.order}
                            </span>
                            <h4 className="font-medium text-gray-900">{step.name}</h4>
                            <code className="text-xs text-gray-600">{step.method} {step.path}</code>
                          </div>
                          {step.description && (
                            <p className="text-sm text-gray-600 mb-2 ml-9">{step.description}</p>
                          )}
                          <div className="ml-9 text-xs text-gray-500">
                            {step.assertions.length} assertions • Click to test
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Step Detail */}
                  {selectedStepIndex !== null && selectedTest.steps && selectedTest.steps[selectedStepIndex] && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">
                          Step {selectedTest.steps[selectedStepIndex].order}: {selectedTest.steps[selectedStepIndex].name}
                        </h3>
                        <button
                          onClick={() => setSelectedStepIndex(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      {(() => {
                        const step = selectedTest.steps![selectedStepIndex]

                        // Determine content type from headers
                        const contentType = step.headers?.['Content-Type'] ||
                                           step.headers?.['content-type'] ||
                                           'application/json'

                        // Build canonical request body
                        let body = undefined
                        if (step.body) {
                          if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
                            // For form data, create fields array
                            const fields: any[] = []
                            if (typeof step.body === 'object') {
                              Object.entries(step.body).forEach(([key, value]) => {
                                // Detect file fields
                                if (key === 'file' || key.toLowerCase().includes('file') || key.toLowerCase().includes('image')) {
                                  fields.push({
                                    name: key,
                                    type: 'string',
                                    format: 'binary',
                                    required: false,
                                    example: undefined,
                                    description: 'File upload'
                                  })
                                } else {
                                  fields.push({
                                    name: key,
                                    type: 'string',
                                    required: false,
                                    example: value
                                  })
                                }
                              })
                            }
                            body = {
                              required: true,
                              fields,
                              example: undefined  // No JSON example for form data
                            }
                          } else {
                            // For JSON or other types, just provide example
                            body = {
                              required: true,
                              example: step.body
                            }
                          }
                        }

                        return (
                          <RequestTester
                            key={step.id || `step-${selectedStepIndex}`}
                            endpoint={{
                              method: step.method,
                              path: step.path,
                              name: step.description || step.name,
                              request: {
                                contentType,
                                parameters: [
                                  // Convert path variables to canonical parameters
                                  ...Object.keys(step.pathVariables || {}).map(key => ({
                                    name: key,
                                    in: 'path' as const,
                                    type: 'string',
                                    required: true,
                                    example: step.pathVariables![key]
                                  })),
                                  // Convert query params to canonical parameters
                                  ...Object.keys(step.queryParams || {}).map(key => ({
                                    name: key,
                                    in: 'query' as const,
                                    type: 'string',
                                    required: false,
                                    example: step.queryParams![key]
                                  }))
                                ],
                                body
                              },
                              assertions: step.assertions
                            } as any}
                            testCase={step}
                            onTestUpdate={(updates) => handleStepUpdate(selectedTest.id!, selectedStepIndex, updates)}
                            onHasChanges={handleHasChanges}
                            showSaveButton={false}
                            readOnly={false}
                            specId={String(selectedTest.specId)}
                            selectedEnv={selectedEnv}
                            environments={environments}
                            selectedEnvId={selectedEnvId}
                            onEnvChange={setSelectedEnvId}
                            initialSession={loadSession(selectedTest.id!, selectedStepIndex)}
                            onSessionChange={(session) => saveSession(selectedTest.id!, session, selectedStepIndex)}
                          />
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
    </PageLayout>
    </>
  )
}
