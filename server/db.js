import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join, extname, basename } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { getArchiveAudioDir as resolveArchiveAudioDir } from './archiveDataset.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || join(__dirname, 'farts.db')
const db = new Database(DB_PATH)
let archiveCatalogCache = { dir: null, clips: [] }

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

  CREATE TABLE IF NOT EXISTS archive_clip_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clip_id TEXT NOT NULL,
    normalized_tag TEXT NOT NULL,
    display_tag TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_archive_clip_tags_clip_id ON archive_clip_tags(clip_id);
  CREATE INDEX IF NOT EXISTS idx_archive_clip_tags_normalized_tag ON archive_clip_tags(normalized_tag);
`)

// Add audio column if it doesn't exist (migration-safe)
try {
  db.exec(`ALTER TABLE events ADD COLUMN audio_data TEXT DEFAULT NULL`)
} catch {
  // Column already exists — ignore
}

// Preserve the original browser MIME type for playback compatibility.
try {
  db.exec(`ALTER TABLE events ADD COLUMN audio_mime_type TEXT DEFAULT NULL`)
} catch (err) {
  if (!String(err?.message || '').includes('duplicate column name')) {
    console.warn(`[DB] Unable to add audio_mime_type column: ${err.message}`)
  }
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

// Human-readable place name ("Grand Canyon Village, Arizona"), a hashed token
// that lets the original poster delete their own recording, and the client's
// own id for the post so a retried upload doesn't create a duplicate.
for (const col of ['place TEXT DEFAULT NULL', 'delete_token_hash TEXT DEFAULT NULL', 'client_post_id TEXT DEFAULT NULL']) {
  try { db.exec(`ALTER TABLE events ADD COLUMN ${col}`) } catch { /* exists */ }
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_events_client_post_id ON events(client_post_id) WHERE client_post_id IS NOT NULL`)

// Public coordinates are rounded to ~1 km so a recording never pins someone's front door.
export const PUBLIC_COORD_DECIMALS = 2
export const MIN_AUDIO_BASE64 = 1400

// A few early test rows stored placeholder text instead of audio. Anything
// under ~1 KB can't be a real recording, so it's left out of public results
// (kept in the table, not deleted).
// The stored size is kept in its own column: measuring length(audio_data)
// would read every recording off disk on each query.
try { db.exec(`ALTER TABLE events ADD COLUMN audio_size INTEGER DEFAULT NULL`) } catch { /* exists */ }
db.exec(`UPDATE events SET audio_size = length(audio_data) WHERE audio_size IS NULL AND audio_data IS NOT NULL`)
const PLAYABLE = `audio_data IS NOT NULL AND COALESCE(audio_size, ${MIN_AUDIO_BASE64}) >= ${MIN_AUDIO_BASE64}`

const legacyNonAudioCount = db.prepare(`
  SELECT COUNT(*) as count FROM events WHERE audio_data IS NULL
`).get().count

const eventColumns = new Set(
  db.prepare(`PRAGMA table_info(events)`).all().map(column => column.name)
)
const hasAudioMimeTypeColumn = eventColumns.has('audio_mime_type')

if (!hasAudioMimeTypeColumn) {
  console.warn('[DB] events.audio_mime_type unavailable; falling back to legacy audio storage')
}

if (legacyNonAudioCount > 0) {
  db.prepare(`DELETE FROM events WHERE audio_data IS NULL`).run()
  console.log(`[DB] Removed ${legacyNonAudioCount} legacy non-audio event(s) from ${DB_PATH}`)
}

