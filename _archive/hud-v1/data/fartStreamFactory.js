/**
 * Tries to connect to the live backend. If the server isn't running,
 * returns a no-op stream — only real data is shown.
 *
 * @param {Object} options
 * @param {Function} options.onEvent - Called when a new event arrives
 * @param {Function} [options.onConnect] - Called when WebSocket connects
 * @param {Function} [options.onDisconnect] - Called when WebSocket disconnects
 */
export async function createStream({ onEvent, onConnect, onDisconnect } = {}) {
  try {
    const health = await fetch('/api/health', {
      signal: AbortSignal.timeout(2000)
    })
    if (health.ok) {
      const { createLiveFartStream } = await import('./liveFartStream.ts')
      console.log('[FATWA] Backend detected — using live data stream')
      return createLiveFartStream({ onEvent, onConnect, onDisconnect })
    }
  } catch {
    // Backend not available
  }

  console.log('[FATWA] Backend not available — waiting for server')
  onDisconnect?.()
  return { stop() {}, connected: false }
}
