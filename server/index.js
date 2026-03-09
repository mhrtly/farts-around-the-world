import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import createRoutes from './routes.js'
import { getStats } from './db.js'
import { primeArchiveDataset } from './archiveDataset.js'

// One-time cleanup: remove old archive cache from persistent disk.
// Archive audio now lives in /tmp (ephemeral) to free disk space for SQLite.
const OLD_ARCHIVE_PATH = '/data/archive-cache'
if (existsSync(OLD_ARCHIVE_PATH)) {
  rm(OLD_ARCHIVE_PATH, { recursive: true, force: true })
    .then(() => console.log('[CLEANUP] Removed old archive cache from persistent disk'))
    .catch(err => console.warn('[CLEANUP] Could not remove old archive cache:', err.message))
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const DIST_DIR = resolve(__dirname, '..', 'dist')

const app = express()
const httpServer = createServer(app)

function normalizeJsonContentTypeHeader(contentType) {
  if (typeof contentType !== 'string') {
    return contentType
  }

  const [mimeType, ...params] = contentType.split(';')
  if (!/^\s*application\/(?:[a-z0-9.+-]+\+)?json\s*$/i.test(mimeType)) {
    return contentType
  }

  const sanitizedParams = []

  for (const rawParam of params) {
    const [rawKey, ...rawValueParts] = rawParam.split('=')
    const key = rawKey?.trim().toLowerCase()
    const value = rawValueParts.join('=').trim().replace(/^"+|"+$/g, '')

    if (!key) {
      continue
    }

    if (key === 'charset') {
      const normalizedValue = value.toLowerCase()
      if (normalizedValue === 'utf-8' || normalizedValue === 'utf8') {
        sanitizedParams.push('charset=utf-8')
      }
      continue
    }

    sanitizedParams.push(`${key}=${value}`)
  }

  return [mimeType.trim(), ...sanitizedParams].join('; ')
}

// Socket.IO — allow any origin in production (single server serves everything)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(cors())
app.use((req, _res, next) => {
  req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  req.headers['content-type'] = normalizeJsonContentTypeHeader(req.headers['content-type'])
  next()
})
app.use(express.json({ limit: '2mb' })) // allows 10s fallback formats like AAC/MP4/WAV with base64 overhead
app.use((err, req, res, next) => {
  if (!err) {
    return next()
  }

  if (err.type === 'entity.too.large') {
    console.error(`[INGEST PARSE] ${req.requestId} payload too large`)
    return res.status(413).json({
      error: 'Audio payload is too large',
      stage: 'parse',
      code: 'PAYLOAD_TOO_LARGE',
      requestId: req.requestId,
    })
  }

  if (err.type === 'entity.parse.failed' || err.type === 'charset.unsupported' || err.status === 415) {
    console.error(`[INGEST PARSE] ${req.requestId} ${err.message}`)
    return res.status(err.status || 400).json({
      error: 'Request body could not be parsed as JSON',
      stage: 'parse',
      code: err.type === 'charset.unsupported' ? 'UNSUPPORTED_CHARSET' : 'INVALID_JSON_BODY',
      requestId: req.requestId,
    })
  }

  return next(err)
})

// Rate limiting
app.use('/api/events', rateLimit({
  windowMs: 60_000,
  max: (req) => req.method === 'POST' ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
}))

app.use('/api/archive', rateLimit({
  windowMs: 60_000,
  max: (req) => req.method === 'POST' ? 90 : 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many archive requests, please try again later' },
}))

// Routes
app.use(createRoutes(io))

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`)
  })
})

// Periodic stats broadcast
setInterval(() => {
  try {
    const stats = getStats()
    io.emit('stats:update', stats)
  } catch (err) {
    console.error('[STATS ERROR]', err.message)
  }
}, 5000)

// Serve built frontend (production mode)
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  // SPA fallback: serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(DIST_DIR, 'index.html'))
    }
  })
  console.log(`[STATIC] Serving frontend from ${DIST_DIR}`)
}

// Start
httpServer.listen(PORT, () => {
  primeArchiveDataset()
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  GFMS Backend Server v1.0                    ║
  ║  Global Flatulence Monitoring System          ║
  ╠══════════════════════════════════════════════╣
  ║  REST API:    http://localhost:${PORT}/api     ║
  ║  WebSocket:   ws://localhost:${PORT}           ║
  ║  Health:      http://localhost:${PORT}/api/health ║
  ╚══════════════════════════════════════════════╝
  `)
})
