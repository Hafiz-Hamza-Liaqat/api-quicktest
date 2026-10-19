import { describe, it, expect } from 'vitest'
import {
  isPrivateOrReservedIp,
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  validateDestinationUrl,
} from '../src/security'
import { MemoryRateLimiter } from '../src/rateLimiter'

describe('SSRF Protection - IP Range Checking', () => {
  it('blocks private IPv4 ranges', () => {
    // Loopback
    expect(isPrivateOrReservedIpv4('127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIpv4('127.255.255.254')).toBe(true)
    // 10.0.0.0/8
    expect(isPrivateOrReservedIpv4('10.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIpv4('10.254.1.10')).toBe(true)
    // 172.16.0.0/12
    expect(isPrivateOrReservedIpv4('172.16.0.1')).toBe(true)
    expect(isPrivateOrReservedIpv4('172.31.255.254')).toBe(true)
    // 192.168.0.0/16
    expect(isPrivateOrReservedIpv4('192.168.1.1')).toBe(true)
    expect(isPrivateOrReservedIpv4('192.168.100.50')).toBe(true)
  })

  it('blocks AWS and Cloud Metadata IPs (169.254.169.254)', () => {
    expect(isPrivateOrReservedIpv4('169.254.169.254')).toBe(true)
    expect(isPrivateOrReservedIpv4('169.254.0.1')).toBe(true)
  })

  it('blocks multicast, broadcast, and reserved IPv4 ranges', () => {
    expect(isPrivateOrReservedIpv4('0.0.0.0')).toBe(true)
    expect(isPrivateOrReservedIpv4('224.0.0.1')).toBe(true) // Multicast
    expect(isPrivateOrReservedIpv4('240.0.0.1')).toBe(true) // Reserved
    expect(isPrivateOrReservedIpv4('255.255.255.255')).toBe(true) // Broadcast
  })

  it('permits valid public IPv4 addresses', () => {
    expect(isPrivateOrReservedIpv4('8.8.8.8')).toBe(false)
    expect(isPrivateOrReservedIpv4('1.1.1.1')).toBe(false)
    expect(isPrivateOrReservedIpv4('93.184.216.34')).toBe(false)
    expect(isPrivateOrReservedIpv4('142.250.190.46')).toBe(false)
  })

  it('blocks private and loopback IPv6 ranges', () => {
    expect(isPrivateOrReservedIpv6('::1')).toBe(true) // Loopback
    expect(isPrivateOrReservedIpv6('::')).toBe(true) // Unspecified
    expect(isPrivateOrReservedIpv6('fe80::1')).toBe(true) // Link-local
    expect(isPrivateOrReservedIpv6('fc00::1')).toBe(true) // Unique local
    expect(isPrivateOrReservedIpv6('fd12:3456:789a::1')).toBe(true) // Unique local
    expect(isPrivateOrReservedIpv6('ff02::1')).toBe(true) // Multicast
    expect(isPrivateOrReservedIpv6('::ffff:127.0.0.1')).toBe(true) // IPv4-mapped loopback
    expect(isPrivateOrReservedIpv6('::ffff:169.254.169.254')).toBe(true) // IPv4-mapped metadata
  })

  it('handles general isPrivateOrReservedIp helper', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('::1')).toBe(true)
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false)
    expect(isPrivateOrReservedIp('invalid-ip-string')).toBe(true)
  })
})

describe('SSRF Protection - Destination URL Validation', () => {
  it('rejects unsupported protocols', async () => {
    const fileResult = await validateDestinationUrl('file:///etc/passwd')
    expect(fileResult.allowed).toBe(false)
    expect(fileResult.error).toContain('Unsupported protocol')

    const ftpResult = await validateDestinationUrl('ftp://ftp.example.com/file')
    expect(ftpResult.allowed).toBe(false)
    expect(ftpResult.error).toContain('Unsupported protocol')
  })

  it('rejects URLs with embedded user credentials', async () => {
    const credResult = await validateDestinationUrl('http://admin:secret@api.example.com')
    expect(credResult.allowed).toBe(false)
    expect(credResult.error).toContain('embedded credentials')
  })

  it('rejects direct private IPs in URLs', async () => {
    const res127 = await validateDestinationUrl('http://127.0.0.1:8080/secret')
    expect(res127.allowed).toBe(false)
    expect(res127.error).toContain('Destination blocked')

    const resMeta = await validateDestinationUrl('http://169.254.169.254/latest/meta-data')
    expect(resMeta.allowed).toBe(false)
    expect(resMeta.error).toContain('Destination blocked')

    const resPrivate = await validateDestinationUrl('http://192.168.1.100/admin')
    expect(resPrivate.allowed).toBe(false)
  })

  it('rejects localhost hostnames', async () => {
    const res = await validateDestinationUrl('http://localhost:3000')
    expect(res.allowed).toBe(false)
    expect(res.error).toContain('Destination blocked')
  })

  it('allows public URLs with DNS resolution', async () => {
    const res = await validateDestinationUrl('https://example.com')
    expect(res.allowed).toBe(true)
    expect(res.resolvedIp).toBeDefined()
    expect(res.protocol).toBe('https:')
  })
})

describe('Rate Limiter', () => {
  it('enforces maximum requests and calculates remaining count', () => {
    const limiter = new MemoryRateLimiter({ windowMs: 10000, maxRequests: 3 })
    const ip = '203.0.113.195'

    const r1 = limiter.check(ip)
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = limiter.check(ip)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = limiter.check(ip)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)

    const r4 = limiter.check(ip)
    expect(r4.allowed).toBe(false)
    expect(r4.remaining).toBe(0)

    limiter.destroy()
  })
})
