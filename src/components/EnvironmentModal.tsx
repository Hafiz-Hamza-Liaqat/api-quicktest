import { useState, type FC } from 'react'
import { X, Plus, Trash2, Copy, Eye, EyeOff, ShieldAlert, Check } from 'lucide-react'
import type { EnvironmentProfile, EnvironmentVariable } from '../types'

interface EnvironmentModalProps {
  isOpen: boolean
  onClose: () => void
  environments: EnvironmentProfile[]
  activeEnvId: string
  onSaveEnvironments: (envs: EnvironmentProfile[], activeId: string) => void
}

export const EnvironmentModal: FC<EnvironmentModalProps> = ({
  isOpen,
  onClose,
  environments,
  activeEnvId,
  onSaveEnvironments,
}) => {
  const [profiles, setProfiles] = useState<EnvironmentProfile[]>(environments)
  const [selectedId, setSelectedId] = useState<string>(activeEnvId)
  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({})

  if (!isOpen) return null

  const currentProfile = profiles.find((p) => p.id === selectedId) || profiles[0]

  const handleUpdateProfileName = (newName: string) => {
    setProfiles(
      profiles.map((p) => (p.id === currentProfile.id ? { ...p, name: newName } : p))
    )
  }

  const handleAddVariable = () => {
    const newVar: EnvironmentVariable = {
      id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: '',
      value: '',
      isSecret: false,
      enabled: true,
    }
    setProfiles(
      profiles.map((p) =>
        p.id === currentProfile.id ? { ...p, variables: [...p.variables, newVar] } : p
      )
    )
  }

  const handleUpdateVariable = (varId: string, updates: Partial<EnvironmentVariable>) => {
    setProfiles(
      profiles.map((p) => {
        if (p.id !== currentProfile.id) return p
        return {
          ...p,
          variables: p.variables.map((v) => (v.id === varId ? { ...v, ...updates } : v)),
        }
      })
    )
  }

  const handleDeleteVariable = (varId: string) => {
    setProfiles(
      profiles.map((p) => {
        if (p.id !== currentProfile.id) return p
        return {
          ...p,
          variables: p.variables.filter((v) => v.id !== varId),
        }
      })
    )
  }

  const handleAddProfile = () => {
    const newProf: EnvironmentProfile = {
      id: `env_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: 'New Environment',
      variables: [
        {
          id: `v_${Date.now()}`,
          key: 'baseUrl',
          value: 'https://api.example.com',
          isSecret: false,
          enabled: true,
        },
      ],
    }
    setProfiles([...profiles, newProf])
    setSelectedId(newProf.id)
  }

  const handleDuplicateProfile = () => {
    const dup: EnvironmentProfile = {
      id: `env_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${currentProfile.name} (Copy)`,
      variables: currentProfile.variables.map((v) => ({
        ...v,
        id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      })),
    }
    setProfiles([...profiles, dup])
    setSelectedId(dup.id)
  }

  const handleDeleteProfile = (profId: string) => {
    if (profiles.length <= 1) {
      alert('You must keep at least one environment profile.')
      return
    }
    const filtered = profiles.filter((p) => p.id !== profId)
    setProfiles(filtered)
    if (selectedId === profId) {
      setSelectedId(filtered[0].id)
    }
  }

  const handleSaveAndClose = () => {
    onSaveEnvironments(profiles, selectedId)
    onClose()
  }

  const toggleShowSecret = (varId: string) => {
    setShowSecretMap((prev) => ({ ...prev, [varId]: !prev[varId] }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] max-h-[680px] w-full max-w-4xl flex-col rounded-xl border border-gray-800 bg-[#161b22] text-gray-200 shadow-2xl html-light:border-gray-300 html-light:bg-white html-light:text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4 html-light:border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-white html-light:text-gray-900">
              Environment Profiles
            </h2>
            <p className="text-xs text-gray-400">
              Define variables to substitute into URLs, headers, and request bodies using &#123;&#123;variableName&#125;&#125;
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white html-light:hover:bg-gray-100 html-light:hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Profiles list sidebar */}
          <div className="w-56 border-r border-gray-800 bg-[#0d1117] p-3 html-light:border-gray-200 html-light:bg-gray-50">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Profiles
              </span>
              <button
                type="button"
                onClick={handleAddProfile}
                title="Add new profile"
                className="flex items-center space-x-1 rounded px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-500/10"
              >
                <Plus className="h-3 w-3" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1 overflow-y-auto">
              {profiles.map((prof) => (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => setSelectedId(prof.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                    prof.id === currentProfile.id
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-medium'
                      : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 html-light:hover:bg-gray-200'
                  }`}
                >
                  <span className="truncate">{prof.name}</span>
                  {prof.id === selectedId && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Variables editor */}
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            {/* Profile name bar & actions */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-400">Profile Name</label>
                <input
                  type="text"
                  value={currentProfile.name}
                  onChange={(e) => handleUpdateProfileName(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                />
              </div>
              <div className="flex items-end space-x-2 pt-5">
                <button
                  type="button"
                  onClick={handleDuplicateProfile}
                  title="Duplicate this environment"
                  className="flex items-center space-x-1 rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Duplicate</span>
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(currentProfile.id)}
                    title="Delete this environment profile"
                    className="flex items-center space-x-1 rounded border border-red-800/40 bg-red-950/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>

            {/* Privacy Warning */}
            <div className="mb-4 flex items-start space-x-2 rounded-lg border border-amber-800/40 bg-amber-950/20 p-2.5 text-xs text-amber-300 html-light:border-amber-300 html-light:bg-amber-50 html-light:text-amber-900">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <strong>Privacy notice:</strong> Secret variables marked below are masked in the UI and stripped from exports and history. Browser localStorage is not secure vault storage.
              </span>
            </div>

            {/* Variables Table */}
            <div className="flex-1 overflow-x-auto">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 html-light:text-gray-700">
                  Variables ({currentProfile.variables.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="flex items-center space-x-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Variable</span>
                </button>
              </div>

              {currentProfile.variables.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center text-xs text-gray-500 html-light:border-gray-300">
                  No variables defined in this profile. Click "Add Variable" above.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 html-light:border-gray-200">
                      <th className="w-8 py-2 text-center">Active</th>
                      <th className="py-2">Variable Key</th>
                      <th className="py-2">Value</th>
                      <th className="w-16 py-2 text-center">Secret</th>
                      <th className="w-8 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 html-light:divide-gray-200">
                    {currentProfile.variables.map((variable) => {
                      const isMasked = variable.isSecret && !showSecretMap[variable.id]
                      return (
                        <tr key={variable.id} className="group hover:bg-gray-800/20 html-light:hover:bg-gray-50">
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={variable.enabled}
                              onChange={(e) =>
                                handleUpdateVariable(variable.id, { enabled: e.target.checked })
                              }
                              className="rounded border-gray-700 text-emerald-600 focus:ring-0"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={variable.key}
                              placeholder="e.g. baseUrl"
                              onChange={(e) =>
                                handleUpdateVariable(variable.id, { key: e.target.value })
                              }
                              className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <div className="relative flex items-center">
                              <input
                                type={isMasked ? 'password' : 'text'}
                                value={variable.value}
                                placeholder="Value"
                                onChange={(e) =>
                                  handleUpdateVariable(variable.id, { value: e.target.value })
                                }
                                className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 pr-7 font-mono text-xs text-gray-100 focus:border-emerald-500 focus:outline-none html-light:border-gray-300 html-light:bg-white html-light:text-gray-900"
                              />
                              {variable.isSecret && (
                                <button
                                  type="button"
                                  onClick={() => toggleShowSecret(variable.id)}
                                  className="absolute right-1.5 text-gray-400 hover:text-gray-200"
                                >
                                  {isMasked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={variable.isSecret}
                              title="Mask value in UI and redact from exports"
                              onChange={(e) =>
                                handleUpdateVariable(variable.id, { isSecret: e.target.checked })
                              }
                              className="rounded border-gray-700 text-amber-500 focus:ring-0"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteVariable(variable.id)}
                              className="text-gray-500 hover:text-red-400"
                              title="Delete variable"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
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
            onClick={handleSaveAndClose}
            className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  )
}
