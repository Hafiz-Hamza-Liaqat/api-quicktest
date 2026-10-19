import { describe, it, expect } from 'vitest'
import {
  getJsonPathValue,
  checkJsonType,
  evaluateAssertions,
} from '../utils/assertions'
import type { AssertionRule, ResponseSummary } from '../types'

describe('Assertions Engine', () => {
  const sampleJson = {
    user: {
      id: 101,
      name: 'Ada Lovelace',
      isActive: true,
      tags: ['math', 'code'],
      meta: null,
    },
    items: [
      { id: 'item_1', price: 29.99 },
      { id: 'item_2', price: 49.99 },
    ],
  }

  const baseResponse: ResponseSummary = {
    status: 200,
    statusText: 'OK',
    clientDurationMs: 120,
    sizeBytes: 450,
    contentType: 'application/json',
    requestUrl: 'https://api.example.com/data',
    requestMethod: 'GET',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_abc123',
    },
    body: JSON.stringify(sampleJson),
    isJson: true,
    jsonParsed: sampleJson,
    isTruncated: false,
    timestamp: Date.now(),
  }

  describe('Safe JSON Path Extractor', () => {
    it('extracts nested object properties', () => {
      expect(getJsonPathValue(sampleJson, 'user.name')).toEqual({
        found: true,
        value: 'Ada Lovelace',
      })
      expect(getJsonPathValue(sampleJson, 'user.id')).toEqual({
        found: true,
        value: 101,
      })
    })

    it('extracts array elements and nested fields', () => {
      expect(getJsonPathValue(sampleJson, 'user.tags[0]')).toEqual({
        found: true,
        value: 'math',
      })
      expect(getJsonPathValue(sampleJson, 'items[1].price')).toEqual({
        found: true,
        value: 49.99,
      })
    })

    it('returns found: false for non-existent paths', () => {
      expect(getJsonPathValue(sampleJson, 'user.nonExistent')).toEqual({
        found: false,
        value: undefined,
      })
      expect(getJsonPathValue(sampleJson, 'items[10].id')).toEqual({
        found: false,
        value: undefined,
      })
    })

    it('guards against prototype pollution safely', () => {
      expect(getJsonPathValue(sampleJson, '__proto__.polluted')).toEqual({
        found: false,
        value: undefined,
      })
      expect(getJsonPathValue(sampleJson, 'constructor.prototype')).toEqual({
        found: false,
        value: undefined,
      })
    })
  })

  describe('Type Checking', () => {
    it('accurately identifies data types', () => {
      expect(checkJsonType('hello', 'string')).toBe(true)
      expect(checkJsonType(123, 'number')).toBe(true)
      expect(checkJsonType(true, 'boolean')).toBe(true)
      expect(checkJsonType([], 'array')).toBe(true)
      expect(checkJsonType({}, 'object')).toBe(true)
      expect(checkJsonType(null, 'null')).toBe(true)
      expect(checkJsonType(123, 'string')).toBe(false)
    })
  })

  describe('Rule Evaluation', () => {
    it('evaluates status_code_equals correctly', () => {
      const passRule: AssertionRule = {
        id: '1',
        type: 'status_code_equals',
        expectedValue: '200',
        enabled: true,
      }
      const failRule: AssertionRule = {
        id: '2',
        type: 'status_code_equals',
        expectedValue: '404',
        enabled: true,
      }

      const results = evaluateAssertions([passRule, failRule], baseResponse)
      expect(results[0].passed).toBe(true)
      expect(results[0].status).toBe('pass')
      expect(results[1].passed).toBe(false)
      expect(results[1].status).toBe('fail')
      expect(results[1].reason).toContain('Expected status 404, got 200')
    })

    it('evaluates response_time_less_than correctly', () => {
      const passRule: AssertionRule = {
        id: '1',
        type: 'response_time_less_than',
        expectedValue: '500',
        enabled: true,
      }
      const failRule: AssertionRule = {
        id: '2',
        type: 'response_time_less_than',
        expectedValue: '50',
        enabled: true,
      }

      const results = evaluateAssertions([passRule, failRule], baseResponse)
      expect(results[0].passed).toBe(true)
      expect(results[1].passed).toBe(false)
    })

    it('evaluates json_path_exists and json_path_equals', () => {
      const rules: AssertionRule[] = [
        { id: '1', type: 'json_path_exists', path: 'user.name', enabled: true },
        { id: '2', type: 'json_path_equals', path: 'user.name', expectedValue: 'Ada Lovelace', enabled: true },
        { id: '3', type: 'json_path_equals', path: 'user.id', expectedValue: '101', enabled: true },
        { id: '4', type: 'json_path_equals', path: 'user.isActive', expectedValue: 'true', enabled: true },
        { id: '5', type: 'json_path_equals', path: 'user.name', expectedValue: 'Wrong Name', enabled: true },
      ]

      const results = evaluateAssertions(rules, baseResponse)
      expect(results[0].passed).toBe(true)
      expect(results[1].passed).toBe(true)
      expect(results[2].passed).toBe(true)
      expect(results[3].passed).toBe(true)
      expect(results[4].passed).toBe(false)
    })

    it('returns not_run when response is a network failure', () => {
      const netErrorResponse: ResponseSummary = {
        ...baseResponse,
        status: 0,
        networkError: true,
        error: 'Network connection failed',
      }
      const rule: AssertionRule = {
        id: '1',
        type: 'status_code_equals',
        expectedValue: '200',
        enabled: true,
      }
      const results = evaluateAssertions([rule], netErrorResponse)
      expect(results[0].status).toBe('not_run')
      expect(results[0].passed).toBe(false)
    })
  })
})
