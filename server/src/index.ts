import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import https from 'https'
import { MemoryRateLimiter } from './rateLimiter'
import { createPinnedAgent, validateDestinationUrl } from './security'

dotenv.config()

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_RESPONSE_BODY_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_REDIRECTS = 5

// Rate Limiter
const rateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 120,
})

// CORS configuration
const allowedOriginsStr = process.env.ALLOWED_ORIGINS || ''
const allowedOrigins = allowedOriginsStr
  ? allowedOriginsStr.split(',').map((o) => o.trim())
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'https://hafiz-hamza-liaqat.github.io',
    ]

app.use(
  cors({
    origin: (origin, callback) => {
      // In dev or if no origin (curl/mobile/local), allow
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true)
      } else {
        callback(new Error('Origin not permitted by CORS policy'))
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  })
)

// Configure trusted proxy behavior
// When running behind Render or another trusted reverse proxy, set TRUST_PROXY=1 (or number of hops).
// In direct connection mode or development, TRUST_PROXY is unset and X-Forwarded-For is not blindly trusted.
const TRUST_PROXY_CONFIG = process.env.TRUST_PROXY
if (TRUST_PROXY_CONFIG) {
  const hopNum = parseInt(TRUST_PROXY_CONFIG, 10)
  app.set('trust proxy', isNaN(hopNum) ? TRUST_PROXY_CONFIG : hopNum)
} else {
  app.set('trust proxy', false)
}

/**
 * Derives a trustworthy client IP for rate limiting.
 * If trust proxy is configured, uses Express's verified req.ip.
 * Otherwise, falls back strictly to req.socket.remoteAddress to prevent spoofing via X-Forwarded-For.
 */
export function getClientIp(req: Request): string {
  if (req.app.get('trust proxy')) {
    return req.ip || req.socket.remoteAddress || 'unknown'
  }
  return req.socket.remoteAddress || 'unknown'
}

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

// Middleware for parsing JSON with size limit
app.use(express.json({ limit: `${MAX_REQUEST_BODY_BYTES}b` }))
app.use(express.text({ limit: `${MAX_REQUEST_BODY_BYTES}b` }))

// Helper for param parsing
function parseParamString(param: any): string {
  if (Array.isArray(param)) return param[0] || ''
  return typeof param === 'string' ? param : String(param || '')
}

// -------------------------------------------------------------
// 1. Health Endpoint
// -------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    product: 'API QuickTest Proxy',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

// -------------------------------------------------------------
// 2. Deterministic Test API Endpoints
// (Enables reliable offline / local testing without external public API dependencies)
// -------------------------------------------------------------
const mockUsers = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'Mathematician', status: 'active' },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com', role: 'Cryptanalyst', status: 'active' },
  { id: 3, name: 'Grace Hopper', email: 'grace@example.com', role: 'Computer Scientist', status: 'active' },
  { id: 4, name: 'Margaret Hamilton', email: 'margaret@example.com', role: 'Systems Engineer', status: 'active' },
]

app.get('/api/test/users', (req: Request, res: Response) => {
  const page = parseInt(parseParamString(req.query.page), 10) || 1
  const limit = parseInt(parseParamString(req.query.limit), 10) || 10
  const start = (page - 1) * limit
  const paged = mockUsers.slice(start, start + limit)

  res.status(200).json({
    page,
    limit,
    total: mockUsers.length,
    users: paged,
  })
})

app.get('/api/test/users/:id', (req: Request, res: Response) => {
  const id = parseInt(parseParamString(req.params.id), 10)
  const user = mockUsers.find((u) => u.id === id)
  if (!user) {
    res.status(404).json({ error: 'User not found', id })
    return
  }
  res.status(200).json(user)
})

