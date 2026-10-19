import type { AuthConfig, EnvironmentVariable, KeyValuePair, RequestMode } from '../types'
import { resolveVariables } from './variables'

// Prohibited/forbidden request headers in browser Fetch standard (in direct browser mode)
export const BROWSER_FORBIDDEN_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
])

export const COMMON_HEADER_NAMES = [
  'Accept',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'User-Agent',
  'X-API-Key',
  'X-Requested-With',
  'X-Custom-Header',
]

export const COMMON_CONTENT_TYPES = [
  'application/json',
  'text/plain',
  'application/x-www-form-urlencoded',
  'text/html',
  'application/xml',
]

/**
 * Checks if a header name is prohibited by browser fetch specification in direct browser mode.
 */
export function isBrowserForbiddenHeader(headerName: string): boolean {
  const normalized = headerName.trim().toLowerCase()
  if (BROWSER_FORBIDDEN_HEADERS.has(normalized)) return true
  if (normalized.startsWith('sec-') || normalized.startsWith('proxy-')) return true
  return false
}

/**
 * Validates header name format (RFC 7230 token characters)
 */
export function isValidHeaderName(name: string): boolean {
  if (!name.trim()) return false
  return /^[a-zA-Z0-9!#$%&'*+-.^_`|~]+$/.test(name.trim())
}

/**
 * Builds the final headers record for execution, incorporating auth configuration and variable resolution.
 */
export function buildFinalHeaders(
  headerPairs: KeyValuePair[],
  auth: AuthConfig,
  variables: EnvironmentVariable[],
  mode: RequestMode
): { headers: Record<string, string>; warnings: string[] } {
  const headers: Record<string, string> = {}
  const warnings: string[] = []

  // 1. Process custom headers
  for (const pair of headerPairs) {
    if (!pair.enabled || !pair.key.trim()) continue

    const key = resolveVariables(pair.key.trim(), variables)
    const val = resolveVariables(pair.value, variables)

    if (!isValidHeaderName(key)) {
      warnings.push(`Header name "${key}" contains invalid characters.`)
      continue
    }

    if (mode === 'direct' && isBrowserForbiddenHeader(key)) {
      warnings.push(
        `Header "${key}" is browser-restricted in Direct Mode and will likely be ignored or blocked by the browser. Consider using Proxy Mode.`
      )
    }

    // Merge or set header
    headers[key] = val
  }

  // 2. Inject Authorization headers if configured
  if (auth.type === 'bearer' && auth.bearerToken?.trim()) {
    const token = resolveVariables(auth.bearerToken.trim(), variables)
    headers['Authorization'] = `Bearer ${token}`
  } else if (auth.type === 'basic') {
    const user = resolveVariables(auth.basicUsername || '', variables)
    const pass = resolveVariables(auth.basicPassword || '', variables)
    try {
      const encoded = btoa(`${user}:${pass}`)
      headers['Authorization'] = `Basic ${encoded}`
    } catch {
      warnings.push('Basic auth credentials could not be base64 encoded.')
    }
  } else if (auth.type === 'apikey' && auth.apiKeyHeader?.trim() && auth.apiKeyValue?.trim()) {
    const headerName = resolveVariables(auth.apiKeyHeader.trim(), variables)
    const headerVal = resolveVariables(auth.apiKeyValue.trim(), variables)
    if (isValidHeaderName(headerName)) {
      headers[headerName] = headerVal
    } else {
      warnings.push(`API Key header name "${headerName}" is invalid.`)
    }
  }

  return { headers, warnings }
}
