import { describe, it, expect, beforeEach } from 'vitest'
import {
  exportCollectionsJson,
  validateAndImportCollections,
} from '../utils/storage'
import { sanitizeRequestModel, sanitizeAuthConfig } from '../utils/redact'
import type { CollectionItem, RequestModel } from '../types'

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
})
