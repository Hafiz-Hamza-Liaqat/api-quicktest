import { describe, it, expect, beforeEach } from 'vitest'
import {
  exportCollectionsJson,
  saveCollections,
  saveEnvironments,
  STORAGE_KEYS,
  validateAndImportCollections,
} from '../utils/storage'
import { sanitizeRequestModel, sanitizeAuthConfig } from '../utils/redact'
import type { CollectionItem, EnvironmentProfile, RequestModel } from '../types'

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
})

