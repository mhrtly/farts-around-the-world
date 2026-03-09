import { Router } from 'express'
import { validateFartEvent } from './validation.js'
import {
  insertEvent,
  getRecentEvents,
  getEventsByRange,
  getStats,
  getAudio,
  updateEventRating,
  getArchiveAudioDir,
  getArchiveClip,
  getArchiveClipCount,
  getArchiveAudioPath,
  insertArchiveTags,
  isArchiveAudioAvailable,
  listArchiveClips,
} from './db.js'
import { ensureArchiveDataset, getArchiveStatus } from './archiveDataset.js'

const startTime = Date.now()
const ARCHIVE_SORT_OPTIONS = new Set(['random', 'untagged', 'most-tagged'])

function normalizeArchiveTag(rawTag) {
  if (typeof rawTag !== 'string') {
    return null
  }

  const displayTag = rawTag
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9\s'-]/g, '')
    .slice(0, 32)

  if (!displayTag || displayTag.length < 2) {
    return null
  }

  return {
    displayTag,
    normalizedTag: displayTag.toLowerCase(),
  }
}

function serializeArchiveClip(clip) {
  if (!clip) {
    return null
  }

  return {
    id: clip.id,
    fileName: clip.fileName,
    tagCount: clip.tagCount,
    tags: clip.tags,
    audioUrl: `/api/archive/clips/${encodeURIComponent(clip.id)}/audio`,
  }
}

export default function createRoutes(io) {
  const router = Router()

  // Submit a fart event (with optional audio)
  router.post('/api/events', (req, res) => {
    const { valid, errors, event } = validateFartEvent(req.body)
    const requestId = req.requestId || `req-${Date.now().toString(36)}`

    if (!valid) {
      console.warn(`[INGEST VALIDATION] ${requestId} ${errors.join(' | ')}`)
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        stage: 'validation',
        code: 'INVALID_EVENT_PAYLOAD',
        requestId,
      })
    }

    try {
      insertEvent(event)
      // Broadcast without audio data (too heavy for broadcast)
      const { audioData, ...eventWithoutAudio } = event
      const broadcastEvent = {
        ...eventWithoutAudio,
        hasAudio: !!audioData,
        ingest: {
          stage: 'stored',
          requestId,
        },
      }
      io.emit('fart:new', broadcastEvent)
      res.status(201).json(broadcastEvent)
    } catch (err) {
      console.error(`[INGEST STORE] ${requestId} ${err.stack || err.message}`)
      res.status(500).json({
        error: 'Failed to store event',
        stage: 'storage',
        code: 'EVENT_STORE_FAILED',
        requestId,
      })
    }
  })

  // Get recent events (no audio data — use /api/events/:id/audio for that)
  router.get('/api/events', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 500)
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
      const audio = getAudio(req.params.id)
      if (!audio) {
        return res.status(404).json({ error: 'No audio for this event' })
      }
      // Return as binary audio
      const buffer = Buffer.from(audio.audioData, 'base64')
      res.setHeader('Content-Type', audio.audioMimeType || 'audio/webm')
      res.setHeader('Content-Length', buffer.length)
      res.end(buffer)
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to fetch audio' })
    }
  })

  // Rate a fart event
  router.patch('/api/events/:id/rate', (req, res) => {
    const { rating } = req.body
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10) {
      return res.status(400).json({ error: 'rating must be an integer between 1 and 10' })
    }
    try {
      const updated = updateEventRating(req.params.id, rating)
      if (!updated) {
        return res.status(404).json({ error: 'Event not found' })
      }
      res.json({ id: req.params.id, rating })
    } catch (err) {
      console.error('[DB ERROR]', err.message)
      res.status(500).json({ error: 'Failed to update rating' })
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

  router.get('/api/archive/clips', (req, res) => {
    if (!isArchiveAudioAvailable()) {
      ensureArchiveDataset().catch(err => {
        console.error('[ARCHIVE ERROR]', err.message)
      })
      return res.status(503).json({
        error: 'Archive dataset is still syncing to server storage',
        archiveAudioDir: getArchiveAudioDir(),
        ...getArchiveStatus(),
      })
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 24)
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
    const sort = ARCHIVE_SORT_OPTIONS.has(req.query.sort) ? req.query.sort : 'random'

    try {
      const clips = listArchiveClips({ limit, offset, sort }).map(serializeArchiveClip)
      res.json({
        clips,
        total: getArchiveClipCount(),
        limit,
        offset,
        sort,
      })
    } catch (err) {
      console.error('[ARCHIVE ERROR]', err.message)
      res.status(500).json({ error: 'Failed to load archive clips' })
    }
  })

  router.get('/api/archive/clips/:clipId/audio', (req, res) => {
    try {
      const filePath = getArchiveAudioPath(req.params.clipId)
      if (!filePath) {
        if (!isArchiveAudioAvailable()) {
          ensureArchiveDataset().catch(err => {
            console.error('[ARCHIVE ERROR]', err.message)
          })
          return res.status(503).json({
            error: 'Archive dataset is still syncing to server storage',
            archiveAudioDir: getArchiveAudioDir(),
            ...getArchiveStatus(),
          })
        }

        return res.status(404).json({ error: 'Archive clip not found' })
      }

      res.type('audio/wav')
      res.sendFile(filePath)
    } catch (err) {
      console.error('[ARCHIVE ERROR]', err.message)
      res.status(500).json({ error: 'Failed to stream archive audio' })
    }
  })

  router.post('/api/archive/clips/:clipId/tags', (req, res) => {
    try {
      if (!getArchiveClip(req.params.clipId)) {
        return res.status(404).json({ error: 'Archive clip not found' })
      }

      const submittedTags = Array.isArray(req.body?.tags) ? req.body.tags : []
      const normalizedTags = []
      const seen = new Set()

      for (const rawTag of submittedTags) {
        const normalized = normalizeArchiveTag(rawTag)
        if (!normalized) {
          continue
        }

        if (seen.has(normalized.normalizedTag)) {
          continue
        }

        seen.add(normalized.normalizedTag)
        normalizedTags.push(normalized)
      }

      if (!normalizedTags.length) {
        return res.status(400).json({ error: 'Provide at least one valid tag' })
      }

      if (normalizedTags.length > 8) {
        return res.status(400).json({ error: 'Limit tag submissions to 8 at a time' })
      }

      const clip = insertArchiveTags(req.params.clipId, normalizedTags)
      res.status(201).json({ clip: serializeArchiveClip(clip) })
    } catch (err) {
      console.error('[ARCHIVE ERROR]', err.message)
      res.status(500).json({ error: 'Failed to save archive tags' })
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
        archiveClipsAvailable: getArchiveClipCount(),
        archiveStatus: getArchiveStatus(),
      })
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message })
    }
  })

  return router
}