// Recordings posted before the recorder measured anything stored the whole
// clip length as "duration" and no loudness or place. Fill in the real values
// (measured from each stored file with the app's own analyzer). Only rows that
// still have no measured loudness are touched, so this is safe on every start.
const LEGACY_MEASUREMENTS = join(__dirname, 'migrations', 'legacy-measurements-2026-09.json')
if (existsSync(LEGACY_MEASUREMENTS)) {
  try {
    const { rows } = JSON.parse(readFileSync(LEGACY_MEASUREMENTS, 'utf8'))
    const fill = db.prepare(`
      UPDATE events
      SET duration = @duration, volume = @volume, peak_volume = @peakVolume, place = COALESCE(place, @place)
      WHERE id = @id AND volume IS NULL
    `)
    const changed = db.transaction(entries => entries.reduce((count, [id, row]) => count + fill.run({
      id,
      duration: row.duration,
      volume: row.volume,
      peakVolume: row.peakVolume,
      place: row.place ?? null,
    }).changes, 0))(Object.entries(rows || {}))
    if (changed) console.log(`[DB] Filled in real measurements for ${changed} older recording(s)`)
  } catch (err) {
    console.warn(`[DB] Could not apply legacy measurements: ${err.message}`)
  }
}

const PUBLIC_EVENT_COLUMNS = `
  id,
  ROUND(lat, ${PUBLIC_COORD_DECIMALS}) as lat,
  ROUND(lng, ${PUBLIC_COORD_DECIMALS}) as lng,
  intensity, country, timestamp, type,
  CASE WHEN audio_data IS NOT NULL THEN 1 ELSE 0 END as hasAudio,
  user_rating, duration, volume, peak_volume as peakVolume,
  ${hasAudioMimeTypeColumn ? 'audio_mime_type' : 'NULL'} as audioMimeType,
  place
`

// Prepared statements
const stmts = {
  insert: db.prepare(`
    INSERT INTO events (
      id, lat, lng, intensity, country, timestamp, type, audio_data${hasAudioMimeTypeColumn ? ', audio_mime_type' : ''}, audio_size, duration, volume, peak_volume, place, delete_token_hash, client_post_id
    )
    VALUES (
      @id, @lat, @lng, @intensity, @country, @timestamp, @type, @audioData${hasAudioMimeTypeColumn ? ', @audioMimeType' : ''}, @audioSize, @duration, @volume, @peakVolume, @place, @deleteTokenHash, @clientPostId
    )
  `),

  recent: db.prepare(`
    SELECT ${PUBLIC_EVENT_COLUMNS}
    FROM events
    WHERE ${PLAYABLE}
    ORDER BY timestamp DESC LIMIT ?
  `),

  single: db.prepare(`
    SELECT ${PUBLIC_EVENT_COLUMNS}
    FROM events
    WHERE id = ? AND ${PLAYABLE}
  `),

  byClientPostId: db.prepare(`
    SELECT ${PUBLIC_EVENT_COLUMNS}, delete_token_hash as deleteTokenHash
    FROM events
    WHERE client_post_id = ?
  `),

  range: db.prepare(`
    SELECT ${PUBLIC_EVENT_COLUMNS}
    FROM events
    WHERE ${PLAYABLE}
      AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
    LIMIT 500
  `),

  deleteWithToken: db.prepare(`
    DELETE FROM events WHERE id = ? AND delete_token_hash IS NOT NULL AND delete_token_hash = ?
  `),

  deleteById: db.prepare(`
    DELETE FROM events WHERE id = ?
  `),

  audio: db.prepare(`
    SELECT audio_data${hasAudioMimeTypeColumn ? ', audio_mime_type as audioMimeType' : ''} FROM events WHERE id = ?
  `),

  countToday: db.prepare(`
    SELECT COUNT(*) as count
    FROM events
    WHERE ${PLAYABLE} AND timestamp >= ?
  `),

  countAll: db.prepare(`
    SELECT COUNT(*) as count
    FROM events
    WHERE ${PLAYABLE}
  `),

  topCountry: db.prepare(`
    SELECT country, COUNT(*) as count FROM events
    WHERE ${PLAYABLE} AND timestamp >= ?
    GROUP BY country ORDER BY count DESC LIMIT 1
  `),

  eventsByType: db.prepare(`
    SELECT type, COUNT(*) as count FROM events
    WHERE ${PLAYABLE} AND timestamp >= ?
    GROUP BY type
  `),

  uniqueCountriesToday: db.prepare(`
    SELECT COUNT(DISTINCT country) as count
    FROM events
    WHERE ${PLAYABLE} AND timestamp >= ?
  `),

  audioCountToday: db.prepare(`
    SELECT COUNT(*) as count FROM events WHERE timestamp >= ? AND ${PLAYABLE}
  `),

  avgDurationToday: db.prepare(`
    SELECT AVG(duration) as avg, MAX(duration) as max
    FROM events
    WHERE ${PLAYABLE} AND timestamp >= ? AND duration IS NOT NULL
  `),

  avgVolumeToday: db.prepare(`
    SELECT AVG(volume) as avg, MAX(volume) as max
    FROM events
    WHERE ${PLAYABLE} AND timestamp >= ? AND volume IS NOT NULL
  `),

  countryLeaderboard: db.prepare(`
    SELECT country, COUNT(*) as count FROM events
    WHERE ${PLAYABLE} AND timestamp >= ?
    GROUP BY country ORDER BY count DESC LIMIT 10
  `),

  updateRating: db.prepare(`
    UPDATE events SET user_rating = ? WHERE id = ?
  `),

  archiveTagInsert: db.prepare(`
    INSERT INTO archive_clip_tags (clip_id, normalized_tag, display_tag)
    VALUES (?, ?, ?)
  `),

  archiveTagCounts: db.prepare(`
    SELECT clip_id, COUNT(*) as count
    FROM archive_clip_tags
    GROUP BY clip_id
  `),
}

