import { describe, it, expect } from 'vitest'
import { resolveVariables, findUnresolvedVariables } from '../utils/variables'
import type { EnvironmentVariable } from '../types'

describe('Environment Variables Resolution', () => {
  const vars: EnvironmentVariable[] = [
    { id: '1', key: 'baseUrl', value: 'https://api.example.com', isSecret: false, enabled: true },
    { id: '2', key: 'userId', value: '42', isSecret: false, enabled: true },
    { id: '3', key: 'disabledKey', value: 'ignore', isSecret: false, enabled: false },
  ]

  it('substitutes enabled variables in text', () => {
    const text = '{{baseUrl}}/users/{{userId}}'
    const resolved = resolveVariables(text, vars)
    expect(resolved).toBe('https://api.example.com/users/42')
  })

  it('leaves disabled or undefined variables untouched in resolveVariables', () => {
    const text = '{{baseUrl}}/{{disabledKey}}/{{unknownVar}}'
    const resolved = resolveVariables(text, vars)
    expect(resolved).toBe('https://api.example.com/{{disabledKey}}/{{unknownVar}}')
  })

  it('detects unresolved variable tokens', () => {
    const text = '{{baseUrl}}/users/{{missingId}}?key={{anotherMissing}}'
    const unresolved = findUnresolvedVariables(text, vars)
    expect(unresolved).toEqual(['missingId', 'anotherMissing'])
  })

  it('returns empty array when all variables are resolved', () => {
    const text = '{{baseUrl}}/users/{{userId}}'
    const unresolved = findUnresolvedVariables(text, vars)
    expect(unresolved).toEqual([])
  })
})
