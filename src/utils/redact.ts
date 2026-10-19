import type {
  AuthConfig,
  CollectionItem,
  EnvironmentProfile,
  KeyValuePair,
  RequestBodyConfig,
  RequestModel,
} from '../types'

/**
 * Checks if a header name represents a sensitive credential or secret.
 */
export function isSensitiveHeaderName(name: string): boolean {
  const lower = name.toLowerCase().trim()
  return (
    lower === 'authorization' ||
    lower === 'proxy-authorization' ||
    lower === 'cookie' ||
    lower === 'cookie2' ||
    lower === 'set-cookie' ||
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('apikey') ||
    lower.includes('api-key') ||
    lower.includes('api_key')
  )
}

/**
 * Checks if a query parameter key represents a credential or secret token.
 */
export function isSensitiveQueryParam(key: string): boolean {
  const lower = key.toLowerCase().trim()
  return (
    lower === 'api_key' ||
    lower === 'apikey' ||
    lower === 'key' ||
    lower === 'token' ||
    lower === 'access_token' ||
    lower === 'auth' ||
    lower === 'secret' ||
    lower === 'client_secret' ||
    lower === 'password' ||
    lower === 'pass' ||
    lower === 'pwd'
  )
}

/**
 * Strips secret authentication fields from an AuthConfig object.
 */
export function sanitizeAuthConfig(auth: AuthConfig): AuthConfig {
  switch (auth.type) {
    case 'bearer':
      return { type: 'bearer', bearerToken: '' }
    case 'basic':
      return { type: 'basic', basicUsername: auth.basicUsername || '', basicPassword: '' }
    case 'apikey':
      return { type: 'apikey', apiKeyHeader: auth.apiKeyHeader || 'X-API-Key', apiKeyValue: '' }
    case 'none':
    default:
      return { type: 'none' }
  }
}

/**
 * Redacts credential values from query parameters.
 */
export function sanitizeQueryParams(params: KeyValuePair[]): KeyValuePair[] {
  return params.map((p) => {
    if (isSensitiveQueryParam(p.key)) {
      return { ...p, value: '' }
    }
    return { ...p }
  })
}

/**
 * Redacts credentials from embedded query strings in URL strings (e.g. ?token=secret).
 */
export function sanitizeUrlCredentials(url: string): string {
  if (!url) return ''
  return url.replace(
    /([?&](?:api_key|apikey|key|token|access_token|auth|secret|client_secret|password|pwd|pass)=)[^&#]*/gi,
    '$1'
  )
}

/**
 * Redacts common credential fields from request bodies.
 * Raw-text request bodies are omitted/cleared in persisted copies by default to prevent secret leakage.
 */
export function sanitizeRequestBody(
  body: RequestBodyConfig,
  options?: { allowSecrets?: boolean }
): RequestBodyConfig {
  if (!body) {
    return { type: 'none', rawText: '' }
  }

  // If user explicitly opts-in to allow secrets, retain rawText
  if (options?.allowSecrets) {
    return { ...body }
  }

  // Raw text mode: omit/clear raw-text bodies in persisted copies by default to prevent secret leakage
  if (body.type === 'raw') {
    return {
      ...body,
      rawText: '',
    }
  }

  if (body.type !== 'json' || !body.rawText.trim()) {
    return { ...body, rawText: '' }
  }

  try {
    const parsed = JSON.parse(body.rawText)
    const redactObject = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj.map(redactObject)

      const result: Record<string, any> = {}
      for (const [key, val] of Object.entries(obj)) {
        const lower = key.toLowerCase().trim()
        if (
          lower === 'password' ||
          lower === 'passwd' ||
          lower === 'pwd' ||
          lower === 'secret' ||
          lower === 'client_secret' ||
          lower === 'token' ||
          lower === 'access_token' ||
          lower === 'refresh_token' ||
          lower === 'apikey' ||
          lower === 'api_key' ||
          lower === 'private_key'
        ) {
          result[key] = ''
        } else if (typeof val === 'object' && val !== null) {
          result[key] = redactObject(val)
        } else {
          result[key] = val
        }
      }
      return result
    }

    const redacted = redactObject(parsed)
    return {
      ...body,
      rawText: JSON.stringify(redacted, null, 2),
    }
  } catch {
    return { ...body, rawText: '' }
  }
}

/**
 * Sanitizes a RequestModel by redacting secrets before saving to history, collections, or exports.
 */
export function sanitizeRequestModel(
  req: RequestModel,
  options?: { allowSecrets?: boolean }
): RequestModel {
  if (options?.allowSecrets) {
    return { ...req }
  }
  return {
    ...req,
    url: sanitizeUrlCredentials(req.url),
    queryParams: sanitizeQueryParams(req.queryParams),
    auth: sanitizeAuthConfig(req.auth),
    headers: req.headers.map((h) => {
      if (isSensitiveHeaderName(h.key)) {
        return { ...h, value: '' }
      }
      return { ...h }
    }),
    body: sanitizeRequestBody(req.body, options),
  }
}

/**
 * Redacts secrets from an EnvironmentProfile before export or persistent storage.
 */
export function sanitizeEnvironmentProfile(profile: EnvironmentProfile): EnvironmentProfile {
  return {
    ...profile,
    variables: profile.variables.map((v) => {
      if (v.isSecret) {
        return { ...v, value: '' }
      }
      return { ...v }
    }),
  }
}

/**
 * Sanitizes an array of collections for export or storage.
 */
export function sanitizeCollections(
  collections: CollectionItem[],
  options?: { allowSecrets?: boolean }
): CollectionItem[] {
  if (options?.allowSecrets) {
    return collections
  }
  return collections.map((col) => ({
    ...col,
    requests: col.requests.map((r) => sanitizeRequestModel(r, options)),
  }))
}

/**
 * Alias for backward compatibility
 */
export const sanitizeCollectionsForExport = sanitizeCollections

/**
 * Strips secrets from a request config when appending to History.
 */
export function sanitizeRequestForHistory(req: RequestModel): Omit<RequestModel, 'id'> {
  const sanitized = sanitizeRequestModel(req, { allowSecrets: false })
  const { id: _, ...rest } = sanitized
  return rest
}
