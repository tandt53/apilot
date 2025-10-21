import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    FileText,
    FolderClosed,
    FolderOpen,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as api from '@/lib/api'
import {deleteTestCasesBySpec} from '@/lib/api/testCases'
import EnvironmentManager from '@/components/EnvironmentManager'
import ResizablePanel from '@/components/ResizablePanel'
import EndpointCard from '@/components/EndpointCard'
import PageLayout from '@/components/PageLayout'
import SaveCancelButtons from '@/components/SaveCancelButtons'
import Button from '@/components/Button'
import StepEditor from '@/components/StepEditor'
import ImportPreviewDialog from '@/components/ImportPreviewDialog'
import {useEnvironments} from '@/lib/hooks'
import type {Spec, TestCase, TestStep} from '@/types/database'

// Group tests by spec
interface TestGroup {
  spec: Spec
  singleTests: TestCase[]
  workflowTests: TestCase[]
}

// Session state interface
interface SessionState {
  [key: string]: any
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
    if (!saved) return undefined

    const parsed = JSON.parse(saved)
    console.log('[Tests] Loaded session for test', testId, ':', parsed)
    return parsed
  } catch (error) {
    console.error('[Tests] Failed to load session:', error)
    return undefined
  }
}

// @ts-expect-error unused for now
const saveSession = (testId: number, session: any, stepIndex?: number) => {
  try {
    console.log('[Tests] Saving session for test', testId, ':', session)
    localStorage.setItem(getSessionKey(testId, stepIndex), JSON.stringify(session))
  } catch (error) {
    console.error('[Tests] Failed to save session:', error)
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
  const [expandedEndpointGroups, setExpandedEndpointGroups] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('tests-expanded-endpoint-groups')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  // @ts-expect-error unused for now
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

  // Steps state for unified view
  const [steps, setSteps] = useState<TestStep[]>([])
  const [originalSteps, setOriginalSteps] = useState<TestStep[]>([])

  // Create test modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTestSpecId, setNewTestSpecId] = useState<number | null>(null)
  const [newTestType, setNewTestType] = useState<'single' | 'workflow'>('single')
  const [newTestName, setNewTestName] = useState('')
  const [newTestDescription, setNewTestDescription] = useState('')
  const [newTestSteps, setNewTestSteps] = useState<TestStep[]>([])
  const [newTestEndpointId, setNewTestEndpointId] = useState<number | null>(null)
  const [uploadingSpec, setUploadingSpec] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImportPreview, setShowImportPreview] = useState(false)
  const [parsedImportData, setParsedImportData] = useState<{
    data: any
    detection: any
  } | null>(null)

  // Manual spec creation state
  const [showCreateSpecForm, setShowCreateSpecForm] = useState(false)
  const [newSpecName, setNewSpecName] = useState('')
  const [newSpecVersion, setNewSpecVersion] = useState('1.0.0')
  const [newSpecDescription, setNewSpecDescription] = useState('')

  // Memoized callback for handling changes
  // @ts-expect-error unused for now
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

  // Reset endpoint selection when spec changes in create modal
  useEffect(() => {
    if (showCreateModal) {
      setNewTestEndpointId(null)
    }
  }, [newTestSpecId, showCreateModal]);

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
    // Disable caching during generation for real-time updates
    staleTime: isGenerating ? 0 : 30000,
    refetchInterval: isGenerating ? 200 : false, // Very fast refetch for real-time streaming (200ms)
    refetchOnWindowFocus: false, // Prevent refetch when switching between windows
  })

  // Listen for test creation events from localStorage to trigger immediate refetch
  useEffect(() => {
    if (!isGenerating) return

    const checkForNewTests = () => {
      const lastTestTime = localStorage.getItem('tests-last-test-created')
      if (lastTestTime) {
        const timeSinceCreation = Date.now() - parseInt(lastTestTime)
        // If a test was created in the last 300ms, refetch immediately
        if (timeSinceCreation < 300) {
          console.log('[Tests Page] New test detected, triggering immediate refetch')
          refetch()
        }
      }
    }

    // Check every 100ms for new test signals
    const interval = setInterval(checkForNewTests, 100)
    return () => clearInterval(interval)
  }, [isGenerating, refetch])

  // Get all tests (flat list for convenience) - memoized to prevent recalculation
  const allTestCases = useMemo(
    () => testGroups?.flatMap(g => [...g.singleTests, ...g.workflowTests]) || [],
    [testGroups]
  )

  const selectedTest = useMemo(
    () => allTestCases.find(t => t.id === selectedTestId),
    [allTestCases, selectedTestId]
  )

  // Helper to group single tests by endpoint (method + path) and sort by path
  const groupSingleTestsByEndpoint = useCallback((singleTests: TestCase[]) => {
    const groups = new Map<string, {
      endpointKey: string
      method: string
      path: string
      tests: TestCase[]
    }>()

    singleTests.forEach(test => {
      const key = `${test.method} ${test.path}`
      if (!groups.has(key)) {
        groups.set(key, {
          endpointKey: key,
          method: test.method,
          path: test.path,
          tests: []
        })
      }
      groups.get(key)!.tests.push(test)
    })

    // Sort groups by path
    return Array.from(groups.values()).sort((a, b) =>
      a.path.localeCompare(b.path)
    )
  }, [])

  // Toggle endpoint group
  const toggleEndpointGroup = (endpointKey: string) => {
    setExpandedEndpointGroups(prev => {
      const next = new Set(prev)
      if (next.has(endpointKey)) {
        next.delete(endpointKey)
      } else {
        next.add(endpointKey)
      }
      return next
    })
  }

  // Memoize session to avoid recreating on every render
  // @ts-expect-error unused for now
  const initialSessionForSingleTest = useMemo(
    () => selectedTest?.id ? loadSession(selectedTest.id) : undefined,
    [selectedTest?.id]
  )

  // @ts-expect-error unused for now
  const initialSessionForWorkflowStep = useMemo(
    () => selectedTest?.id && selectedStepIndex !== null ? loadSession(selectedTest.id, selectedStepIndex) : undefined,
    [selectedTest?.id, selectedStepIndex]
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

  // Auto-scroll to skeleton when generation starts (only once, not on every test added)
  useEffect(() => {
    if (isGenerating && generatingSpecId && testListRef.current) {
      testListRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isGenerating, generatingSpecId])

  // Sync test name, description, and steps when selectedTest changes
  useEffect(() => {
    if (selectedTest) {
      setTestName(selectedTest.name)
      setTestDescription(selectedTest.description || '')
      setOriginalTestName(selectedTest.name)
      setOriginalTestDescription(selectedTest.description || '')

      // Convert test to steps format
      if (selectedTest.testType === 'single') {
        // Single test: create one step from test data
        const singleStep: TestStep = {
          id: selectedTest.id?.toString() || crypto.randomUUID(),
          order: 1,
          name: selectedTest.name,
          description: selectedTest.description || '',
          sourceEndpointId: selectedTest.sourceEndpointId,
          currentEndpointId: selectedTest.currentEndpointId,
          isCustomEndpoint: selectedTest.isCustomEndpoint,
          method: selectedTest.method,
          path: selectedTest.path,
          pathVariables: selectedTest.pathVariables || {},
          queryParams: selectedTest.queryParams || {},
          headers: selectedTest.headers || {},
          body: selectedTest.body,
          assertions: selectedTest.assertions || [],
          extractVariables: [],
          delayBefore: 0,
          delayAfter: 0,
          skipOnFailure: false,
          continueOnFailure: false,
        }
        setSteps([singleStep])
        setOriginalSteps([singleStep])
      } else {
        // Workflow test: use existing steps
        setSteps(selectedTest.steps || [])
        setOriginalSteps(selectedTest.steps || [])
      }
    } else {
      setTestName('')
      setTestDescription('')
      setOriginalTestName('')
      setOriginalTestDescription('')
      setSteps([])
    }
  }, [selectedTest?.id])

  // Track changes in name/description/steps
  const [hasHeaderChanges, setHasHeaderChanges] = useState(false)
  useEffect(() => {
    const nameChanged = testName !== originalTestName
    const descChanged = testDescription !== originalTestDescription
    const stepsChanged = JSON.stringify(steps) !== JSON.stringify(originalSteps)
    setHasHeaderChanges(nameChanged || descChanged || stepsChanged)
  }, [testName, testDescription, originalTestName, originalTestDescription, steps, originalSteps])

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

  // Persist expanded endpoint groups
  useEffect(() => {
    localStorage.setItem('tests-expanded-endpoint-groups', JSON.stringify(Array.from(expandedEndpointGroups)))
  }, [expandedEndpointGroups])

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

  // @ts-expect-error unused for now
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

  // Load endpoints for selected spec in create modal
  const { data: newTestEndpoints } = useQuery({
    queryKey: ['endpoints', newTestSpecId],
    queryFn: () => newTestSpecId ? api.getEndpointsBySpec(newTestSpecId) : Promise.resolve([]),
    enabled: !!newTestSpecId && showCreateModal,
  })

  // Handler to open create test modal
  const handleOpenCreateModal = () => {
    // Initialize with first spec if available
    const firstSpecId = testGroups?.[0]?.spec.id || null
    setNewTestSpecId(firstSpecId)
    setNewTestType('single')
    setNewTestName('')
    setNewTestDescription('')
    setNewTestEndpointId(null)

    // Initialize with one default step
    const defaultStep: TestStep = {
      id: crypto.randomUUID(),
      order: 1,
      name: 'Step 1',
      description: '',
      sourceEndpointId: undefined,
      currentEndpointId: undefined,
      isCustomEndpoint: true,
      method: 'GET',
      path: '/',
      pathVariables: {},
      queryParams: {},
      headers: {},
      body: undefined,
      assertions: [],
      extractVariables: [],
      delayBefore: 0,
      delayAfter: 0,
      skipOnFailure: false,
      continueOnFailure: false,
    }
    setNewTestSteps([defaultStep])
    setShowCreateModal(true)
  }

  // Handler when endpoint is selected for single test
  const handleEndpointSelect = (endpointId: number) => {
    setNewTestEndpointId(endpointId)
    const endpoint = newTestEndpoints?.find(e => e.id === endpointId)

    if (endpoint) {
      // Update the first step with endpoint data
      const pathParams = endpoint.request?.parameters?.filter(p => p.in === 'path') || []
      const queryParams = endpoint.request?.parameters?.filter(p => p.in === 'query') || []
      const headerParams = endpoint.request?.parameters?.filter(p => p.in === 'header') || []

      const updatedStep: TestStep = {
        id: newTestSteps[0]?.id || crypto.randomUUID(),
        order: 1,
        name: endpoint.name || `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description || '',
        sourceEndpointId: endpoint.id,
        currentEndpointId: endpoint.id,
        isCustomEndpoint: false,
        method: endpoint.method,
        path: endpoint.path,
        pathVariables: pathParams.reduce((acc, p) => ({ ...acc, [p.name]: p.example || '' }), {} as Record<string, any>),
        queryParams: queryParams.reduce((acc, p) => ({ ...acc, [p.name]: p.example || '' }), {} as Record<string, any>),
        headers: headerParams.reduce((acc, p) => ({ ...acc, [p.name]: String(p.example || '') }), {} as Record<string, string>),
        body: endpoint.request?.body?.example || undefined,
        assertions: [],
        extractVariables: [],
        delayBefore: 0,
        delayAfter: 0,
        skipOnFailure: false,
        continueOnFailure: false,
      }
      setNewTestSteps([updatedStep])

      // Auto-fill test name if empty
      if (!newTestName) {
        setNewTestName(endpoint.name || `Test ${endpoint.method} ${endpoint.path}`)
      }
    }
  }

  // Handle spec file upload for create test modal
  const handleSpecUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingSpec(true)
    try {
      const content = await file.text()
      await importSpecContent(content)
    } catch (error: any) {
      alert(`Failed to upload spec: ${error.message}`)
    } finally {
      setUploadingSpec(false)
      e.target.value = ''
    }
  }

  const importSpecContent = async (content: string) => {
    // Use unified parser to detect and parse format
    const { parseImportedContent } = await import('@/lib/converters')
    const parseResult = await parseImportedContent(content)

    if (!parseResult.success || !parseResult.data) {
      throw new Error(parseResult.error || 'Failed to parse imported content')
    }

    const { data: parsedData, detection } = parseResult

    console.log(`[Import] Detected format: ${detection.format} (${detection.version || 'unknown version'})`)

    // Store parsed data and show preview dialog
    setParsedImportData({ data: parsedData, detection })
    setShowImportPreview(true)
  }

  const handleImportSuccess = async () => {
    // Save the spec name for matching
    const importedSpecName = parsedImportData?.data.name

    // Close import preview first
    setShowImportPreview(false)
    setParsedImportData(null)

    // Refresh test groups to get the new spec
    await refetch()

    // Try to find and select the newly created spec by name
    // Note: refetch updates testGroups, but we need to wait for the query to update
    // We'll use a timeout to allow the data to refresh
    setTimeout(() => {
      if (importedSpecName && testGroups) {
        const newSpec = testGroups.find(g => g.spec.name === importedSpecName)
        if (newSpec?.spec.id) {
          setNewTestSpecId(newSpec.spec.id)
        }
      }
    }, 500)
  }

  // Handler for spec dropdown change
  const handleSpecChange = (value: string) => {
    if (value === 'CREATE_NEW') {
      // Show manual spec creation form
      setShowCreateSpecForm(true)
      setNewSpecName('')
      setNewSpecVersion('1.0.0')
      setNewSpecDescription('')
    } else {
      setNewTestSpecId(value ? Number(value) : null)
    }
  }

  // Handler to create spec manually
  const handleCreateSpecManually = async () => {
    if (!newSpecName.trim()) {
      alert('Please enter a spec name')
      return
    }
    if (!newSpecVersion.trim()) {
      alert('Please enter a spec version')
      return
    }

    try {
      // Create a minimal spec without importing a file
      const newSpec = await api.createSpec({
        name: newSpecName.trim(),
        version: newSpecVersion.trim(),
        description: newSpecDescription.trim() || undefined,
        baseUrl: '',
        rawSpec: JSON.stringify({
          info: {
            title: newSpecName.trim(),
            version: newSpecVersion.trim(),
            description: newSpecDescription.trim() || undefined,
          }
        }),
        format: 'openapi',
        versionGroup: crypto.randomUUID(),
        isLatest: true,
        originalName: newSpecName.trim(),
      })

      // Refresh test groups
      await refetch()

      // Select the newly created spec
      if (newSpec.id) {
        setNewTestSpecId(newSpec.id)
      }

      // Close the form
      setShowCreateSpecForm(false)

      alert('Spec created successfully!')
    } catch (error: any) {
      alert(`Failed to create spec: ${error.message}`)
    }
  }

  // Handler to save new test
  const handleSaveNewTest = async () => {
    if (!newTestSpecId) {
      alert('Please select a spec')
      return
    }
    if (newTestType === 'single' && !newTestEndpointId) {
      alert('Please select an endpoint for single test')
      return
    }
    if (!newTestName.trim()) {
      alert('Please enter a test name')
      return
    }
    if (newTestSteps.length === 0) {
      alert('Please add at least one step')
      return
    }

    try {
      const newTest: Partial<TestCase> = {
        specId: newTestSpecId,
        name: newTestName,
        description: newTestDescription,
        testType: newTestType,
      }

      if (newTestType === 'single' && newTestSteps.length > 0) {
        // For single test, use first step data
        const step = newTestSteps[0]
        newTest.method = step.method
        newTest.path = step.path
        newTest.sourceEndpointId = step.sourceEndpointId
        newTest.currentEndpointId = step.currentEndpointId
        newTest.isCustomEndpoint = step.isCustomEndpoint
        newTest.pathVariables = step.pathVariables
        newTest.queryParams = step.queryParams
        newTest.headers = step.headers
        newTest.body = step.body
        newTest.assertions = step.assertions
      } else {
        // For workflow test, save steps
        newTest.steps = newTestSteps
        // Use first step for method/path display
        newTest.method = newTestSteps[0].method
        newTest.path = newTestSteps[0].path
      }

      await api.createTestCase(newTest as any)
      await refetch()
      setShowCreateModal(false)
      alert('Test created successfully!')
    } catch (error: any) {
      alert(`Failed to create test: ${error.message}`)
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
              <button
                onClick={handleOpenCreateModal}
                className="glass-panel rounded-full p-2.5 hover:shadow-lg transition-all flex-shrink-0 active:scale-95"
                title="Create New Test"
              >
                <Plus size={18} className="text-purple-600" />
              </button>
            </div>

            {/* Generating Banner - Sticky at top */}
            {isGenerating && (
              <div className="sticky top-0 z-10 m-4 mb-2 p-3 glass-card rounded-2xl flex items-center gap-3 flex-shrink-0 shadow-lg">
                <Loader2 size={18} className="text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-blue-900">Generating Tests</h3>
                  <p className="text-xs text-blue-700">Auto-refreshing...</p>
                </div>
                <button
                  onClick={async () => {
                    console.log('[Tests] Stop button clicked - cancelling generation')
                    try {
                      const result = await (window as any).electron.cancelGeneration()
                      console.log('[Tests] Cancel result:', result)
                      setIsGenerating(false)
                      searchParams.delete('generating')
                      setSearchParams(searchParams)
                      localStorage.removeItem('tests-generating')
                      localStorage.removeItem('tests-generating-spec-id')
                    } catch (error) {
                      console.error('[Tests] Failed to cancel generation:', error)
                      // Still update UI even if cancel fails
                      setIsGenerating(false)
                      searchParams.delete('generating')
                      setSearchParams(searchParams)
                    }
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex-shrink-0"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Token Limit Banner with Continue/Stop Buttons */}
            {tokenLimitReached && !isGenerating && (
              <div className="m-4 mb-2 p-4 glass-card rounded-2xl border-l-4 border-orange-500">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-orange-900 mb-1">Generation Paused</h3>
                    <p className="text-sm text-orange-700 mb-3">
                      The AI reached its response limit. Would you like to continue generating more tests?
                    </p>
                    <div className="flex gap-2">
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
                          localStorage.removeItem('tests-generation-metadata')
                          localStorage.removeItem('tests-generating-spec-id')
                        }}
                        className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
                      >
                        Stop
                      </button>
                <button
                  onClick={async () => {
                    try {
                      // Import necessary modules
                      const { generateTestsViaIPC } = await import('@/lib/ai/client')
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

                      // Parse spec for AI - handle different formats
                      let parsedSpec: any
                      const specFormat = spec.format || 'openapi' // Default to openapi for backward compatibility
                      if (specFormat === 'curl') {
                        // For cURL imports, create a minimal spec object from the spec metadata
                        parsedSpec = {
                          info: {
                            title: spec.name,
                            version: spec.version,
                            description: spec.description,
                          },
                          servers: spec.baseUrl ? [{ url: spec.baseUrl }] : [],
                        }
                      } else {
                        // For OpenAPI/Swagger/Postman, parse the rawSpec JSON
                        try {
                          parsedSpec = JSON.parse(spec.rawSpec)
                        } catch (error) {
                          console.error('[Tests] Failed to parse rawSpec:', error)
                          alert('Invalid spec format: could not parse specification')
                          return
                        }
                      }

                      // Get metadata for continuation
                      const previousMetadataStr = localStorage.getItem('tests-generation-metadata')

                      console.log('[Tests] 📥 LOADING metadata from localStorage:', {
                        exists: !!previousMetadataStr,
                        length: previousMetadataStr?.length,
                        preview: previousMetadataStr?.substring(0, 200)
                      })

                      const previousMetadata = previousMetadataStr ? JSON.parse(previousMetadataStr) : undefined

                      console.log('[Tests] 📊 PARSED metadata:', {
                        completeParsedTests: previousMetadata?.completeParsedTests?.length || 0,
                        tests: previousMetadata?.completeParsedTests?.map((t: any) => t.name) || []
                      })

                      console.log('[Tests] Continuing generation for', endpointsToGenerate.length, 'endpoints')

                      // Generate tests via IPC (secure main process execution)
                      const result = await generateTestsViaIPC({
                        endpoints: endpointsToGenerate,
                        spec: parsedSpec,
                        previousMetadata,
                        onTestGenerated: async (test: any) => {
                          await createTestCase(test as any)
                          refetch()
                        },
                      })

                      // Handle result
                      if (!result.completed && result.error === 'TOKEN_LIMIT_REACHED') {
                        console.log('[Tests] Token limit reached again')
                        // Update state for another continuation
                        localStorage.setItem('tests-token-limit-reached', 'true')
                        localStorage.setItem('tests-remaining-endpoint-ids', JSON.stringify(result.remainingEndpointIds))
                        localStorage.setItem('tests-completed-count', String(result.completedEndpointIds.length))
                        localStorage.setItem('tests-total-count', String(result.remainingEndpointIds.length))
                        localStorage.setItem('tests-generation-metadata', JSON.stringify(result.metadata))
                        localStorage.removeItem('tests-generating')

                        console.log('[Tests] 💾 SAVED metadata to localStorage:', {
                          completeParsedTests: result.metadata.completeParsedTests.length,
                          tests: result.metadata.completeParsedTests.map((t: any) => t.name),
                          raw: JSON.stringify(result.metadata).substring(0, 200)
                        })
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
                        localStorage.removeItem('tests-generation-metadata')
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
                  className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-medium"
                >
                  Continue
                </button>
                    </div>
                  </div>
                </div>
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
            <div className="p-4 pb-40 space-y-2 flex-1 overflow-auto">
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
                                {/* Group single tests by endpoint */}
                                {groupSingleTestsByEndpoint(group.singleTests).map(endpointGroup => {
                                  const isGroupExpanded = expandedEndpointGroups.has(endpointGroup.endpointKey)

                                  return (
                                    <div key={endpointGroup.endpointKey}>
                                      {/* Endpoint Group Header */}
                                      <button
                                        onClick={() => toggleEndpointGroup(endpointGroup.endpointKey)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors text-left"
                                      >
                                        {/* Expand/Collapse Icon */}
                                        {isGroupExpanded ?
                                          <ChevronDown size={14} className="text-gray-500 flex-shrink-0" /> :
                                          <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
                                        }

                                        {/* Method Badge */}
                                        <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                          endpointGroup.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                                          endpointGroup.method === 'POST' ? 'bg-green-100 text-green-700' :
                                          endpointGroup.method === 'PUT' ? 'bg-orange-100 text-orange-700' :
                                          endpointGroup.method === 'PATCH' ? 'bg-yellow-100 text-yellow-700' :
                                          endpointGroup.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {endpointGroup.method}
                                        </span>

                                        {/* Path */}
                                        <span className="text-sm text-gray-700 font-mono truncate flex-1">
                                          {endpointGroup.path}
                                        </span>

                                        {/* Test Count */}
                                        <span className="text-xs text-gray-500 flex-shrink-0">
                                          ({endpointGroup.tests.length})
                                        </span>
                                      </button>

                                      {/* Tests under this endpoint */}
                                      {isGroupExpanded && (
                                        <div className="ml-4 mt-1 space-y-1">
                                          {endpointGroup.tests.map(test => (
                                            <EndpointCard
                                              key={test.id}
                                              method={test.method}
                                              path={test.path}
                                              name={test.name}
                                              isSelected={test.id === selectedTestId}
                                              onClick={() => setSelectedTestId(test.id!)}
                                              hideEndpointInfo={true}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}

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
                                {/* Sort workflow tests by path */}
                                {[...group.workflowTests]
                                  .sort((a, b) => a.path.localeCompare(b.path))
                                  .map(test => (
                                    <EndpointCard
                                      key={test.id}
                                      method={test.method}
                                      path={test.path}
                                      name={test.name}
                                      stepCount={test.steps?.length || 0}
                                      isSelected={test.id === selectedTestId}
                                      onClick={() => setSelectedTestId(test.id!)}
                                      hideEndpointInfo={true}
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

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const group = testGroups?.find(g => g.spec.id === selectedSpecId)
                      const totalTests = (group?.singleTests.length || 0) + (group?.workflowTests.length || 0)

                      return totalTests > 0 ? (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `Delete all tests for "${selectedSpec.name}"?\n\nThis will delete ${totalTests} test(s) and their execution history. The spec itself will NOT be deleted.`
                            )
                            if (confirmed) {
                              try {
                                await deleteTestCasesBySpec(selectedSpecId!)
                                refetch()
                                setSelectedTestId(null)
                              } catch (error: any) {
                                alert(`Failed to delete tests: ${error.message}`)
                              }
                            }
                          }}
                          title="Delete all tests for this spec"
                        />
                      ) : null
                    })()}
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
                    <SaveCancelButtons
                      onSave={async () => {
                        try {
                          const updates: any = {}

                          // Save name/description changes
                          if (testName !== originalTestName) {
                            updates.name = testName
                          }
                          if (testDescription !== originalTestDescription) {
                            updates.description = testDescription
                          }

                          // Save steps changes
                          if (JSON.stringify(steps) !== JSON.stringify(originalSteps)) {
                            if (selectedTest.testType === 'single' && steps.length > 0) {
                              // For single tests, update test data from the first step
                              const step = steps[0]
                              updates.method = step.method
                              updates.path = step.path
                              updates.pathVariables = step.pathVariables
                              updates.queryParams = step.queryParams
                              updates.headers = step.headers
                              updates.body = step.body
                              updates.assertions = step.assertions
                              updates.extractVariables = step.extractVariables
                            } else {
                              // For workflow tests, update steps array
                              updates.steps = steps
                            }
                          }

                          // Save changes if any
                          if (Object.keys(updates).length > 0 && selectedTest) {
                            await handleTestUpdate(selectedTest.id!, updates)
                            setOriginalTestName(testName)
                            setOriginalTestDescription(testDescription)
                            setOriginalSteps(steps)
                          }

                          // Reset change tracking
                          setHasHeaderChanges(false)
                        } catch (error) {
                          console.error('Failed to save changes:', error)
                        }
                      }}
                      hasUnsavedChanges={hasUnsavedChanges}
                      saveOnly={true}
                      saveLabel="Save changes"
                    />
                    {/* Delete button */}
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleDelete(selectedTest.id!, selectedTest.name)}
                      title="Delete test"
                    />
                  </div>
                </div>
              </div>

              {/* Test Details - Unified Steps View */}
              <div className="bg-white border border-gray-200 rounded-lg">
                {/* Steps Header */}
                <div className="border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Steps ({steps.length})
                    </h3>
                    <button
                      onClick={() => {
                        const newStep: TestStep = {
                          id: crypto.randomUUID(),
                          order: steps.length + 1,
                          name: `Step ${steps.length + 1}`,
                          description: '',
                          sourceEndpointId: undefined,
                          currentEndpointId: undefined,
                          isCustomEndpoint: true,
                          method: 'GET',
                          path: '/',
                          pathVariables: {},
                          queryParams: {},
                          headers: {},
                          body: undefined,
                          assertions: [],
                          extractVariables: [],
                          delayBefore: 0,
                          delayAfter: 0,
                          skipOnFailure: false,
                          continueOnFailure: false,
                        }
                        setSteps([...steps, newStep])
                      }}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Add step"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                {/* Steps Content */}
                <div className="p-4">
                  <StepEditor
                    steps={steps}
                    onStepsChange={setSteps}
                    environment={selectedEnv}
                    environments={environments}
                    selectedEnvId={selectedEnvId}
                    onEnvChange={setSelectedEnvId}
                    mode="edit"
                    specId={String(selectedTest.specId)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
    </PageLayout>

    {/* Create Test Modal */}
    <Dialog.Root open={showCreateModal} onOpenChange={setShowCreateModal}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden z-50 flex flex-col">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-xl font-bold text-gray-900">
                Create New Test
              </Dialog.Title>
              <Dialog.Close className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </Dialog.Close>
            </div>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Spec Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specification *
              </label>
              <select
                value={newTestSpecId || ''}
                onChange={(e) => handleSpecChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={uploadingSpec}
              >
                <option value="">Select a spec</option>
                {testGroups?.map(group => (
                  <option key={group.spec.id} value={group.spec.id}>
                    {group.spec.name} (v{group.spec.version})
                  </option>
                ))}
                <option value="CREATE_NEW" className="font-semibold text-purple-600">
                  + Create New Spec
                </option>
              </select>
              {uploadingSpec && (
                <p className="mt-1 text-xs text-purple-600">Uploading spec...</p>
              )}
              {/* Hidden file input for spec upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleSpecUpload}
                className="hidden"
              />
            </div>

            {/* Create Spec Form (shown when user clicks "Create New Spec") */}
            {showCreateSpecForm && (
              <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-purple-900">Create New Specification</h3>
                  <button
                    onClick={() => setShowCreateSpecForm(false)}
                    className="p-1 hover:bg-purple-100 rounded transition-colors"
                  >
                    <X size={16} className="text-purple-600" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Spec Name *
                    </label>
                    <input
                      type="text"
                      value={newSpecName}
                      onChange={(e) => setNewSpecName(e.target.value)}
                      placeholder="e.g., My API"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Version *
                    </label>
                    <input
                      type="text"
                      value={newSpecVersion}
                      onChange={(e) => setNewSpecVersion(e.target.value)}
                      placeholder="e.g., 1.0.0"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={newSpecDescription}
                      onChange={(e) => setNewSpecDescription(e.target.value)}
                      placeholder="Brief description of this specification"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <button
                    onClick={handleCreateSpecManually}
                    className="w-full px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Create Spec
                  </button>
                </div>
              </div>
            )}

            {/* Test Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setNewTestType('single')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    newTestType === 'single'
                      ? 'border-purple-500 bg-purple-50 text-purple-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">Single Test</div>
                  <div className="text-xs mt-1 opacity-75">Test one endpoint</div>
                </button>
                <button
                  onClick={() => setNewTestType('workflow')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    newTestType === 'workflow'
                      ? 'border-purple-500 bg-purple-50 text-purple-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">Workflow Test</div>
                  <div className="text-xs mt-1 opacity-75">Test multiple steps</div>
                </button>
              </div>
            </div>

            {/* Endpoint Selector (only for single tests) */}
            {newTestType === 'single' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endpoint *
                </label>
                <select
                  value={newTestEndpointId || ''}
                  onChange={(e) => handleEndpointSelect(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={!newTestSpecId}
                >
                  <option value="">Select an endpoint</option>
                  {newTestEndpoints?.map(endpoint => (
                    <option key={endpoint.id} value={endpoint.id}>
                      {endpoint.method} {endpoint.path} {endpoint.name ? `- ${endpoint.name}` : ''}
                    </option>
                  ))}
                </select>
                {!newTestSpecId && (
                  <p className="mt-1 text-xs text-gray-500">Please select a spec first</p>
                )}
              </div>
            )}

            {/* Test Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Name *
              </label>
              <input
                type="text"
                value={newTestName}
                onChange={(e) => setNewTestName(e.target.value)}
                placeholder="Enter test name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Test Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Description
              </label>
              <textarea
                value={newTestDescription}
                onChange={(e) => setNewTestDescription(e.target.value)}
                placeholder="Enter test description (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Steps Editor */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Steps ({newTestSteps.length})
                  </h3>
                  <button
                    onClick={() => {
                      const newStep: TestStep = {
                        id: crypto.randomUUID(),
                        order: newTestSteps.length + 1,
                        name: `Step ${newTestSteps.length + 1}`,
                        description: '',
                        sourceEndpointId: undefined,
                        currentEndpointId: undefined,
                        isCustomEndpoint: true,
                        method: 'GET',
                        path: '/',
                        pathVariables: {},
                        queryParams: {},
                        headers: {},
                        body: undefined,
                        assertions: [],
                        extractVariables: [],
                        delayBefore: 0,
                        delayAfter: 0,
                        skipOnFailure: false,
                        continueOnFailure: false,
                      }
                      setNewTestSteps([...newTestSteps, newStep])
                    }}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Add step"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <StepEditor
                  steps={newTestSteps}
                  onStepsChange={setNewTestSteps}
                  environment={undefined}
                  environments={[]}
                  selectedEnvId={null}
                  onEnvChange={() => {}}
                  mode="edit"
                  specId={String(newTestSpecId || '')}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNewTest}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Create Test
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    {/* Import Preview Dialog */}
    {showImportPreview && parsedImportData && (
      <ImportPreviewDialog
        isOpen={showImportPreview}
        parsedData={parsedImportData.data}
        detection={parsedImportData.detection}
        specs={testGroups?.map(g => g.spec) || []}
        onSuccess={handleImportSuccess}
        onCancel={() => {
          setShowImportPreview(false)
          setParsedImportData(null)
        }}
      />
    )}
    </>
  )
}
