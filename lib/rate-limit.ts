// Simple in-memory rate limiter for MVP
// In production, use Redis or a proper rate limiting service

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 100 // requests per window

// Clean up old entries periodically (only initialize once)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    // Use Array.from to convert Map entries to array for ES5 compatibility
    const entries = Array.from(rateLimitMap.entries())
    for (let i = 0; i < entries.length; i++) {
      const [key, entry] = entries[i]
      if (now > entry.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }, RATE_LIMIT_WINDOW)
}

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}
