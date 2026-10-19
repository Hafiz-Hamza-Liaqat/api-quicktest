import type { CollectionItem, EnvironmentProfile, HistoryItem, RequestModel } from '../types'
import { sanitizeCollectionsForExport, sanitizeRequestForHistory } from './redact'

const STORAGE_KEYS = {
  HISTORY: 'api_quicktest_v1_history',
  COLLECTIONS: 'api_quicktest_v1_collections',
  ENVIRONMENTS: 'api_quicktest_v1_environments',
  ACTIVE_ENV: 'api_quicktest_v1_active_env',
  THEME: 'api_quicktest_v1_theme',
  REQUEST_MODE: 'api_quicktest_v1_request_mode',
}

export const DEFAULT_ENVIRONMENTS: EnvironmentProfile[] = [
  {
    id: 'env_dev',
    name: 'Development',
    variables: [
      { id: 'v1', key: 'baseUrl', value: 'http://localhost:3001', isSecret: false, enabled: true },
      { id: 'v2', key: 'userId', value: '1', isSecret: false, enabled: true },
    ],
  },
  {
    id: 'env_staging',
    name: 'Staging',
    variables: [
      { id: 'v3', key: 'baseUrl', value: 'https://staging.api.example.com', isSecret: false, enabled: true },
      { id: 'v4', key: 'apiKey', value: 'stg_test_key_123', isSecret: true, enabled: true },
    ],
  },
  {
    id: 'env_prod',
    name: 'Production',
    variables: [
      { id: 'v5', key: 'baseUrl', value: 'https://api.example.com', isSecret: false, enabled: true },
    ],
  },
]

export const DEFAULT_COLLECTIONS: CollectionItem[] = [
  {
    id: 'col_sample',
    name: 'Quick Samples',
    description: 'Ready-to-use sample requests to test API QuickTest',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    requests: [
      {
        id: 'req_sample_1',
        name: 'List Users (GET)',
        method: 'GET',
        url: '{{baseUrl}}/api/test/users',
        queryParams: [{ id: 'p1', key: 'limit', value: '5', enabled: true }],
        headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
        body: { type: 'none', rawText: '' },
        auth: { type: 'none' },
        assertions: [
          { id: 'a1', type: 'status_code_equals', expectedValue: '200', enabled: true },
          { id: 'a2', type: 'response_time_less_than', expectedValue: '1000', enabled: true },
        ],
        timeoutMs: 30000,
        requestMode: 'direct',
      },
      {
        id: 'req_sample_2',
        name: 'Create User (POST)',
        method: 'POST',
        url: '{{baseUrl}}/api/test/users',
        queryParams: [],
        headers: [
          { id: 'h2', key: 'Content-Type', value: 'application/json', enabled: true },
          { id: 'h3', key: 'Accept', value: 'application/json', enabled: true },
        ],
        body: {
          type: 'json',
          rawText: JSON.stringify({ name: 'Ada Lovelace', role: 'Engineer' }, null, 2),
          contentType: 'application/json',
        },
        auth: { type: 'none' },
        assertions: [
          { id: 'a3', type: 'status_code_equals', expectedValue: '201', enabled: true },
          { id: 'a4', type: 'json_path_exists', path: 'id', enabled: true },
        ],
        timeoutMs: 30000,
        requestMode: 'direct',
      },
    ],
  },
]

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.warn(`Failed to persist to localStorage [${key}]:`, e)
  }
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = safeGetItem(STORAGE_KEYS.HISTORY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(history: HistoryItem[]): void {
  const bounded = history.slice(0, 50)
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(bounded))
}

export function addHistoryItem(
  request: RequestModel,
  status?: number,
  durationMs?: number,
  networkError?: boolean
): HistoryItem[] {
  const current = loadHistory()
  const sanitizedConfig = sanitizeRequestForHistory(request)
  const newItem: HistoryItem = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    method: request.method,
    url: request.url,
    status,
    durationMs,
    networkError,
    requestConfig: sanitizedConfig,
  }
  const updated = [newItem, ...current].slice(0, 50)
  saveHistory(updated)
  return updated
}

