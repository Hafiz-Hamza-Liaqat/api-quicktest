import type { AuthConfig, CollectionItem, EnvironmentProfile, RequestModel } from '../types'

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
 * Sanitizes a RequestModel by redacting secrets before saving to history, collections, or exports.
 */
export function sanitizeRequestModel(req: RequestModel): RequestModel {
  return {
    ...req,
    auth: sanitizeAuthConfig(req.auth),
    headers: req.headers.map((h) => {
      // If a header is Authorization or looks like a secret, strip or mask it
      const lower = h.key.toLowerCase().trim()
      if (lower === 'authorization' || lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('apikey') || lower.includes('api-key')) {
        return { ...h, value: '' }
      }
      return { ...h }
    }),
  }
}

/**
 * Redacts secrets from an EnvironmentProfile before export or untrusted persistence.
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
 * Sanitizes an array of collections for export.
 */
export function sanitizeCollectionsForExport(collections: CollectionItem[]): CollectionItem[] {
  return collections.map((col) => ({
    ...col,
    requests: col.requests.map((r) => sanitizeRequestModel(r)),
  }))
}

/**
 * Strips secrets from a request config when appending to History.
 */
export function sanitizeRequestForHistory(req: RequestModel): Omit<RequestModel, 'id'> {
  const sanitized = sanitizeRequestModel(req)
  const { id: _, ...rest } = sanitized
  return rest
}
