import { createFartStream } from './mockFartStream.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Tries to connect to the live backend. Falls back to mock data
 * if the server isn't running.
 */
export async function createStream(onEvent) {
  try {
    const health = await fetch(`${API_URL}/api/health`, {
      signal: AbortSignal.timeout(2000)
    })
    if (health.ok) {
      // Dynamic import so socket.io-client isn't bundled if unused
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
