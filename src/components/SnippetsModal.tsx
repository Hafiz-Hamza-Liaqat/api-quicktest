import { useState, type FC } from 'react'
import { X, Copy, Check, Terminal, Shield } from 'lucide-react'
import type { EnvironmentVariable, RequestModel } from '../types'
import {
  generateCurlSnippet,
  generateFetchSnippet,
  generatePythonSnippet,
} from '../utils/snippets'

interface SnippetsModalProps {
  isOpen: boolean
  onClose: () => void
  request: RequestModel
  variables: EnvironmentVariable[]
}

export const SnippetsModal: FC<SnippetsModalProps> = ({
  isOpen,
  onClose,
  request,
  variables,
}) => {
  const [activeTab, setActiveTab] = useState<'curl' | 'fetch' | 'python'>('curl')
  const [includeSecrets, setIncludeSecrets] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  if (!isOpen) return null

  let snippetCode = ''
  if (activeTab === 'curl') {
    snippetCode = generateCurlSnippet(request, variables, { includeSecrets })
  } else if (activeTab === 'fetch') {
    snippetCode = generateFetchSnippet(request, variables, { includeSecrets })
  } else if (activeTab === 'python') {
    snippetCode = generatePythonSnippet(request, variables, { includeSecrets })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippetCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.warn('Clipboard write failed:', e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex h-[85vh] max-h-[600px] w-full max-w-3xl flex-col rounded-xl border border-gray-800 bg-[#161b22] text-gray-200 shadow-2xl html-light:border-gray-300 html-light:bg-white html-light:text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4 html-light:border-gray-200">
          <div className="flex items-center space-x-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-white html-light:text-gray-900">
                Code Snippets
              </h2>
              <p className="text-xs text-gray-400">
                Ready-to-run code snippets for {request.method} {request.url || 'request'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white html-light:hover:bg-gray-100 html-light:hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector & Secret toggle */}
        <div className="flex flex-wrap items-center justify-between border-b border-gray-800 bg-[#0d1117] px-5 py-2.5 html-light:border-gray-200 html-light:bg-gray-50">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('curl')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'curl'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 html-light:text-gray-600 html-light:hover:text-gray-900'
              }`}
            >
              cURL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fetch')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'fetch'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 html-light:text-gray-600 html-light:hover:text-gray-900'
              }`}
            >
              JavaScript (fetch)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'python'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 html-light:text-gray-600 html-light:hover:text-gray-900'
              }`}
            >
              Python (requests)
            </button>
          </div>

          <div className="flex items-center space-x-2 pt-2 sm:pt-0">
            <label className="flex items-center space-x-1.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSecrets}
                onChange={(e) => setIncludeSecrets(e.target.checked)}
                className="rounded border-gray-700 text-amber-500 focus:ring-0"
              />
              <span className="text-[11px]">Include secrets in snippet</span>
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center space-x-1 rounded px-3 py-1 text-xs font-medium transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-200 hover:bg-gray-700 html-light:bg-gray-200 html-light:text-gray-800 html-light:hover:bg-gray-300'
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Snippet'}</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="relative flex-1 overflow-auto bg-[#0a0d12] p-4 text-xs font-mono html-light:bg-gray-900">
          <pre className="text-gray-200 whitespace-pre-wrap leading-relaxed select-all">
            {snippetCode}
          </pre>
        </div>

        {/* Footer Note */}
        <div className="flex items-center space-x-2 border-t border-gray-800 bg-[#161b22] px-5 py-3 text-xs text-gray-400 html-light:border-gray-200 html-light:bg-white">
          <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            {activeTab === 'fetch'
              ? 'Browser CORS Note: JavaScript fetch() is restricted by target API CORS headers when run in a browser environment.'
              : 'Credentials are masked by default. Always review snippets before sharing with colleagues.'}
          </span>
        </div>
      </div>
    </div>
  )
}