const insertArchiveTagsTx = db.transaction((clipId, tags) => {
  for (const tag of tags) {
    stmts.archiveTagInsert.run(clipId, tag.normalizedTag, tag.displayTag)
  }
})

function numericClipSort(a, b) {
  const aNum = Number.parseInt(basename(a, '.wav'), 10)
  const bNum = Number.parseInt(basename(b, '.wav'), 10)

  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    return aNum - bNum
  }

  return a.localeCompare(b)
}

function getArchiveCatalog() {
  const archiveDir = resolveArchiveAudioDir()

  if (archiveCatalogCache.dir === archiveDir && archiveCatalogCache.clips.length > 0) {
    return archiveCatalogCache.clips
  }

  if (!existsSync(archiveDir)) {
    archiveCatalogCache = { dir: archiveDir, clips: [] }
    return archiveCatalogCache.clips
  }

  const files = readdirSync(archiveDir)
    .filter(fileName => extname(fileName).toLowerCase() === '.wav')
    .sort(numericClipSort)

  archiveCatalogCache = {
    dir: archiveDir,
    clips: files.map(fileName => ({
    id: basename(fileName, '.wav'),
    fileName,
    filePath: join(archiveDir, fileName),
    })),
  }

  return archiveCatalogCache.clips
}

function getArchiveTagCountMap() {
  const rows = stmts.archiveTagCounts.all()
  return new Map(rows.map(row => [row.clip_id, row.count]))
}

function getArchiveTagSummaryForClipIds(clipIds) {
  if (!clipIds.length) {
    return new Map()
  }

  const placeholders = clipIds.map(() => '?').join(', ')
  const rows = db.prepare(`
    SELECT clip_id, normalized_tag, MAX(display_tag) as display_tag, COUNT(*) as count
    FROM archive_clip_tags
    WHERE clip_id IN (${placeholders})
    GROUP BY clip_id, normalized_tag
    ORDER BY clip_id ASC, count DESC, display_tag ASC
  `).all(...clipIds)

  const grouped = new Map()

  for (const row of rows) {
    if (!grouped.has(row.clip_id)) {
      grouped.set(row.clip_id, [])
    }

    grouped.get(row.clip_id).push({
      label: row.display_tag,
      normalizedTag: row.normalized_tag,
      count: row.count,
    })
  }

  return grouped
}

