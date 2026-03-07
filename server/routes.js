import { Router } from 'express'
import { validateFartEvent } from './validation.js'
import { insertEvent, getRecentEvents, getEventsByRange, getStats, getAudio } from './db.js'

const startTime = Date.now()

export default function createRoutes(io) {
  const router = Router()

  // Submit a fart event (with optional audio)
  router.post('/api/events', (req, res) => {
    const { valid, errors, event } = validateFartEvent(req.body)

    if (!valid) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      insertEvent(event)
      // Broadcast without audio data (too heavy for broadcast)
      const { audioData, ...eventWithoutAudio } = event
      const broadcastEvent = { ...eventWithoutAudio, hasAudio: !!audioData }
      io.emit('fart:new', broadcastEvent)
      res.status(201).json(broadcastEvent)
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to store event' })
    }
  })

  // Get recent events (no audio data — use /api/events/:id/audio for that)
  router.get('/api/events', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500)
    try {
      const events = getRecentEvents(limit)
      res.json(events)
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to fetch events' })
    }
  })

  // Get audio for a specific event
  router.get('/api/events/:id/audio', (req, res) => {
    try {
      const audioData = getAudio(req.params.id)
      if (!audioData) {
        return res.status(404).json({ error: 'No audio for this event' })
      }
      // Return as binary audio
      const buffer = Buffer.from(audioData, 'base64')
      res.setHeader('Content-Type', 'audio/webm')
      res.setHeader('Content-Length', buffer.length)
      res.end(buffer)
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to fetch audio' })
    }
  })

  // Get events by time range
  router.get('/api/events/range', (req, res) => {
    const start = parseInt(req.query.start)
    const end = parseInt(req.query.end)

    if (!start || !end || start > end) {
      return res.status(400).json({ error: 'start and end must be valid epoch timestamps with start <= end' })
    }

    try {
      const events = getEventsByRange(start, end)
      res.json(events)
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to fetch events' })
    }
  })

  // Aggregate stats
  router.get('/api/stats', (_req, res) => {
    try {
      const stats = getStats()
      res.json(stats)
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to compute stats' })
    }
  })

  // Health check
  router.get('/api/health', (_req, res) => {
    try {
      const stats = getStats()
      res.json({
        status: 'ok',
        uptime: Math.round((Date.now() - startTime) / 1000),
        eventCount: stats.totalAllTime,
      })
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message })
    }
  })

  return router
}
