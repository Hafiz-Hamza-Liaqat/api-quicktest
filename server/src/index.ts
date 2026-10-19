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
  // Rate limiting check
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
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
  let redirectsCount = 0

  while (redirectsCount <= MAX_REDIRECTS) {
    // SSRF Validation
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

      // Filter prohibited or dangerous headers before forwarding
      const forwardedHeaders: Record<string, string> = {}
      for (const [k, v] of Object.entries(headers)) {
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
          method: upperMethod,
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
        if (upperMethod !== 'GET' && body) {
          upstreamReq.write(body)
        }

        upstreamReq.end()
      })

      const upstreamDurationMs = Math.round(performance.now() - upstreamStart)

      // Check for redirect (301, 302, 303, 307, 308)
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

        // Resolve relative redirect against current URL
        currentUrl = new URL(upstreamResult.location, currentUrl).toString()
        continue // Loop to re-validate new target with SSRF checks!
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

const server = app.listen(PORT, () => {
  console.log(`API QuickTest Proxy server running on port ${PORT}`)
})

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down API QuickTest Proxy gracefully...')
  rateLimiter.destroy()
  server.close(() => {
    console.log('Proxy server closed.')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export default app
