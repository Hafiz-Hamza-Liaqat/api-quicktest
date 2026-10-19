import type { EnvironmentVariable } from '../types'

/**
 * Replaces all occurrences of {{varName}} in text using enabled environment variables.
 */
export function resolveVariables(
  text: string,
  variables: EnvironmentVariable[]
): string {
  if (!text) return ''

  const varMap = new Map<string, string>()
  for (const v of variables) {
    if (v.enabled && v.key.trim()) {
      varMap.set(v.key.trim(), v.value)
    }
  }

  return text.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
    if (varMap.has(key)) {
      return varMap.get(key)!
    }
    return match
  })
}

/**
 * Finds all variable tokens {{varName}} that are not defined in the provided variables.
 */
export function findUnresolvedVariables(
  text: string,
  variables: EnvironmentVariable[]
): string[] {
  if (!text) return []

  const enabledKeys = new Set(
    variables.filter((v) => v.enabled && v.key.trim()).map((v) => v.key.trim())
  )

  const unresolved = new Set<string>()
  const regex = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const key = match[1]
    if (!enabledKeys.has(key)) {
      unresolved.add(key)
    }
  }

  return Array.from(unresolved)
}
