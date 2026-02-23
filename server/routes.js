import { Router } from 'express'
import { validateFartEvent } from './validation.js'
import { insertEvent, getRecentEvents, getEventsByRange, getStats } from './db.js'

const startTime = Date.now()

export default function createRoutes(io) {
  const router = Router()

  // Submit a fart event
  router.post('/api/events', (req, res) => {
    const { valid, errors, event } = validateFartEvent(req.body)

    if (!valid) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      insertEvent(event)
      io.emit('fart:new', event)
      res.status(201).json(event)
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to store event' })
    }
  })

  // Get recent events
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
