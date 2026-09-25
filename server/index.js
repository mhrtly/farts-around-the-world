import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

// Load .env from server/ directory (cwd may be project root)
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') })

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { existsSync, readFileSync } from 'fs'
import { rm, appendFile } from 'fs/promises'
import createRoutes from './routes.js'
import { getEvent } from './db.js'
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

// On Render the app sits behind one proxy: trust it so req.ip is the visitor's
// (rate limits are per person, not shared by everyone) and req.protocol is https.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

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
// (No Clerk middleware: no route needs a signed-in user, and it redirected
// every first page load through Clerk's handshake.)
app.use((req, _res, next) => {
  req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  req.headers['content-type'] = normalizeJsonContentTypeHeader(req.headers['content-type'])
  next()
})
// Rate limiting — mounted before body parsing so an over-limit upload is
// refused before its ~1 MB body is read. Audio files never change and are
// cached for a year, so they get their own looser budget: opening one card
// can take 3-4 requests (analysis fetch + the audio element's byte ranges).
const isAudioFile = req => req.method !== 'POST' && /^\/[^/]+\/audio\/?$/.test(req.path)
const limiter = (max, skip, error = 'Too many requests, please try again later') => rateLimit({
  windowMs: 60_000,
  max,
  skip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error },
})
// Separate counters, so browsing never uses up someone's posts
app.use('/api/events', limiter(10, req => req.method !== 'POST', 'Too many posts from your network just now. Try again in a minute.'))
app.use('/api/events', limiter(120, req => req.method === 'POST' || isAudioFile(req)))
app.use('/api/events', limiter(600, req => !isAudioFile(req)))

app.use('/api/archive', rateLimit({
  windowMs: 60_000,
  max: (req) => req.method === 'POST' ? 90 : 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many archive requests, please try again later' },
}))

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

// Routes
app.use(createRoutes(io))

// Unknown API routes get a JSON 404 instead of hanging on the SPA fallback.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`)
  })
})


// Serve Cmd+Up as a standalone static app
const CMD_UP_DIR = resolve(__dirname, '..', 'cmd-up')
const CMD_UP_FEEDBACK = join(CMD_UP_DIR, 'FEEDBACK.md')

app.post('/cmd-up/feedback', async (req, res) => {
  try {
    const { message } = req.body || {}
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Empty message' })
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const entry = `\n---\n**${ts}**\n\n${message.trim()}\n`
    await appendFile(CMD_UP_FEEDBACK, entry)
    console.log(`[CMD-UP FEEDBACK] ${ts}: ${message.trim().slice(0, 80)}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[CMD-UP FEEDBACK ERROR]', err.message)
    res.status(500).json({ error: 'Failed to save feedback' })
  }
})

app.use('/cmd-up', express.static(CMD_UP_DIR))

// Serve built frontend (production mode)
if (existsSync(DIST_DIR)) {
  // Shared links (/r/:id) get their own link-preview title, e.g.
  // "A fart from Grand Canyon Village, Arizona" in iMessage or Slack.
  const indexHtmlPath = join(DIST_DIR, 'index.html')
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
  let indexHtmlCache = null

  app.get('/r/:id', (req, res, next) => {
    try {
      const event = getEvent(req.params.id)
      if (!event) return next()
      indexHtmlCache = indexHtmlCache || readFileSync(indexHtmlPath, 'utf8')
      // Country name, if known ('XX' means we couldn't tell)
      let country = event.country && event.country !== 'XX' ? event.country : null
      if (country) {
        try { country = regionNames.of(country) } catch { /* keep the code */ }
      }
      const where = event.place
        ? (country && !event.place.includes(country) ? `${event.place}, ${country}` : event.place)
        : (country || 'somewhere on Earth')
      const d = Number(event.duration)
      const seconds = !Number.isFinite(d) || d <= 0 ? 'A few seconds'
        : d < 1 ? `${d.toFixed(2)} seconds`
        : `${Math.round(d * 10) / 10} second${Math.round(d * 10) / 10 === 1 ? '' : 's'}`
      const title = escapeHtml(`A fart from ${where}`)
      const description = escapeHtml(`${seconds} of real audio, pinned where it happened. Tap to listen on Farts Around the World.`)
      const origin = `${req.protocol}://${req.get('host')}`
      const url = escapeHtml(`${origin}/r/${event.id}`)
      const image = escapeHtml(`${origin}/share.jpg`)
      // The page carries its recording, so the splash can title it and the card
      // can open before the list loads. (No audio preload: on slow connections
      // it delayed the page itself; the audio streams after the PLAY tap.)
      const shared = JSON.stringify(event).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
      const html = indexHtmlCache
        .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, (_, open, close) => `${open}${title}${close}`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/, (_, open, close) => `${open}${description}${close}`)
        .replace(/(<meta name="description" content=")[^"]*(")/, (_, open, close) => `${open}${description}${close}`)
        .replace(/(<meta property="og:image" content=")[^"]*(")/, (_, open, close) => `${open}${image}${close}`)
        .replace(/(<meta property="og:url" content=")[^"]*(")/, (_, open, close) => `${open}${url}${close}`)
        .replace('</head>', () => `    <script>window.__FATW_SHARED__ = ${shared}</script>\n  </head>`)
      res.set('Cache-Control', 'no-cache').send(html)
    } catch (err) {
      console.error('[SHARE PREVIEW]', err.message)
      next()
    }
  })

  // Built files have content hashes in their names: cache them for a year, and
  // a missing one is a real 404 (not the app's HTML).
  app.use('/assets', express.static(join(DIST_DIR, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }))
  app.use(express.static(DIST_DIR, {
    setHeaders(res, filePath) {
      res.setHeader('Cache-Control', filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=604800')
    },
  }))
  // SPA fallback: serve index.html for any non-API route
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/cmd-up')) {
      return next()
    }
    res.set('Cache-Control', 'no-cache').sendFile(join(DIST_DIR, 'index.html'))
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