export function clearHistory(): void {
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify([]))
}

export function loadCollections(): CollectionItem[] {
  try {
    const raw = safeGetItem(STORAGE_KEYS.COLLECTIONS)
    if (!raw) return DEFAULT_COLLECTIONS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : DEFAULT_COLLECTIONS
  } catch {
    return DEFAULT_COLLECTIONS
  }
}

export function saveCollections(collections: CollectionItem[]): void {
  safeSetItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections))
}

export function loadEnvironments(): EnvironmentProfile[] {
  try {
    const raw = safeGetItem(STORAGE_KEYS.ENVIRONMENTS)
    if (!raw) return DEFAULT_ENVIRONMENTS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ENVIRONMENTS
  } catch {
    return DEFAULT_ENVIRONMENTS
  }
}

export function saveEnvironments(environments: EnvironmentProfile[]): void {
  safeSetItem(STORAGE_KEYS.ENVIRONMENTS, JSON.stringify(environments))
}

export function loadActiveEnvId(): string {
  return safeGetItem(STORAGE_KEYS.ACTIVE_ENV) || 'env_dev'
}

export function saveActiveEnvId(id: string): void {
  safeSetItem(STORAGE_KEYS.ACTIVE_ENV, id)
}

export function loadTheme(): 'dark' | 'light' {
  const t = safeGetItem(STORAGE_KEYS.THEME)
  return t === 'light' ? 'light' : 'dark'
}

export function saveTheme(theme: 'dark' | 'light'): void {
  safeSetItem(STORAGE_KEYS.THEME, theme)
}

export function exportCollectionsJson(collections: CollectionItem[]): string {
  const sanitized = sanitizeCollectionsForExport(collections)
  return JSON.stringify(
    {
      format: 'api-quicktest-collections',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      collections: sanitized,
    },
    null,
    2
  )
}

export function validateAndImportCollections(
  jsonText: string
): { success: boolean; collections?: CollectionItem[]; error?: string } {
  try {
    const data = JSON.parse(jsonText)
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Import data must be a valid JSON object.' }
    }

    let collectionsArray: any[] = []

    if (Array.isArray(data)) {
      collectionsArray = data
    } else if (Array.isArray(data.collections)) {
      collectionsArray = data.collections
    } else {
      return {
        success: false,
        error: 'JSON must contain a "collections" array or be an array of collections.',
      }
    }

    const validated: CollectionItem[] = []
    for (const c of collectionsArray) {
      if (!c.name || typeof c.name !== 'string') {
        return { success: false, error: 'Each collection must have a "name" string.' }
      }

      const reqs: RequestModel[] = []
      if (Array.isArray(c.requests)) {
        for (const r of c.requests) {
          if (!r.method || !r.url) continue
          reqs.push({
            id: r.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: r.name || `${r.method} ${r.url}`,
            method: r.method,
            url: r.url,
            queryParams: Array.isArray(r.queryParams) ? r.queryParams : [],
            headers: Array.isArray(r.headers) ? r.headers : [],
            body: r.body || { type: 'none', rawText: '' },
            auth: r.auth || { type: 'none' },
            assertions: Array.isArray(r.assertions) ? r.assertions : [],
            timeoutMs: typeof r.timeoutMs === 'number' ? r.timeoutMs : 30000,
            requestMode: r.requestMode || 'direct',
          })
        }
      }

      validated.push({
        id: c.id || `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: c.name,
        description: c.description || '',
        createdAt: c.createdAt || Date.now(),
        updatedAt: Date.now(),
        requests: reqs,
      })
    }

    if (validated.length === 0) {
      return { success: false, error: 'No valid collections found in the file.' }
    }

    return { success: true, collections: validated }
  } catch (err: any) {
    return { success: false, error: `Invalid JSON syntax: ${err.message}` }
  }
}
