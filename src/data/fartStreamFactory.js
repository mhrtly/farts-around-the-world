import { createFartStream } from './mockFartStream.js'

/**
 * Tries to connect to the live backend. Falls back to mock data
 * if the server isn't running. Uses relative URLs so it works
 * both in dev (via Vite proxy) and prod (served from Express).
 */
export async function createStream(onEvent) {
  try {
    const health = await fetch('/api/health', {
      signal: AbortSignal.timeout(2000)
    })
    if (health.ok) {
      const { createLiveFartStream } = await import('./liveFartStream.ts')
      console.log('[GFMS] Backend detected — using live data stream')
      return createLiveFartStream({ onEvent })
    }
  } catch {
    // Backend not available — fall through to mock
  }

  console.log('[GFMS] Backend not available — using mock data stream')
  return createFartStream(onEvent)
}
