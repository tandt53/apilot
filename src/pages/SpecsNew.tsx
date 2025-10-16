import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useEnvironments, useSpecs} from '@/lib/hooks'
import {FileCode, FolderClosed, FolderOpen, Search, Settings2, Trash2, Upload, X} from 'lucide-react'
import * as api from '@/lib/api'
import EndpointDetail from '@/components/EndpointDetail'
import EnvironmentManager from '@/components/EnvironmentManager'
import ResizablePanel from '@/components/ResizablePanel'
import EndpointCard from '@/components/EndpointCard'
import PageLayout from '@/components/PageLayout'
import type {Endpoint, Spec} from '@/types/database'
import {generateTestsViaIPC} from "@/lib/ai/client.ts";

interface SpecWithEndpoints {
  spec: Spec
  endpoints: Endpoint[]
}

export default function SpecsNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: specs, isLoading, refetch } = useSpecs()
  const [expandedSpecs, setExpandedSpecs] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('specs-expanded-specs')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(() => {
    const saved = localStorage.getItem('specs-selected-spec-id')
    return saved ? parseInt(saved) : null
  })
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(() => {
    const saved = localStorage.getItem('specs-selected-endpoint-id')
    return saved ? parseInt(saved) : null
  })
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importMode, setImportMode] = useState<'file' | 'text'>('file')
  const [curlText, setCurlText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Batch test generation states
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<Set<number>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null)

  // Continue generation states (for token limit handling)
  const [remainingEndpointIds, setRemainingEndpointIds] = useState<Set<number>>(new Set())
  const [showContinueButton, setShowContinueButton] = useState(false)
  const [partialGenerationMessage, setPartialGenerationMessage] = useState<string | null>(null)

  // Load all specs with their endpoints (like Tests screen)
  const { data: specGroups } = useQuery({
    queryKey: ['spec-groups'],
    queryFn: async () => {
      if (!specs) return []

      const groups: SpecWithEndpoints[] = []
      for (const spec of specs) {
        const endpoints = await api.getEndpointsBySpec(spec.id!)
        groups.push({
          spec,
          endpoints: endpoints || []
        })
      }
      return groups
    },
    enabled: !!specs,
    staleTime: 30000,
  })

  const selectedSpec = specs?.find(s => s.id === selectedSpecId)

  // Find selected endpoint across all specs
  const selectedEndpoint = specGroups?.flatMap(g => g.endpoints).find(e => e.id === selectedEndpointId)

  // Only fetch environments if a spec is selected
  const { data: environments } = useEnvironments(selectedSpecId || 0)

  // Global environment selection
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(() => {
    if (selectedSpecId) {
      return localStorage.getItem(`spec-${selectedSpecId}-selected-env`) || null
    }
    return null
  })

  useEffect(() => {
    if (selectedSpecId) {
      const saved = localStorage.getItem(`spec-${selectedSpecId}-selected-env`)
      setSelectedEnvId(saved || null)
    }
  }, [selectedSpecId])

  useEffect(() => {
    if (selectedSpecId && selectedEnvId) {
      localStorage.setItem(`spec-${selectedSpecId}-selected-env`, selectedEnvId)
    } else if (selectedSpecId) {
      localStorage.removeItem(`spec-${selectedSpecId}-selected-env`)
    }
  }, [selectedEnvId, selectedSpecId])

  // Persist selected spec ID
  useEffect(() => {
    if (selectedSpecId) {
      localStorage.setItem('specs-selected-spec-id', String(selectedSpecId))
    } else {
      localStorage.removeItem('specs-selected-spec-id')
    }
  }, [selectedSpecId])

  // Persist selected endpoint ID
  useEffect(() => {
    if (selectedEndpointId) {
      localStorage.setItem('specs-selected-endpoint-id', String(selectedEndpointId))
    } else {
      localStorage.removeItem('specs-selected-endpoint-id')
    }
  }, [selectedEndpointId])

  // Auto-expand spec when selectedSpecId or selectedEndpointId is restored from localStorage
  useEffect(() => {
    if (selectedSpecId) {
      setExpandedSpecs(prev => new Set(prev).add(selectedSpecId))
    }
  }, [selectedSpecId])

  // If endpoint is selected on mount, ensure its spec is selected and expanded
  useEffect(() => {
    if (selectedEndpointId && selectedEndpoint && selectedEndpoint.specId) {
      setSelectedSpecId(selectedEndpoint.specId)
      setExpandedSpecs(prev => new Set(prev).add(selectedEndpoint.specId))
    }
  }, [selectedEndpointId, selectedEndpoint])

  // Persist expanded specs
  useEffect(() => {
    localStorage.setItem('specs-expanded-specs', JSON.stringify(Array.from(expandedSpecs)))
  }, [expandedSpecs])

  const selectedEnv = environments?.find(env => env.id === selectedEnvId)

  const toggleSpec = (specId: number) => {
    const newExpanded = new Set(expandedSpecs)
    if (newExpanded.has(specId)) {
      newExpanded.delete(specId)
    } else {
      newExpanded.add(specId)
    }
    setExpandedSpecs(newExpanded)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const content = await file.text()
      await importContent(content, file.name)
    } catch (error: any) {
      alert(`Failed to upload spec: ${error.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleTextImport = async () => {
    if (!curlText.trim()) {
      alert('Please enter cURL command or paste API specification')
      return
    }

    setUploading(true)
    try {
      await importContent(curlText.trim(), 'imported-content')
      setCurlText('')
    } catch (error: any) {
      alert(`Failed to import: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const importContent = async (content: string, sourceName: string) => {
    // Use unified parser to detect and parse format
    const { parseImportedContent } = await import('@/lib/converters')
    const parseResult = await parseImportedContent(content)

    if (!parseResult.success || !parseResult.data) {
      throw new Error(parseResult.error || 'Failed to parse imported content')
    }

    const { data: parsedData, detection } = parseResult

    console.log(`[Import] Detected format: ${detection.format} (${detection.version || 'unknown version'})`)

    // Create spec
    const spec = await api.createSpec({
      name: parsedData.name || sourceName,
      version: parsedData.version || '1.0.0',
      description: parsedData.description,
      baseUrl: parsedData.baseUrl || '',
      rawSpec: parsedData.rawSpec,
      format: detection.format as any, // Store detected format
      versionGroup: crypto.randomUUID(),
      isLatest: true,
      originalName: parsedData.name || sourceName,
    })

    // Import endpoints (already converted to canonical format)
    const endpointsData = parsedData.endpoints.map(endpoint => ({
      specId: spec.id!,
      ...endpoint,
      updatedAt: new Date(),
      createdBy: 'import' as const,
    }))

    if (endpointsData.length > 0) {
      await api.bulkCreateEndpoints(endpointsData)
    }

    // Import variables as environment if present (for Postman collections)
    if (parsedData.variables && Object.keys(parsedData.variables).length > 0) {
      await api.createEnvironment({
        specId: spec.id!,
        name: 'Imported Variables',
        baseUrl: parsedData.baseUrl || '',
        variables: parsedData.variables,
      })
    }

    // Refetch specs first, then spec-groups to load endpoints for new spec
    await refetch()
    await queryClient.invalidateQueries({ queryKey: ['specs'] })
    await queryClient.refetchQueries({ queryKey: ['spec-groups'] })

    setShowUploadModal(false)
    setSelectedSpecId(spec.id!)
    // Auto-expand the newly imported spec
    setExpandedSpecs(prev => new Set(prev).add(spec.id!))

    // Show success message with format info
    alert(`✓ Successfully imported ${detection.format.toUpperCase()} with ${parsedData.endpoints.length} endpoint(s)`)
  }

  const handleDeleteSpec = async (specId: number, name: string) => {
    if (!confirm(`Delete spec "${name}"?`)) return
    await api.deleteSpec(specId)
    if (selectedSpecId === specId) {
      setSelectedSpecId(null)
    }
      await refetch()
  }

  const handleContinueGeneration = async () => {
    // Get endpoints for selected spec from specGroups
    const selectedSpecGroup = specGroups?.find(g => g.spec.id === selectedSpecId)
    const specEndpoints = selectedSpecGroup?.endpoints || []

    if (!selectedSpecId || specEndpoints.length === 0 || remainingEndpointIds.size === 0) {
      alert('No remaining endpoints to generate tests for')
      return
    }

    const selectedSpec = specs?.find(s => s.id === selectedSpecId)
    if (!selectedSpec) {
      alert('Spec not found')
      return
    }

    try {
      setIsGenerating(true)
      setShowContinueButton(false) // Hide button while generating
      setPartialGenerationMessage(null)
      setGenerationProgress({ current: 0, total: remainingEndpointIds.size })

      // Set generating flag and spec ID in localStorage for Tests page
      localStorage.setItem('tests-generating', 'true')
      localStorage.setItem('tests-generating-spec-id', String(selectedSpecId))

      // Get remaining endpoints
      const endpointsToGenerate = specEndpoints.filter(e => remainingEndpointIds.has(e.id!))

      console.log('[SpecsNew] Continuing generation for', endpointsToGenerate.length, 'remaining endpoints')

      // Parse spec for AI - handle different formats
      let parsedSpec: any
      const specFormat = selectedSpec.format || 'openapi' // Default to openapi for backward compatibility
      if (specFormat === 'curl') {
        // For cURL imports, create a minimal spec object from the spec metadata
        parsedSpec = {
          info: {
            title: selectedSpec.name,
            version: selectedSpec.version,
            description: selectedSpec.description,
          },
          servers: selectedSpec.baseUrl ? [{ url: selectedSpec.baseUrl }] : [],
        }
      } else {
        // For OpenAPI/Swagger/Postman, parse the rawSpec JSON
        try {
          parsedSpec = JSON.parse(selectedSpec.rawSpec)
        } catch (error) {
          console.error('[SpecsNew] Failed to parse rawSpec:', error)
          alert('Invalid spec format: could not parse specification')
          return
        }
      }

      // Get conversation history for continuation
      const previousMessages = localStorage.getItem('tests-conversation-messages')
      const previousSummary = localStorage.getItem('tests-generated-summary')

      console.log('[SpecsNew] Continuing with history:', previousMessages ? 'Yes' : 'No')

      // Track saved test names to prevent duplicates
      const savedTestNames = new Set<string>()

      // Generate tests for remaining endpoints with conversation history via IPC
      const result = await generateTestsViaIPC({
        endpoints: endpointsToGenerate,
        spec: parsedSpec,
        previousMessages: previousMessages ? JSON.parse(previousMessages) : undefined,
        generatedTestsSummary: previousSummary || undefined,
        onProgress: (progress: any) => {
          setGenerationProgress({ current: progress.current, total: remainingEndpointIds.size })
        },
        onTestGenerated: async (test: any) => {
          // Save test in real-time as it's generated
          console.log('[SpecsNew handleContinueGeneration] Received test from IPC:', {
            name: test.name,
            method: test.method,
            path: test.path,
            testType: test.testType,
            assertions: test.assertions?.length
          })

          // Skip if already saved in this session
          if (savedTestNames.has(test.name)) {
            console.log('[SpecsNew handleContinueGeneration] Test already saved, skipping:', test.name)
            return
          }

          // Mark as saved IMMEDIATELY to prevent race condition with result processing
          savedTestNames.add(test.name)
          console.log('[SpecsNew handleContinueGeneration] Marked test as saved:', test.name, '- Total saved:', savedTestNames.size)

          await api.createTestCase(test as any)

          // Signal to Tests page that a new test was created (for immediate streaming)
          localStorage.setItem('tests-last-test-created', String(Date.now()))

          // Invalidate test groups query to trigger refetch in Tests page
          queryClient.invalidateQueries({ queryKey: ['test-groups'] })
        },
      })

      // IMPORTANT: Process all tests from result.tests in case IPC events didn't fire
      // This ensures all tests are saved even if real-time callbacks fail
      console.log('[SpecsNew handleContinueGeneration] Processing tests from result:', {
        testsCount: result.tests?.length,
        completed: result.completed,
        savedViaCb: savedTestNames.size
      })

      if (result.tests && result.tests.length > 0) {
        console.log('[SpecsNew handleContinueGeneration] Checking', result.tests.length, 'tests from result object')
        for (const test of result.tests) {
          // Skip if already saved via callback
          if (savedTestNames.has(test.name)) {
            console.log('[SpecsNew handleContinueGeneration] Test already saved via callback, skipping:', test.name)
            continue
          }

          console.log('[SpecsNew handleContinueGeneration] Saving test from result:', {
            name: test.name,
            method: test.method,
            path: test.path
          })
          await api.createTestCase(test as any)
          savedTestNames.add(test.name)
        }
        // Invalidate test groups query to trigger refetch in Tests page
        queryClient.invalidateQueries({ queryKey: ['test-groups'] })
        console.log('[SpecsNew handleContinueGeneration] Total unique tests saved:', savedTestNames.size)
      }

      // Handle result - could hit token limit again
      if (!result.completed && result.error === 'TOKEN_LIMIT_REACHED') {
        console.log('[SpecsNew] Token limit reached again during continuation')
        const completedCount = result.completedEndpointIds.length
        const stillRemaining = result.remainingEndpointIds.length

        // Store updated token limit state and conversation
        localStorage.setItem('tests-token-limit-reached', 'true')
        localStorage.setItem('tests-remaining-endpoint-ids', JSON.stringify(result.remainingEndpointIds))
        localStorage.setItem('tests-completed-count', String(completedCount))
        localStorage.setItem('tests-total-count', String(stillRemaining))
        localStorage.setItem('tests-conversation-messages', JSON.stringify(result.conversationMessages))
        localStorage.setItem('tests-generated-summary', result.generatedTestsSummary)
        localStorage.removeItem('tests-generating')

        setRemainingEndpointIds(new Set(result.remainingEndpointIds))
        setShowContinueButton(true)
        setPartialGenerationMessage(
          `Generated tests for ${completedCount} more endpoints. ${stillRemaining} endpoints still remaining (token limit reached again).`
        )
      } else {
        // Full completion - clear everything including conversation
        console.log('[SpecsNew] All remaining tests generated successfully')
        setSelectedEndpointIds(new Set())
        setRemainingEndpointIds(new Set())
        setShowContinueButton(false)
        setPartialGenerationMessage(null)
        localStorage.removeItem('tests-generating')
        localStorage.removeItem('tests-generating-spec-id')
        localStorage.removeItem('tests-token-limit-reached')
        localStorage.removeItem('tests-remaining-endpoint-ids')
        localStorage.removeItem('tests-completed-count')
        localStorage.removeItem('tests-total-count')
        localStorage.removeItem('tests-conversation-messages')
        localStorage.removeItem('tests-generated-summary')
      }
    } catch (error: any) {
      console.error('Continue generation error:', error)
      alert(`Failed to continue generation: ${error.message}`)
      localStorage.removeItem('tests-generating')
      localStorage.removeItem('tests-generating-spec-id')
    } finally {
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }

  const handleBatchGenerate = async () => {
    // Get endpoints for selected spec from specGroups
    const selectedSpecGroup = specGroups?.find(g => g.spec.id === selectedSpecId)
    const specEndpoints = selectedSpecGroup?.endpoints || []

    if (!selectedSpecId || specEndpoints.length === 0 || selectedEndpointIds.size === 0) {
      alert('Please select endpoints to generate tests for')
      return
    }

    const selectedSpec = specs?.find(s => s.id === selectedSpecId)
    if (!selectedSpec) {
      alert('Spec not found')
      return
    }

    try {
      setIsGenerating(true)
      setGenerationProgress({ current: 0, total: selectedEndpointIds.size })

      // Clear any previous conversation history (this is a NEW generation, not a continuation)
      localStorage.removeItem('tests-conversation-messages')
      localStorage.removeItem('tests-generated-summary')
      localStorage.removeItem('tests-token-limit-reached')
      localStorage.removeItem('tests-remaining-endpoint-ids')
      localStorage.removeItem('tests-completed-count')
      localStorage.removeItem('tests-total-count')

      // Set generating flag and spec ID in localStorage for Tests page
      localStorage.setItem('tests-generating', 'true')
      localStorage.setItem('tests-generating-spec-id', String(selectedSpecId))

      // Navigate to Tests page with generating flag
      navigate('/tests?generating=true')

      // Get selected endpoints
      const endpointsToGenerate = specEndpoints.filter(e => selectedEndpointIds.has(e.id!))

      // Parse spec for AI - handle different formats
      let parsedSpec: any
      const specFormat = selectedSpec.format || 'openapi' // Default to openapi for backward compatibility
      if (specFormat === 'curl') {
        // For cURL imports, create a minimal spec object from the spec metadata
        parsedSpec = {
          info: {
            title: selectedSpec.name,
            version: selectedSpec.version,
            description: selectedSpec.description,
          },
          servers: selectedSpec.baseUrl ? [{ url: selectedSpec.baseUrl }] : [],
        }
      } else {
        // For OpenAPI/Swagger/Postman, parse the rawSpec JSON
        try {
          parsedSpec = JSON.parse(selectedSpec.rawSpec)
        } catch (error) {
          console.error('[SpecsNew] Failed to parse rawSpec:', error)
          alert('Invalid spec format: could not parse specification')
          setIsGenerating(false)
          localStorage.removeItem('tests-generating')
          localStorage.removeItem('tests-generating-spec-id')
          return
        }
      }

      // Get conversation history if continuing (should be empty for new generation)
      const previousMessages = localStorage.getItem('tests-conversation-messages')
      const previousSummary = localStorage.getItem('tests-generated-summary')

      // Track saved test names to prevent duplicates
      const savedTestNames = new Set<string>()

      // Generate tests with streaming via IPC
      const result = await generateTestsViaIPC({
        endpoints: endpointsToGenerate,
        spec: parsedSpec,
        previousMessages: previousMessages ? JSON.parse(previousMessages) : undefined,
        generatedTestsSummary: previousSummary || undefined,
        onProgress: (progress: any) => {
          setGenerationProgress({ current: progress.current, total: selectedEndpointIds.size })
        },
        onTestGenerated: async (test: any) => {
          // Save test in real-time as it's generated
          console.log('[SpecsNew handleBatchGenerate] Received test from IPC:', {
            name: test.name,
            method: test.method,
            path: test.path,
            testType: test.testType,
            assertions: test.assertions?.length
          })

          // Skip if already saved in this session
          if (savedTestNames.has(test.name)) {
            console.log('[SpecsNew handleBatchGenerate] Test already saved, skipping:', test.name)
            return
          }

          // Mark as saved IMMEDIATELY to prevent race condition with result processing
          savedTestNames.add(test.name)
          console.log('[SpecsNew handleBatchGenerate] Marked test as saved:', test.name, '- Total saved:', savedTestNames.size)

          await api.createTestCase(test as any)

          // Signal to Tests page that a new test was created (for immediate streaming)
          localStorage.setItem('tests-last-test-created', String(Date.now()))

          // Invalidate AND refetch immediately for real-time updates in Tests page
          await queryClient.invalidateQueries({ queryKey: ['test-groups'] })
          await queryClient.refetchQueries({ queryKey: ['test-groups'] })
        },
      })

      // IMPORTANT: Process all tests from result.tests in case IPC events didn't fire
      // This ensures all tests are saved even if real-time callbacks fail
      console.log('[SpecsNew] Processing tests from result:', {
        testsCount: result.tests?.length,
        completed: result.completed,
        savedViaCb: savedTestNames.size
      })

      if (result.tests && result.tests.length > 0) {
        console.log('[SpecsNew] Checking', result.tests.length, 'tests from result object')
        for (const test of result.tests) {
          // Skip if already saved via callback
          if (savedTestNames.has(test.name)) {
            console.log('[SpecsNew] Test already saved via callback, skipping:', test.name)
            continue
          }

          console.log('[SpecsNew] Saving test from result:', {
            name: test.name,
            method: test.method,
            path: test.path
          })
          await api.createTestCase(test as any)
          savedTestNames.add(test.name)
        }
        // Invalidate test groups query to trigger refetch in Tests page
        queryClient.invalidateQueries({ queryKey: ['test-groups'] })
        console.log('[SpecsNew] Total unique tests saved:', savedTestNames.size)
      }

      // Handle partial completion (token limit reached)
      if (!result.completed && result.error === 'TOKEN_LIMIT_REACHED') {
        console.log('[SpecsNew] Token limit reached. Storing state for Tests page.')
        const completedCount = result.completedEndpointIds.length
        const totalCount = selectedEndpointIds.size

        // Store token limit state in localStorage for Tests page
        localStorage.setItem('tests-token-limit-reached', 'true')
        localStorage.setItem('tests-remaining-endpoint-ids', JSON.stringify(result.remainingEndpointIds))
        localStorage.setItem('tests-completed-count', String(completedCount))
        localStorage.setItem('tests-total-count', String(totalCount))

        // Store conversation history and summary for continuation
        localStorage.setItem('tests-conversation-messages', JSON.stringify(result.conversationMessages))
        localStorage.setItem('tests-generated-summary', result.generatedTestsSummary)

        localStorage.removeItem('tests-generating') // Stop the "generating" state

        // Keep local state for Specs page
        setRemainingEndpointIds(new Set(result.remainingEndpointIds))
        setShowContinueButton(true)
        setPartialGenerationMessage(
          `Generated tests for ${completedCount} of ${totalCount} endpoints (token limit reached).`
        )
      } else {
        // Full completion - clear everything including conversation history
        setSelectedEndpointIds(new Set())
        setRemainingEndpointIds(new Set())
        setShowContinueButton(false)
        setPartialGenerationMessage(null)
        localStorage.removeItem('tests-generating')
        localStorage.removeItem('tests-generating-spec-id')
        localStorage.removeItem('tests-token-limit-reached')
        localStorage.removeItem('tests-remaining-endpoint-ids')
        localStorage.removeItem('tests-completed-count')
        localStorage.removeItem('tests-total-count')
        localStorage.removeItem('tests-conversation-messages')
        localStorage.removeItem('tests-generated-summary')
      }
    } catch (error: any) {
      console.error('Test generation error:', error)
      alert(`Failed to generate tests: ${error.message}`)
      localStorage.removeItem('tests-generating')
      localStorage.removeItem('tests-generating-spec-id')
    } finally {
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading specifications...</div>
      </div>
    )
  }

  return (
    <>
      <PageLayout>
        {/* Left Panel: Specs List */}
        <ResizablePanel defaultWidth={320} minWidth={300} maxWidth={600} className="">
          {/* Search Bar with Upload Button */}
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
              onClick={() => setShowUploadModal(true)}
              className="glass-panel rounded-full p-2.5 hover:shadow-lg transition-all flex-shrink-0"
              title="Upload Spec"
            >
              <Upload size={18} className="text-purple-600" />
            </button>
          </div>

          <div className="px-4 pb-24">
            {!specs || specs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <FileCode size={32} className="mx-auto mb-2 text-gray-400" />
                No specs uploaded yet
              </div>
            ) : (
              <div className="space-y-1">
                {specs
                  .filter((spec) => {
                    if (!searchQuery) return true

                    const query = searchQuery.toLowerCase()
                    const specGroup = specGroups?.find(g => g.spec.id === spec.id)
                    const specEndpoints = specGroup?.endpoints || []

                    // Search in spec name
                    const specMatch = spec.name.toLowerCase().includes(query)

                    // Search in endpoint methods and paths
                    const endpointMatch = specEndpoints.some(ep =>
                      ep.method.toLowerCase().includes(query) ||
                      ep.path.toLowerCase().includes(query)
                    )

                    return specMatch || endpointMatch
                  })
                  .map((spec) => {
                  const isExpanded = expandedSpecs.has(spec.id!)

                  // Get endpoints for this spec from specGroups
                  const specGroup = specGroups?.find(g => g.spec.id === spec.id)
                  const specEndpoints = specGroup?.endpoints || []

                  // Filter endpoints by search query
                  const filteredEndpoints = searchQuery
                    ? specEndpoints.filter(ep => {
                        const query = searchQuery.toLowerCase()
                        return (
                          ep.method.toLowerCase().includes(query) ||
                          ep.path.toLowerCase().includes(query)
                        )
                      })
                    : specEndpoints

                  // Count selected endpoints for this spec
                  const selectedCountForSpec = filteredEndpoints.filter(e => selectedEndpointIds.has(e.id!)).length

                  return (
                    <div key={spec.id}>
                      {/* Spec Header */}
                      <div className={`w-full flex items-center gap-2 px-3 py-2 transition-colors ${
                        selectedSpecId === spec.id && !selectedEndpointId
                          ? 'bg-purple-200 rounded-lg'
                          : 'hover:bg-gray-50 hover:rounded-lg'
                      }`}>
                        {/* Folder icon - toggle collapse/expand */}
                        <button
                          onClick={() => toggleSpec(spec.id!)}
                          className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? <FolderOpen size={16} className="text-purple-600" /> : <FolderClosed size={16} className="text-purple-600" />}
                        </button>

                        {/* Spec info - select spec */}
                        <button
                          onClick={() => {
                            setSelectedSpecId(spec.id!)
                            setSelectedEndpointId(null)
                            // Auto-expand if collapsed
                            if (!isExpanded) {
                              toggleSpec(spec.id!)
                            }
                          }}
                          className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{spec.name}</h3>
                            <p className="text-xs text-gray-500">v{spec.version}</p>
                          </div>
                        </button>
                      </div>

                      {/* Partial Generation Warning - shown when token limit reached */}
                      {isExpanded && showContinueButton && partialGenerationMessage && spec.id === selectedSpecId && (
                        <div className="ml-2 mt-2 mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs text-yellow-800">{partialGenerationMessage}</p>
                        </div>
                      )}

                      {/* Generate/Continue Tests Button - shown when spec is expanded and has selected endpoints */}
                      {isExpanded && (selectedCountForSpec > 0 || (showContinueButton && spec.id === selectedSpecId)) && (
                        <div className="ml-2 mt-2 mb-1">
                          <button
                            onClick={() => {
                              if (showContinueButton && spec.id === selectedSpecId) {
                                // Call continue handler if we're in continue mode
                                handleContinueGeneration()
                              } else {
                                handleBatchGenerate()
                              }
                            }}
                            disabled={isGenerating}
                            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                              showContinueButton && spec.id === selectedSpecId
                                ? 'bg-orange-600 hover:bg-orange-700'
                                : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                          >
                            {isGenerating ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Generating {generationProgress?.current || 0}/{generationProgress?.total || 0}
                              </>
                            ) : showContinueButton && spec.id === selectedSpecId ? (
                              <>
                                <Settings2 size={16} />
                                Continue Generation ({remainingEndpointIds.size} remaining)
                              </>
                            ) : (
                              <>
                                <Settings2 size={16} />
                                Generate Tests ({selectedCountForSpec})
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Endpoints List */}
                      {isExpanded && filteredEndpoints.length > 0 && (
                        <div className="ml-2 mt-1 space-y-1">
                          {filteredEndpoints.map((endpoint) => (
                            <EndpointCard
                              key={endpoint.id}
                              method={endpoint.method}
                              path={endpoint.path}
                              name={endpoint.name}
                              isSelected={endpoint.id === selectedEndpointId}
                              onClick={() => {
                                setSelectedEndpointId(endpoint.id!)
                                setSelectedSpecId(spec.id!)
                              }}
                              showCheckbox={true}
                              isChecked={selectedEndpointIds.has(endpoint.id!)}
                              onCheckboxChange={(checked) => {
                                const newSelected = new Set(selectedEndpointIds)
                                if (checked) {
                                  newSelected.add(endpoint.id!)
                                } else {
                                  newSelected.delete(endpoint.id!)
                                }
                                setSelectedEndpointIds(newSelected)
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ResizablePanel>

        {/* Right Panel: Spec or Endpoint Detail */}
        <div className="flex-1 overflow-y-auto glass-card rounded-3xl">
          {!selectedSpec ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <FileCode size={48} className="mx-auto mb-4 text-gray-400" />
                <p>Select a spec to view details</p>
              </div>
            </div>
          ) : selectedEndpoint ? (
            <div className="pb-20">
              <EndpointDetail
                endpoint={selectedEndpoint}
                specId={String(selectedSpecId)}
                selectedEnv={selectedEnv}
              />
            </div>
          ) : (
            <div className="p-6 pb-20">
              {/* Spec Header */}
              <div className="glass-card rounded-2xl p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedSpec.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">Version {selectedSpec.version}</p>
                    {selectedSpec.description && (
                      <p className="text-sm text-gray-600 mt-2">{selectedSpec.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteSpec(selectedSpec.id!, selectedSpec.name)}
                    className="text-gray-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Endpoints:</span>{' '}
                    <span className="font-medium">{specGroups?.find(g => g.spec.id === selectedSpecId)?.endpoints.length || 0}</span>
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
                environments={environments}
                selectedEnvId={selectedEnvId}
                onEnvChange={setSelectedEnvId}
              />
            </div>
          )}
        </div>
    </PageLayout>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-3xl shadow-glass-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Import API</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => setImportMode('file')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  importMode === 'file'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                📁 Upload File
              </button>
              <button
                onClick={() => setImportMode('text')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  importMode === 'text'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                📋 Paste cURL/Text
              </button>
            </div>

            <div className="space-y-4">
              {importMode === 'file' ? (
                <>
                  <p className="text-sm text-gray-600">
                    Supports: <strong>OpenAPI 3.x</strong>, <strong>Swagger 2.0</strong>, <strong>Postman Collection v2.x</strong>
                  </p>

                  <label className="block">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer">
                      <Upload size={48} className="mx-auto mb-3 text-gray-400" />
                      <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500 mt-1">JSON file (OpenAPI, Swagger, Postman)</p>
                    </div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Paste a <strong>cURL command</strong> from browser DevTools or any <strong>JSON specification</strong>
                  </p>

                  <textarea
                    value={curlText}
                    onChange={(e) => setCurlText(e.target.value)}
                    placeholder={'Paste here...\n\nExamples:\n• curl https://api.example.com/users -H "Authorization: Bearer token"\n• OpenAPI/Swagger JSON\n• Postman Collection JSON'}
                    className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={uploading}
                  />

                  <button
                    onClick={handleTextImport}
                    disabled={uploading || !curlText.trim()}
                    className="w-full py-2 px-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    {uploading ? 'Importing...' : 'Import'}
                  </button>
                </>
              )}

              {uploading && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-sm text-gray-600 mt-2">Processing...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
