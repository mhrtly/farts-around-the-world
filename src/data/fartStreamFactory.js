/**
 * Tries to connect to the live backend. If the server isn't running,
 * returns a no-op stream — only real data is shown.
 */
export async function createStream(onEvent) {
  try {
    const health = await fetch('/api/health', {
      signal: AbortSignal.timeout(2000)
    })
    if (health.ok) {
      const { createLiveFartStream } = await import('./liveFartStream.ts')
      console.log('[FATWA] Backend detected — using live data stream')
      return createLiveFartStream({ onEvent })
    }
  } catch {
    // Backend not available
  }

  console.log('[FATWA] Backend not available — waiting for server')
  return { stop() {} }
}
