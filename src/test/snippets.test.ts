import { describe, it, expect } from 'vitest'
import {
  generateCurlSnippet,
  generateFetchSnippet,
  generatePythonSnippet,
} from '../utils/snippets'
import type { RequestModel } from '../types'

describe('Code Snippets Generator', () => {
  const sampleRequest: RequestModel = {
    id: 'req_1',
    name: 'Create User',
    method: 'POST',
    url: 'https://api.example.com/v1/users',
    queryParams: [{ id: 'p1', key: 'sendWelcome', value: 'true', enabled: true }],
    headers: [
      { id: 'h1', key: 'Accept', value: 'application/json', enabled: true },
      { id: 'h2', key: 'X-App-Version', value: '1.0.0', enabled: true },
    ],
    body: {
      type: 'json',
      rawText: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    },
    auth: {
      type: 'bearer',
      bearerToken: 'secret_jwt_token_xyz',
    },
    assertions: [],
    timeoutMs: 30000,
    requestMode: 'direct',
  }

  it('generates cURL command with masked secrets by default', () => {
    const curl = generateCurlSnippet(sampleRequest, [], { includeSecrets: false })
    expect(curl).toContain("curl \\\n  -X POST")
    expect(curl).toContain("https://api.example.com/v1/users?sendWelcome=true")
    expect(curl).toContain("-H 'Authorization: Bearer <BEARER_TOKEN>'")
    expect(curl).not.toContain('secret_jwt_token_xyz')
    expect(curl).toContain("--data '{\"name\":\"Ada\",\"email\":\"ada@example.com\"}'")
  })

  it('generates cURL command with real secrets when explicitly requested', () => {
    const curl = generateCurlSnippet(sampleRequest, [], { includeSecrets: true })
    expect(curl).toContain("-H 'Authorization: Bearer secret_jwt_token_xyz'")
  })

  it('generates JavaScript fetch snippet with CORS guidance and clean async/await', () => {
    const fetchCode = generateFetchSnippet(sampleRequest, [], { includeSecrets: false })
    expect(fetchCode).toContain('async function executeRequest()')
    expect(fetchCode).toContain('https://api.example.com/v1/users?sendWelcome=true')
    expect(fetchCode).toContain('"Authorization": "Bearer <BEARER_TOKEN>"')
    expect(fetchCode).toContain('// Note: When running directly in browser')
  })

  it('generates Python requests snippet properly', () => {
    const pythonCode = generatePythonSnippet(sampleRequest, [], { includeSecrets: false })
    expect(pythonCode).toContain('import requests')
    expect(pythonCode).toContain('response = requests.post(url')
    expect(pythonCode).toContain('"Authorization": "Bearer <BEARER_TOKEN>"')
  })
})
