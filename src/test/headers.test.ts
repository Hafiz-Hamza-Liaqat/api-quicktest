import { describe, it, expect } from 'vitest'
import {
  isBrowserForbiddenHeader,
  isValidHeaderName,
  buildFinalHeaders,
} from '../utils/headers'
import type { AuthConfig, EnvironmentVariable, KeyValuePair } from '../types'

describe('Headers Handling and Validation', () => {
  it('detects prohibited browser headers in direct mode', () => {
    expect(isBrowserForbiddenHeader('Host')).toBe(true)
    expect(isBrowserForbiddenHeader('Cookie')).toBe(true)
    expect(isBrowserForbiddenHeader('Origin')).toBe(true)
    expect(isBrowserForbiddenHeader('Referer')).toBe(true)
    expect(isBrowserForbiddenHeader('Sec-Fetch-Mode')).toBe(true)
    expect(isBrowserForbiddenHeader('X-Custom-Header')).toBe(false)
    expect(isBrowserForbiddenHeader('Authorization')).toBe(false)
  })

  it('validates header name characters', () => {
    expect(isValidHeaderName('Content-Type')).toBe(true)
    expect(isValidHeaderName('X_API_KEY')).toBe(true)
    expect(isValidHeaderName('Invalid Name With Spaces')).toBe(false)
    expect(isValidHeaderName('Header:Colon')).toBe(false)
    expect(isValidHeaderName('')).toBe(false)
  })

  it('builds final headers with Bearer auth token injection', () => {
    const pairs: KeyValuePair[] = [
      { id: '1', key: 'Accept', value: 'application/json', enabled: true },
      { id: '2', key: 'Disabled-Header', value: 'value', enabled: false },
    ]
    const auth: AuthConfig = {
      type: 'bearer',
      bearerToken: 'test-token-12345',
    }
    const vars: EnvironmentVariable[] = []

    const { headers, warnings } = buildFinalHeaders(pairs, auth, vars, 'direct')
    expect(warnings).toEqual([])
    expect(headers['Accept']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer test-token-12345')
    expect(headers['Disabled-Header']).toBeUndefined()
  })

  it('builds final headers with Basic auth credentials', () => {
    const pairs: KeyValuePair[] = []
    const auth: AuthConfig = {
      type: 'basic',
      basicUsername: 'alice',
      basicPassword: 'password123',
    }
    const vars: EnvironmentVariable[] = []

    const { headers } = buildFinalHeaders(pairs, auth, vars, 'direct')
    // btoa("alice:password123") -> "YWxpY2U6cGFzc3dvcmQxMjM="
    expect(headers['Authorization']).toBe('Basic YWxpY2U6cGFzc3dvcmQxMjM=')
  })

  it('builds final headers with API key in custom header', () => {
    const pairs: KeyValuePair[] = []
    const auth: AuthConfig = {
      type: 'apikey',
      apiKeyHeader: 'X-Service-Key',
      apiKeyValue: 'key_xyz987',
    }
    const vars: EnvironmentVariable[] = []

    const { headers } = buildFinalHeaders(pairs, auth, vars, 'direct')
    expect(headers['X-Service-Key']).toBe('key_xyz987')
  })

  it('warns when using browser-prohibited header in direct mode', () => {
    const pairs: KeyValuePair[] = [
      { id: '1', key: 'Host', value: 'custom-host.com', enabled: true },
    ]
    const auth: AuthConfig = { type: 'none' }
    const vars: EnvironmentVariable[] = []

    const { warnings } = buildFinalHeaders(pairs, auth, vars, 'direct')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('browser-restricted')
  })
})
