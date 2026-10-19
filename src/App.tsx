import { useState, useEffect, useRef } from 'react'
import type {
  AssertionResult,
  CollectionItem,
  EnvironmentProfile,
  HistoryItem,
  RecipeItem,
  RequestMode,
  RequestModel,
  ResponseSummary,
} from './types'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { RequestBuilder } from './components/RequestBuilder'
import { ResponseInspector } from './components/ResponseInspector'
import { EnvironmentModal } from './components/EnvironmentModal'
import { SnippetsModal } from './components/SnippetsModal'
import { RecipesModal } from './components/RecipesModal'
import { SaveRequestModal } from './components/SaveRequestModal'
import {
  addHistoryItem,
  clearHistory,
  exportCollectionsJson,
  loadActiveEnvId,
  loadCollections,
  loadEnvironments,
  loadHistory,
  loadTheme,
  saveActiveEnvId,
  saveCollections,
  saveEnvironments,
  saveTheme,
  validateAndImportCollections,
} from './utils/storage'
import { evaluateAssertions } from './utils/assertions'
import { executeRequest } from './services/requestExecutor'
import { API_RECIPES } from './data/recipes'

const INITIAL_REQUEST: RequestModel = {
  id: 'req_init',
  name: 'List Users (GET)',
  method: 'GET',
  url: '{{baseUrl}}/api/test/users',
  queryParams: [
    { id: 'p1', key: 'page', value: '1', enabled: true },
    { id: 'p2', key: 'limit', value: '5', enabled: true },
  ],
  headers: [
    { id: 'h1', key: 'Accept', value: 'application/json', enabled: true },
  ],
  body: {
    type: 'none',
    rawText: '',
  },
  auth: {
    type: 'none',
  },
  assertions: [
    { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
    { id: 'a2', type: 'response_time_less_than', expectedValue: '1500', enabled: true },
    { id: 'a3', type: 'json_path_exists', path: 'users', enabled: true },
  ],
  timeoutMs: 30000,
  requestMode: 'direct',
}

export function App() {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadTheme())

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('html-light')
    } else {
      root.classList.remove('dark')
      root.classList.add('html-light')
    }
    saveTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Environments state
  const [environments, setEnvironments] = useState<EnvironmentProfile[]>(() => loadEnvironments())
  const [activeEnvId, setActiveEnvId] = useState<string>(() => loadActiveEnvId())

  const activeEnv =
    environments.find((e) => e.id === activeEnvId) || environments[0] || {
      id: 'default',
      name: 'Default',
      variables: [],
    }

  const handleSelectEnv = (id: string) => {
    setActiveEnvId(id)
    saveActiveEnvId(id)
  }

  const handleSaveEnvironments = (envs: EnvironmentProfile[], activeId: string) => {
    setEnvironments(envs)
    setActiveEnvId(activeId)
    saveEnvironments(envs)
    saveActiveEnvId(activeId)
  }

  // Collections & History state
  const [collections, setCollections] = useState<CollectionItem[]>(() => loadCollections())
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())

  // Request & Execution state
  const [activeRequest, setActiveRequest] = useState<RequestModel>(INITIAL_REQUEST)
  const [response, setResponse] = useState<ResponseSummary | null>(null)
  const [assertionResults, setAssertionResults] = useState<AssertionResult[]>([])
  const [isSending, setIsSending] = useState<boolean>(false)
  const [elapsedMs, setElapsedMs] = useState<number>(0)

  // Modals & Navigation state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true)
  const [isEnvModalOpen, setIsEnvModalOpen] = useState<boolean>(false)
  const [isSnippetsModalOpen, setIsSnippetsModalOpen] = useState<boolean>(false)
  const [isRecipesModalOpen, setIsRecipesModalOpen] = useState<boolean>(false)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<any>(null)

  // Toggle request mode helper
  const handleToggleRequestMode = () => {
    const nextMode: RequestMode = activeRequest.requestMode === 'direct' ? 'proxy' : 'direct'
    setActiveRequest((prev) => ({ ...prev, requestMode: nextMode }))
  }

  // Update request helper
  const handleChangeRequest = (updates: Partial<RequestModel>) => {
    setActiveRequest((prev) => ({ ...prev, ...updates }))
  }

  // Execute request
  const handleSendRequest = async () => {
    if (isSending) return

    setIsSending(true)
    setElapsedMs(0)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const startTime = performance.now()
    timerRef.current = setInterval(() => {
      setElapsedMs(performance.now() - startTime)
    }, 20)

    try {
      const summary = await executeRequest(activeRequest, activeEnv.variables, {
        signal: controller.signal,
      })

      setResponse(summary)

      // Evaluate assertions if response was received
      const results = evaluateAssertions(activeRequest.assertions, summary)
      setAssertionResults(results)

      // Add to history (secrets will be stripped safely)
      const updatedHistory = addHistoryItem(
        activeRequest,
        summary.status,
        summary.clientDurationMs,
        summary.networkError
      )
      setHistory(updatedHistory)
    } catch (err: any) {
      const failedSummary: ResponseSummary = {
        status: 0,
        statusText: 'Execution Error',
        clientDurationMs: Math.round(performance.now() - startTime),
        sizeBytes: 0,
        contentType: 'text/plain',
        requestUrl: activeRequest.url,
        requestMethod: activeRequest.method,
        headers: {},
        body: '',
        isJson: false,
        isTruncated: false,
        networkError: true,
        error: err.message,
        timestamp: Date.now(),
      }
      setResponse(failedSummary)
      setAssertionResults(evaluateAssertions(activeRequest.assertions, failedSummary))
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      setIsSending(false)
      abortControllerRef.current = null
    }
  }

  // Cancel request
  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  // History handlers
  const handleSelectHistoryItem = (item: HistoryItem) => {
    setActiveRequest({
      ...item.requestConfig,
      id: `req_${Date.now()}`,
      name: `${item.method} ${item.url}`,
    })
  }

  const handleRerunHistoryItem = (item: HistoryItem) => {
    const reqToRun: RequestModel = {
      ...item.requestConfig,
      id: `req_${Date.now()}`,
      name: `${item.method} ${item.url}`,
    }
    setActiveRequest(reqToRun)
    setTimeout(() => {
      handleSendRequest()
    }, 50)
  }

  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
  }

  // Collections handlers
  const handleSelectCollectionRequest = (req: RequestModel) => {
    setActiveRequest({ ...req })
  }

  const handleCreateCollection = (name: string) => {
    const newCol: CollectionItem = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [...collections, newCol]
    setCollections(updated)
    saveCollections(updated)
  }

  const handleRenameCollection = (id: string, name: string) => {
    const updated = collections.map((c) =>
      c.id === id ? { ...c, name, updatedAt: Date.now() } : c
    )
    setCollections(updated)
    saveCollections(updated)
  }

  const handleDeleteCollection = (id: string) => {
    const updated = collections.filter((c) => c.id !== id)
    setCollections(updated)
    saveCollections(updated)
  }

  const handleDeleteCollectionRequest = (collectionId: string, requestId: string) => {
    const updated = collections.map((c) => {
      if (c.id !== collectionId) return c
      return {
        ...c,
        requests: c.requests.filter((r) => r.id !== requestId),
        updatedAt: Date.now(),
      }
    })
    setCollections(updated)
    saveCollections(updated)
  }

  const handleDuplicateCollectionRequest = (collectionId: string, req: RequestModel) => {
    const duplicated: RequestModel = {
      ...req,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${req.name} (Copy)`,
    }
    const updated = collections.map((c) => {
      if (c.id !== collectionId) return c
      return {
        ...c,
        requests: [...c.requests, duplicated],
        updatedAt: Date.now(),
      }
    })
    setCollections(updated)
    saveCollections(updated)
  }

  const handleSaveToCollection = (collectionId: string, requestName: string) => {
    const toSave: RequestModel = {
      ...activeRequest,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: requestName,
    }
    const updated = collections.map((c) => {
      if (c.id !== collectionId) return c
      return {
        ...c,
        requests: [...c.requests, toSave],
        updatedAt: Date.now(),
      }
    })
    setCollections(updated)
    saveCollections(updated)
  }

  const handleCreateAndSaveToCollection = (newCollectionName: string, requestName: string) => {
    const toSave: RequestModel = {
      ...activeRequest,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: requestName,
    }
    const newCol: CollectionItem = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newCollectionName,
      requests: [toSave],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [...collections, newCol]
    setCollections(updated)
    saveCollections(updated)
  }

  const handleExportCollections = () => {
    const jsonStr = exportCollectionsJson(collections)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-quicktest-collections-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportCollections = (jsonText: string) => {
    const result = validateAndImportCollections(jsonText)
    if (result.success && result.collections) {
      const merged = [...collections, ...result.collections]
      setCollections(merged)
      saveCollections(merged)
      alert(`Successfully imported ${result.collections.length} collection(s)!`)
    } else {
      alert(`Import failed: ${result.error || 'Invalid file format'}`)
    }
  }

  // Load recipe into builder
  const handleSelectRecipe = (recipe: RecipeItem) => {
    setActiveRequest({
      id: `req_${Date.now()}`,
      name: recipe.title,
      method: recipe.request.method || 'GET',
      url: recipe.request.url || '',
      queryParams: recipe.request.queryParams || [],
      headers: recipe.request.headers || [],
      body: recipe.request.body || { type: 'none', rawText: '' },
      auth: recipe.request.auth || { type: 'none' },
      assertions: recipe.request.assertions || [],
      timeoutMs: recipe.request.timeoutMs || 30000,
      requestMode: activeRequest.requestMode,
    })
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0d1117] text-gray-200 html-light:bg-[#f6f8fa] html-light:text-gray-900">
      {/* Application Header */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        requestMode={activeRequest.requestMode}
        onToggleRequestMode={handleToggleRequestMode}
        activeEnv={activeEnv}
        environments={environments}
        onSelectEnv={handleSelectEnv}
        onOpenEnvModal={() => setIsEnvModalOpen(true)}
        onOpenSnippetsModal={() => setIsSnippetsModalOpen(true)}
        onOpenRecipes={() => setIsRecipesModalOpen(true)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onCloseMobile={() => {
            if (window.innerWidth < 768) {
              setSidebarOpen(false)
            }
          }}
          history={history}
          onSelectHistoryItem={handleSelectHistoryItem}
          onRerunHistoryItem={handleRerunHistoryItem}
          onClearHistory={handleClearHistory}
          collections={collections}
          onSelectCollectionRequest={handleSelectCollectionRequest}
          onCreateCollection={handleCreateCollection}
          onRenameCollection={handleRenameCollection}
          onDeleteCollection={handleDeleteCollection}
          onDeleteCollectionRequest={handleDeleteCollectionRequest}
          onDuplicateCollectionRequest={handleDuplicateCollectionRequest}
          onExportCollections={handleExportCollections}
          onImportCollections={handleImportCollections}
        />

        {/* Content Pane: Request Builder (top) + Response Inspector (bottom) */}
        <main className="flex flex-1 flex-col overflow-y-auto">
          {/* Request Builder */}
          <RequestBuilder
            request={activeRequest}
            onChangeRequest={handleChangeRequest}
            onSend={handleSendRequest}
            onCancel={handleCancelRequest}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
            isSending={isSending}
            elapsedMs={elapsedMs}
            variables={activeEnv.variables}
          />

          {/* Response Inspector */}
          <ResponseInspector
            response={response}
            assertionResults={assertionResults}
            isSending={isSending}
            elapsedMs={elapsedMs}
            onLoadRecipeSample={() => handleSelectRecipe(API_RECIPES[0])}
            onSwitchToProxy={() => handleChangeRequest({ requestMode: 'proxy' })}
          />
        </main>
      </div>

      {/* Modals */}
      <EnvironmentModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        environments={environments}
        activeEnvId={activeEnvId}
        onSaveEnvironments={handleSaveEnvironments}
      />

      <SnippetsModal
        isOpen={isSnippetsModalOpen}
        onClose={() => setIsSnippetsModalOpen(false)}
        request={activeRequest}
        variables={activeEnv.variables}
      />

      <RecipesModal
        isOpen={isRecipesModalOpen}
        onClose={() => setIsRecipesModalOpen(false)}
        onSelectRecipe={handleSelectRecipe}
      />

      <SaveRequestModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        request={activeRequest}
        collections={collections}
        onSaveToCollection={handleSaveToCollection}
        onCreateAndSaveToCollection={handleCreateAndSaveToCollection}
      />
    </div>
  )
}

export default App
