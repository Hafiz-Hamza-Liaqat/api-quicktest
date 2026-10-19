import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeRequest, MAX_RESPONSE_BYTES } from '../services/requestExecutor'
import type { RequestModel } from '../types'

describe('Request Executor - Streaming & Response Size Limits', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('handles small responses without truncation', async () => {
    const payload = JSON.stringify({ message: 'hello world', items: [1, 2, 3] })
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload))
        controller.close()
      },
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const req: RequestModel = {
      id: 'r1',
      name: 'Small Response',
      method: 'GET',
      url: 'https://example.com/api',
      queryParams: [],
      headers: [],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [],
      timeoutMs: 5000,
      requestMode: 'direct',
    }

    const res = await executeRequest(req, [])
    expect(res.status).toBe(200)
    expect(res.isTruncated).toBe(false)
    expect(res.isJson).toBe(true)
    expect(res.jsonParsed).toEqual({ message: 'hello world', items: [1, 2, 3] })
  })

  it('streams response chunks and truncates when exceeding MAX_RESPONSE_BYTES', async () => {
    const chunkSize = 1024 * 1024 // 1 MB
    let readCount = 0
    let cancelCalled = false

    const mockReader = {
      read: vi.fn().mockImplementation(async () => {
        readCount++
        if (readCount <= 6) {
          return { done: false, value: new Uint8Array(chunkSize).fill(65) }
        }
        return { done: true, value: undefined }
      }),
      cancel: vi.fn().mockImplementation(async () => {
        cancelCalled = true
      }),
    }

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      body: {
        getReader: () => mockReader,
      },
    } as unknown as Response

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const req: RequestModel = {
      id: 'r_large',
      name: 'Large Response',
      method: 'GET',
      url: 'https://example.com/large-data',
      queryParams: [],
      headers: [],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [],
      timeoutMs: 5000,
      requestMode: 'direct',
    }

    const res = await executeRequest(req, [])
    expect(res.status).toBe(200)
    expect(res.isTruncated).toBe(true)
    expect(res.body.length).toBe(MAX_RESPONSE_BYTES)
    expect(cancelCalled).toBe(true)
    expect(mockReader.cancel).toHaveBeenCalledWith('Response body limit of 5MB reached')
  })

  it('reports clear unconfigured error when running on remote domain without VITE_API_PROXY_URL', async () => {
    const originalWindow = globalThis.window
    // Simulate GitHub Pages hostname
    // @ts-ignore
    globalThis.window = {
      location: { hostname: 'hafiz-hamza-liaqat.github.io' },
    } as any

    const req: RequestModel = {
      id: 'r_proxy',
      name: 'Proxy on Remote',
      method: 'GET',
      url: 'https://api.example.com/data',
      queryParams: [],
      headers: [],
      body: { type: 'none', rawText: '' },
      auth: { type: 'none' },
      assertions: [],
      timeoutMs: 5000,
      requestMode: 'proxy',
    }

    const res = await executeRequest(req, [], { proxyBaseUrl: '' })
    expect(res.status).toBe(0)
    expect(res.statusText).toBe('Proxy Unconfigured')
    expect(res.error).toContain('Proxy backend URL is unconfigured')
    expect(res.error).toContain('VITE_API_PROXY_URL')

    // Restore window
    // @ts-ignore
    globalThis.window = originalWindow
  })
})
