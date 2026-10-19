import type { FC } from 'react'
import {
  Globe,
  Server,
  Layers,
  Code2,
  BookOpen,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react'
import type { EnvironmentProfile, RequestMode } from '../types'

interface HeaderProps {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  requestMode: RequestMode
  onToggleRequestMode: () => void
  activeEnv: EnvironmentProfile
  environments: EnvironmentProfile[]
  onSelectEnv: (envId: string) => void
  onOpenEnvModal: () => void
  onOpenSnippetsModal: () => void
  onOpenRecipes: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export const Header: FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  requestMode,
  onToggleRequestMode,
  activeEnv,
  environments,
  onSelectEnv,
  onOpenEnvModal,
  onOpenSnippetsModal,
  onOpenRecipes,
  sidebarOpen,
  onToggleSidebar,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-800 bg-[#0d1117] text-gray-200 transition-colors dark:border-gray-800 dark:bg-[#0d1117] html-light:border-gray-200 html-light:bg-white html-light:text-gray-800">
      <div className="flex h-14 items-center justify-between px-3 md:px-4">
        {/* Left: Sidebar toggle + Logo */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-700 html-light:hover:bg-gray-200"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white shadow-sm">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold tracking-tight text-white html-light:text-gray-900">
                  API QuickTest
                </span>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  v1.0
                </span>
              </div>
              <p className="hidden text-[10px] text-gray-400 sm:block">
                Send. Inspect. Understand.
              </p>
            </div>
          </div>
        </div>

        {/* Center/Right: Environment, Mode Toggle, Recipes, Snippets, Theme */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Environment Selector */}
          <div className="flex items-center rounded-md border border-gray-800 bg-gray-900/90 p-0.5 text-xs html-light:border-gray-300 html-light:bg-gray-50">
            <Layers className="ml-1.5 h-3.5 w-3.5 text-gray-400" />
            <select
              value={activeEnv.id}
              onChange={(e) => onSelectEnv(e.target.value)}
              aria-label="Active Environment"
              className="bg-transparent py-1 pl-1.5 pr-2 text-xs font-medium text-gray-200 focus:outline-none html-light:text-gray-800"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id} className="bg-gray-900 text-gray-200 html-light:bg-white html-light:text-gray-800">
                  {env.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenEnvModal}
              title="Manage environment profiles"
              className="rounded px-1.5 py-1 text-[11px] text-gray-400 hover:bg-gray-800 hover:text-white html-light:hover:bg-gray-200 html-light:hover:text-gray-900"
            >
              Edit
            </button>
          </div>

          {/* Request Mode Toggle (Direct Browser vs Proxy) */}
          <button
            type="button"
            onClick={onToggleRequestMode}
            title={
              requestMode === 'direct'
                ? 'Direct Mode: Requests sent directly from browser (subject to target CORS policy)'
                : 'Proxy Mode: Requests routed through Node.js proxy (bypasses browser CORS)'
            }
            className={`flex items-center space-x-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              requestMode === 'direct'
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                : 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
            }`}
          >
            {requestMode === 'direct' ? (
              <>
                <Globe className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Direct Mode</span>
                <span className="sm:hidden">Direct</span>
              </>
            ) : (
              <>
                <Server className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Proxy Mode</span>
                <span className="sm:hidden">Proxy</span>
              </>
            )}
          </button>

          {/* Recipes Button */}
          <button
            type="button"
            onClick={onOpenRecipes}
            title="View API Recipes & Workflow Examples"
            className="flex items-center space-x-1 rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-700 html-light:hover:bg-gray-200"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden md:inline">Recipes</span>
          </button>

          {/* Snippets Button */}
          <button
            type="button"
            onClick={onOpenSnippetsModal}
            title="Generate code snippets (cURL, fetch, Python)"
            className="flex items-center space-x-1 rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-700 html-light:hover:bg-gray-200"
          >
            <Code2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden md:inline">Snippets</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white html-light:border-gray-300 html-light:bg-gray-100 html-light:text-gray-700 html-light:hover:bg-gray-200"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  )
}
