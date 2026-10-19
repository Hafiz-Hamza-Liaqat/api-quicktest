export interface RateLimiterOptions {
  windowMs: number
  maxRequests: number
}

interface ClientRecord {
  count: number
  resetTime: number
}

export class MemoryRateLimiter {
  private records = new Map<string, ClientRecord>()
  private windowMs: number
  private maxRequests: number
  private cleanupInterval: NodeJS.Timeout

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.windowMs = options.windowMs || 60 * 1000 // 1 minute
    this.maxRequests = options.maxRequests || 60 // 60 requests / min
    // Cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 2 * 60 * 1000)
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  public check(clientIp: string): { allowed: boolean; limit: number; remaining: number; resetTime: number } {
    const now = Date.now()
    let record = this.records.get(clientIp)

    if (!record || now >= record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.windowMs,
      }
      this.records.set(clientIp, record)
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetTime: record.resetTime,
      }
    }

    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetTime: record.resetTime,
      }
    }

    record.count += 1
    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - record.count,
      resetTime: record.resetTime,
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [ip, record] of this.records.entries()) {
      if (now >= record.resetTime) {
        this.records.delete(ip)
      }
    }
  }

  public destroy(): void {
    clearInterval(this.cleanupInterval)
    this.records.clear()
  }
}
