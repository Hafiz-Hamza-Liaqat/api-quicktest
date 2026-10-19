import dns from 'dns/promises'
import net from 'net'
import http from 'http'
import https from 'https'

/**
 * Converts an IPv4 dotted string to a 32-bit unsigned number.
 */
export function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`)
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/**
 * Checks if a 32-bit IPv4 address falls within a given CIDR block.
 */
function inIpv4Range(ipNum: number, baseIpStr: string, maskBits: number): boolean {
  const baseNum = ipv4ToNumber(baseIpStr)
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0
  return (ipNum & mask) === (baseNum & mask)
}

/**
 * Checks if an IPv4 address is private, loopback, link-local, reserved, or multicast.
 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  try {
    const num = ipv4ToNumber(ip)

    // 0.0.0.0/8 Current network
    if (inIpv4Range(num, '0.0.0.0', 8)) return true
    // 10.0.0.0/8 Private network
    if (inIpv4Range(num, '10.0.0.0', 8)) return true
    // 127.0.0.0/8 Loopback
    if (inIpv4Range(num, '127.0.0.0', 8)) return true
    // 169.254.0.0/16 Link-local (Cloud metadata e.g. 169.254.169.254)
    if (inIpv4Range(num, '169.254.0.0', 16)) return true
    // 172.16.0.0/12 Private network
    if (inIpv4Range(num, '172.16.0.0', 12)) return true
    // 192.168.0.0/16 Private network
    if (inIpv4Range(num, '192.168.0.0', 16)) return true
    // 192.0.0.0/24 IETF Protocol Assignments
    if (inIpv4Range(num, '192.0.0.0', 24)) return true
    // 192.0.2.0/24 Documentation (TEST-NET-1)
    if (inIpv4Range(num, '192.0.2.0', 24)) return true
    // 198.51.100.0/24 Documentation (TEST-NET-2)
    if (inIpv4Range(num, '198.51.100.0', 24)) return true
    // 203.0.113.0/24 Documentation (TEST-NET-3)
    if (inIpv4Range(num, '203.0.113.0', 24)) return true
    // 224.0.0.0/4 Multicast
    if (inIpv4Range(num, '224.0.0.0', 4)) return true
    // 240.0.0.0/4 Reserved
    if (inIpv4Range(num, '240.0.0.0', 4)) return true
    // 255.255.255.255 Broadcast
    if (num === 0xffffffff) return true

    return false
  } catch {
    return true
  }
}

/**
 * Checks if an IPv6 address is private, loopback, link-local, unique-local, or multicast.
 */
export function isPrivateOrReservedIpv6(ip: string): boolean {
  const norm = ip.toLowerCase().trim()

  // Loopback and unspecified
  if (norm === '::' || norm === '::1') return true

  // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (norm.startsWith('::ffff:')) {
    const remainder = norm.slice(7)
    if (net.isIPv4(remainder)) {
      return isPrivateOrReservedIpv4(remainder)
    }
  }

  // Unique local addresses (fc00::/7) - starts with fc or fd
  if (/^f[cd][0-9a-f]{2}:/i.test(norm)) return true

  // Link-local addresses (fe80::/10) - starts with fe8, fe9, fea, feb
  if (/^fe[89ab][0-9a-f]:/i.test(norm)) return true

  // Multicast (ff00::/8)
  if (/^ff[0-9a-f]{2}:/i.test(norm)) return true

  // Discard prefix (100::/64)
  if (norm.startsWith('100:')) return true

  return false
}

/**
 * Validates any IP address (IPv4 or IPv6)
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const ipType = net.isIP(ip)
  if (ipType === 4) {
    return isPrivateOrReservedIpv4(ip)
  }
  if (ipType === 6) {
    return isPrivateOrReservedIpv6(ip)
  }
  return true // Not a valid IP -> consider unsafe
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
 * Creates custom HTTP / HTTPS agents that pin DNS lookup to the validated IP,
 * preventing DNS Rebinding attacks while preserving SNI and Host header.
 */
export function createPinnedAgent(pinnedIp: string, isHttps: boolean): http.Agent | https.Agent {
  const customLookup: typeof dns.lookup = ((
    _hostname: string,
    _options: any,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  ) => {
    const family = net.isIP(pinnedIp)
    callback(null, pinnedIp, family)
  }) as any

  if (isHttps) {
    return new https.Agent({
      lookup: customLookup,
      keepAlive: false,
    })
  } else {
    return new http.Agent({
      lookup: customLookup,
      keepAlive: false,
    })
  }
}
