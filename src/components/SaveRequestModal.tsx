import { useState, type FC } from 'react'
import { X, FolderPlus, ShieldCheck } from 'lucide-react'
import type { CollectionItem, RequestModel } from '../types'

interface SaveRequestModalProps {
  isOpen: boolean
  onClose: () => void
  request: RequestModel
  collections: CollectionItem[]
  onSaveToCollection: (collectionId: string, requestName: string) => void
  onCreateAndSaveToCollection: (newCollectionName: string, requestName: string) => void
}

export const SaveRequestModal: FC<SaveRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  collections,
  onSaveToCollection,
  onCreateAndSaveToCollection,
}) => {
  const [requestName, setRequestName] = useState<string>(request.name || `${request.method} ${request.url}`)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    collections[0]?.id || 'new'
  )
  const [newCollectionName, setNewCollectionName] = useState<string>('')

  if (!isOpen) return null

  const handleSave = () => {
    if (!requestName.trim()) return

    if (selectedCollectionId === 'new') {
      if (!newCollectionName.trim()) return
      onCreateAndSaveToCollection(newCollectionName.trim(), requestName.trim())
    } else {
      onSaveToCollection(selectedCollectionId, requestName.trim())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#161b22] text-gray-200 shadow-2xl html-light:border-gray-300 html-light:bg-white html-light:text-gray-900">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4 html-light:border-gray-200">
          <div className="flex items-center space-x-2">
            <FolderPlus className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white html-light:text-gray-900">
              Save to Collection
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white html-light:hover:bg-gray-100 html-light:hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400">Request Name</label>
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="e.g. Get User Profile"
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">Collection</label>
            <select
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
            >
              {collections.map((col) => (
                <option key={col.id} value={col.id} className="bg-gray-900 html-light:bg-white">
                  {col.name}
                </option>
              ))}
              <option value="new" className="bg-gray-900 font-semibold text-emerald-400 html-light:bg-white">
                + Create New Collection...
              </option>
            </select>
          </div>

          {selectedCollectionId === 'new' && (
            <div>
              <label className="block text-xs font-medium text-gray-400">New Collection Name</label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g. Auth Service"
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
              />
            </div>
          )}

          <div className="flex items-start space-x-2 rounded-lg border border-gray-800 bg-[#0d1117] p-2.5 text-xs text-gray-400 html-light:border-gray-200 html-light:bg-gray-50">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <strong>Safe Storage:</strong> Tokens, passwords, and private API keys are automatically stripped before saving to keep your collections clean and shareable.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 border-t border-gray-800 px-5 py-3 html-light:border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!requestName.trim() || (selectedCollectionId === 'new' && !newCollectionName.trim())}
            className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Save Request
          </button>
        </div>
      </div>
    </div>
  )
}
