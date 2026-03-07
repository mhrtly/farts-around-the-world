/**
 * GFMS Live Fart Stream
 *
 * Connects to the backend WebSocket and delivers real-time fart events.
 * Designed to integrate with the persisted REST bootstrap path in App.jsx.
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

export function createLiveFartStream(options: LiveStreamOptions): LiveStream {
  const { onEvent, onStats, onConnect, onDisconnect } = options

  // Connect to same origin — works in prod (Express serves everything)
  // and in dev (Vite proxy forwards to Express)
  const socket: Socket = io(window.location.origin)

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

  socket.on('connect', () => {
    onConnect?.()
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
