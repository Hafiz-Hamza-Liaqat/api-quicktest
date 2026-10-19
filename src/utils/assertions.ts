import type { AssertionResult, AssertionRule, ResponseSummary } from '../types'

/**
 * Safely extracts a value at a given JSON path without using eval or new Function.
 * Supports dot notation ('data.user.id') and array indexing ('items[0].name' or '[0].name').
 * Protects against prototype pollution.
 */
export function getJsonPathValue(obj: any, path: string): { found: boolean; value: any } {
  if (obj === null || obj === undefined || !path.trim()) {
    return { found: false, value: undefined }
  }

  // Tokenize path into property keys and array indices
  // e.g. "users[0].profile.email" -> ["users", "0", "profile", "email"]
  const normalized = path.trim().replace(/\[(\d+)\]/g, '.$1')
  const tokens = normalized.split('.').filter((token) => token.length > 0)

  let current = obj
  for (const token of tokens) {
    if (token === '__proto__' || token === 'prototype' || token === 'constructor') {
      return { found: false, value: undefined }
    }

    if (current === null || current === undefined || typeof current !== 'object') {
      return { found: false, value: undefined }
    }

    if (Array.isArray(current)) {
      const idx = Number(token)
      if (Number.isInteger(idx) && idx >= 0 && idx < current.length) {
        current = current[idx]
      } else {
        return { found: false, value: undefined }
      }
    } else if (Object.prototype.hasOwnProperty.call(current, token)) {
      current = current[token]
    } else {
      return { found: false, value: undefined }
    }
  }

  return { found: true, value: current }
}

/**
 * Checks type matching for json_path_type
 */
export function checkJsonType(value: any, expectedType: string): boolean {
  const norm = expectedType.trim().toLowerCase()
  if (value === null) return norm === 'null'
  if (Array.isArray(value)) return norm === 'array'
  if (norm === 'number') return typeof value === 'number' && !Number.isNaN(value)
  return typeof value === norm
}

/**
 * Safely parses expected value for equality comparisons
 */
export function parseExpectedValue(val: string): any {
  const trimmed = val.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (trimmed === 'undefined') return undefined
  if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed)
  // Check if it's quoted string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

/**
 * Evaluates all assertion rules against a real completed response.
 */
