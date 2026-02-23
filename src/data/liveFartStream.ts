/**
 * GFMS Live Fart Stream
 *
 * Connects to the backend WebSocket and delivers real-time fart events.
 * Designed to integrate with any state management (Zustand, vanilla, etc.)
 *
 * Usage:
 *   const stream = createLiveFartStream({
 *     onEvent: (event) => store.addEvent(event),
 *     onStats: (stats) => store.updateStats(stats),
 *     onConnect: () => console.log('connected'),
 *     onDisconnect: () => console.log('disconnected'),
 *   })
 *
 *   // Later:
 *   stream.stop()
 */

import { io, type Socket } from 'socket.io-client'
import type { FartEvent, GFMSStats } from './apiClient'

export interface LiveStreamOptions {
  onEvent: (event: FartEvent) => void
  onStats?: (stats: GFMSStats) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export interface LiveStream {
  stop: () => void
  readonly connected: boolean
}

const API_URL = import.meta.env.VITE_API_URL || ''

export function createLiveFartStream(options: LiveStreamOptions): LiveStream {
  const { onEvent, onStats, onConnect, onDisconnect } = options

  const socket: Socket = io(API_URL || window.location.origin)

  socket.on('fart:new', (event: FartEvent) => {
    onEvent(event)
  })

  socket.on('fart:burst', (events: FartEvent[]) => {
    for (const event of events) {
      onEvent(event)
    }
  })

  if (onStats) {
    socket.on('stats:update', (stats: GFMSStats) => {
      onStats(stats)
    })
  }

  socket.on('connect', async () => {
    onConnect?.()
    // Load recent events to populate the view
    try {
      const res = await fetch(`${API_URL}/api/events?limit=200`)
      if (res.ok) {
        const events: FartEvent[] = await res.json()
        // Deliver oldest first so the store builds up chronologically
        for (let i = events.length - 1; i >= 0; i--) {
          onEvent(events[i])
        }
      }
    } catch {
      console.warn('[GFMS] Failed to load recent events')
    }
  })

  socket.on('disconnect', () => {
    onDisconnect?.()
  })

  return {
    stop() {
      socket.disconnect()
    },
    get connected() {
      return socket.connected
    },
  }
}
