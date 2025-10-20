import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useEnvironments, useSpecs} from '@/lib/hooks'
import {AlertCircle, Copy, Download, Edit3, FileCode, FolderClosed, FolderOpen, Search, Sparkles, Trash2, Upload, X, Zap} from 'lucide-react'
import * as api from '@/lib/api'
import EndpointDetail from '@/components/EndpointDetail'
import EnvironmentManager from '@/components/EnvironmentManager'
import ResizablePanel from '@/components/ResizablePanel'
import EndpointCard from '@/components/EndpointCard'
import PageLayout from '@/components/PageLayout'
import Button from '@/components/Button'
import ImportPreviewDialog from '@/components/ImportPreviewDialog'
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

  // Import preview state
  const [showImportPreview, setShowImportPreview] = useState(false)
  const [parsedImportData, setParsedImportData] = useState<{
    data: any
    detection: any
  } | null>(null)

  // Batch test generation states
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<Set<number>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [_generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectionModeSpecId, setSelectionModeSpecId] = useState<number | null>(null)

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

  const importContent = async (content: string, _sourceName: string) => {
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
    setShowUploadModal(false)
    setShowImportPreview(true)
  }

  const handleImportSuccess = async () => {
    // Refresh data after import
    await refetch()
    await queryClient.invalidateQueries({ queryKey: ['specs'] })
    await queryClient.refetchQueries({ queryKey: ['spec-groups'] })

    setShowImportPreview(false)
    setParsedImportData(null)
  }

  const handleDeleteSpec = async (specId: number, name: string) => {
    if (!confirm(`Delete spec "${name}"?`)) return
    await api.deleteSpec(specId)
    if (selectedSpecId === specId) {
      setSelectedSpecId(null)
    }
    await refetch()
  }

  const handleEditSpec = (_specId: number) => {
    // TODO: Implement edit spec modal/page
    alert('Edit spec feature coming soon')
  }

  const handleExportSpec = async (spec: Spec) => {
    try {
      // Export as OpenAPI JSON
      const exportData = {
        ...JSON.parse(spec.rawSpec),
        info: {
          title: spec.name,
          version: spec.version,
          description: spec.description,
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${spec.name.replace(/\s+/g, '-')}-${spec.version}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export spec')
    }
  }

  const handleDuplicateSpec = async (spec: Spec) => {
    try {
      // Create a new spec with duplicated data
      const newSpec = await api.createSpec({
        name: `${spec.name} (Copy)`,
        version: spec.version,
        description: spec.description,
        baseUrl: spec.baseUrl,
        rawSpec: spec.rawSpec,
        format: spec.format,
        versionGroup: crypto.randomUUID(),
        isLatest: true,
        originalName: spec.originalName,
      })

      // Duplicate all endpoints
      const specGroup = specGroups?.find(g => g.spec.id === spec.id)
      const endpoints = specGroup?.endpoints || []

      if (endpoints.length > 0) {
        const endpointsData = endpoints.map(endpoint => ({
          specId: newSpec.id!,
          method: endpoint.method,
          path: endpoint.path,
          name: endpoint.name,
          description: endpoint.description,
          request: endpoint.request,
          responses: endpoint.responses,
          auth: endpoint.auth,
          source: endpoint.source,
          updatedAt: new Date(),
          createdBy: 'manual' as const,
        }))
        await api.bulkCreateEndpoints(endpointsData)
      }

      // Refetch specs and spec-groups
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['specs'] })
      await queryClient.refetchQueries({ queryKey: ['spec-groups'] })

      // Select the new duplicated spec
      setSelectedSpecId(newSpec.id!)
      setExpandedSpecs(prev => new Set(prev).add(newSpec.id!))

      alert(`✓ Successfully duplicated spec with ${endpoints.length} endpoint(s)`)
    } catch (error) {
      console.error('Duplicate failed:', error)
      alert('Failed to duplicate spec')
    }
  }

  const handleContinueGeneration = async () => {
    console.log('[SpecsNew] === CONTINUE GENERATION STARTED ===')
    console.log('[SpecsNew] Selected spec ID:', selectedSpecId)
    console.log('[SpecsNew] Remaining endpoint IDs:', Array.from(remainingEndpointIds))
    console.log('[SpecsNew] Remaining count:', remainingEndpointIds.size)

    // Get endpoints for selected spec from specGroups
    const selectedSpecGroup = specGroups?.find(g => g.spec.id === selectedSpecId)
    const specEndpoints = selectedSpecGroup?.endpoints || []

    // IMPORTANT: When token limit is hit, we want to generate MORE tests for the SAME endpoints
    // The remainingEndpointIds might be empty if all endpoints have tests, but we still want to continue
    // So we check if we have metadata - if yes, continue with same endpoints
    const hasConversationHistory = !!localStorage.getItem('tests-generation-metadata')

    if (!selectedSpecId || specEndpoints.length === 0) {
      alert('No endpoints found for selected spec')
      return
    }

    // Only check remainingEndpointIds if we DON'T have conversation history
    if (!hasConversationHistory && remainingEndpointIds.size === 0) {
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

      // Get remaining endpoints to continue generating tests for
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

      // Get metadata for continuation
      const previousMetadataStr = localStorage.getItem('tests-generation-metadata')

      console.log('[SpecsNew] 📥 LOADING metadata from localStorage:', {
        exists: !!previousMetadataStr,
        length: previousMetadataStr?.length,
        preview: previousMetadataStr?.substring(0, 200)
      })

      const previousMetadata = previousMetadataStr ? JSON.parse(previousMetadataStr) : undefined

      console.log('[SpecsNew] 📊 PARSED metadata:', {
        completeParsedTests: previousMetadata?.completeParsedTests?.length || 0,
        tests: previousMetadata?.completeParsedTests?.map((t: any) => t.name) || []
      })

      console.log('[SpecsNew] Endpoints to generate:', endpointsToGenerate.length)

      // Track saved test names to prevent duplicates
      const savedTestNames = new Set<string>()

      // Generate tests for remaining endpoints with metadata for continuation
      const result = await generateTestsViaIPC({
        endpoints: endpointsToGenerate,
        spec: parsedSpec,
        previousMetadata,
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
        console.log('[SpecsNew] ⚠️ Token limit reached AGAIN during continuation')

        // Keep the same endpoints for another continuation
        const endpointsForContinuation = Array.from(remainingEndpointIds)

        // Store updated token limit state and metadata
        localStorage.setItem('tests-token-limit-reached', 'true')
        localStorage.setItem('tests-remaining-endpoint-ids', JSON.stringify(endpointsForContinuation))
        localStorage.setItem('tests-generation-metadata', JSON.stringify(result.metadata))
        localStorage.removeItem('tests-generating')

        console.log('[SpecsNew] 💾 SAVED metadata to localStorage:', {
          completeParsedTests: result.metadata.completeParsedTests.length,
          tests: result.metadata.completeParsedTests.map((t: any) => t.name),
          raw: JSON.stringify(result.metadata).substring(0, 200)
        })

        setRemainingEndpointIds(new Set(endpointsForContinuation))
        setShowContinueButton(true)
        setPartialGenerationMessage(
          `Generated ${result.tests?.length || 0} more tests but hit token limit again. Click continue to generate more.`
        )

        console.log('[SpecsNew] Continue button should still be visible')
      } else {
        // Full completion - clear everything
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
        localStorage.removeItem('tests-generation-metadata')
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

      // Clear any previous metadata (this is a NEW generation, not a continuation)
      localStorage.removeItem('tests-generation-metadata')
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

      // Get metadata if continuing (should be empty for new generation)
      const previousMetadataStr = localStorage.getItem('tests-generation-metadata')
      const previousMetadata = previousMetadataStr ? JSON.parse(previousMetadataStr) : undefined

      // Track saved test names to prevent duplicates
      const savedTestNames = new Set<string>()

      // Generate tests with streaming via IPC
      const result = await generateTestsViaIPC({
        endpoints: endpointsToGenerate,
        spec: parsedSpec,
        previousMetadata,
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
        console.log('[SpecsNew] ⚠️ TOKEN LIMIT REACHED - Showing continue button')
        console.log('[SpecsNew] Result:', {
          completed: result.completed,
          error: result.error,
          completedEndpointIds: result.completedEndpointIds,
          remainingEndpointIds: result.remainingEndpointIds,
          testsGenerated: result.tests?.length
        })

        const completedCount = result.completedEndpointIds.length
        const totalCount = selectedEndpointIds.size

        // When token limit is hit, we want to continue generating MORE tests
        // So we keep the SAME endpoints, not "remaining" endpoints
        const endpointsForContinuation = Array.from(selectedEndpointIds)

        // Store token limit state in localStorage for Tests page
        localStorage.setItem('tests-token-limit-reached', 'true')
        localStorage.setItem('tests-remaining-endpoint-ids', JSON.stringify(endpointsForContinuation))
        localStorage.setItem('tests-completed-count', String(completedCount))
        localStorage.setItem('tests-total-count', String(totalCount))

        // Store metadata for continuation
        localStorage.setItem('tests-generation-metadata', JSON.stringify(result.metadata))

        console.log('[SpecsNew] 💾 SAVED metadata to localStorage:', {
          completeParsedTests: result.metadata.completeParsedTests.length,
          tests: result.metadata.completeParsedTests.map((t: any) => t.name),
          raw: JSON.stringify(result.metadata).substring(0, 200)
        })

        localStorage.removeItem('tests-generating') // Stop the "generating" state

        // Keep local state for Specs page - use selected endpoints, not remaining
        setRemainingEndpointIds(new Set(endpointsForContinuation))
        setShowContinueButton(true)
        setPartialGenerationMessage(
          `Generated ${result.tests?.length || 0} tests but hit token limit. Click continue to generate more tests.`
        )

        console.log('[SpecsNew] Continue button should now be visible')
        console.log('[SpecsNew] showContinueButton:', true)
        console.log('[SpecsNew] remainingEndpointIds:', endpointsForContinuation)
      } else {
        // Full completion - clear everything
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
        localStorage.removeItem('tests-generation-metadata')
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

                        {/* Generate Tests / Actions - Only show when expanded */}
                        {isExpanded && (
                          <div className="flex items-center gap-1">
                            {selectionModeSpecId === spec.id ? (
                              // Selection mode: Show Generate + Cancel buttons
                              <>
                                <Button
                                  variant="save"
                                  size="sm"
                                  icon={Zap}
                                  highlighted={selectedCountForSpec > 0}
                                  onClick={() => handleBatchGenerate()}
                                  disabled={isGenerating || selectedCountForSpec === 0}
                                  title={selectedCountForSpec > 0 ? `Generate tests for ${selectedCountForSpec} endpoints` : 'Select endpoints first'}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={X}
                                  onClick={() => {
                                    setSelectionModeSpecId(null)
                                    setSelectedEndpointIds(new Set())
                                  }}
                                  title="Cancel selection"
                                />
                              </>
                            ) : (
                              // Normal mode: Show trigger button (highlighted)
                              <Button
                                variant="save"
                                size="sm"
                                icon={Sparkles}
                                highlighted={true}
                                onClick={() => {
                                  setSelectionModeSpecId(spec.id!)
                                  setSelectedEndpointIds(new Set())
                                }}
                                title="Generate tests"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selection Mode Info Banner */}
                      {isExpanded && selectionModeSpecId === spec.id && (
                        <div className="ml-2 mt-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700">
                            {selectedCountForSpec === 0 ? (
                              'Select up to 5 endpoints to generate tests'
                            ) : selectedCountForSpec >= 5 ? (
                              `✓ Maximum 5 endpoints selected`
                            ) : (
                              `${selectedCountForSpec} of 5 endpoints selected`
                            )}
                          </p>
                        </div>
                      )}

                      {/* Partial Generation Warning - shown when token limit reached */}
                      {isExpanded && showContinueButton && partialGenerationMessage && spec.id === selectedSpecId && (
                        <div className="ml-2 mt-2 mb-2 p-4 bg-orange-50 border border-orange-200 rounded-lg border-l-4 border-l-orange-500">
                          <div className="flex items-start gap-3">
                            <AlertCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-orange-900 mb-1">Generation Paused</h3>
                              <p className="text-sm text-orange-700 mb-3">{partialGenerationMessage}</p>
                              <button
                                onClick={handleContinueGeneration}
                                disabled={isGenerating}
                                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                              >
                                {isGenerating ? (
                                  <>
                                    <span className="animate-spin">⏳</span>
                                    Continuing...
                                  </>
                                ) : (
                                  'Continue Generation'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Endpoints List */}
                      {isExpanded && filteredEndpoints.length > 0 && (
                        <div className="ml-2 mt-1 space-y-1">
                          {filteredEndpoints.map((endpoint) => {
                            const isChecked = selectedEndpointIds.has(endpoint.id!)
                            const canCheck = isChecked || selectedCountForSpec < 5

                            return (
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
                                showCheckbox={selectionModeSpecId === spec.id}
                                isChecked={isChecked}
                                onCheckboxChange={(checked) => {
                                  const newSelected = new Set(selectedEndpointIds)
                                  if (checked) {
                                    // Only allow checking if under limit
                                    if (newSelected.size < 5) {
                                      newSelected.add(endpoint.id!)
                                    }
                                  } else {
                                    newSelected.delete(endpoint.id!)
                                  }
                                  setSelectedEndpointIds(newSelected)
                                }}
                                disabled={!canCheck && selectionModeSpecId === spec.id}
                              />
                            )
                          })}
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

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit3}
                      onClick={() => handleEditSpec(selectedSpec.id!)}
                      title="Edit spec metadata (coming soon)"
                      disabled
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Download}
                      onClick={() => handleExportSpec(selectedSpec)}
                      title="Export spec (coming soon)"
                      disabled
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Copy}
                      onClick={() => handleDuplicateSpec(selectedSpec)}
                      title="Duplicate spec (coming soon)"
                      disabled
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleDeleteSpec(selectedSpec.id!, selectedSpec.name)}
                      title="Delete spec"
                    />
                  </div>
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

      {/* Import Preview Dialog */}
      {showImportPreview && parsedImportData && (
        <ImportPreviewDialog
          isOpen={showImportPreview}
          parsedData={parsedImportData.data}
          detection={parsedImportData.detection}
          specs={specs || []}
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