export function evaluateAssertions(
  rules: AssertionRule[],
  response: ResponseSummary | null
): AssertionResult[] {
  if (!response || response.networkError) {
    return rules.map((r) => ({
      ruleId: r.id,
      ruleType: r.type,
      passed: false,
      status: 'not_run',
      reason: response?.networkError
        ? 'Request failed at network level; assertions not evaluated.'
        : 'No response available.',
    }))
  }

  return rules.map((rule) => {
    if (!rule.enabled) {
      return {
        ruleId: rule.id,
        ruleType: rule.type,
        passed: false,
        status: 'not_run',
        reason: 'Rule disabled',
      }
    }

    switch (rule.type) {
      case 'status_code_equals': {
        const expected = parseInt(rule.expectedValue || '200', 10)
        const actual = response.status
        const passed = actual === expected
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed,
          status: passed ? 'pass' : 'fail',
          actualValue: actual,
          expectedValue: expected,
          reason: passed
            ? `Status code is ${actual}`
            : `Expected status ${expected}, got ${actual}`,
        }
      }

      case 'response_time_less_than': {
        const threshold = parseFloat(rule.expectedValue || '1000')
        const actual = response.clientDurationMs
        const passed = actual < threshold
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed,
          status: passed ? 'pass' : 'fail',
          actualValue: `${Math.round(actual)}ms`,
          expectedValue: `< ${threshold}ms`,
          reason: passed
            ? `Response time ${Math.round(actual)}ms is under ${threshold}ms`
            : `Response time ${Math.round(actual)}ms exceeded threshold ${threshold}ms`,
        }
      }

      case 'json_path_exists': {
        if (!response.isJson || !response.jsonParsed) {
          return {
            ruleId: rule.id,
            ruleType: rule.type,
            passed: false,
            status: 'fail',
            reason: 'Response is not valid JSON.',
          }
        }
        const path = rule.path || ''
        const { found, value } = getJsonPathValue(response.jsonParsed, path)
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed: found,
          status: found ? 'pass' : 'fail',
          actualValue: found ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : undefined,
          reason: found
            ? `Path "${path}" exists in JSON response.`
            : `Path "${path}" not found in response.`,
        }
      }

      case 'json_path_equals': {
        if (!response.isJson || !response.jsonParsed) {
          return {
            ruleId: rule.id,
            ruleType: rule.type,
            passed: false,
            status: 'fail',
            reason: 'Response is not valid JSON.',
          }
        }
        const path = rule.path || ''
        const { found, value: actual } = getJsonPathValue(response.jsonParsed, path)
        if (!found) {
          return {
            ruleId: rule.id,
            ruleType: rule.type,
            passed: false,
            status: 'fail',
            reason: `Path "${path}" not found in response.`,
          }
        }
        const expected = parseExpectedValue(rule.expectedValue || '')
        const passed = JSON.stringify(actual) === JSON.stringify(expected) || actual === expected
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed,
          status: passed ? 'pass' : 'fail',
          actualValue: typeof actual === 'object' ? JSON.stringify(actual) : String(actual),
          expectedValue: typeof expected === 'object' ? JSON.stringify(expected) : String(expected),
          reason: passed
            ? `Field at "${path}" matches expected value.`
            : `Expected "${path}" to equal ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`,
        }
      }

      case 'json_path_type': {
        if (!response.isJson || !response.jsonParsed) {
          return {
            ruleId: rule.id,
            ruleType: rule.type,
            passed: false,
            status: 'fail',
            reason: 'Response is not valid JSON.',
          }
        }
        const path = rule.path || ''
        const { found, value: actual } = getJsonPathValue(response.jsonParsed, path)
        if (!found) {
          return {
            ruleId: rule.id,
            ruleType: rule.type,
            passed: false,
            status: 'fail',
            reason: `Path "${path}" not found in response.`,
          }
        }
        const expectedType = rule.expectedValue || 'string'
        const passed = checkJsonType(actual, expectedType)
        const actualType = actual === null ? 'null' : Array.isArray(actual) ? 'array' : typeof actual
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed,
          status: passed ? 'pass' : 'fail',
          actualValue: actualType,
          expectedValue: expectedType,
          reason: passed
            ? `Field "${path}" has expected type "${expectedType}".`
            : `Expected type "${expectedType}" at "${path}", got "${actualType}".`,
        }
      }

      case 'header_exists': {
        const headerName = (rule.path || rule.expectedValue || '').toLowerCase().trim()
        const found = Object.keys(response.headers).some(
          (k) => k.toLowerCase() === headerName
        )
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed: found,
          status: found ? 'pass' : 'fail',
          reason: found
            ? `Header "${headerName}" is present.`
            : `Header "${headerName}" is missing from response.`,
        }
      }

      case 'header_equals': {
        const headerName = (rule.path || '').toLowerCase().trim()
        const expected = (rule.expectedValue || '').trim()
        const key = Object.keys(response.headers).find((k) => k.toLowerCase() === headerName)
        const actual = key ? response.headers[key] : undefined
        const passed = actual !== undefined && actual.toLowerCase() === expected.toLowerCase()
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed,
          status: passed ? 'pass' : 'fail',
          actualValue: actual,
          expectedValue: expected,
          reason: passed
            ? `Header "${headerName}" matched expected value.`
            : `Expected header "${headerName}" to equal "${expected}", got "${actual || 'missing'}".`,
        }
      }

      default:
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          passed: false,
          status: 'not_run',
          reason: 'Unknown assertion type',
        }
    }
  })
}
