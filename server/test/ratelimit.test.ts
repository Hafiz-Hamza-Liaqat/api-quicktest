import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import type { AddressInfo } from 'net'
import express, { Request } from 'express'
import { MemoryRateLimiter } from '../src/rateLimiter'
import { getClientIp } from '../src/index'

describe('Rate Limit Client Identification and Bypass Prevention', () => {
  let server: http.Server
  let baseUrl: string
  let rateLimiter: MemoryRateLimiter

  beforeAll(async () => {
    rateLimiter = new MemoryRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 3,
    })

    const testApp = express()
    // By default, untrusted proxy environment
    testApp.set('trust proxy', false)

    testApp.get('/test-limit', (req, res) => {
      const clientIp = getClientIp(req)
      const check = rateLimiter.check(clientIp)
      res.setHeader('X-Client-Ip', clientIp)
      if (!check.allowed) {
        res.status(429).json({ error: 'Too Many Requests', clientIp })
        return
      }
      res.status(200).json({ success: true, remaining: check.remaining, clientIp })
    })

    server = http.createServer(testApp)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const port = (server.address() as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    rateLimiter.destroy()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('proves caller cannot bypass rate limit by altering X-Forwarded-For header', async () => {
    // Request 1: with spoofed X-Forwarded-For
    const r1 = await fetch(`${baseUrl}/test-limit`, {
      headers: { 'X-Forwarded-For': '203.0.113.1' },
    })
    expect(r1.status).toBe(200)

    // Request 2: with different spoofed X-Forwarded-For
    const r2 = await fetch(`${baseUrl}/test-limit`, {
      headers: { 'X-Forwarded-For': '203.0.113.2' },
    })
    expect(r2.status).toBe(200)

    // Request 3: with yet another spoofed IP
    const r3 = await fetch(`${baseUrl}/test-limit`, {
      headers: { 'X-Forwarded-For': '203.0.113.3' },
    })
    expect(r3.status).toBe(200)

    // Request 4: limit reached for socket remote address!
    // Spoofing a brand new IP should NOT bypass the limit
    const r4 = await fetch(`${baseUrl}/test-limit`, {
      headers: { 'X-Forwarded-For': '198.51.100.99' },
    })
    expect(r4.status).toBe(429)
    const json = await r4.json()
    expect(json.error).toBe('Too Many Requests')
  })

  it('correctly handles trusted proxy chains when trust proxy is configured', () => {
    const mockAppWithTrust = express()
    mockAppWithTrust.set('trust proxy', 1) // 1 hop trusted reverse proxy (e.g. Render)

    const mockReqWithTrust = {
      app: mockAppWithTrust,
      ip: '203.0.113.50',
      socket: { remoteAddress: '10.0.0.1' },
    } as unknown as Request

    expect(getClientIp(mockReqWithTrust)).toBe('203.0.113.50')

    const mockAppWithoutTrust = express()
    mockAppWithoutTrust.set('trust proxy', false)

    const mockReqWithoutTrust = {
      app: mockAppWithoutTrust,
      ip: '203.0.113.50', // Would be derived from X-Forwarded-For if trusted
      socket: { remoteAddress: '198.51.100.22' },
    } as unknown as Request

    // When trust proxy is false, strictly use socket address
    expect(getClientIp(mockReqWithoutTrust)).toBe('198.51.100.22')
  })

  it('safely handles missing client IP without crashing', () => {
    const mockApp = express()
    mockApp.set('trust proxy', false)

    const emptyReq = {
      app: mockApp,
      socket: {},
    } as unknown as Request

    expect(getClientIp(emptyReq)).toBe('unknown')
  })
})
