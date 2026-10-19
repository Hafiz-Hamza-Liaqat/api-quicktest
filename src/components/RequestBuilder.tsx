import { useState, useMemo, type FC } from 'react'
import {
  Send,
  Square,
  Bookmark,
  Plus,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldAlert,
  Sparkles,
  Info,
} from 'lucide-react'
import type {
  AssertionRule,
  AssertionType,
  AuthConfig,
  EnvironmentVariable,
  HttpMethod,
  KeyValuePair,
  RequestBodyConfig,
  RequestMode,
  RequestModel,
} from '../types'
import {
  COMMON_HEADER_NAMES,
  isBrowserForbiddenHeader,
} from '../utils/headers'
import { buildFinalUrl, validateProtocol } from '../utils/url'

interface RequestBuilderProps {
  request: RequestModel
  onChangeRequest: (updates: Partial<RequestModel>) => void
  onSend: () => void
  onCancel: () => void
  onOpenSaveModal: () => void
  isSending: boolean
  elapsedMs: number
  variables: EnvironmentVariable[]
}

type TabType = 'params' | 'headers' | 'auth' | 'body' | 'assertions' | 'settings'

export const RequestBuilder: FC<RequestBuilderProps> = ({
  request,
  onChangeRequest,
  onSend,
  onCancel,
  onOpenSaveModal,
  isSending,
  elapsedMs,
  variables,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('params')
  const [showSecrets, setShowSecrets] = useState<boolean>(false)

  // Calculate resolved URL and missing variables
  const { finalUrl, unresolvedVars } = buildFinalUrl(
    request.url,
    request.queryParams,
    variables
  )

  const protoValidation = validateProtocol(request.url)

  // Derive JSON body validation error during render
  const jsonValidationError = useMemo(() => {
    if (request.method !== 'GET' && request.body.type === 'json' && request.body.rawText.trim()) {
      try {
        JSON.parse(request.body.rawText)
        return null
      } catch (e: any) {
        return e.message
      }
    }
    return null
  }, [request.body.rawText, request.body.type, request.method])

  // Method selector color styles
  const getMethodColorClass = (m: HttpMethod) => {
    switch (m) {
      case 'GET':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      case 'POST':
        return 'text-blue-400 border-blue-500/40 bg-blue-500/10'
      case 'PUT':
        return 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      case 'PATCH':
        return 'text-orange-400 border-orange-500/40 bg-orange-500/10'
      case 'DELETE':
        return 'text-rose-400 border-rose-500/40 bg-rose-500/10'
    }
  }

  // --- Handlers for Params ---
  const handleUrlChange = (val: string) => {
    // If URL contains query string, we can update or keep
    onChangeRequest({ url: val })
  }

  const handleAddParam = () => {
    const newPair: KeyValuePair = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: '',
      value: '',
      enabled: true,
    }
    onChangeRequest({ queryParams: [...request.queryParams, newPair] })
  }

  const handleUpdateParam = (id: string, updates: Partial<KeyValuePair>) => {
    onChangeRequest({
      queryParams: request.queryParams.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })
  }

  const handleDeleteParam = (id: string) => {
    onChangeRequest({
      queryParams: request.queryParams.filter((p) => p.id !== id),
    })
  }

  // --- Handlers for Headers ---
  const handleAddHeader = () => {
    const newPair: KeyValuePair = {
      id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: '',
      value: '',
      enabled: true,
    }
    onChangeRequest({ headers: [...request.headers, newPair] })
  }

  const handleUpdateHeader = (id: string, updates: Partial<KeyValuePair>) => {
    onChangeRequest({
      headers: request.headers.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    })
  }

  const handleDeleteHeader = (id: string) => {
    onChangeRequest({
      headers: request.headers.filter((h) => h.id !== id),
    })
  }

  // --- Handlers for Auth ---
  const handleUpdateAuth = (updates: Partial<AuthConfig>) => {
    onChangeRequest({ auth: { ...request.auth, ...updates } })
  }

  // --- Handlers for Body ---
  const handleUpdateBody = (updates: Partial<RequestBodyConfig>) => {
    onChangeRequest({ body: { ...request.body, ...updates } })
  }

  const handleFormatJson = () => {
    if (!request.body.rawText.trim()) return
    try {
      const parsed = JSON.parse(request.body.rawText)
      handleUpdateBody({ rawText: JSON.stringify(parsed, null, 2) })
    } catch {
      // Ignored: jsonValidationError derived memo already handles display
    }
  }

  // --- Handlers for Assertions ---
  const handleAddAssertion = () => {
    const newRule: AssertionRule = {
      id: `a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'status_code_equals',
      expectedValue: '200',
      enabled: true,
    }
    onChangeRequest({ assertions: [...request.assertions, newRule] })
  }

  const handleUpdateAssertion = (id: string, updates: Partial<AssertionRule>) => {
    onChangeRequest({
      assertions: request.assertions.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })
  }

  const handleDeleteAssertion = (id: string) => {
    onChangeRequest({
      assertions: request.assertions.filter((a) => a.id !== id),
    })
  }

  return (
    <div className="flex flex-col border-b border-gray-800 bg-[#0d1117] p-3 sm:p-4 html-light:border-gray-200 html-light:bg-white">
      {/* Top Request Bar: Method Selector + URL input + Send + Save */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Method & URL group */}
        <div className="flex flex-1 items-center rounded-lg border border-gray-700 bg-gray-900/90 shadow-xs focus-within:border-emerald-500 html-light:border-gray-300 html-light:bg-gray-50">
          <select
            value={request.method}
            onChange={(e) => onChangeRequest({ method: e.target.value as HttpMethod })}
            aria-label="HTTP Method"
            className={`cursor-pointer rounded-l-lg border-r border-gray-700 bg-transparent px-3 py-2 font-mono text-xs font-bold focus:outline-none html-light:border-gray-300 ${getMethodColorClass(
              request.method
            )}`}
          >
            <option value="GET" className="bg-gray-900 text-emerald-400">GET</option>
            <option value="POST" className="bg-gray-900 text-blue-400">POST</option>
            <option value="PUT" className="bg-gray-900 text-amber-400">PUT</option>
            <option value="PATCH" className="bg-gray-900 text-orange-400">PATCH</option>
            <option value="DELETE" className="bg-gray-900 text-rose-400">DELETE</option>
          </select>

          <input
            type="text"
            value={request.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Enter request URL or {{baseUrl}}/endpoint"
            className="w-full bg-transparent px-3 py-2 font-mono text-xs text-gray-100 placeholder-gray-500 focus:outline-none html-light:text-gray-900"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSending) {
                onSend()
              }
            }}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2">
          {isSending ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex flex-1 items-center justify-center space-x-1.5 rounded-lg border border-rose-500/40 bg-rose-600/20 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 sm:flex-none"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Cancel ({Math.round(elapsedMs)}ms)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              className="flex flex-1 items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 sm:flex-none"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSaveModal}
            title="Save request to collection"
            className="flex items-center space-x-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-700 html-light:hover:bg-gray-200"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Resolved URL Preview & Warnings */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px]">
        <div className="flex items-center space-x-1.5 truncate text-gray-400">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Preview:</span>
          <span className="truncate font-mono text-gray-300 html-light:text-gray-700" title={finalUrl}>
            {finalUrl || '(no URL)'}
          </span>
        </div>

        {/* Unresolved variable pills */}
        {unresolvedVars.length > 0 && (
          <div className="flex items-center space-x-1 text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span>Missing: {unresolvedVars.map((v) => `{{${v}}}`).join(', ')}</span>
          </div>
        )}

        {!protoValidation.valid && (
          <div className="flex items-center space-x-1 text-rose-400">
            <AlertCircle className="h-3 w-3" />
            <span>{protoValidation.error}</span>
          </div>
        )}
      </div>

      {/* Tabs Header */}
      <div className="mt-3 flex items-center border-b border-gray-800 text-xs html-light:border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`border-b-2 px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'params'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 html-light:hover:text-gray-800'
          }`}
        >
          Params
          {request.queryParams.filter((p) => p.enabled && p.key.trim()).length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300 html-light:bg-gray-200 html-light:text-gray-700">
              {request.queryParams.filter((p) => p.enabled && p.key.trim()).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('headers')}
          className={`border-b-2 px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'headers'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 html-light:hover:text-gray-800'
          }`}
        >
          Headers
          {request.headers.filter((h) => h.enabled && h.key.trim()).length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300 html-light:bg-gray-200 html-light:text-gray-700">
              {request.headers.filter((h) => h.enabled && h.key.trim()).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('auth')}
          className={`border-b-2 px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'auth'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 html-light:hover:text-gray-800'
          }`}
        >
          Authorization
          {request.auth.type !== 'none' && (
            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('body')}
          className={`border-b-2 px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'body'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 html-light:hover:text-gray-800'
          }`}
        >
          Body
          {request.method === 'GET' && (
            <span className="ml-1 text-[10px] text-gray-500">(Disabled)</span>
          )}
          {request.method !== 'GET' && request.body.type !== 'none' && (
            <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300 html-light:bg-gray-200 html-light:text-gray-700">
              {request.body.type.toUpperCase()}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assertions')}
          className={`border-b-2 px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'assertions'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 html-light:hover:text-gray-800'
          }`}
        >
          Assertions
          {request.assertions.filter((a) => a.enabled).length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300 html-light:bg-gray-200 html-light:text-gray-700">
              {request.assertions.filter((a) => a.enabled).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`border-b-2 px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 html-light:hover:text-gray-800'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Tabs Body */}
      <div className="pt-3">
        {/* PARAMS TAB */}
        {activeTab === 'params' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Query Parameters</span>
              <button
                type="button"
                onClick={handleAddParam}
                className="flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Parameter</span>
              </button>
            </div>

            {request.queryParams.length === 0 ? (
              <div className="rounded border border-dashed border-gray-800 p-4 text-center text-xs text-gray-500 html-light:border-gray-300">
                No query parameters configured. Click "Add Parameter" to append to URL.
              </div>
            ) : (
              <div className="space-y-1.5">
                {request.queryParams.map((param) => (
                  <div key={param.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={param.enabled}
                      onChange={(e) => handleUpdateParam(param.id, { enabled: e.target.checked })}
                      className="rounded border-gray-700 text-emerald-600 focus:ring-0"
                    />
                    <input
                      type="text"
                      placeholder="Parameter Key"
                      value={param.key}
                      onChange={(e) => handleUpdateParam(param.id, { key: e.target.value })}
                      className="flex-1 rounded border border-gray-700 bg-gray-900 px-2.5 py-1 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={param.value}
                      onChange={(e) => handleUpdateParam(param.id, { value: e.target.value })}
                      className="flex-1 rounded border border-gray-700 bg-gray-900 px-2.5 py-1 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteParam(param.id)}
                      className="p-1 text-gray-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Request Headers</span>
              <button
                type="button"
                onClick={handleAddHeader}
                className="flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Header</span>
              </button>
            </div>

            {request.headers.length === 0 ? (
              <div className="rounded border border-dashed border-gray-800 p-4 text-center text-xs text-gray-500 html-light:border-gray-300">
                No custom headers configured. Click "Add Header" or select common presets.
              </div>
            ) : (
              <div className="space-y-1.5">
                {request.headers.map((h) => {
                  const isForbidden =
                    request.requestMode === 'direct' && isBrowserForbiddenHeader(h.key)

                  return (
                    <div key={h.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => handleUpdateHeader(h.id, { enabled: e.target.checked })}
                        className="rounded border-gray-700 text-emerald-600 focus:ring-0"
                      />
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Header Name (e.g. Accept)"
                          value={h.key}
                          list="common-headers-list"
                          onChange={(e) => handleUpdateHeader(h.id, { key: e.target.value })}
                          className={`w-full rounded border bg-gray-900 px-2.5 py-1 font-mono text-xs text-gray-100 focus:outline-none html-light:bg-white html-light:text-gray-900 ${
                            isForbidden
                              ? 'border-amber-500/60 focus:border-amber-500'
                              : 'border-gray-700 focus:border-emerald-500 html-light:border-gray-300'
                          }`}
                        />
                        {isForbidden && (
                          <span
                            title="Browser restricted header in direct mode"
                            className="absolute right-2 top-1 text-[10px] text-amber-400"
                          >
                            Restricted
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Value (e.g. application/json)"
                        value={h.value}
                        onChange={(e) => handleUpdateHeader(h.id, { value: e.target.value })}
                        className="flex-1 rounded border border-gray-700 bg-gray-900 px-2.5 py-1 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteHeader(h.id)}
                        className="p-1 text-gray-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <datalist id="common-headers-list">
              {COMMON_HEADER_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        )}

        {/* AUTH TAB */}
        {activeTab === 'auth' && (
          <div className="max-w-xl space-y-4">
            <div className="flex items-center space-x-3">
              <label className="text-xs font-medium text-gray-400">Type:</label>
              <select
                aria-label="Auth Type"
                value={request.auth.type}
                onChange={(e) => handleUpdateAuth({ type: e.target.value as any })}
                className="rounded border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs text-gray-200 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
              >
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apikey">API Key</option>
              </select>
            </div>

            {request.auth.type === 'bearer' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-400">Token</label>
                <div className="relative flex items-center">
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={request.auth.bearerToken || ''}
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    onChange={(e) => handleUpdateAuth({ bearerToken: e.target.value })}
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 pr-8 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-2 text-gray-400 hover:text-gray-200"
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {request.auth.type === 'basic' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Username</label>
                  <input
                    type="text"
                    value={request.auth.basicUsername || ''}
                    placeholder="user"
                    onChange={(e) => handleUpdateAuth({ basicUsername: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Password</label>
                  <div className="relative mt-1 flex items-center">
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={request.auth.basicPassword || ''}
                      placeholder="password"
                      onChange={(e) => handleUpdateAuth({ basicPassword: e.target.value })}
                      className="w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 pr-8 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecrets(!showSecrets)}
                      className="absolute right-2 text-gray-400 hover:text-gray-200"
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {request.auth.type === 'apikey' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Header Name</label>
                  <input
                    type="text"
                    value={request.auth.apiKeyHeader || 'X-API-Key'}
                    placeholder="X-API-Key"
                    onChange={(e) => handleUpdateAuth({ apiKeyHeader: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Value</label>
                  <div className="relative mt-1 flex items-center">
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={request.auth.apiKeyValue || ''}
                      placeholder="secret_key_..."
                      onChange={(e) => handleUpdateAuth({ apiKeyValue: e.target.value })}
                      className="w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 pr-8 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecrets(!showSecrets)}
                      className="absolute right-2 text-gray-400 hover:text-gray-200"
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-2 rounded border border-gray-800 bg-[#161b22] p-2 text-xs text-gray-400 html-light:border-gray-200 html-light:bg-gray-50">
              <ShieldAlert className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Credentials are used only during dispatch. They are never saved to history, collection exports, or server logs.
              </span>
            </div>
          </div>
        )}

        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div>
            {request.method === 'GET' ? (
              <div className="rounded border border-gray-800 bg-[#161b22] p-6 text-center text-xs text-gray-400 html-light:border-gray-200 html-light:bg-gray-50">
                <Info className="mx-auto mb-2 h-6 w-6 text-gray-500" />
                GET requests do not transmit a request body according to HTTP/1.1 specifications.
                Switch to POST, PUT, or PATCH to send payloads.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateBody({ type: 'none', rawText: '' })}
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        request.body.type === 'none'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-200 html-light:bg-gray-200 html-light:text-gray-700'
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateBody({
                          type: 'json',
                          contentType: 'application/json',
                          rawText: request.body.rawText || '{\n  \n}',
                        })
                      }
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        request.body.type === 'json'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-200 html-light:bg-gray-200 html-light:text-gray-700'
                      }`}
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateBody({
                          type: 'raw',
                          contentType: 'text/plain',
                        })
                      }
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        request.body.type === 'raw'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-200 html-light:bg-gray-200 html-light:text-gray-700'
                      }`}
                    >
                      Raw Text
                    </button>
                  </div>

                  {request.body.type === 'json' && (
                    <button
                      type="button"
                      onClick={handleFormatJson}
                      className="flex items-center space-x-1 rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-800"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Format JSON</span>
                    </button>
                  )}
                </div>

                {request.body.type !== 'none' && (
                  <div className="space-y-1">
                    <textarea
                      rows={8}
                      value={request.body.rawText}
                      onChange={(e) => handleUpdateBody({ rawText: e.target.value })}
                      placeholder={request.body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter raw request body'}
                      className="w-full rounded border border-gray-700 bg-[#0a0d12] p-3 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                    />

                    {jsonValidationError && (
                      <div className="flex items-center space-x-1.5 text-xs text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>JSON Syntax: {jsonValidationError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ASSERTIONS TAB */}
        {activeTab === 'assertions' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-400">Response Assertions</span>
                <p className="text-[11px] text-gray-500">
                  Tests execute automatically upon response receipt. No eval or dynamic scripts.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAssertion}
                className="flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Assertion</span>
              </button>
            </div>

            {request.assertions.length === 0 ? (
              <div className="rounded border border-dashed border-gray-800 p-4 text-center text-xs text-gray-500 html-light:border-gray-300">
                No assertion rules configured. Click "Add Assertion" to verify status codes, response time, or JSON fields.
              </div>
            ) : (
              <div className="space-y-2">
                {request.assertions.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-gray-800 bg-[#161b22] p-2 text-xs html-light:border-gray-200 html-light:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        handleUpdateAssertion(rule.id, { enabled: e.target.checked })
                      }
                      className="rounded border-gray-700 text-emerald-600 focus:ring-0"
                    />

                    <select
                      value={rule.type}
                      onChange={(e) =>
                        handleUpdateAssertion(rule.id, {
                          type: e.target.value as AssertionType,
                        })
                      }
                      className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                    >
                      <option value="status_code_equals">Status Code Equals</option>
                      <option value="response_time_less_than">Response Time &lt; (ms)</option>
                      <option value="json_path_exists">JSON Path Exists</option>
                      <option value="json_path_equals">JSON Path Equals</option>
                      <option value="json_path_type">JSON Path Type</option>
                      <option value="header_exists">Header Exists</option>
                      <option value="header_equals">Header Equals</option>
                    </select>

                    {/* Path input for json_path or header */}
                    {(rule.type.startsWith('json_path') || rule.type === 'header_equals') && (
                      <input
                        type="text"
                        placeholder={rule.type.startsWith('json') ? 'Path (e.g. data.id)' : 'Header name'}
                        value={rule.path || ''}
                        onChange={(e) =>
                          handleUpdateAssertion(rule.id, { path: e.target.value })
                        }
                        className="w-36 rounded border border-gray-700 bg-gray-900 px-2 py-1 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                      />
                    )}

                    {/* Expected value input */}
                    {rule.type !== 'json_path_exists' && (
                      <input
                        type="text"
                        placeholder="Expected Value"
                        value={rule.expectedValue || ''}
                        onChange={(e) =>
                          handleUpdateAssertion(rule.id, { expectedValue: e.target.value })
                        }
                        className="flex-1 min-w-[100px] rounded border border-gray-700 bg-gray-900 px-2 py-1 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteAssertion(rule.id)}
                      className="p-1 text-gray-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-md space-y-4 text-xs">
            <div>
              <label className="block font-medium text-gray-400">Request Timeout (milliseconds)</label>
              <input
                type="number"
                min="1000"
                max="60000"
                value={request.timeoutMs || 30000}
                onChange={(e) =>
                  onChangeRequest({ timeoutMs: parseInt(e.target.value, 10) || 30000 })
                }
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Default: 30,000ms (30 seconds). Request automatically aborts if elapsed time exceeds timeout.
              </p>
            </div>

            <div>
              <label className="block font-medium text-gray-400">Request Dispatch Mode</label>
              <select
                value={request.requestMode}
                onChange={(e) => onChangeRequest({ requestMode: e.target.value as RequestMode })}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
              >
                <option value="direct">Direct Browser Mode (Subject to target server CORS)</option>
                <option value="proxy">Node.js Proxy Mode (Bypasses browser CORS via backend)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
