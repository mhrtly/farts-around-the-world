import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { existsSync } from 'fs'
import createRoutes from './routes.js'
import { getStats } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const DIST_DIR = resolve(__dirname, '..', 'dist')

const app = express()
const httpServer = createServer(app)

// Socket.IO — allow any origin in production (single server serves everything)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(cors())
app.use(express.json({ limit: '1kb' }))

// Rate limiting
app.use('/api/events', rateLimit({
  windowMs: 60_000,
  max: (req) => req.method === 'POST' ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
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