function withArchiveTagData(clips, tagCounts = null) {
  const counts = tagCounts || getArchiveTagCountMap()
  const tagSummary = getArchiveTagSummaryForClipIds(clips.map(clip => clip.id))

  return clips.map(clip => ({
    ...clip,
    tagCount: counts.get(clip.id) || 0,
    tags: tagSummary.get(clip.id) || [],
  }))
}

function shuffleArray(items) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swapIndex]
    copy[swapIndex] = current
  }

  return copy
}

function shouldRetryWrite(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('database is locked') || message.includes('database is busy') || message.includes('sqlite_busy')
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

export function insertEvent(event) {
  let lastError = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      stmts.insert.run({ ...event, audioSize: typeof event.audioData === 'string' ? event.audioData.length : null })
      return
    } catch (error) {
      lastError = error

      if (!shouldRetryWrite(error) || attempt === 2) {
        throw error
      }

      sleep(120 * (attempt + 1))
    }
  }

  throw lastError
}

export function getRecentEvents(limit = 200) {
  return stmts.recent.all(Math.min(limit, 500))
}

export function getEvent(eventId) {
  return stmts.single.get(eventId) || null
}

export function getEventByClientPostId(clientPostId) {
  return stmts.byClientPostId.get(clientPostId) || null
}

export function deleteEventWithToken(eventId, tokenHash) {
  return stmts.deleteWithToken.run(eventId, tokenHash).changes > 0
}

export function deleteEventById(eventId) {
  return stmts.deleteById.run(eventId).changes > 0
}

export function getEventsByRange(start, end) {
  return stmts.range.all(start, end)
}

export function getAudio(eventId) {
  const row = stmts.audio.get(eventId)
  if (!row?.audio_data) {
    return null
  }

  return {
    audioData: row.audio_data,
    audioMimeType: row.audioMimeType || 'audio/webm',
  }
}

export function getDatabasePath() {
  return DB_PATH
}

export function getArchiveAudioDir() {
  return resolveArchiveAudioDir()
}

export function getArchiveClipCount() {
  return getArchiveCatalog().length
}

export function isArchiveAudioAvailable() {
  return getArchiveClipCount() > 0
}

export function listArchiveClips({ limit = 12, offset = 0, sort = 'random' } = {}) {
  const catalog = getArchiveCatalog()
  const safeLimit = Math.min(Math.max(limit, 1), 24)
  const safeOffset = Math.max(offset, 0)
  const tagCounts = getArchiveTagCountMap()
  let working = [...catalog]

  if (sort === 'untagged') {
    working.sort((a, b) => {
      const diff = (tagCounts.get(a.id) || 0) - (tagCounts.get(b.id) || 0)
      return diff !== 0 ? diff : numericClipSort(a.fileName, b.fileName)
    })
    working = working.slice(safeOffset, safeOffset + safeLimit)
  } else if (sort === 'most-tagged') {
    working.sort((a, b) => {
      const diff = (tagCounts.get(b.id) || 0) - (tagCounts.get(a.id) || 0)
      return diff !== 0 ? diff : numericClipSort(a.fileName, b.fileName)
    })
    working = working.slice(safeOffset, safeOffset + safeLimit)
  } else {
    working = shuffleArray(working).slice(0, safeLimit)
  }

  return withArchiveTagData(working, tagCounts)
}

export function getArchiveClip(clipId) {
  const clip = getArchiveCatalog().find(item => item.id === clipId)
  if (!clip) {
    return null
  }

  return withArchiveTagData([clip])[0]
}

export function getArchiveAudioPath(clipId) {
  return getArchiveClip(clipId)?.filePath || null
}

export function insertArchiveTags(clipId, tags) {
  insertArchiveTagsTx(clipId, tags)
  return getArchiveClip(clipId)
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
