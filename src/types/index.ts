export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey'

export interface AuthConfig {
  type: AuthType
  bearerToken?: string
  basicUsername?: string
  basicPassword?: string
  apiKeyHeader?: string
  apiKeyValue?: string
}

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
  description?: string
}

export type BodyType = 'none' | 'json' | 'raw'

export interface RequestBodyConfig {
  type: BodyType
  rawText: string
  contentType?: string
}

export type RequestMode = 'direct' | 'proxy'

export type AssertionType =
  | 'status_code_equals'
  | 'response_time_less_than'
  | 'json_path_exists'
  | 'json_path_equals'
  | 'json_path_type'
  | 'header_exists'
  | 'header_equals'

export interface AssertionRule {
  id: string
  type: AssertionType
  path?: string
  expectedValue?: string
  enabled: boolean
}

export interface AssertionResult {
  ruleId: string
  ruleType: AssertionType
  passed: boolean
  status: 'pass' | 'fail' | 'not_run'
  actualValue?: any
  expectedValue?: any
  reason: string
}

export interface RequestModel {
  id: string
  name: string
  method: HttpMethod
  url: string
  queryParams: KeyValuePair[]
  headers: KeyValuePair[]
  body: RequestBodyConfig
  auth: AuthConfig
  assertions: AssertionRule[]
  timeoutMs: number
  requestMode: RequestMode
}

export interface ResponseSummary {
  status: number
  statusText: string
  clientDurationMs: number
  upstreamDurationMs?: number
  sizeBytes: number
  contentType: string
  requestUrl: string
  requestMethod: HttpMethod
  headers: Record<string, string>
  body: string
  isJson: boolean
  jsonParsed?: any
  isTruncated: boolean
  error?: string
  networkError?: boolean
  timestamp: number
}

export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  isSecret: boolean
  enabled: boolean
}

export interface EnvironmentProfile {
  id: string
  name: string
  variables: EnvironmentVariable[]
}

export interface HistoryItem {
  id: string
  timestamp: number
  method: HttpMethod
  url: string
  status?: number
  durationMs?: number
  networkError?: boolean
  requestConfig: Omit<RequestModel, 'id'>
}

export interface CollectionItem {
  id: string
  name: string
  description?: string
  requests: RequestModel[]
  createdAt: number
  updatedAt: number
}

export interface RecipeItem {
  id: string
  title: string
  description: string
  category: string
  request: Partial<RequestModel>
}
