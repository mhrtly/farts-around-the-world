import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'farts.db')

const db = new Database(DB_PATH)

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id        TEXT PRIMARY KEY,
    lat       REAL NOT NULL,
    lng       REAL NOT NULL,
    intensity INTEGER NOT NULL CHECK(intensity >= 1 AND intensity <= 10),
    country   TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    type      TEXT NOT NULL CHECK(type IN ('standard','epic','silent-but-deadly')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
`)

// Add audio column if it doesn't exist (migration-safe)
try {
  db.exec(`ALTER TABLE events ADD COLUMN audio_data TEXT DEFAULT NULL`)
} catch {
  // Column already exists — ignore
}

// Prepared statements
const stmts = {
  insert: db.prepare(`
    INSERT INTO events (id, lat, lng, intensity, country, timestamp, type, audio_data)
    VALUES (@id, @lat, @lng, @intensity, @country, @timestamp, @type, @audioData)
  `),

  recent: db.prepare(`
    SELECT id, lat, lng, intensity, country, timestamp, type,
           CASE WHEN audio_data IS NOT NULL THEN 1 ELSE 0 END as hasAudio
    FROM events ORDER BY timestamp DESC LIMIT ?
  `),

  range: db.prepare(`
    SELECT id, lat, lng, intensity, country, timestamp, type,
           CASE WHEN audio_data IS NOT NULL THEN 1 ELSE 0 END as hasAudio
    FROM events WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `),

  audio: db.prepare(`
    SELECT audio_data FROM events WHERE id = ?
  `),

  countToday: db.prepare(`
    SELECT COUNT(*) as count FROM events WHERE timestamp >= ?
  `),

  countAll: db.prepare(`
    SELECT COUNT(*) as count FROM events
  `),

  topCountry: db.prepare(`
    SELECT country, COUNT(*) as count FROM events
    WHERE timestamp >= ?
    GROUP BY country ORDER BY count DESC LIMIT 1
  `),

  eventsByType: db.prepare(`
    SELECT type, COUNT(*) as count FROM events
    WHERE timestamp >= ?
    GROUP BY type
  `),
}

export function insertEvent(event) {
  stmts.insert.run(event)
}

export function getRecentEvents(limit = 200) {
  return stmts.recent.all(Math.min(limit, 500))
}

export function getEventsByRange(start, end) {
  return stmts.range.all(start, end)
}

export function getAudio(eventId) {
  const row = stmts.audio.get(eventId)
  return row?.audio_data || null
}

export function getStats() {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEpoch = todayStart.getTime()

  const totalToday = stmts.countToday.get(todayEpoch).count
  const totalAllTime = stmts.countAll.get().count
  const topRow = stmts.topCountry.get(todayEpoch)
  const typeRows = stmts.eventsByType.all(todayEpoch)

  const eventsByType = {}
  for (const row of typeRows) {
    eventsByType[row.type] = row.count
  }

  return {
    totalToday,
    totalAllTime,
    topCountry: topRow?.country ?? '—',
    eventsByType,
  }
}

export default db
