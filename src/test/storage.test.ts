import { describe, it, expect, beforeEach } from 'vitest'
import {
  addHistoryItem,
  exportCollectionsJson,
  loadHistory,
  saveCollections,
  saveEnvironments,
  saveHistory,
  STORAGE_KEYS,
  validateAndImportCollections,
} from '../utils/storage'
import {
  sanitizeRequestModel,
  sanitizeAuthConfig,
  sanitizeHistoryItem,
  sanitizeUrlCredentials,
} from '../utils/redact'
import type { CollectionItem, EnvironmentProfile, HistoryItem, RequestModel } from '../types'

describe('Storage, Redaction, and Collection Import/Export', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redacts secret credentials from AuthConfig', () => {
    const bearer = sanitizeAuthConfig({ type: 'bearer', bearerToken: 'super-secret-token' })
    expect(bearer.bearerToken).toBe('')

    const basic = sanitizeAuthConfig({
      type: 'basic',
      basicUsername: 'admin',
      basicPassword: 'password999',
    })
    expect(basic.basicPassword).toBe('')
    expect(basic.basicUsername).toBe('admin')

    const apikey = sanitizeAuthConfig({
      type: 'apikey',
      apiKeyHeader: 'X-API-Key',
      apiKeyValue: 'private_key_123',
    })
    expect(apikey.apiKeyValue).toBe('')
  })

  it('sanitizes RequestModel removing secret headers and auth', () => {
    const req: RequestModel = {
      id: 'req_test',
      name: 'Test Request',
      method: 'GET',
      url: 'https://api.example.com',
      queryParams: [],
      headers: [
        { id: '1', key: 'Accept', value: 'application/json', enabled: true },
        { id: '2', key: 'Authorization', value: 'Bearer secret_value', enabled: true },
        { id: '3', key: 'X-Secret-Token', value: 'secret123', enabled: true },
      ],
      body: { type: 'none', rawText: '' },
      auth: { type: 'bearer', bearerToken: 'jwt123' },
      assertions: [],
      timeoutMs: 30000,
      requestMode: 'direct',
    }

    const sanitized = sanitizeRequestModel(req)
    expect(sanitized.auth.bearerToken).toBe('')
    const authHeader = sanitized.headers.find((h) => h.key === 'Authorization')
    expect(authHeader?.value).toBe('')
    const secretHeader = sanitized.headers.find((h) => h.key === 'X-Secret-Token')
    expect(secretHeader?.value).toBe('')
    const acceptHeader = sanitized.headers.find((h) => h.key === 'Accept')
    expect(acceptHeader?.value).toBe('application/json')
  })

  it('exports collections to valid JSON with secrets stripped', () => {
    const collections: CollectionItem[] = [
      {
        id: 'col_1',
        name: 'My API',
        description: 'Production APIs',
        createdAt: 1000,
        updatedAt: 2000,
        requests: [
          {
            id: 'r1',
            name: 'Auth Request',
            method: 'POST',
            url: 'https://api.example.com/login',
            queryParams: [],
            headers: [],
            body: { type: 'none', rawText: '' },
            auth: { type: 'bearer', bearerToken: 'token_to_strip' },
            assertions: [],
            timeoutMs: 30000,
            requestMode: 'direct',
          },
        ],
      },
    ]

    const exportedJson = exportCollectionsJson(collections)
    expect(exportedJson).not.toContain('token_to_strip')
    const parsed = JSON.parse(exportedJson)
    expect(parsed.format).toBe('api-quicktest-collections')
    expect(parsed.collections[0].requests[0].auth.bearerToken).toBe('')
  })

  it('validates and imports collections successfully', () => {
    const validJson = JSON.stringify({
      format: 'api-quicktest-collections',
      collections: [
        {
          id: 'imported_col',
          name: 'Imported Suite',
          requests: [
            {
              id: 'r_imp',
              name: 'Health Check',
              method: 'GET',
              url: 'https://api.example.com/health',
            },
          ],
        },
      ],
    })

    const res = validateAndImportCollections(validJson)
    expect(res.success).toBe(true)
    expect(res.collections).toBeDefined()
    expect(res.collections![0].name).toBe('Imported Suite')
    expect(res.collections![0].requests[0].method).toBe('GET')
  })

  it('rejects malformed or invalid collection JSON gracefully', () => {
    const badJson = '{ invalid json'
    const res1 = validateAndImportCollections(badJson)
    expect(res1.success).toBe(false)
    expect(res1.error).toContain('Invalid JSON')

    const wrongSchema = JSON.stringify({ otherData: 123 })
    const res2 = validateAndImportCollections(wrongSchema)
    expect(res2.success).toBe(false)
    expect(res2.error).toContain('collections')
  })

  it('proves saveCollections does not persist credentials to localStorage by default', () => {
    const sensitiveCollection: CollectionItem[] = [
      {
        id: 'col_sec',
        name: 'Sensitive Collection',
        requests: [
          {
            id: 'req_sec_1',
            name: 'Sensitive Request',
            method: 'POST',
            url: 'https://api.example.com/login?token=sensitive_query_secret&normal=123',
            queryParams: [
              { id: '1', key: 'token', value: 'query_secret_token', enabled: true },
              { id: '2', key: 'limit', value: '50', enabled: true },
            ],
            headers: [
              { id: '3', key: 'Authorization', value: 'Bearer top_secret_jwt', enabled: true },
              { id: '4', key: 'X-API-Key', value: 'live_secret_key_999', enabled: true },
              { id: '5', key: 'User-Agent', value: 'APIQuickTest', enabled: true },
            ],
            body: {
              type: 'json',
              rawText: JSON.stringify({
                user: 'admin',
                password: 'super_secret_password',
                client_secret: 'oauth_secret_abc',
                nested: { token: 'nested_secret_token' },
              }),
            },
            auth: {
              type: 'bearer',
              bearerToken: 'bearer_token_secret',
            },
            assertions: [],
            timeoutMs: 30000,
            requestMode: 'direct',
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    // Default save (allowSecrets false)
    saveCollections(sensitiveCollection)

    const storedRaw = localStorage.getItem(STORAGE_KEYS.COLLECTIONS)
    expect(storedRaw).toBeDefined()
    expect(storedRaw).not.toContain('top_secret_jwt')
    expect(storedRaw).not.toContain('live_secret_key_999')
    expect(storedRaw).not.toContain('super_secret_password')
    expect(storedRaw).not.toContain('oauth_secret_abc')
    expect(storedRaw).not.toContain('nested_secret_token')
    expect(storedRaw).not.toContain('bearer_token_secret')
    expect(storedRaw).not.toContain('query_secret_token')
    expect(storedRaw).not.toContain('sensitive_query_secret')

    // Preserves non-sensitive data
    expect(storedRaw).toContain('Sensitive Request')
    expect(storedRaw).toContain('limit')
    expect(storedRaw).toContain('50')
    expect(storedRaw).toContain('APIQuickTest')
    expect(storedRaw).toContain('admin')
  })

  it('proves saveEnvironments does not persist secret variables to localStorage by default', () => {
    const envs: EnvironmentProfile[] = [
      {
        id: 'env_prod',
        name: 'Production',
        variables: [
          { id: 'v1', key: 'baseUrl', value: 'https://api.prod.com', isSecret: false, enabled: true },
          { id: 'v2', key: 'apiKey', value: 'prod_secret_key_xyz', isSecret: true, enabled: true },
          { id: 'v3', key: 'dbPassword', value: 'db_pass_12345', isSecret: true, enabled: true },
        ],
      },
    ]

    saveEnvironments(envs)

    const storedRaw = localStorage.getItem(STORAGE_KEYS.ENVIRONMENTS)
    expect(storedRaw).toBeDefined()
    expect(storedRaw).not.toContain('prod_secret_key_xyz')
    expect(storedRaw).not.toContain('db_pass_12345')

    // Preserves non-secret variables and metadata
    expect(storedRaw).toContain('https://api.prod.com')
    expect(storedRaw).toContain('apiKey')
    expect(storedRaw).toContain('dbPassword')
  })

  it('sanitizes imported collections by default to prevent secret leakage', () => {
    const externalJson = JSON.stringify({
      format: 'api-quicktest-collections',
      collections: [
        {
          id: 'imp_1',
          name: 'Imported with secrets',
          requests: [
            {
              id: 'imp_req_1',
              name: 'Request with secrets',
              method: 'POST',
              url: 'https://api.example.com/test',
              headers: [
                { id: 'h1', key: 'Authorization', value: 'Bearer external_secret' },
              ],
              auth: {
                type: 'bearer',
                bearerToken: 'token_in_import_file',
              },
            },
          ],
        },
      ],
    })

    const result = validateAndImportCollections(externalJson)
    expect(result.success).toBe(true)
    const importedReq = result.collections![0].requests[0]
    expect(importedReq.auth.bearerToken).toBe('')
    const authH = importedReq.headers.find((h) => h.key === 'Authorization')
    expect(authH?.value).toBe('')
  })

  it('omits raw-text bodies containing credentials from localStorage and exports by default', () => {
    const rawSecretBody = 'grant_type=password&username=admin&password=dummy_raw_password_999&client_secret=raw_sec_key'
    const collectionWithRawBody: CollectionItem[] = [
      {
        id: 'col_raw',
        name: 'Raw Body Collection',
        requests: [
          {
            id: 'r_raw_1',
            name: 'Raw Auth Request',
            method: 'POST',
            url: 'https://api.example.com/oauth/token',
            queryParams: [],
            headers: [{ id: 'h1', key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true }],
            body: {
              type: 'raw',
              rawText: rawSecretBody,
            },
            auth: { type: 'none' },
            assertions: [],
            timeoutMs: 30000,
            requestMode: 'direct',
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    // Default save (allowSecrets false)
    saveCollections(collectionWithRawBody)

    const storedRaw = localStorage.getItem(STORAGE_KEYS.COLLECTIONS)
    expect(storedRaw).toBeDefined()
    expect(storedRaw).not.toContain('dummy_raw_password_999')
    expect(storedRaw).not.toContain('raw_sec_key')

    // Default export (allowSecrets false)
    const exportedJson = exportCollectionsJson(collectionWithRawBody)
    expect(exportedJson).not.toContain('dummy_raw_password_999')
    expect(exportedJson).not.toContain('raw_sec_key')

    // Proves import also omits raw-text bodies by default
    const importPayload = JSON.stringify({
      format: 'api-quicktest-collections',
      collections: collectionWithRawBody,
    })
    const imported = validateAndImportCollections(importPayload)
    expect(imported.success).toBe(true)
    expect(imported.collections![0].requests[0].body.rawText).toBe('')

    // Proves opt-in retains rawText when allowSecrets is true
    const explicitExport = exportCollectionsJson(collectionWithRawBody, { allowSecrets: true })
    expect(explicitExport).toContain('dummy_raw_password_999')
  })

  it('sanitizes URL and requestConfig when adding a history item with ?token= and ?api_key=', () => {
    const liveRequest: RequestModel = {
      id: 'req_live_1',
      name: 'Search Users',
      method: 'GET',
      url: 'https://api.example.com/search?token=secret_token_123&api_key=key_abc_999&filter=active&page=1',
      queryParams: [
        { id: 'p1', key: 'token', value: 'secret_token_123', enabled: true },
        { id: 'p2', key: 'api_key', value: 'key_abc_999', enabled: true },
        { id: 'p3', key: 'filter', value: 'active', enabled: true },
        { id: 'p4', key: 'page', value: '1', enabled: true },
      ],
      headers: [
        { id: 'h1', key: 'Authorization', value: 'Bearer top_secret_jwt', enabled: true },
        { id: 'h2', key: 'Accept', value: 'application/json', enabled: true },
      ],
      body: { type: 'none', rawText: '' },
      auth: { type: 'bearer', bearerToken: 'top_secret_jwt' },
      assertions: [],
      timeoutMs: 30000,
      requestMode: 'direct',
    }

    const history = addHistoryItem(liveRequest, 200, 150, false)

    // Verify history entry top-level URL is sanitized
    expect(history.length).toBe(1)
    const entry = history[0]
    expect(entry.url).not.toContain('secret_token_123')
    expect(entry.url).not.toContain('key_abc_999')
    expect(entry.url).toContain('filter=active')
    expect(entry.url).toContain('page=1')
    expect(entry.url).toBe('https://api.example.com/search?token=&api_key=&filter=active&page=1')

    // Verify requestConfig is sanitized
    expect(entry.requestConfig.url).toBe(
      'https://api.example.com/search?token=&api_key=&filter=active&page=1'
    )
    expect(entry.requestConfig.auth.bearerToken).toBe('')
    const authHeader = entry.requestConfig.headers.find((h) => h.key === 'Authorization')
    expect(authHeader?.value).toBe('')
    const acceptHeader = entry.requestConfig.headers.find((h) => h.key === 'Accept')
    expect(acceptHeader?.value).toBe('application/json')

    // Verify localStorage contains sanitized values
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
    expect(stored).toBeDefined()
    expect(stored).not.toContain('secret_token_123')
    expect(stored).not.toContain('key_abc_999')
    expect(stored).not.toContain('top_secret_jwt')
    expect(stored).toContain('filter=active')

    // Prove live request in active editor is completely unaltered
    expect(liveRequest.url).toBe(
      'https://api.example.com/search?token=secret_token_123&api_key=key_abc_999&filter=active&page=1'
    )
    expect(liveRequest.auth.bearerToken).toBe('top_secret_jwt')
    expect(liveRequest.headers[0].value).toBe('Bearer top_secret_jwt')
  })

  it('normalizes legacy history containing sensitive URLs when loadHistory is called and resaves cleaned data', () => {
    // Inject legacy unsanitized history item into localStorage
    const legacyHistory: HistoryItem[] = [
      {
        id: 'hist_legacy_1',
        timestamp: 1670000000,
        method: 'GET',
        url: 'https://api.example.com/user?token=old_leaked_secret&api_key=old_key&limit=25',
        status: 200,
        durationMs: 85,
        networkError: false,
        requestConfig: {
          name: 'Legacy Req',
          method: 'GET',
          url: 'https://api.example.com/user?token=old_leaked_secret&api_key=old_key&limit=25',
          queryParams: [
            { id: '1', key: 'token', value: 'old_leaked_secret', enabled: true },
            { id: '2', key: 'limit', value: '25', enabled: true },
          ],
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer legacy_token', enabled: true }],
          body: { type: 'none', rawText: '' },
          auth: { type: 'bearer', bearerToken: 'legacy_token' },
          assertions: [],
          timeoutMs: 30000,
          requestMode: 'direct',
        },
      },
    ]

    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(legacyHistory))

    // Call loadHistory - it should normalize credentials and resave
    const loaded = loadHistory()

    expect(loaded.length).toBe(1)
    const normalized = loaded[0]

    // Credentials must be stripped
    expect(normalized.url).not.toContain('old_leaked_secret')
    expect(normalized.url).not.toContain('old_key')
    expect(normalized.url).toBe('https://api.example.com/user?token=&api_key=&limit=25')

    // RequestConfig credentials must be stripped
    expect(normalized.requestConfig.url).toBe(
      'https://api.example.com/user?token=&api_key=&limit=25'
    )
    expect(normalized.requestConfig.auth.bearerToken).toBe('')
    expect(normalized.requestConfig.headers[0].value).toBe('')

    // Non-sensitive query parameters and history metadata must be preserved
    expect(normalized.id).toBe('hist_legacy_1')
    expect(normalized.timestamp).toBe(1670000000)
    expect(normalized.method).toBe('GET')
    expect(normalized.status).toBe(200)
    expect(normalized.durationMs).toBe(85)
    expect(normalized.networkError).toBe(false)
    expect(normalized.url).toContain('limit=25')

    // Verify localStorage was updated with the cleaned version
    const updatedStored = localStorage.getItem(STORAGE_KEYS.HISTORY)
    expect(updatedStored).not.toContain('old_leaked_secret')
    expect(updatedStored).not.toContain('old_key')
    expect(updatedStored).not.toContain('legacy_token')
    expect(updatedStored).toContain('limit=25')
  })

  it('saveHistory sanitizes all incoming entries and bounds to 50 items', () => {
    const dirtyItems: HistoryItem[] = Array.from({ length: 60 }, (_, i) => ({
      id: `h_${i}`,
      timestamp: Date.now() - i * 1000,
      method: 'GET',
      url: `https://api.example.com/resource?token=secret_${i}&page=${i}`,
      status: 200,
      durationMs: 50,
      requestConfig: {
        name: `Req ${i}`,
        method: 'GET',
        url: `https://api.example.com/resource?token=secret_${i}&page=${i}`,
        queryParams: [],
        headers: [{ id: '1', key: 'Authorization', value: `Bearer sec_${i}`, enabled: true }],
        body: { type: 'none', rawText: '' },
        auth: { type: 'bearer', bearerToken: `sec_${i}` },
        assertions: [],
        timeoutMs: 30000,
        requestMode: 'direct',
      },
    }))

    saveHistory(dirtyItems)

    const storedRaw = localStorage.getItem(STORAGE_KEYS.HISTORY)
    expect(storedRaw).toBeDefined()
    const parsed: HistoryItem[] = JSON.parse(storedRaw!)

    // Bounded to 50 items
    expect(parsed.length).toBe(50)

    // All items sanitized
    for (const item of parsed) {
      expect(item.url).not.toContain('secret_')
      expect(item.url).toContain('token=&page=')
      expect(item.requestConfig.auth.bearerToken).toBe('')
      expect(item.requestConfig.headers[0].value).toBe('')
    }
  })

  it('handles corrupted localStorage gracefully when loading history', () => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, '{"corrupted": true')
    const loaded = loadHistory()
    expect(loaded).toEqual([])
  })

  it('sanitizeHistoryItem sanitizes URL and requestConfig directly and supports opt-in', () => {
    const item: HistoryItem = {
      id: 'h_test',
      timestamp: 1000,
      method: 'GET',
      url: 'https://api.example.com/test?token=my_secret_token',
      requestConfig: {
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com/test?token=my_secret_token',
        queryParams: [],
        headers: [{ id: '1', key: 'Authorization', value: 'Bearer secret', enabled: true }],
        body: { type: 'none', rawText: '' },
        auth: { type: 'bearer', bearerToken: 'secret' },
        assertions: [],
        timeoutMs: 30000,
        requestMode: 'direct',
      },
    }

    const sanitized = sanitizeHistoryItem(item)
    expect(sanitized.url).toBe('https://api.example.com/test?token=')
    expect(sanitized.requestConfig.auth.bearerToken).toBe('')

    const allowed = sanitizeHistoryItem(item, { allowSecrets: true })
    expect(allowed.url).toBe('https://api.example.com/test?token=my_secret_token')
    expect(allowed.requestConfig.auth.bearerToken).toBe('secret')
  })

  describe('URL User-Info and Credential Sanitization', () => {
    it('removes username and password user-info completely from URLs', () => {
      expect(sanitizeUrlCredentials('https://username:password@example.com/api')).toBe(
        'https://example.com/api'
      )
      expect(sanitizeUrlCredentials('http://admin:secret123@localhost:3000/v1/users')).toBe(
        'http://localhost:3000/v1/users'
      )
      expect(sanitizeUrlCredentials('https://:onlypass@example.com/resource')).toBe(
        'https://example.com/resource'
      )
      expect(sanitizeUrlCredentials('https://username:@example.com/resource')).toBe(
        'https://example.com/resource'
      )
    })

    it('removes username-only user-info completely from URLs', () => {
      expect(sanitizeUrlCredentials('https://username@example.com/api')).toBe(
        'https://example.com/api'
      )
      expect(sanitizeUrlCredentials('http://deployer@127.0.0.1:8080/deploy')).toBe(
        'http://127.0.0.1:8080/deploy'
      )
      expect(sanitizeUrlCredentials('//user@cdn.example.com/assets')).toBe(
        '//cdn.example.com/assets'
      )
    })

    it('redacts sensitive query parameters while preserving ordinary parameters, hostname, path, and fragment', () => {
      const complexUrl =
        'https://username:password@example.com:8443/v1/search?token=secret_token&filter=active&api_key=key_xyz&page=3&access_token=jwt_val#results'

      const sanitized = sanitizeUrlCredentials(complexUrl)

      // User-info removed
      expect(sanitized).not.toContain('username')
      expect(sanitized).not.toContain('password')
      expect(sanitized).not.toContain('@example.com')

      // Hostname, port, path, and fragment preserved
      expect(sanitized).toContain('https://example.com:8443/v1/search')
      expect(sanitized).toContain('#results')

      // Sensitive query parameters redacted
      expect(sanitized).not.toContain('secret_token')
      expect(sanitized).not.toContain('key_xyz')
      expect(sanitized).not.toContain('jwt_val')
      expect(sanitized).toContain('token=')
      expect(sanitized).toContain('api_key=')
      expect(sanitized).toContain('access_token=')

      // Non-sensitive query parameters preserved
      expect(sanitized).toContain('filter=active')
      expect(sanitized).toContain('page=3')

      // Email in query parameter or fragment with @ is not stripped as user-info
      const emailUrl = 'https://example.com/api?email=user@example.com&role=admin'
      expect(sanitizeUrlCredentials(emailUrl)).toBe(
        'https://example.com/api?email=user@example.com&role=admin'
      )
    })

    it('handles malformed URLs safely without throwing', () => {
      expect(sanitizeUrlCredentials('')).toBe('')
      expect(sanitizeUrlCredentials(null as any)).toBe('')
      expect(sanitizeUrlCredentials(undefined as any)).toBe('')
      expect(sanitizeUrlCredentials('not a valid url!@#$')).toBe('not a valid url!@#$')
      expect(sanitizeUrlCredentials('{{baseUrl}}/api/test?token=abc')).toBe(
        '{{baseUrl}}/api/test?token='
      )
    })

    it('preserves the active request URL in editor when creating sanitized history items', () => {
      const activeRequest: RequestModel = {
        id: 'req_editor_1',
        name: 'User Info Request',
        method: 'GET',
        url: 'https://operator:superSecret@internal.example.com/api?token=liveToken&limit=10',
        queryParams: [],
        headers: [],
        body: { type: 'none', rawText: '' },
        auth: { type: 'none' },
        assertions: [],
        timeoutMs: 30000,
        requestMode: 'direct',
      }

      const history = addHistoryItem(activeRequest, 200, 50, false)

      // Stored history item URL is sanitized (no user-info, sensitive query param stripped)
      expect(history[0].url).toBe('https://internal.example.com/api?token=&limit=10')
      expect(history[0].url).not.toContain('operator')
      expect(history[0].url).not.toContain('superSecret')
      expect(history[0].url).not.toContain('liveToken')

      // Active request URL in editor remains untouched
      expect(activeRequest.url).toBe(
        'https://operator:superSecret@internal.example.com/api?token=liveToken&limit=10'
      )
    })
  })
})

