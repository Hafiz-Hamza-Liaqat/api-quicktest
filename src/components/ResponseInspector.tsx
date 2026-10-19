import { useState, type FC } from 'react'
import {
  Copy,
  Download,
  Search,
  Check,
  AlertTriangle,
  Clock,
  HardDrive,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react'
import type { AssertionResult, ResponseSummary } from '../types'

interface ResponseInspectorProps {
  response: ResponseSummary | null
  assertionResults: AssertionResult[]
  isSending: boolean
  elapsedMs: number
  onLoadRecipeSample?: () => void
  onSwitchToProxy?: () => void
}

type ResponseTab = 'pretty' | 'raw' | 'headers' | 'assertions'

export const ResponseInspector: FC<ResponseInspectorProps> = ({
  response,
  assertionResults,
  isSending,
  elapsedMs,
  onLoadRecipeSample,
  onSwitchToProxy,
}) => {
  const [activeTab, setActiveTab] = useState<ResponseTab>('pretty')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [copiedBody, setCopiedBody] = useState<boolean>(false)
  const [copiedHeaders, setCopiedHeaders] = useState<boolean>(false)
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false)

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Copy helpers
  const handleCopyBody = async () => {
    if (!response) return
    try {
      await navigator.clipboard.writeText(response.body)
      setCopiedBody(true)
      setTimeout(() => setCopiedBody(false), 2000)
    } catch (e) {
      console.warn('Copy body failed:', e)
    }
  }

  const handleCopyHeaders = async () => {
    if (!response) return
    try {
      const headerText = Object.entries(response.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
      await navigator.clipboard.writeText(headerText)
      setCopiedHeaders(true)
      setTimeout(() => setCopiedHeaders(false), 2000)
    } catch (e) {
      console.warn('Copy headers failed:', e)
    }
  }

  const handleCopyUrl = async () => {
    if (!response) return
    try {
      await navigator.clipboard.writeText(response.requestUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch (e) {
      console.warn('Copy URL failed:', e)
    }
  }

  const handleDownloadBody = () => {
    if (!response) return
    const blob = new Blob([response.body], {
      type: response.isJson ? 'application/json' : 'text/plain',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = response.isJson ? 'response.json' : 'response.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Status badge styling
  const getStatusStyle = (status: number, isNetworkError?: boolean) => {
    if (isNetworkError) {
      return {
        badge: 'bg-rose-950/40 text-rose-400 border border-rose-800/50',
        label: 'Network Failure',
      }
    }
    if (status >= 200 && status < 300) {
      return {
        badge: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50',
        label: 'Success (2xx)',
      }
    }
    if (status >= 300 && status < 400) {
      return {
        badge: 'bg-blue-950/40 text-blue-400 border border-blue-800/50',
        label: 'Redirection (3xx)',
      }
    }
    if (status >= 400 && status < 500) {
      return {
        badge: 'bg-amber-950/40 text-amber-400 border border-amber-800/50',
        label: 'Client Error (4xx)',
      }
    }
    if (status >= 500) {
      return {
        badge: 'bg-rose-950/40 text-rose-400 border border-rose-800/50',
        label: 'Server Error (5xx)',
      }
    }
    return {
      badge: 'bg-gray-800 text-gray-400 border border-gray-700',
      label: 'Unknown',
    }
  }

  // Count search occurrences in text
  const getSearchMatchCount = (text: string, query: string): number => {
    if (!query.trim()) return 0
    try {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matches = text.match(regex)
      return matches ? matches.length : 0
    } catch {
      return 0
    }
  }

  // 1. Sending State
  if (isSending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-400">
        <div className="relative mb-4 flex h-12 w-12 items-center justify-center">
          <div className="absolute h-full w-full animate-ping rounded-full bg-emerald-500/20" />
          <Clock className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-200">Executing HTTP Request...</h3>
        <p className="mt-1 text-xs text-gray-400">
          Elapsed time: <span className="font-mono text-emerald-400">{Math.round(elapsedMs)} ms</span>
        </p>
        <p className="mt-3 text-[11px] text-gray-500">
          You can click Cancel at any time in the request bar.
        </p>
      </div>
    )
  }

  // 2. Empty Initial State
  if (!response) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-400">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800/60 border border-gray-700/50 text-gray-400">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-200 html-light:text-gray-800">
          No Response Yet
        </h3>
        <p className="mt-1 max-w-sm text-xs text-gray-400 leading-relaxed">
          Configure your request method, target URL, and headers above, then click <strong>Send</strong>.
        </p>
        {onLoadRecipeSample && (
          <button
            type="button"
            onClick={onLoadRecipeSample}
            className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            Load Sample Recipe (GET Users)
          </button>
        )}
      </div>
    )
  }

  const statusInfo = getStatusStyle(response.status, response.networkError)
  const prettyJsonString = response.isJson
    ? JSON.stringify(response.jsonParsed, null, 2)
    : response.body

  const searchCount = searchQuery
    ? getSearchMatchCount(activeTab === 'pretty' ? prettyJsonString : response.body, searchQuery)
    : 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#0d1117] text-gray-200 html-light:bg-white html-light:text-gray-900">
      {/* Top Response Summary Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-800 bg-[#161b22] px-4 py-2.5 gap-2 html-light:border-gray-200 html-light:bg-gray-50">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Badge */}
          <div
            className={`flex items-center space-x-1.5 rounded-md px-2.5 py-1 text-xs font-mono font-bold ${statusInfo.badge}`}
          >
            <span>{response.status ? `${response.status} ${response.statusText}` : response.statusText}</span>
          </div>

          {/* Client Duration */}
          <div
            className="flex items-center space-x-1 rounded bg-gray-800/70 px-2 py-1 text-xs text-gray-300 html-light:bg-gray-200 html-light:text-gray-700"
            title="Total client-observed duration from dispatch to completion"
          >
            <Clock className="h-3 w-3 text-emerald-400" />
            <span className="font-mono">{response.clientDurationMs} ms</span>
            {response.upstreamDurationMs !== undefined && (
              <span className="text-[10px] text-gray-500">
                (upstream: {response.upstreamDurationMs}ms)
              </span>
            )}
          </div>

          {/* Response Size */}
          <div
            className="flex items-center space-x-1 rounded bg-gray-800/70 px-2 py-1 text-xs text-gray-300 html-light:bg-gray-200 html-light:text-gray-700"
            title="Total payload size"
          >
            <HardDrive className="h-3 w-3 text-blue-400" />
            <span className="font-mono">{formatBytes(response.sizeBytes)}</span>
          </div>

          {/* Content Type */}
          {response.contentType && (
            <div
              className="hidden sm:flex items-center space-x-1 rounded bg-gray-800/70 px-2 py-1 text-[11px] text-gray-400 truncate max-w-[200px] html-light:bg-gray-200 html-light:text-gray-600"
              title={response.contentType}
            >
              <span className="truncate">{response.contentType}</span>
            </div>
          )}
        </div>

        {/* Action Buttons: Copy, Download, URL */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleCopyBody}
            title="Copy response body"
            className="flex items-center space-x-1 rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white html-light:border-gray-300 html-light:bg-white html-light:text-gray-800"
          >
            {copiedBody ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copiedBody ? 'Copied' : 'Body'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyHeaders}
            title="Copy response headers"
            className="flex items-center space-x-1 rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white html-light:border-gray-300 html-light:bg-white html-light:text-gray-800"
          >
            {copiedHeaders ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copiedHeaders ? 'Copied' : 'Headers'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyUrl}
            title="Copy requested URL"
            className="flex items-center space-x-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white html-light:border-gray-300 html-light:bg-white html-light:text-gray-800"
          >
            {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <ExternalLink className="h-3 w-3" />}
            <span className="hidden md:inline">URL</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBody}
            title="Download response body file"
            className="flex items-center space-x-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white html-light:border-gray-300 html-light:bg-white html-light:text-gray-800"
          >
            <Download className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Network Error / CORS Alert Banner */}
      {response.networkError && (
        <div className="border-b border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300">
          <div className="flex items-start space-x-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">{response.error || 'Network request failed.'}</p>
              <p className="text-[11px] text-rose-400/90 leading-relaxed">
                If the destination server does not allow Cross-Origin Resource Sharing (CORS), browsers block direct fetch requests.
              </p>
              {onSwitchToProxy && (
                <button
                  type="button"
                  onClick={onSwitchToProxy}
                  className="mt-2 inline-flex items-center space-x-1 rounded bg-rose-600/30 px-2.5 py-1 text-xs font-medium text-rose-200 border border-rose-500/40 hover:bg-rose-600/50"
                >
                  <span>Switch to Proxy Mode</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Truncated notice */}
      {response.isTruncated && (
        <div className="border-b border-amber-900/50 bg-amber-950/20 px-4 py-2 text-xs text-amber-300 flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            Response body exceeded 5MB and was truncated to prevent browser memory exhaustion.
          </span>
        </div>
      )}

      {/* Response Navigation Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-800 bg-[#0d1117] px-4 py-1.5 html-light:border-gray-200 html-light:bg-white">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('pretty')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'pretty'
                ? 'bg-gray-800 text-white html-light:bg-gray-200 html-light:text-gray-900'
                : 'text-gray-400 hover:text-gray-200 html-light:text-gray-600 html-light:hover:text-gray-900'
            }`}
          >
            Pretty
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'raw'
                ? 'bg-gray-800 text-white html-light:bg-gray-200 html-light:text-gray-900'
                : 'text-gray-400 hover:text-gray-200 html-light:text-gray-600 html-light:hover:text-gray-900'
            }`}
          >
            Raw
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'headers'
                ? 'bg-gray-800 text-white html-light:bg-gray-200 html-light:text-gray-900'
                : 'text-gray-400 hover:text-gray-200 html-light:text-gray-600 html-light:hover:text-gray-900'
            }`}
          >
            Headers ({Object.keys(response.headers).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assertions')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors flex items-center space-x-1 ${
              activeTab === 'assertions'
                ? 'bg-gray-800 text-white html-light:bg-gray-200 html-light:text-gray-900'
                : 'text-gray-400 hover:text-gray-200 html-light:text-gray-600 html-light:hover:text-gray-900'
            }`}
          >
            <span>Assertions</span>
            {assertionResults.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  assertionResults.every((a) => a.passed)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {assertionResults.filter((a) => a.passed).length}/{assertionResults.length}
              </span>
            )}
          </button>
        </div>

        {/* Search within response */}
        {(activeTab === 'pretty' || activeTab === 'raw') && (
          <div className="relative flex items-center mt-1 sm:mt-0">
            <Search className="absolute left-2 h-3.5 w-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search response..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 sm:w-48 rounded border border-gray-700 bg-gray-900 pl-7 pr-12 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-gray-50 html-light:text-gray-900"
            />
            {searchQuery && (
              <span className="absolute right-2 text-[10px] text-gray-400 font-mono">
                {searchCount} {searchCount === 1 ? 'match' : 'matches'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Response Tab Content */}
      <div className="flex-1 overflow-auto p-4 text-xs font-mono">
        {/* PRETTY TAB */}
        {activeTab === 'pretty' && (
          <div>
            {response.status === 204 || (!response.body.trim() && !response.networkError) ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                204 No Content (Empty response body)
              </div>
            ) : response.isJson ? (
              <pre className="text-gray-200 leading-relaxed whitespace-pre-wrap select-all">
                {prettyJsonString}
              </pre>
            ) : (
              <div>
                {response.contentType?.includes('json') && (
                  <div className="mb-2 rounded border border-amber-800/40 bg-amber-950/20 p-2 text-[11px] text-amber-300 font-sans">
                    Warning: Response Content-Type declared JSON, but content failed JSON parsing. Displaying raw text.
                  </div>
                )}
                <pre className="text-gray-200 leading-relaxed whitespace-pre-wrap select-all">
                  {response.body}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* RAW TAB */}
        {activeTab === 'raw' && (
          <pre className="text-gray-200 leading-relaxed whitespace-pre-wrap select-all">
            {response.body || '(empty response body)'}
          </pre>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-2 font-sans">
            {Object.keys(response.headers).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No response headers available.
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-800 html-light:border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161b22] text-gray-400 border-b border-gray-800 html-light:bg-gray-100 html-light:border-gray-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold w-1/3">Header Name</th>
                      <th className="py-2 px-3 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-mono text-xs html-light:divide-gray-200">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <tr key={k} className="hover:bg-gray-800/20 html-light:hover:bg-gray-50">
                        <td className="py-1.5 px-3 font-semibold text-emerald-400 break-all">{k}</td>
                        <td className="py-1.5 px-3 text-gray-300 break-all html-light:text-gray-700">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ASSERTIONS TAB */}
        {activeTab === 'assertions' && (
          <div className="space-y-2 font-sans">
            {assertionResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No assertion rules were defined for this request. Add assertions in the Request Builder's "Assertions" tab.
              </div>
            ) : (
              <div className="space-y-2">
                {assertionResults.map((result) => (
                  <div
                    key={result.ruleId}
                    className={`flex items-start justify-between rounded-lg border p-3 text-xs transition-colors ${
                      result.status === 'pass'
                        ? 'border-emerald-800/40 bg-emerald-950/20 text-emerald-300'
                        : result.status === 'fail'
                        ? 'border-rose-800/40 bg-rose-950/20 text-rose-300'
                        : 'border-gray-800 bg-[#161b22] text-gray-400'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {result.status === 'pass' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      {result.status === 'fail' && (
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      {result.status === 'not_run' && (
                        <HelpCircle className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold">
                          {result.status === 'pass'
                            ? 'PASS'
                            : result.status === 'fail'
                            ? 'FAIL'
                            : 'NOT RUN'}{' '}
                          — {result.ruleType.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <p className="mt-0.5 text-[11px] opacity-90">{result.reason}</p>
                        {result.actualValue !== undefined && (
                          <p className="mt-1 font-mono text-[10px] opacity-75">
                            Actual: {String(result.actualValue)} | Expected: {String(result.expectedValue)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
