import type { EnvironmentVariable, RequestModel } from '../types'
import { buildFinalHeaders } from './headers'
import { buildFinalUrl } from './url'

export interface SnippetOptions {
  includeSecrets?: boolean
}

/**
 * Escapes a string for POSIX shell single quotes
 */
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

/**
 * Generates cURL command
 */
export function generateCurlSnippet(
  request: RequestModel,
  variables: EnvironmentVariable[],
  options: SnippetOptions = {}
): string {
  const { finalUrl } = buildFinalUrl(request.url, request.queryParams, variables)
  const urlToUse = finalUrl || request.url || 'https://api.example.com/v1/resource'

  const authCopy = { ...request.auth }
  if (!options.includeSecrets) {
    if (authCopy.type === 'bearer') authCopy.bearerToken = '<BEARER_TOKEN>'
    if (authCopy.type === 'basic') {
      authCopy.basicUsername = authCopy.basicUsername || 'user'
      authCopy.basicPassword = '<PASSWORD>'
    }
    if (authCopy.type === 'apikey') authCopy.apiKeyValue = '<API_KEY>'
  }

  const { headers } = buildFinalHeaders(request.headers, authCopy, variables, request.requestMode)

  const parts: string[] = ['curl']

  // Method
  if (request.method !== 'GET') {
    parts.push(`-X ${request.method}`)
  }

  // URL
  parts.push(escapeShellArg(urlToUse))

  // Headers
  for (const [key, val] of Object.entries(headers)) {
    parts.push(`-H ${escapeShellArg(`${key}: ${val}`)}`)
  }

  // Body
  if (request.method !== 'GET' && request.body.type !== 'none' && request.body.rawText.trim()) {
    // If not already in headers, add Content-Type
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')
    if (!hasContentType) {
      const ctype = request.body.type === 'json' ? 'application/json' : 'text/plain'
      parts.push(`-H ${escapeShellArg(`Content-Type: ${ctype}`)}`)
    }
    parts.push(`--data ${escapeShellArg(request.body.rawText)}`)
  }

  return parts.join(' \\\n  ')
}

/**
 * Generates modern JavaScript fetch() snippet
 */
export function generateFetchSnippet(
  request: RequestModel,
  variables: EnvironmentVariable[],
  options: SnippetOptions = {}
): string {
  const { finalUrl } = buildFinalUrl(request.url, request.queryParams, variables)
  const urlToUse = finalUrl || request.url || 'https://api.example.com/v1/resource'

  const authCopy = { ...request.auth }
  if (!options.includeSecrets) {
    if (authCopy.type === 'bearer') authCopy.bearerToken = '<BEARER_TOKEN>'
    if (authCopy.type === 'basic') {
      authCopy.basicUsername = authCopy.basicUsername || 'user'
      authCopy.basicPassword = '<PASSWORD>'
    }
    if (authCopy.type === 'apikey') authCopy.apiKeyValue = '<API_KEY>'
  }

  const { headers } = buildFinalHeaders(request.headers, authCopy, variables, request.requestMode)

  if (request.method !== 'GET' && request.body.type !== 'none' && request.body.rawText.trim()) {
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')
    if (!hasContentType) {
      headers['Content-Type'] = request.body.type === 'json' ? 'application/json' : 'text/plain'
    }
  }

  const fetchOptions: any = {
    method: request.method,
  }

  if (Object.keys(headers).length > 0) {
    fetchOptions.headers = headers
  }

  let bodyCode = ''
  if (request.method !== 'GET' && request.body.type !== 'none' && request.body.rawText.trim()) {
    if (request.body.type === 'json') {
      try {
        const parsed = JSON.parse(request.body.rawText)
        fetchOptions.body = 'JSON_BODY_PLACEHOLDER'
        bodyCode = JSON.stringify(parsed, null, 2)
      } catch {
        fetchOptions.body = request.body.rawText
      }
    } else {
      fetchOptions.body = request.body.rawText
    }
  }

  let optionsJson = JSON.stringify(fetchOptions, null, 2)
  if (bodyCode) {
    optionsJson = optionsJson.replace('"JSON_BODY_PLACEHOLDER"', `JSON.stringify(${bodyCode})`)
  }

  return `// Note: When running directly in browser, the target API must permit CORS.
async function executeRequest() {
  const response = await fetch(${JSON.stringify(urlToUse)}, ${optionsJson});
  
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  
  const data = await response.json();
  console.log(data);
  return data;
}

executeRequest().catch(console.error);`
}

/**
 * Generates Python requests snippet
 */
export function generatePythonSnippet(
  request: RequestModel,
  variables: EnvironmentVariable[],
  options: SnippetOptions = {}
): string {
  const { finalUrl } = buildFinalUrl(request.url, request.queryParams, variables)
  const urlToUse = finalUrl || request.url || 'https://api.example.com/v1/resource'

  const authCopy = { ...request.auth }
  if (!options.includeSecrets) {
    if (authCopy.type === 'bearer') authCopy.bearerToken = '<BEARER_TOKEN>'
    if (authCopy.type === 'basic') {
      authCopy.basicUsername = authCopy.basicUsername || 'user'
      authCopy.basicPassword = '<PASSWORD>'
    }
    if (authCopy.type === 'apikey') authCopy.apiKeyValue = '<API_KEY>'
  }

  const { headers } = buildFinalHeaders(request.headers, authCopy, variables, request.requestMode)

  let py = `import requests\n\nurl = "${urlToUse}"\n`

  if (Object.keys(headers).length > 0) {
    py += `headers = ${JSON.stringify(headers, null, 4)}\n`
  } else {
    py += `headers = {}\n`
  }

  let dataParam = ''
  if (request.method !== 'GET' && request.body.type !== 'none' && request.body.rawText.trim()) {
    if (request.body.type === 'json') {
      try {
        const parsed = JSON.parse(request.body.rawText)
        py += `payload = ${JSON.stringify(parsed, null, 4)}\n`
        dataParam = ', json=payload'
      } catch {
        py += `payload = """${request.body.rawText}"""\n`
        dataParam = ', data=payload'
      }
    } else {
      py += `payload = """${request.body.rawText}"""\n`
      dataParam = ', data=payload'
    }
  }

  const methodLower = request.method.toLowerCase()
  py += `\nresponse = requests.${methodLower}(url, headers=headers${dataParam})\n`
  py += `print("Status code:", response.status_code)\ntry:\n    print(response.json())\nexcept Exception:\n    print(response.text)\n`

  return py
}
