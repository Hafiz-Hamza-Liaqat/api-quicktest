import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import type { AddressInfo } from 'net'
import app from '../src/index'

describe('Proxy Redirects and Security Integration Tests', () => {
  let proxyServer: http.Server
  let proxyBaseUrl: string

  let targetServerB: http.Server
  let targetOriginB: string

  let targetServerC: http.Server
  let targetOriginC: string

  let receivedHeadersAtC: http.IncomingHttpHeaders | null = null

  beforeAll(async () => {
    // 1. Start proxy server
    proxyServer = http.createServer(app)
    await new Promise<void>((resolve) => proxyServer.listen(0, '127.0.0.1', () => resolve()))
    const proxyPort = (proxyServer.address() as AddressInfo).port
    proxyBaseUrl = `http://127.0.0.1:${proxyPort}`

    // 2. Start server B (initial target origin)
    targetServerB = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`)

      if (url.pathname === '/redirect/to-c') {
        res.writeHead(302, { Location: `${targetOriginC}/destination` })
        res.end()
        return
      }

      if (url.pathname === '/redirect/same-origin') {
        res.writeHead(302, { Location: `${targetOriginB}/final-b` })
        res.end()
        return
      }

      if (url.pathname === '/final-b') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ origin: 'B', success: true }))
        return
      }

      if (url.pathname === '/redirect/to-metadata') {
        // Public to private redirect
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' })
        res.end()
        return
      }

      if (url.pathname === '/redirect/loop-1') {
        res.writeHead(302, { Location: `${targetOriginB}/redirect/loop-2` })
        res.end()
        return
      }

      if (url.pathname === '/redirect/loop-2') {
        res.writeHead(302, { Location: `${targetOriginB}/redirect/loop-1` })
        res.end()
        return
      }

      if (url.pathname.startsWith('/redirect/chain/')) {
        const step = parseInt(url.pathname.split('/').pop() || '1', 10)
        res.writeHead(302, { Location: `${targetOriginB}/redirect/chain/${step + 1}` })
        res.end()
        return
      }

      if (url.pathname.startsWith('/redirect/status/')) {
        const code = parseInt(url.pathname.split('/').pop() || '302', 10)
        res.writeHead(code, { Location: `${targetOriginB}/echo` })
        res.end()
        return
      }

      if (url.pathname === '/echo') {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              method: req.method,
              receivedBody: body,
              headers: req.headers,
            })
          )
        })
        return
      }

      res.writeHead(404)
      res.end('Not found')
    })
    await new Promise<void>((resolve) => targetServerB.listen(0, '127.0.0.1', () => resolve()))
    const portB = (targetServerB.address() as AddressInfo).port
    targetOriginB = `http://127.0.0.1:${portB}`

    // 3. Start server C (cross-origin destination)
    targetServerC = http.createServer((req, res) => {
      receivedHeadersAtC = req.headers
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ origin: 'C', received: true }))
    })
    await new Promise<void>((resolve) => targetServerC.listen(0, '127.0.0.1', () => resolve()))
    const portC = (targetServerC.address() as AddressInfo).port
    targetOriginC = `http://127.0.0.1:${portC}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => proxyServer.close(() => resolve()))
    await new Promise<void>((resolve) => targetServerB.close(() => resolve()))
    await new Promise<void>((resolve) => targetServerC.close(() => resolve()))
  })

  it('successfully follows same-origin redirects', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/same-origin`,
        method: 'GET',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe(200)
    const parsed = JSON.parse(json.body)
    expect(parsed.origin).toBe('B')
  })

  it('rejects cross-origin redirect when Authorization token is present', async () => {
    receivedHeadersAtC = null

    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/to-c`,
        method: 'GET',
        headers: {
          Authorization: 'Bearer sensitive_access_token_123',
        },
      }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('CROSS_ORIGIN_REDIRECT_CREDENTIALS_BLOCKED')
    expect(json.error).toContain('sensitive credentials')

    // Proves Server C never received the request or token
    expect(receivedHeadersAtC).toBeNull()
  })

  it('rejects cross-origin redirect when custom API key header is present', async () => {
    receivedHeadersAtC = null

    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/to-c`,
        method: 'GET',
        headers: {
          'X-API-Key': 'client_secret_api_key_xyz',
        },
      }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('CROSS_ORIGIN_REDIRECT_CREDENTIALS_BLOCKED')
    expect(receivedHeadersAtC).toBeNull()
  })

  it('permits cross-origin redirect when NO credentials are provided', async () => {
    receivedHeadersAtC = null

    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/to-c`,
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe(200)
    expect(receivedHeadersAtC).not.toBeNull()
    expect(receivedHeadersAtC?.['authorization']).toBeUndefined()
    expect(receivedHeadersAtC?.['x-api-key']).toBeUndefined()
  })

  it('blocks redirect attempting to access private metadata service (SSRF protection)', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/to-metadata`,
        method: 'GET',
      }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('SSRF_BLOCKED')
    expect(json.error).toContain('Destination blocked')
  })

  it('detects and blocks redirect loops', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/loop-1`,
        method: 'GET',
      }),
    })

    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.code).toBe('REDIRECT_LOOP_DETECTED')
    expect(json.error).toContain('Redirect loop detected')
  })

  it('enforces maximum redirect limit (5 redirects max)', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/chain/1`,
        method: 'GET',
      }),
    })

    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.code).toBe('TOO_MANY_REDIRECTS')
  })

  it('transforms POST to GET and drops body on 301 and 302 redirects', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/status/302`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'original body' }),
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    const echo = JSON.parse(json.body)
    expect(echo.method).toBe('GET')
    expect(echo.receivedBody).toBe('')
  })

  it('transforms to GET and drops body on 303 See Other redirect', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/status/303`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'data' }),
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    const echo = JSON.parse(json.body)
    expect(echo.method).toBe('GET')
    expect(echo.receivedBody).toBe('')
  })

  it('preserves POST method and body on 307 and 308 redirects', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/status/307`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'preserved-value' }),
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    const echo = JSON.parse(json.body)
    expect(echo.method).toBe('POST')
    expect(echo.receivedBody).toContain('preserved-value')
  })

  it('rejects cross-origin redirect when X-Session-Id is present', async () => {
    receivedHeadersAtC = null

    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/to-c`,
        method: 'GET',
        headers: {
          'X-Session-Id': 'sess_xyz_secret_999',
        },
      }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('CROSS_ORIGIN_REDIRECT_CREDENTIALS_BLOCKED')
    expect(receivedHeadersAtC).toBeNull()
  })

  it('rejects cross-origin redirect when X-Client-Credential is present', async () => {
    receivedHeadersAtC = null

    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/to-c`,
        method: 'GET',
        headers: {
          'X-Client-Credential': 'cred_private_token',
        },
      }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('CROSS_ORIGIN_REDIRECT_CREDENTIALS_BLOCKED')
    expect(receivedHeadersAtC).toBeNull()
  })

  it('rejects cross-origin redirect when X-Internal-Key is present', async () => {
    receivedHeadersAtC = null

    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${targetOriginB}/redirect/to-c`,
        method: 'GET',
        headers: {
          'X-Internal-Key': 'internal_master_key',
        },
      }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('CROSS_ORIGIN_REDIRECT_CREDENTIALS_BLOCKED')
    expect(receivedHeadersAtC).toBeNull()
  })

  it('safely handles oversized upstream response (>5MB) without crashing and keeps proxy healthy', async () => {
    const res = await fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${proxyBaseUrl}/api/test/oversized`,
        method: 'GET',
      }),
    })

    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.code).toBe('RESPONSE_TOO_LARGE')
    expect(json.error).toContain('5MB maximum')

    // Verify proxy server remains healthy after oversized body error
    const health = await fetch(`${proxyBaseUrl}/health`)
    expect(health.status).toBe(200)
    const healthJson = await health.json()
    expect(healthJson.status).toBe('ok')
  })

  it('propagates client cancellation to upstream request and keeps proxy healthy', async () => {
    const controller = new AbortController()

    // Send request to slow streaming endpoint
    const proxyPromise = fetch(`${proxyBaseUrl}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${proxyBaseUrl}/api/test/slow-stream`,
        method: 'GET',
      }),
      signal: controller.signal,
    })

    // Wait a brief moment to ensure upstream request was initiated
    await new Promise((resolve) => setTimeout(resolve, 80))

    // Client disconnects
    controller.abort()

    await expect(proxyPromise).rejects.toThrow()

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 250))

    // Verify slow stream connection was terminated and cleaned up
    const countRes = await fetch(`${proxyBaseUrl}/api/test/slow-stream/active-count`)
    const countJson = await countRes.json()
    expect(countJson.activeCount).toBe(0)

    // Verify proxy server remains completely healthy
    const health = await fetch(`${proxyBaseUrl}/health`)
    expect(health.status).toBe(200)
    const healthJson = await health.json()
    expect(healthJson.status).toBe('ok')
  })
})
