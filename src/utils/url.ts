import type { EnvironmentVariable, KeyValuePair } from '../types'
import { findUnresolvedVariables, resolveVariables } from './variables'

export interface ParsedUrl {
  cleanBaseUrl: string
  params: Array<{ key: string; value: string }>
  fragment: string
}

export function parseUrlQueryParams(fullUrl: string): ParsedUrl {
  if (!fullUrl.trim()) {
    return { cleanBaseUrl: '', params: [], fragment: '' }
  }

  try {
    // If the URL has template variables like {{baseUrl}}, standard URL constructor might throw if no protocol
    // So let's handle fragment first
    let urlStr = fullUrl
    let fragment = ''
    const hashIndex = urlStr.indexOf('#')
    if (hashIndex !== -1) {
      fragment = urlStr.slice(hashIndex + 1)
      urlStr = urlStr.slice(0, hashIndex)
    }

    const questionIndex = urlStr.indexOf('?')
    if (questionIndex === -1) {
      return { cleanBaseUrl: urlStr, params: [], fragment }
    }

    const cleanBaseUrl = urlStr.slice(0, questionIndex)
    const queryString = urlStr.slice(questionIndex + 1)
    const params: Array<{ key: string; value: string }> = []

    if (queryString) {
      const searchParams = new URLSearchParams(queryString)
      searchParams.forEach((value, key) => {
        params.push({ key, value })
      })
    }

    return { cleanBaseUrl, params, fragment }
  } catch {
    return { cleanBaseUrl: fullUrl, params: [], fragment: '' }
  }
}

export function validateProtocol(url: string): { valid: boolean; error?: string } {
  if (!url.trim()) {
    return { valid: false, error: 'URL cannot be empty' }
  }

  // Check for rejected protocols explicitly
  const lower = url.trim().toLowerCase()
  const forbiddenProtocols = ['file:', 'ftp:', 'javascript:', 'data:', 'blob:', 'ws:', 'wss:']
  for (const proto of forbiddenProtocols) {
    if (lower.startsWith(proto)) {
      return { valid: false, error: `Protocol "${proto}" is not supported. Use HTTP or HTTPS.` }
    }
  }

  // If starts with http:// or https:// it's valid
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return { valid: true }
  }

  // If it's a relative path starting with / or contains template variable {{
  if (url.startsWith('/') || url.includes('{{')) {
    return { valid: true }
  }

  return { valid: false, error: 'URL must start with http:// or https://' }
}

export function buildFinalUrl(
  inputUrl: string,
  queryParams: KeyValuePair[],
  variables: EnvironmentVariable[]
): { finalUrl: string; unresolvedVars: string[]; error?: string } {
  if (!inputUrl.trim()) {
    return { finalUrl: '', unresolvedVars: [], error: 'URL is required' }
  }

  // 1. Check unresolved variables across URL and query params
  const allTexts = [
    inputUrl,
    ...queryParams.filter((p) => p.enabled).flatMap((p) => [p.key, p.value]),
  ]
  const unresolvedSet = new Set<string>()
  for (const text of allTexts) {
    const missing = findUnresolvedVariables(text, variables)
    for (const m of missing) {
      unresolvedSet.add(m)
    }
  }
  const unresolvedVars = Array.from(unresolvedSet)

  // 2. Resolve variables in inputUrl
  let resolvedUrl = resolveVariables(inputUrl.trim(), variables)

  // 3. Separate fragment if present
  let fragment = ''
  const hashIdx = resolvedUrl.indexOf('#')
  if (hashIdx !== -1) {
    fragment = resolvedUrl.slice(hashIdx)
    resolvedUrl = resolvedUrl.slice(0, hashIdx)
  }

  // 4. Validate protocol on resolved URL
  const protoCheck = validateProtocol(resolvedUrl)
  if (!protoCheck.valid) {
    return { finalUrl: resolvedUrl, unresolvedVars, error: protoCheck.error }
  }

  // 5. Append query params
  const enabledParams = queryParams.filter((p) => p.enabled && p.key.trim())
  if (enabledParams.length > 0) {
    const hasExistingQuery = resolvedUrl.includes('?')
    const prefix = hasExistingQuery ? '&' : '?'

    const queryParts = enabledParams.map((p) => {
      const resolvedKey = resolveVariables(p.key.trim(), variables)
      const resolvedVal = resolveVariables(p.value, variables)
      return `${encodeURIComponent(resolvedKey)}=${encodeURIComponent(resolvedVal)}`
    })

    resolvedUrl = `${resolvedUrl}${prefix}${queryParts.join('&')}`
  }

  // 6. Re-attach fragment
  if (fragment) {
    resolvedUrl = `${resolvedUrl}${fragment}`
  }

  return { finalUrl: resolvedUrl, unresolvedVars }
}
