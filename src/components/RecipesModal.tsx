import type { FC } from 'react'
import { X, BookOpen, ArrowRight } from 'lucide-react'
import { API_RECIPES } from '../data/recipes'
import type { RecipeItem } from '../types'

interface RecipesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectRecipe: (recipe: RecipeItem) => void
}

export const RecipesModal: FC<RecipesModalProps> = ({
  isOpen,
  onClose,
  onSelectRecipe,
}) => {
  if (!isOpen) return null

  const categories = Array.from(new Set(API_RECIPES.map((r) => r.category)))

  const getMethodBadgeClass = (method?: string) => {
    switch (method?.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'POST':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'PUT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'PATCH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex h-[88vh] max-h-[640px] w-full max-w-3xl flex-col rounded-xl border border-gray-800 bg-[#161b22] text-gray-200 shadow-2xl html-light:border-gray-300 html-light:bg-white html-light:text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4 html-light:border-gray-200">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-white html-light:text-gray-900">
                API Recipes & Quick Start
              </h2>
              <p className="text-xs text-gray-400">
                Learn common REST patterns, response inspection, and automated response assertions
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {cat}
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {API_RECIPES.filter((r) => r.category === cat).map((recipe) => (
                  <div
                    key={recipe.id}
                    data-recipe-id={recipe.id}
                    className="flex flex-col justify-between rounded-lg border border-gray-800 bg-[#0d1117] p-3 transition-colors hover:border-gray-700 hover:bg-gray-900/60 html-light:border-gray-200 html-light:bg-gray-50 html-light:hover:border-gray-300"
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${getMethodBadgeClass(
                            recipe.request.method
                          )}`}
                        >
                          {recipe.request.method}
                        </span>
                        <span className="text-xs font-medium text-white truncate html-light:text-gray-900">
                          {recipe.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                        {recipe.description}
                      </p>
                      <div className="font-mono text-[10px] text-gray-500 truncate mb-3">
                        {recipe.request.url}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectRecipe(recipe)
                        onClose()
                      }}
                      className="flex items-center justify-center space-x-1 rounded bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-colors"
                    >
                      <span>Load into Builder</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