app.post('/api/test/users', (req: Request, res: Response) => {
  const body = req.body || {}
  const newUser = {
    id: 100 + Math.floor(Math.random() * 900),
    name: body.name || 'Anonymous User',
    email: body.email || 'anon@example.com',
    role: body.role || 'Developer',
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  res.status(201).json(newUser)
})

app.put('/api/test/users/:id', (req: Request, res: Response) => {
  const id = parseInt(parseParamString(req.params.id), 10)
  res.status(200).json({
    id,
    ...req.body,
    updatedAt: new Date().toISOString(),
    operation: 'full_replacement',
  })
})

app.patch('/api/test/users/:id', (req: Request, res: Response) => {
  const id = parseInt(parseParamString(req.params.id), 10)
  res.status(200).json({
    id,
    ...req.body,
    patchedAt: new Date().toISOString(),
    operation: 'partial_update',
  })
})

app.delete('/api/test/users/:id', (req: Request, res: Response) => {
  const id = parseInt(parseParamString(req.params.id), 10)
  res.status(200).json({
    success: true,
    deletedId: id,
    message: `User ${id} successfully deleted.`,
  })
})

app.get('/api/test/status/:code', (req: Request, res: Response) => {
  const code = parseInt(parseParamString(req.params.code), 10) || 200
  if (code === 204) {
    res.status(204).end()
    return
  }
  res.status(code).json({
    statusCode: code,
    message: `Response generated with status code ${code}`,
  })
})

app.get('/api/test/delay/:ms', async (req: Request, res: Response) => {
  const ms = Math.min(parseInt(parseParamString(req.params.ms), 10) || 500, 10000)
  await new Promise((resolve) => setTimeout(resolve, ms))
  res.status(200).json({
    delayedMs: ms,
    message: `Completed delay of ${ms}ms`,
  })
})

// Deterministic redirect test endpoints
app.get('/api/test/redirect/same-origin', (_req: Request, res: Response) => {
  res.redirect(302, '/api/test/users')
})

app.get('/api/test/redirect/loop-a', (_req: Request, res: Response) => {
  res.redirect(302, '/api/test/redirect/loop-b')
})

app.get('/api/test/redirect/loop-b', (_req: Request, res: Response) => {
  res.redirect(302, '/api/test/redirect/loop-a')
})

app.get('/api/test/redirect/chain/:step', (req: Request, res: Response) => {
  const step = parseInt(parseParamString(req.params.step), 10) || 1
  if (step >= 10) {
    res.status(200).json({ finalStep: step })
  } else {
    res.redirect(302, `/api/test/redirect/chain/${step + 1}`)
  }
})

app.get('/api/test/redirect/to-private', (_req: Request, res: Response) => {
  res.redirect(302, 'http://169.254.169.254/latest/meta-data')
})

app.all('/api/test/echo', (req: Request, res: Response) => {
  res.status(200).json({
    method: req.method,
    headers: req.headers,
    body: req.body,
  })
})

app.all('/api/test/redirect/status/:code', (req: Request, res: Response) => {
  const code = parseInt(parseParamString(req.params.code), 10) || 302
  res.redirect(code, '/api/test/echo')
})

// -------------------------------------------------------------
// 3. Secure Proxy Endpoint
// -------------------------------------------------------------
interface ProxyRequestBody {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

app.post('/proxy', async (req: Request, res: Response) => {
  // Hardened Rate limiting check using validated client IP
  const clientIp = getClientIp(req)
  const rateResult = rateLimiter.check(clientIp)

  res.setHeader('X-RateLimit-Limit', rateResult.limit.toString())
  res.setHeader('X-RateLimit-Remaining', rateResult.remaining.toString())
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateResult.resetTime / 1000).toString())

  if (!rateResult.allowed) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for client IP. Please wait before retrying.',
    })
    return
  }

  const { url, method = 'GET', headers = {}, body, timeoutMs = 30000 }: ProxyRequestBody = req.body || {}

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Invalid URL parameter provided.' })
    return
  }

  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  const upperMethod = method.toUpperCase()
  if (!allowedMethods.includes(upperMethod)) {
    res.status(400).json({ error: `Method "${upperMethod}" is not permitted.` })
    return
  }

  const allowLocalhostInDev = process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCALHOST === 'true'

  let currentUrl = url
  let currentMethod = upperMethod
  let currentBody: string | undefined = body
  let currentHeaders: Record<string, string> = { ...headers }
  let redirectsCount = 0
  const visitedUrls = new Set<string>([url])

  while (redirectsCount <= MAX_REDIRECTS) {
    // SSRF Validation for current target hop
    const validation = await validateDestinationUrl(currentUrl, allowLocalhostInDev)
    if (!validation.allowed || !validation.resolvedIp) {
      res.status(403).json({
        error: validation.error || 'Destination target is not allowed by SSRF policy.',
        code: 'SSRF_BLOCKED',
      })
      return
    }

    try {
      const parsedCurrentUrl = new URL(currentUrl)
      const isHttps = parsedCurrentUrl.protocol === 'https:'
      const agent = createPinnedAgent(validation.resolvedIp, isHttps)

      // Filter prohibited or hop-by-hop headers before forwarding
      const forwardedHeaders: Record<string, string> = {}
      for (const [k, v] of Object.entries(currentHeaders)) {
        const lower = k.toLowerCase().trim()
        if (
          lower === 'host' ||
          lower === 'content-length' ||
          lower === 'connection' ||
          lower === 'transfer-encoding'
        ) {
          continue
        }
        forwardedHeaders[k] = v
      }
      forwardedHeaders['Host'] = parsedCurrentUrl.host

      const effectiveTimeout = Math.min(Math.max(timeoutMs, 1000), 60000)
      const upstreamStart = performance.now()

      const upstreamResult = await new Promise<{
        status: number
        statusText: string
        headers: Record<string, string>
        body: string
        location?: string
      }>((resolve, reject) => {
        const lib = isHttps ? https : http

        const reqOptions: http.RequestOptions = {
          protocol: parsedCurrentUrl.protocol,
          hostname: parsedCurrentUrl.hostname,
          port: validation.port,
          path: `${parsedCurrentUrl.pathname}${parsedCurrentUrl.search}`,
          method: currentMethod,
          headers: forwardedHeaders,
          agent,
          timeout: effectiveTimeout,
        }

        const upstreamReq = lib.request(reqOptions, (upstreamRes) => {
          const respHeaders: Record<string, string> = {}
          for (const [hk, hv] of Object.entries(upstreamRes.headers)) {
            if (hv !== undefined) {
              respHeaders[hk] = Array.isArray(hv) ? hv.join(', ') : hv
            }
          }

          let responseData = ''
          let totalBytes = 0

          upstreamRes.setEncoding('utf8')

          upstreamRes.on('data', (chunk) => {
            totalBytes += Buffer.byteLength(chunk)
            if (totalBytes > MAX_RESPONSE_BODY_BYTES) {
              upstreamRes.destroy(new Error('Response size limit exceeded (5MB maximum)'))
              return
            }
            responseData += chunk
          })

          upstreamRes.on('end', () => {
            resolve({
              status: upstreamRes.statusCode || 200,
              statusText: upstreamRes.statusMessage || 'OK',
              headers: respHeaders,
              body: responseData,
              location: respHeaders['location'],
            })
          })
        })

        upstreamReq.on('timeout', () => {
          upstreamReq.destroy(new Error(`Upstream request timed out after ${effectiveTimeout}ms`))
        })

        upstreamReq.on('error', (err) => {
          reject(err)
        })

        // Write body if applicable
        if (currentMethod !== 'GET' && currentBody) {
          upstreamReq.write(currentBody)
        }

        upstreamReq.end()
      })

      const upstreamDurationMs = Math.round(performance.now() - upstreamStart)

      // Check for HTTP redirect status codes (301, 302, 303, 307, 308)
      if (
        [301, 302, 303, 307, 308].includes(upstreamResult.status) &&
        upstreamResult.location
      ) {
        redirectsCount++
        if (redirectsCount > MAX_REDIRECTS) {
          res.status(502).json({
            error: 'Maximum redirect limit exceeded (5 redirects max).',
            code: 'TOO_MANY_REDIRECTS',
          })
          return
        }

        let nextUrl: string
        try {
          nextUrl = new URL(upstreamResult.location, currentUrl).toString()
        } catch {
          res.status(502).json({
            error: `Malformed redirect location received from upstream: "${upstreamResult.location}".`,
            code: 'INVALID_REDIRECT_LOCATION',
          })
          return
        }

        // Loop detection
        if (visitedUrls.has(nextUrl)) {
          res.status(502).json({
            error: `Redirect loop detected: destination "${nextUrl}" was already visited.`,
            code: 'REDIRECT_LOOP_DETECTED',
          })
          return
        }
        visitedUrls.add(nextUrl)

        const currentOrigin = new URL(currentUrl).origin
        const nextOrigin = new URL(nextUrl).origin
        const isCrossOrigin = currentOrigin !== nextOrigin

        if (isCrossOrigin) {
          // Reject cross-origin redirects if credentials or secrets are present
          const hasSensitiveCredentials = Object.keys(currentHeaders).some((k) => {
            const lower = k.toLowerCase().trim()
            return (
              lower === 'authorization' ||
              lower === 'proxy-authorization' ||
              lower === 'cookie' ||
              lower === 'cookie2' ||
              lower === 'set-cookie' ||
              lower.includes('token') ||
              lower.includes('secret') ||
              lower.includes('password') ||
              lower.includes('apikey') ||
              lower.includes('api-key') ||
              lower.includes('api_key')
            )
          })

          if (hasSensitiveCredentials) {
            res.status(403).json({
              error: `Cross-origin redirect rejected: Request contains sensitive credentials (Authorization / API Key / Cookie) that cannot be safely forwarded to a different origin ("${nextOrigin}").`,
              code: 'CROSS_ORIGIN_REDIRECT_CREDENTIALS_BLOCKED',
            })
            return
          }

          // Strip any residual auth/cookie headers before redirecting across origins
          const sanitizedHeaders: Record<string, string> = {}
          for (const [k, v] of Object.entries(currentHeaders)) {
            const lower = k.toLowerCase().trim()
            if (
              lower !== 'authorization' &&
              lower !== 'proxy-authorization' &&
              lower !== 'cookie' &&
              lower !== 'cookie2'
            ) {
              sanitizedHeaders[k] = v
            }
          }
          currentHeaders = sanitizedHeaders
        }

        // Method and Body semantics for redirects (RFC 9110)
        // 301 and 302: historically change POST to GET and drop request body
        // 303 (See Other): MUST change method to GET (unless HEAD) and drop request body
        // 307 and 308: MUST preserve original method and body intact
        if (
          upstreamResult.status === 303 ||
          ((upstreamResult.status === 301 || upstreamResult.status === 302) && currentMethod === 'POST')
        ) {
          currentMethod = 'GET'
          currentBody = undefined
          for (const k of Object.keys(currentHeaders)) {
            if (k.toLowerCase() === 'content-type' || k.toLowerCase() === 'content-length') {
              delete currentHeaders[k]
            }
          }
        }

        currentUrl = nextUrl
        continue // Loop to re-validate destination URL against SSRF policy!
      }

      // Return successful response without logging secrets
      res.status(200).json({
        status: upstreamResult.status,
        statusText: upstreamResult.statusText,
        headers: upstreamResult.headers,
        body: upstreamResult.body,
        upstreamDurationMs,
      })
      return
    } catch (err: any) {
      res.status(502).json({
        error: `Upstream request failed: ${err.message}`,
        code: 'UPSTREAM_FAILURE',
      })
      return
    }
  }
})

// Safe error handling middleware (never expose stack traces)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500
  res.status(status).json({
    error: err.message || 'Internal proxy error',
    code: 'INTERNAL_ERROR',
  })
})

let server: http.Server | null = null

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`API QuickTest Proxy server running on port ${PORT}`)
  })
}

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down API QuickTest Proxy gracefully...')
  rateLimiter.destroy()
  if (server) {
    server.close(() => {
      console.log('Proxy server closed.')
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export { app, server, rateLimiter }
export default app
