import dns from 'dns/promises'
import net from 'net'
import http from 'http'
import https from 'https'
import ipaddr from 'ipaddr.js'

/**
 * Checks if an IPv4 address is private, loopback, link-local, carrier-grade NAT, reserved, or multicast.
 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true
  const trimmed = ip.trim()
  if (!ipaddr.IPv4.isValid(trimmed)) {
    return true
  }
  try {
    const addr = ipaddr.IPv4.parse(trimmed)
    return addr.range() !== 'unicast'
  } catch {
    return true
  }
}

/**
 * Checks if an IPv6 address is private, loopback, link-local, unique-local, multicast,
 * or an IPv4-mapped IPv6 address pointing to a non-public IPv4.
 */
export function isPrivateOrReservedIpv6(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true
  const trimmed = ip.trim()
  if (!ipaddr.IPv6.isValid(trimmed)) {
    return true
  }
  try {
    const processed = ipaddr.process(trimmed)
    return processed.range() !== 'unicast'
  } catch {
    return true
  }
}

/**
 * Validates any IP address (IPv4 or IPv6) against private, loopback, link-local, CGNAT,
 * documentation, and reserved ranges using RFC-compliant ipaddr.js processing.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true
  const trimmed = ip.trim()
  if (!ipaddr.isValid(trimmed)) {
    return true // Unparseable or invalid IP is strictly rejected as unsafe
  }
  try {
    const processed = ipaddr.process(trimmed)
    return processed.range() !== 'unicast'
  } catch {
    return true
  }
}

export interface DestinationValidationResult {
  allowed: boolean
  resolvedIp?: string
  error?: string
  hostname?: string
  port?: number
  protocol?: string
}

/**
 * Validates destination URL against SSRF rules:
 * - Scheme must be http: or https:
 * - No userinfo credentials allowed
 * - Host must not be empty or loopback/localhost
 * - Resolves all DNS records and rejects if ANY answer is private/reserved
 * - Returns a pinned IP for DNS rebinding mitigation
 */
export async function validateDestinationUrl(
  rawUrl: string,
  allowLocalhostInDev: boolean = false
): Promise<DestinationValidationResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch (err: any) {
    return { allowed: false, error: `Malformed URL: ${err.message}` }
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      allowed: false,
      error: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    }
  }

  // Reject credentials in URL (e.g., http://user:pass@host)
  if (parsed.username || parsed.password) {
    return {
      allowed: false,
      error: 'URLs containing embedded credentials (user:pass@host) are rejected for security.',
    }
  }

  const hostname = parsed.hostname.toLowerCase().trim()
  if (!hostname) {
    return { allowed: false, error: 'Target URL hostname is missing.' }
  }

  // Check explicit localhost / loopback names
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '::1') {
    if (!allowLocalhostInDev) {
      return {
        allowed: false,
        error: 'Destination blocked: Access to localhost/loopback is strictly prohibited.',
      }
    }
  }

  // If hostname is directly an IP address
  const directIpType = net.isIP(hostname)
  if (directIpType !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      if (!allowLocalhostInDev || (hostname !== '127.0.0.1' && hostname !== '::1')) {
        return {
          allowed: false,
          error: `Destination blocked: IP address "${hostname}" is within a private, loopback, or reserved range.`,
        }
      }
    }
    return {
      allowed: true,
      resolvedIp: hostname,
      hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80,
      protocol: parsed.protocol,
    }
  }

  // Resolve DNS records for hostname
  try {
    const lookupResults = await dns.lookup(hostname, { all: true })
    if (!lookupResults || lookupResults.length === 0) {
      return { allowed: false, error: `DNS lookup failed: No addresses found for host "${hostname}".` }
    }

    // Inspect all resolved IP addresses
    for (const record of lookupResults) {
      if (isPrivateOrReservedIp(record.address)) {
        if (!allowLocalhostInDev || (record.address !== '127.0.0.1' && record.address !== '::1')) {
          return {
            allowed: false,
            error: `Destination blocked: Host "${hostname}" resolved to private/reserved IP address "${record.address}".`,
          }
        }
      }
    }

    // Pick first validated IP
    const pinnedIp = lookupResults[0].address

    return {
      allowed: true,
      resolvedIp: pinnedIp,
      hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80,
      protocol: parsed.protocol,
    }
  } catch (dnsErr: any) {
    return {
      allowed: false,
      error: `DNS resolution failed for host "${hostname}": ${dnsErr.message}`,
    }
  }
}

/**
 * Resolves a hostname directly to a pinned IP for custom Agent lookup,
 * preventing DNS rebinding attacks.
 */
export function pinnedLookup(
  pinnedIp: string,
  _hostname: string,
  optionsOrCallback: any,
  maybeCallback?: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
): void {
  const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
  const family = net.isIP(pinnedIp)
  if (!cb) return

  if (optionsOrCallback && typeof optionsOrCallback === 'object' && optionsOrCallback.all) {
    cb(null, [{ address: pinnedIp, family }])
  } else {
    cb(null, pinnedIp, family)
  }
}

/**
 * Creates custom HTTP / HTTPS agents that pin DNS lookup to the validated IP,
 * preventing DNS Rebinding attacks while preserving SNI and Host header.
 */
export function createPinnedAgent(pinnedIp: string, isHttps: boolean): http.Agent | https.Agent {
  const customLookup = (
    hostname: string,
    optionsOrCallback: any,
    maybeCallback?: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
  ) => {
    pinnedLookup(pinnedIp, hostname, optionsOrCallback, maybeCallback)
  }

  if (isHttps) {
    return new https.Agent({
      lookup: customLookup as any,
      keepAlive: false,
    })
  } else {
    return new http.Agent({
      lookup: customLookup as any,
      keepAlive: false,
    })
  }
}
