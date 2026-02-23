import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import createRoutes from './routes.js'
import { getStats } from './db.js'

const PORT = process.env.PORT || 3001

const app = express()
const httpServer = createServer(app)

// Socket.IO with CORS for Vite dev server
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
  ],
}))
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
