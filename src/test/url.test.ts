import { describe, it, expect } from 'vitest'
import { parseUrlQueryParams, validateProtocol, buildFinalUrl } from '../utils/url'
import type { EnvironmentVariable, KeyValuePair } from '../types'

describe('URL and Query Parameter Handling', () => {
  it('parses base URL and query parameters from a full URL', () => {
    const raw = 'https://api.example.com/v1/items?filter=active&sort=desc#results'
    const parsed = parseUrlQueryParams(raw)
    expect(parsed.cleanBaseUrl).toBe('https://api.example.com/v1/items')
    expect(parsed.params).toEqual([
      { key: 'filter', value: 'active' },
      { key: 'sort', value: 'desc' },
    ])
    expect(parsed.fragment).toBe('results')
  })

  it('validates HTTP and HTTPS protocols and rejects forbidden protocols', () => {
    expect(validateProtocol('https://api.example.com').valid).toBe(true)
    expect(validateProtocol('http://localhost:3000').valid).toBe(true)
    expect(validateProtocol('file:///C:/secrets.txt').valid).toBe(false)
    expect(validateProtocol('ftp://ftp.example.com').valid).toBe(false)
    expect(validateProtocol('javascript:alert(1)').valid).toBe(false)
    expect(validateProtocol('data:text/html,test').valid).toBe(false)
  })

  it('builds final URL with query parameters, encoding, and variable resolution', () => {
    const vars: EnvironmentVariable[] = [
      { id: '1', key: 'baseUrl', value: 'https://api.example.com', isSecret: false, enabled: true },
      { id: '2', key: 'statusVal', value: 'in progress', isSecret: false, enabled: true },
    ]
    const queryParams: KeyValuePair[] = [
      { id: 'p1', key: 'query', value: 'special & chars', enabled: true },
      { id: 'p2', key: 'status', value: '{{statusVal}}', enabled: true },
      { id: 'p3', key: 'disabled', value: 'skip', enabled: false },
    ]

    const result = buildFinalUrl('{{baseUrl}}/search', queryParams, vars)
    expect(result.error).toBeUndefined()
    expect(result.unresolvedVars).toEqual([])
    expect(result.finalUrl).toBe(
      'https://api.example.com/search?query=special%20%26%20chars&status=in%20progress'
    )
  })

  it('preserves fragment when building final URL', () => {
    const vars: EnvironmentVariable[] = []
    const queryParams: KeyValuePair[] = [{ id: 'p1', key: 'page', value: '2', enabled: true }]
    const result = buildFinalUrl('https://api.example.com/list#section-a', queryParams, vars)
    expect(result.finalUrl).toBe('https://api.example.com/list?page=2#section-a')
  })

  it('reports unresolved variables when building final URL', () => {
    const vars: EnvironmentVariable[] = []
    const queryParams: KeyValuePair[] = [{ id: 'p1', key: 'id', value: '{{missingId}}', enabled: true }]
    const result = buildFinalUrl('{{unknownHost}}/items', queryParams, vars)
    expect(result.unresolvedVars).toContain('unknownHost')
    expect(result.unresolvedVars).toContain('missingId')
  })
})
