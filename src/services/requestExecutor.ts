import type { EnvironmentVariable, RequestModel, ResponseSummary } from '../types'
import { buildFinalHeaders } from '../utils/headers'
import { buildFinalUrl } from '../utils/url'

export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5 MB

export interface ExecutionOptions {
  signal?: AbortSignal
  proxyBaseUrl?: string
}

export async function executeRequest(
  request: RequestModel,
  variables: EnvironmentVariable[],
  options: ExecutionOptions = {}
): Promise<ResponseSummary> {
  const { finalUrl, error: urlError, unresolvedVars } = buildFinalUrl(
    request.url,
    request.queryParams,
    variables
  )

  if (urlError) {
    throw new Error(`Invalid URL: ${urlError}`)
  }

  if (unresolvedVars.length > 0) {
    throw new Error(
      `Unresolved environment variables in request: ${unresolvedVars.map((v) => `{{${v}}}`).join(', ')}. Please check your active environment profile.`
    )
  }

  const { headers: finalHeaders } = buildFinalHeaders(
    request.headers,
    request.auth,
    variables,
    request.requestMode
  )

  // Configure body for POST, PUT, PATCH, DELETE
  let bodyToSend: BodyInit | undefined = undefined
  if (request.method !== 'GET' && request.body.type !== 'none' && request.body.rawText.trim()) {
    bodyToSend = request.body.rawText

    // Auto-set Content-Type if not explicitly given
    const hasContentType = Object.keys(finalHeaders).some(
      (k) => k.toLowerCase() === 'content-type'
    )
    if (!hasContentType) {
      finalHeaders['Content-Type'] =
        request.body.type === 'json' ? 'application/json' : 'text/plain; charset=utf-8'
    }
  }

  // Setup timeout & cancellation
  const timeoutMs = request.timeoutMs || 30000
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`))
  }, timeoutMs)

  let combinedSignal = timeoutController.signal
  if (options.signal) {
    const parentSignal = options.signal
    if (parentSignal.aborted) {
      clearTimeout(timeoutId)
      throw new Error('Request was aborted')
    }
    parentSignal.addEventListener('abort', () => {
      timeoutController.abort(new Error('Request was aborted by user'))
    })
  }

  const startTime = performance.now()

  try {
    if (request.requestMode === 'proxy') {
      return await executeViaProxy(
        finalUrl,
        request,
        finalHeaders,
        bodyToSend as string | undefined,
        combinedSignal,
        startTime,
        options.proxyBaseUrl
      )
    } else {
      return await executeDirect(
        finalUrl,
        request,
        finalHeaders,
        bodyToSend,
        combinedSignal,
        startTime
      )
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function executeDirect(
  finalUrl: string,
  request: RequestModel,
  headers: Record<string, string>,
  body: BodyInit | undefined,
  signal: AbortSignal,
  startTime: number
): Promise<ResponseSummary> {
  try {
    const fetchResponse = await fetch(finalUrl, {
      method: request.method,
      headers,
      body,
      signal,
    })

    let displayBody = ''
    let sizeBytes = 0
    let isTruncated = false

    // Enforce size limit while streaming to avoid buffering unbounded responses
    if (fetchResponse.body && typeof fetchResponse.body.getReader === 'function') {
      const reader = fetchResponse.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value && value.byteLength > 0) {
            sizeBytes += value.byteLength
            if (sizeBytes > MAX_RESPONSE_BYTES) {
              const overflow = sizeBytes - MAX_RESPONSE_BYTES
              const bytesToKeep = value.byteLength - overflow
              if (bytesToKeep > 0) {
                displayBody += decoder.decode(value.subarray(0, bytesToKeep), { stream: false })
              }
              isTruncated = true
              // Cancel reader early to stop network stream and conserve browser memory
              await reader.cancel('Response body limit of 5MB reached')
              break
            } else {
              displayBody += decoder.decode(value, { stream: true })
            }
          }
        }
      } catch (streamErr: any) {
        if (signal.aborted) throw streamErr
        if (!isTruncated) throw streamErr
      }
    } else {
      const rawBody = await fetchResponse.text()
      sizeBytes = new Blob([rawBody]).size
      if (sizeBytes > MAX_RESPONSE_BYTES) {
        isTruncated = true
        displayBody = rawBody.slice(0, MAX_RESPONSE_BYTES)
      } else {
        displayBody = rawBody
      }
    }

    const clientDurationMs = Math.round(performance.now() - startTime)

    // Parse response headers
    const responseHeaders: Record<string, string> = {}
    fetchResponse.headers.forEach((val, key) => {
      responseHeaders[key] = val
    })

    const contentType = fetchResponse.headers.get('content-type') || 'text/plain'

    let isJson = false
    let jsonParsed: any = undefined

    if (
      displayBody.trim() &&
      (contentType.includes('json') ||
        displayBody.trim().startsWith('{') ||
        displayBody.trim().startsWith('['))
    ) {
      try {
        jsonParsed = JSON.parse(displayBody)
        isJson = true
      } catch {
        // Not valid JSON even if content-type claimed so
        isJson = false
      }
    }

    return {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText || getDefaultStatusText(fetchResponse.status),
      clientDurationMs,
      sizeBytes,
      contentType,
      requestUrl: finalUrl,
      requestMethod: request.method,
      headers: responseHeaders,
      body: displayBody,
      isJson,
      jsonParsed,
      isTruncated,
      timestamp: Date.now(),
    }
  } catch (err: any) {
    const clientDurationMs = Math.round(performance.now() - startTime)
    const isAbort = signal.aborted || err.name === 'AbortError' || err.message?.includes('aborted')
    const isTimeout = err.message?.includes('timed out')

    return {
      status: 0,
      statusText: isTimeout ? 'Timed Out' : isAbort ? 'Aborted' : 'Network Error',
      clientDurationMs,
      sizeBytes: 0,
      contentType: 'text/plain',
      requestUrl: finalUrl,
      requestMethod: request.method,
      headers: {},
      body: '',
      isJson: false,
      isTruncated: false,
      networkError: true,
      error: isTimeout
        ? err.message
        : isAbort
        ? 'Request was cancelled by user.'
        : `Network request failed. This often indicates CORS restriction by the target server, invalid host, or server being unreachable. Consider switching to Proxy Mode. (${err.message})`,
      timestamp: Date.now(),
    }
  }
}

async function executeViaProxy(
  finalUrl: string,
  request: RequestModel,
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal,
  startTime: number,
  proxyBaseUrl?: string
): Promise<ResponseSummary> {
  const envProxyUrl =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_PROXY_URL : undefined
  const isBrowser = typeof window !== 'undefined'
  const isLocalhost =
    isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  let proxyUrl = proxyBaseUrl || envProxyUrl
  if (!proxyUrl) {
    if (isLocalhost || !isBrowser) {
      proxyUrl = 'http://localhost:3001'
    } else {
      // Remote deployment (e.g. GitHub Pages) with unconfigured proxy URL
      return {
        status: 0,
        statusText: 'Proxy Unconfigured',
        clientDurationMs: 0,
        sizeBytes: 0,
        contentType: 'text/plain',
        requestUrl: finalUrl,
        requestMethod: request.method,
        headers: {},
        body: '',
        isJson: false,
        isTruncated: false,
        networkError: true,
        error:
          'Proxy backend URL is unconfigured. When hosted on GitHub Pages, configure VITE_API_PROXY_URL pointing to your deployed Render proxy service, or switch to Direct Mode.',
        timestamp: Date.now(),
      }
    }
  }

  const proxyEndpoint = `${proxyUrl.replace(/\/+$/, '')}/proxy`

  try {
    const res = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: finalUrl,
        method: request.method,
        headers,
        body,
        timeoutMs: request.timeoutMs || 30000,
      }),
      signal,
    })

    const clientDurationMs = Math.round(performance.now() - startTime)
    const data = await res.json()

    if (!res.ok) {
      return {
        status: data.upstreamStatus || res.status,
        statusText: data.upstreamStatusText || 'Proxy Error',
        clientDurationMs,
        upstreamDurationMs: data.upstreamDurationMs,
        sizeBytes: 0,
        contentType: 'application/json',
        requestUrl: finalUrl,
        requestMethod: request.method,
        headers: {},
        body: JSON.stringify(data, null, 2),
        isJson: true,
        jsonParsed: data,
        isTruncated: false,
        networkError: true,
        error: data.error || `Proxy returned HTTP ${res.status}: ${data.message || 'Unknown error'}`,
        timestamp: Date.now(),
      }
    }

    const rawBody = data.body || ''
    const sizeBytes = new Blob([rawBody]).size
    const isTruncated = sizeBytes > MAX_RESPONSE_BYTES
    const displayBody = isTruncated ? rawBody.slice(0, MAX_RESPONSE_BYTES) : rawBody

    let isJson = false
    let jsonParsed: any = undefined
    const contentType = data.headers?.['content-type'] || 'text/plain'

    if (displayBody.trim() && (contentType.includes('json') || displayBody.trim().startsWith('{') || displayBody.trim().startsWith('['))) {
      try {
        jsonParsed = JSON.parse(displayBody)
        isJson = true
      } catch {
        isJson = false
      }
    }

    return {
      status: data.status,
      statusText: data.statusText || getDefaultStatusText(data.status),
      clientDurationMs,
      upstreamDurationMs: data.upstreamDurationMs,
      sizeBytes,
      contentType,
      requestUrl: finalUrl,
      requestMethod: request.method,
      headers: data.headers || {},
      body: displayBody,
      isJson,
      jsonParsed,
      isTruncated,
      timestamp: Date.now(),
    }
  } catch (err: any) {
    const clientDurationMs = Math.round(performance.now() - startTime)
    const isAbort = signal.aborted || err.name === 'AbortError' || err.message?.includes('aborted')
    const isTimeout = err.message?.includes('timed out')

    return {
      status: 0,
      statusText: isTimeout ? 'Timed Out' : isAbort ? 'Aborted' : 'Proxy Network Error',
      clientDurationMs,
      sizeBytes: 0,
      contentType: 'text/plain',
      requestUrl: finalUrl,
      requestMethod: request.method,
      headers: {},
      body: '',
      isJson: false,
      isTruncated: false,
      networkError: true,
      error: isTimeout
        ? err.message
        : isAbort
        ? 'Request was cancelled by user.'
        : `Could not reach Proxy at "${proxyEndpoint}". Please ensure the Node.js proxy server is running (e.g., "npm run dev:server") or switch to Direct Mode. (${err.message})`,
      timestamp: Date.now(),
    }
  }
}

function getDefaultStatusText(status: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  }
  return map[status] || (status >= 200 && status < 300 ? 'Success' : 'Response')
}
