import { useState, useRef, type FC } from 'react'
import {
  History,
  Folder,
  Trash2,
  Play,
  Download,
  Upload,
  Plus,
  ChevronRight,
  ChevronDown,
  Copy,
  Edit2,
  Check,
  X,
  Clock,
  FolderOpen,
} from 'lucide-react'
import type { CollectionItem, HistoryItem, HttpMethod, RequestModel } from '../types'

interface SidebarProps {
  isOpen: boolean
  onCloseMobile: () => void
  history: HistoryItem[]
  onSelectHistoryItem: (item: HistoryItem) => void
  onRerunHistoryItem: (item: HistoryItem) => void
  onClearHistory: () => void
  collections: CollectionItem[]
  onSelectCollectionRequest: (req: RequestModel) => void
  onCreateCollection: (name: string) => void
  onRenameCollection: (id: string, name: string) => void
  onDeleteCollection: (id: string) => void
  onDeleteCollectionRequest: (collectionId: string, requestId: string) => void
  onDuplicateCollectionRequest: (collectionId: string, req: RequestModel) => void
  onExportCollections: () => void
  onImportCollections: (jsonText: string) => void
}

export const Sidebar: FC<SidebarProps> = ({
  isOpen,
  onCloseMobile,
  history,
  onSelectHistoryItem,
  onRerunHistoryItem,
  onClearHistory,
  collections,
  onSelectCollectionRequest,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onDeleteCollectionRequest,
  onDuplicateCollectionRequest,
  onExportCollections,
  onImportCollections,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'collections'>('history')
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({
    [collections[0]?.id || '']: true,
  })
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>('')
  const [newCollectionName, setNewCollectionName] = useState<string>('')
  const [isCreatingCollection, setIsCreatingCollection] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleStartRename = (col: CollectionItem) => {
    setEditingCollectionId(col.id)
    setEditingName(col.name)
  }

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      onRenameCollection(id, editingName.trim())
    }
    setEditingCollectionId(null)
  }

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim())
      setNewCollectionName('')
      setIsCreatingCollection(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        onImportCollections(content)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getMethodColor = (method: HttpMethod) => {
    switch (method) {
      case 'GET':
        return 'text-emerald-400'
      case 'POST':
        return 'text-blue-400'
      case 'PUT':
        return 'text-amber-400'
      case 'PATCH':
        return 'text-orange-400'
      case 'DELETE':
        return 'text-rose-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStatusBadge = (status?: number, networkError?: boolean) => {
    if (networkError) {
      return <span className="text-[10px] text-rose-400 font-mono">Err</span>
    }
    if (!status) return null
    if (status >= 200 && status < 300) {
      return <span className="text-[10px] text-emerald-400 font-mono">{status}</span>
    }
    if (status >= 300 && status < 400) {
      return <span className="text-[10px] text-blue-400 font-mono">{status}</span>
    }
    if (status >= 400 && status < 500) {
      return <span className="text-[10px] text-amber-400 font-mono">{status}</span>
    }
    return <span className="text-[10px] text-rose-400 font-mono">{status}</span>
  }

  if (!isOpen) return null

  return (
    <aside className="fixed inset-y-14 left-0 z-30 flex w-72 flex-col border-r border-gray-800 bg-[#0d1117] text-gray-200 transition-all md:static md:w-64 lg:w-72 html-light:border-gray-200 html-light:bg-white html-light:text-gray-800">
      {/* Tab Switcher */}
      <div className="flex border-b border-gray-800 bg-[#161b22] p-1.5 html-light:border-gray-200 html-light:bg-gray-50">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex flex-1 items-center justify-center space-x-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-gray-800 text-white shadow-xs html-light:bg-white html-light:text-gray-900'
              : 'text-gray-400 hover:text-gray-200 html-light:hover:text-gray-900'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>History</span>
          <span className="rounded-full bg-gray-700/60 px-1.5 py-0.2 text-[10px] text-gray-300">
            {history.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={`flex flex-1 items-center justify-center space-x-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'collections'
              ? 'bg-gray-800 text-white shadow-xs html-light:bg-white html-light:text-gray-900'
              : 'text-gray-400 hover:text-gray-200 html-light:hover:text-gray-900'
          }`}
        >
          <Folder className="h-3.5 w-3.5" />
          <span>Collections</span>
          <span className="rounded-full bg-gray-700/60 px-1.5 py-0.2 text-[10px] text-gray-300">
            {collections.length}
          </span>
        </button>
      </div>

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-800/80 px-3 py-2 text-xs text-gray-400 html-light:border-gray-200">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Recent Requests</span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                title="Clear all history items"
                className="flex items-center space-x-1 text-[11px] text-gray-400 hover:text-rose-400"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {history.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">
                <Clock className="mx-auto mb-2 h-6 w-6 text-gray-600" />
                No request history yet. Send a request to see it here.
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between rounded-md p-2 text-xs hover:bg-gray-800/60 html-light:hover:bg-gray-100 transition-colors"
                >
                  <div
                    onClick={() => {
                      onSelectHistoryItem(item)
                      onCloseMobile()
                    }}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className={`font-mono text-[11px] font-bold ${getMethodColor(item.method)}`}>
                        {item.method}
                      </span>
                      {getStatusBadge(item.status, item.networkError)}
                      <span className="text-[10px] text-gray-500">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[11px] text-gray-300 html-light:text-gray-700">
                      {item.url}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRerunHistoryItem(item)
                    }}
                    title="Rerun request immediately"
                    className="ml-1 opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Collections Tab Content */}
      {activeTab === 'collections' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Action bar: New collection, Import, Export */}
          <div className="flex items-center justify-between border-b border-gray-800/80 px-3 py-2 text-xs text-gray-400 html-light:border-gray-200">
            <button
              type="button"
              onClick={() => setIsCreatingCollection(true)}
              className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>

            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Import collections from JSON file"
                className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
              >
                <Upload className="h-3 w-3" />
                <span>Import</span>
              </button>
              <button
                type="button"
                onClick={onExportCollections}
                title="Export collections to JSON file (secrets stripped)"
                className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
              >
                <Download className="h-3 w-3" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* New collection input */}
          {isCreatingCollection && (
            <div className="border-b border-gray-800 bg-[#161b22] p-2 flex items-center space-x-1.5 html-light:border-gray-200 html-light:bg-gray-50">
              <input
                type="text"
                autoFocus
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name"
                className="flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCollection()
                  if (e.key === 'Escape') setIsCreatingCollection(false)
                }}
              />
              <button
                type="button"
                onClick={handleCreateCollection}
                className="text-emerald-400 hover:text-emerald-300 p-1"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingCollection(false)}
                className="text-gray-500 hover:text-gray-400 p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Collections List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {collections.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">
                <FolderOpen className="mx-auto mb-2 h-6 w-6 text-gray-600" />
                No collections yet. Click "New" to create one.
              </div>
            ) : (
              collections.map((col) => {
                const isExpanded = !!expandedCollections[col.id]
                const isEditing = editingCollectionId === col.id

                return (
                  <div
                    key={col.id}
                    className="rounded-md border border-gray-800/80 bg-[#161b22]/50 html-light:border-gray-200 html-light:bg-gray-50/50"
                  >
                    {/* Collection Header */}
                    <div className="group flex items-center justify-between px-2 py-1.5 text-xs">
                      {isEditing ? (
                        <div className="flex flex-1 items-center space-x-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 text-xs text-gray-100 html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(col.id)
                              if (e.key === 'Escape') setEditingCollectionId(null)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(col.id)}
                            className="text-emerald-400"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCollection(col.id)}
                          className="flex flex-1 items-center space-x-1.5 truncate text-left text-gray-200 hover:text-white html-light:text-gray-800"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          )}
                          <span className="truncate font-medium">{col.name}</span>
                          <span className="text-[10px] text-gray-500">({col.requests.length})</span>
                        </button>
                      )}

                      {!isEditing && (
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleStartRename(col)}
                            title="Rename collection"
                            className="p-1 text-gray-400 hover:text-gray-200"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCollection(col.id)}
                            title="Delete collection"
                            className="p-1 text-gray-400 hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Collection Requests */}
                    {isExpanded && (
                      <div className="border-t border-gray-800/60 p-1 space-y-0.5 html-light:border-gray-200">
                        {col.requests.length === 0 ? (
                          <div className="py-2 text-center text-[11px] text-gray-500">
                            Empty collection
                          </div>
                        ) : (
                          col.requests.map((req) => (
                            <div
                              key={req.id}
                              className="group flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-800/60 html-light:hover:bg-gray-200"
                            >
                              <div
                                onClick={() => {
                                  onSelectCollectionRequest(req)
                                  onCloseMobile()
                                }}
                                className="flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="flex items-center space-x-1.5">
                                  <span
                                    className={`font-mono text-[10px] font-bold ${getMethodColor(
                                      req.method
                                    )}`}
                                  >
                                    {req.method}
                                  </span>
                                  <span className="truncate text-gray-300 html-light:text-gray-700">
                                    {req.name || req.url}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => onDuplicateCollectionRequest(col.id, req)}
                                  title="Duplicate request"
                                  className="p-0.5 text-gray-400 hover:text-gray-200"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteCollectionRequest(col.id, req.id)}
                                  title="Delete request"
                                  className="p-0.5 text-gray-400 hover:text-rose-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
