import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'farts.db')

const db = new Database(DB_PATH)

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')
db.pragma('synchronous = NORMAL')

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

// Add user_rating column (migration-safe)
try {
  db.exec(`ALTER TABLE events ADD COLUMN user_rating INTEGER DEFAULT NULL`)
} catch {
  // Column already exists — ignore
}

// Add audio stats columns (migration-safe)
for (const col of ['duration REAL DEFAULT NULL', 'volume REAL DEFAULT NULL', 'peak_volume REAL DEFAULT NULL']) {
  try { db.exec(`ALTER TABLE events ADD COLUMN ${col}`) } catch { /* exists */ }
}

const legacyNonAudioCount = db.prepare(`
  SELECT COUNT(*) as count FROM events WHERE audio_data IS NULL
`).get().count

if (legacyNonAudioCount > 0) {
  db.prepare(`DELETE FROM events WHERE audio_data IS NULL`).run()
  console.log(`[DB] Removed ${legacyNonAudioCount} legacy non-audio event(s) from ${DB_PATH}`)
}

// Prepared statements
const stmts = {
  insert: db.prepare(`
    INSERT INTO events (id, lat, lng, intensity, country, timestamp, type, audio_data, duration, volume, peak_volume)
    VALUES (@id, @lat, @lng, @intensity, @country, @timestamp, @type, @audioData, @duration, @volume, @peakVolume)
  `),

  recent: db.prepare(`
    SELECT id, lat, lng, intensity, country, timestamp, type,
           CASE WHEN audio_data IS NOT NULL THEN 1 ELSE 0 END as hasAudio,
           user_rating, duration, volume, peak_volume as peakVolume
    FROM events
    WHERE audio_data IS NOT NULL
    ORDER BY timestamp DESC LIMIT ?
  `),

  range: db.prepare(`
    SELECT id, lat, lng, intensity, country, timestamp, type,
           CASE WHEN audio_data IS NOT NULL THEN 1 ELSE 0 END as hasAudio,
           user_rating, duration, volume, peak_volume as peakVolume
    FROM events
    WHERE audio_data IS NOT NULL
      AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `),

  audio: db.prepare(`
    SELECT audio_data FROM events WHERE id = ?
  `),

  countToday: db.prepare(`
    SELECT COUNT(*) as count
    FROM events
    WHERE audio_data IS NOT NULL AND timestamp >= ?
  `),

  countAll: db.prepare(`
    SELECT COUNT(*) as count
    FROM events
    WHERE audio_data IS NOT NULL
  `),

  topCountry: db.prepare(`
    SELECT country, COUNT(*) as count FROM events
    WHERE audio_data IS NOT NULL AND timestamp >= ?
    GROUP BY country ORDER BY count DESC LIMIT 1
  `),

  eventsByType: db.prepare(`
    SELECT type, COUNT(*) as count FROM events
    WHERE audio_data IS NOT NULL AND timestamp >= ?
    GROUP BY type
  `),

  uniqueCountriesToday: db.prepare(`
    SELECT COUNT(DISTINCT country) as count
    FROM events
    WHERE audio_data IS NOT NULL AND timestamp >= ?
  `),

  audioCountToday: db.prepare(`
    SELECT COUNT(*) as count FROM events WHERE timestamp >= ? AND audio_data IS NOT NULL
  `),

  avgDurationToday: db.prepare(`
    SELECT AVG(duration) as avg, MAX(duration) as max
    FROM events
    WHERE audio_data IS NOT NULL AND timestamp >= ? AND duration IS NOT NULL
  `),

  avgVolumeToday: db.prepare(`
    SELECT AVG(volume) as avg, MAX(volume) as max
    FROM events
    WHERE audio_data IS NOT NULL AND timestamp >= ? AND volume IS NOT NULL
  `),

  countryLeaderboard: db.prepare(`
    SELECT country, COUNT(*) as count FROM events
    WHERE audio_data IS NOT NULL AND timestamp >= ?
    GROUP BY country ORDER BY count DESC LIMIT 10
  `),

  updateRating: db.prepare(`
    UPDATE events SET user_rating = ? WHERE id = ?
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

export function getDatabasePath() {
  return DB_PATH
}

export function updateEventRating(id, rating) {
  const result = stmts.updateRating.run(rating, id)
  return result.changes > 0
}

export function getStats() {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEpoch = todayStart.getTime()

  const totalToday = stmts.countToday.get(todayEpoch).count
  const totalAllTime = stmts.countAll.get().count
  const topRow = stmts.topCountry.get(todayEpoch)
  const typeRows = stmts.eventsByType.all(todayEpoch)
  const uniqueCountries = stmts.uniqueCountriesToday.get(todayEpoch).count
  const audioCount = stmts.audioCountToday.get(todayEpoch).count
  const durationStats = stmts.avgDurationToday.get(todayEpoch)
  const volumeStats = stmts.avgVolumeToday.get(todayEpoch)
  const leaderboard = stmts.countryLeaderboard.all(todayEpoch)

  const eventsByType = {}
  for (const row of typeRows) {
    eventsByType[row.type] = row.count
  }

  return {
    totalToday,
    totalAllTime,
    topCountry: topRow?.country ?? '\u2014',
    topCountryCount: topRow?.count ?? 0,
    eventsByType,
    uniqueCountries,
    audioCount,
    avgDuration: durationStats?.avg ? Math.round(durationStats.avg * 10) / 10 : null,
    maxDuration: durationStats?.max ? Math.round(durationStats.max * 10) / 10 : null,
    avgVolume: volumeStats?.avg ? Math.round(volumeStats.avg * 10) / 10 : null,
    maxVolume: volumeStats?.max ? Math.round(volumeStats.max * 10) / 10 : null,
    leaderboard,
  }
}

export default db
