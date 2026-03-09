import extract from 'extract-zip'
import { createWriteStream, existsSync, readdirSync } from 'fs'
import { mkdir, rm, stat } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join, resolve } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

const DATASET_VERSION = '12'
const DATASET_OWNER = 'alecledoux'
const DATASET_SLUG = 'fart-recordings-dataset'
const DATASET_DOWNLOAD_URL =
  `https://www.kaggle.com/api/v1/datasets/download/${DATASET_OWNER}/${DATASET_SLUG}?dataset_version_number=${DATASET_VERSION}`

const DEFAULT_LOCAL_ARCHIVE_DIR = resolve(
  homedir(),
  '.cache',
  'kagglehub',
  'datasets',
  DATASET_OWNER,
  DATASET_SLUG,
  'versions',
  DATASET_VERSION,
  'fart_dataset',
)

// Archive audio goes to ephemeral /tmp — it's re-downloadable from Kaggle
// and must NOT share the persistent disk with the SQLite database.
const DEFAULT_PRODUCTION_ARCHIVE_DIR = resolve(
  '/tmp',
  'archive-cache',
  'datasets',
  DATASET_OWNER,
  DATASET_SLUG,
  'versions',
  DATASET_VERSION,
  'fart_dataset',
)

const ROOT_DIR = dirname(DEFAULT_PRODUCTION_ARCHIVE_DIR)
const ZIP_PATH = join(ROOT_DIR, `${DATASET_SLUG}-v${DATASET_VERSION}.zip`)

let inFlightSync = null
let archiveStatus = {
  state: 'idle',
  message: 'Archive sync has not started yet.',
  lastUpdatedAt: Date.now(),
}

function setArchiveStatus(next) {
  archiveStatus = {
    ...archiveStatus,
    ...next,
    lastUpdatedAt: Date.now(),
  }
}

export function getArchiveAudioDir() {
  if (process.env.ARCHIVE_AUDIO_DIR) {
    return resolve(process.env.ARCHIVE_AUDIO_DIR)
  }

  return process.env.NODE_ENV === 'production'
    ? DEFAULT_PRODUCTION_ARCHIVE_DIR
    : DEFAULT_LOCAL_ARCHIVE_DIR
}

function countWavs(dir) {
  if (!existsSync(dir)) {
    return 0
  }

  return readdirSync(dir).filter(fileName => fileName.toLowerCase().endsWith('.wav')).length
}

export function isArchiveReady() {
  return countWavs(getArchiveAudioDir()) > 0
}

export function getArchiveStatus() {
  return {
    ...archiveStatus,
    audioDir: getArchiveAudioDir(),
    clipCount: countWavs(getArchiveAudioDir()),
  }
}

async function downloadArchiveZip() {
  const response = await fetch(DATASET_DOWNLOAD_URL, {
    headers: {
      'user-agent': 'FATWA-ArchiveSync/1.0',
      accept: '*/*',
    },
  })

  if (!response.ok || !response.body) {
    throw new Error(`Archive download failed with status ${response.status}`)
  }

  await mkdir(ROOT_DIR, { recursive: true })
  const fileStream = createWriteStream(ZIP_PATH)
  await pipeline(Readable.fromWeb(response.body), fileStream)
}

async function extractArchiveZip() {
  await extract(ZIP_PATH, { dir: ROOT_DIR })
}

async function syncArchiveToDisk() {
  if (isArchiveReady()) {
    setArchiveStatus({
      state: 'ready',
      message: 'Archive dataset ready.',
    })
    return getArchiveAudioDir()
  }

  setArchiveStatus({
    state: 'downloading',
    message: 'Downloading archive dataset to persistent disk.',
  })
  await downloadArchiveZip()

  setArchiveStatus({
    state: 'extracting',
    message: 'Extracting archive dataset on persistent disk.',
  })
  await extractArchiveZip()
  await rm(ZIP_PATH, { force: true })

  if (!isArchiveReady()) {
    throw new Error('Archive sync completed but WAV files were not found.')
  }

  setArchiveStatus({
    state: 'ready',
    message: 'Archive dataset ready.',
  })
  return getArchiveAudioDir()
}

export async function ensureArchiveDataset() {
  if (isArchiveReady()) {
    setArchiveStatus({
      state: 'ready',
      message: 'Archive dataset ready.',
    })
    return getArchiveAudioDir()
  }

  if (inFlightSync) {
    return inFlightSync
  }

  inFlightSync = syncArchiveToDisk()
    .catch(async error => {
      try {
        const zipStats = await stat(ZIP_PATH)
        if (zipStats.size === 0) {
          await rm(ZIP_PATH, { force: true })
        }
      } catch {
        // Ignore cleanup failures.
      }

      setArchiveStatus({
        state: 'error',
        message: error.message || 'Archive sync failed.',
      })
      throw error
    })
    .finally(() => {
      inFlightSync = null
    })

  return inFlightSync
}

export function primeArchiveDataset() {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  if (isArchiveReady()) {
    setArchiveStatus({
      state: 'ready',
      message: 'Archive dataset ready.',
    })
    return
  }

  ensureArchiveDataset().catch(error => {
    console.error('[ARCHIVE SYNC ERROR]', error.message)
  })
}
