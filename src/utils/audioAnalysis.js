// Real measurements from real recordings: waveform, loudness, pitch, and
// silence trimming. Also re-encodes new recordings as WAV so every browser
// (including iPhones) can play them back.

import { recordingAudioUrl } from './recordings.js'

const OfflineCtx = typeof window !== 'undefined'
  ? (window.OfflineAudioContext || window.webkitOfflineAudioContext)
  : null
const RealtimeCtx = typeof window !== 'undefined'
  ? (window.AudioContext || window.webkitAudioContext)
  : null

let fallbackContext = null

function decodeWith(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    // Older Safari only supports the callback form.
    const maybePromise = context.decodeAudioData(arrayBuffer, resolve, reject)
    if (maybePromise?.then) maybePromise.then(resolve, reject)
  })
}

export async function decodeAudio(arrayBuffer) {
  if (OfflineCtx) {
    try {
      return await decodeWith(new OfflineCtx(1, 1, 44100), arrayBuffer.slice(0))
    } catch {
      // fall through to a realtime context
    }
  }
  if (!RealtimeCtx) throw new Error('This browser cannot decode audio')
  fallbackContext = fallbackContext || new RealtimeCtx()
  return decodeWith(fallbackContext, arrayBuffer.slice(0))
}

function mixToMono(audioBuffer) {
  if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0)
  const out = new Float32Array(audioBuffer.length)
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const data = audioBuffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) out[i] += data[i] / audioBuffer.numberOfChannels
  }
  return out
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

function toDb(rms) {
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity
}

function frameRms(samples, sampleRate, frameSeconds = 0.02) {
  const frame = Math.max(1, Math.round(sampleRate * frameSeconds))
  const count = Math.floor(samples.length / frame)
  const rms = new Float32Array(count)
  for (let f = 0; f < count; f++) {
    let sum = 0
    const start = f * frame
    for (let i = start; i < start + frame; i++) sum += samples[i] * samples[i]
    rms[f] = Math.sqrt(sum / frame)
  }
  return { rms, frame }
}

// Finds where the sound actually is, ignoring room tone before and after.
function findActiveRegion(rms, frame, sampleRate) {
  const values = Array.from(rms)
  const peak = values.reduce((max, v) => Math.max(max, v), 0)
  const floor = percentile(values, 0.1)

  if (peak < 0.006) {
    return { quiet: true, start: 0, end: rms.length * frame, threshold: 0, peak, floor }
  }

  // No real silence in the clip (it's all sound) — keep everything.
  if (peak < floor * 4) {
    return { quiet: false, start: 0, end: rms.length * frame, threshold: floor, peak, floor }
  }

  const threshold = Math.max(floor * 3, peak * 0.06, 0.004)
  let first = -1
  let last = -1
  for (let f = 0; f < rms.length; f++) {
    if (rms[f] >= threshold) {
      if (first === -1) first = f
      last = f
    }
  }

  return {
    quiet: false,
    start: first * frame,
    end: Math.min((last + 1) * frame, rms.length * frame),
    threshold,
    peak,
    floor,
    sampleRate,
  }
}

// YIN pitch estimate on a downsampled copy. Returns median Hz of the frames
// that are clearly periodic, or null for noisy / breathy sounds.
function detectPitch(samples, sampleRate, region) {
  const factor = Math.max(1, Math.round(sampleRate / 11025))
  const sr = sampleRate / factor
  const startSample = Math.floor(region.start / factor)
  const endSample = Math.floor(region.end / factor)
  const n = endSample - startSample
  if (n <= 0) return { hz: null, confidence: 0 }

  const ds = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    const base = (startSample + i) * factor
    for (let j = 0; j < factor; j++) sum += samples[base + j] || 0
    ds[i] = sum / factor
  }

  const W = Math.round(sr * 0.03)
  const minLag = Math.floor(sr / 600)
  const maxLag = Math.ceil(sr / 55)
  const hop = Math.round(sr * 0.02)
  const diff = new Float32Array(maxLag + 1)
  const pitches = []
  let framesConsidered = 0
  const gate = Math.max(region.threshold || 0, 0.004)

  for (let start = 0; start + W + maxLag < n; start += hop) {
    let energy = 0
    for (let j = 0; j < W; j++) energy += ds[start + j] * ds[start + j]
    if (Math.sqrt(energy / W) < gate) continue
    framesConsidered++

    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0
      for (let j = 0; j < W; j++) {
        const d = ds[start + j] - ds[start + j + lag]
        sum += d * d
      }
      diff[lag] = sum
    }

    // Cumulative mean normalized difference
    let running = 0
    let best = -1
    let bestValue = Infinity
    for (let lag = 1; lag <= maxLag; lag++) {
      running += diff[lag]
      const cmnd = running > 0 ? (diff[lag] * lag) / running : 1
      diff[lag] = cmnd
    }
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (diff[lag] < 0.2) {
        while (lag + 1 <= maxLag && diff[lag + 1] < diff[lag]) lag++
        best = lag
        bestValue = diff[lag]
        break
      }
      if (diff[lag] < bestValue) {
        bestValue = diff[lag]
        best = lag
      }
    }
    if (best <= 0 || bestValue > 0.35) continue

    const prev = diff[best - 1] ?? diff[best]
    const next = diff[best + 1] ?? diff[best]
    const denom = prev - 2 * diff[best] + next
    const shift = denom !== 0 ? 0.5 * (prev - next) / denom : 0
    const lag = best + Math.max(-1, Math.min(1, shift))
    pitches.push(sr / lag)
  }

  if (framesConsidered < 4 || pitches.length < 3) return { hz: null, confidence: 0 }
  const confidence = pitches.length / framesConsidered
  if (confidence < 0.35) return { hz: null, confidence }
  pitches.sort((a, b) => a - b)
  return { hz: pitches[Math.floor(pitches.length / 2)], confidence }
}

function waveformPeaks(samples, start, end, barCount) {
  const peaks = new Float32Array(barCount)
  const span = Math.max(1, end - start)
  let max = 0
  for (let b = 0; b < barCount; b++) {
    const from = start + Math.floor((b / barCount) * span)
    const to = Math.max(from + 1, start + Math.floor(((b + 1) / barCount) * span))
    let sum = 0
    for (let i = from; i < to; i++) sum += samples[i] * samples[i]
    const value = Math.sqrt(sum / (to - from))
    peaks[b] = value
    if (value > max) max = value
  }
  if (max > 0) {
    for (let b = 0; b < barCount; b++) peaks[b] = Math.sqrt(peaks[b] / max)
  }
  return peaks
}

const PRE_ROLL = 0.12
const POST_ROLL = 0.3

// The part of a clip worth hearing: the sound plus a little breathing room.
function trimWindow(samples, sampleRate, region) {
  let start = 0
  let end = samples.length
  if (!region.quiet) {
    start = Math.max(0, Math.floor(region.start - PRE_ROLL * sampleRate))
    end = Math.min(samples.length, Math.ceil(region.end + POST_ROLL * sampleRate))
    // Not worth trimming a sliver
    if (samples.length - (end - start) < 0.25 * sampleRate) {
      start = 0
      end = samples.length
    }
    // Keep at least ~0.4s
    if (end - start < 0.4 * sampleRate) {
      const pad = Math.ceil((0.4 * sampleRate - (end - start)) / 2)
      start = Math.max(0, start - pad)
      end = Math.min(samples.length, end + pad)
    }
  }
  return { start, end }
}

export function analyzeBuffer(audioBuffer, { barCount = 72 } = {}) {
  const samples = mixToMono(audioBuffer)
  const sampleRate = audioBuffer.sampleRate
  const { rms, frame } = frameRms(samples, sampleRate)
  const region = findActiveRegion(rms, frame, sampleRate)
  const trim = trimWindow(samples, sampleRate, region)

  let activeSum = 0
  let activeCount = 0
  let peakRms = 0
  for (let f = 0; f < rms.length; f++) {
    if (rms[f] > peakRms) peakRms = rms[f]
    if (rms[f] >= region.threshold) {
      activeSum += rms[f]
      activeCount++
    }
  }
  const meanRms = activeCount ? activeSum / activeCount : 0
  const pitch = region.quiet ? { hz: null, confidence: 0 } : detectPitch(samples, sampleRate, region)

  return {
    samples,
    sampleRate,
    duration: audioBuffer.duration,
    // Playback window + waveform cover just the sound (older clips have long silences)
    trimStart: trim.start / sampleRate,
    trimEnd: trim.end / sampleRate,
    trim,
    peaks: waveformPeaks(samples, trim.start, trim.end, barCount),
    region,
    quiet: region.quiet,
    peakDb: toDb(peakRms),
    meanDb: toDb(meanRms),
    volume: Math.round(meanRms * 1000) / 10,
    peakVolume: Math.round(peakRms * 1000) / 10,
    pitchHz: pitch.hz,
    pitchConfidence: pitch.confidence,
  }
}

async function resample(samples, fromRate, toRate) {
  if (fromRate <= toRate || !OfflineCtx) return { samples, sampleRate: fromRate }
  try {
    const length = Math.ceil((samples.length * toRate) / fromRate)
    const ctx = new OfflineCtx(1, length, toRate)
    const buffer = ctx.createBuffer(1, samples.length, fromRate)
    buffer.getChannelData(0).set(samples)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
    const rendered = await new Promise((resolve, reject) => {
      ctx.oncomplete = event => resolve(event.renderedBuffer)
      const maybePromise = ctx.startRendering()
      if (maybePromise?.then) maybePromise.then(resolve, reject)
    })
    return { samples: rendered.getChannelData(0), sampleRate: toRate }
  } catch {
    return { samples, sampleRate: fromRate }
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

const TARGET_SAMPLE_RATE = 22050
const MAX_SECONDS = 10
const MAX_UPLOAD_BYTES = 1_050_000

// How long the actual sound lasts (ignoring silence around it).
export function soundSeconds(analysis) {
  if (!analysis) return null
  const { region, sampleRate, duration } = analysis
  if (!region || region.quiet || !sampleRate) return duration
  return Math.max(0.1, (region.end - region.start) / sampleRate)
}

// Silences the first/last few hundredths of a second in place. The finger that
// taps "start now" or "stop" is picked up by the mic; this keeps that click out
// of the trim, the stats and the posted clip.
// A take stopped mid-sound is faded out over ~12 ms rather than cut to digital
// silence, which would click.
function cutEdges(audioBuffer, headSeconds, tailSeconds) {
  const head = Math.min(audioBuffer.length, Math.round(Math.max(0, headSeconds) * audioBuffer.sampleRate))
  const tail = Math.min(audioBuffer.length - head, Math.round(Math.max(0, tailSeconds) * audioBuffer.sampleRate))
  if (!head && !tail) return
  const ramp = Math.round(0.012 * audioBuffer.sampleRate)
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const data = audioBuffer.getChannelData(c)
    if (head) {
      data.fill(0, 0, head)
      const to = Math.min(data.length, head + ramp)
      for (let i = head; i < to; i++) data[i] *= (i - head) / ramp
    }
    if (tail) {
      const cut = data.length - tail
      data.fill(0, cut)
      const from = Math.max(head, cut - ramp)
      for (let i = from; i < cut; i++) data[i] *= (cut - i) / ramp
    }
  }
}

// Turns a raw recording into the clip we actually post: trimmed to the sound,
// gently normalized so quiet ones are still audible, and encoded as WAV.
// Options: headCut / tailCut (seconds) silence a tap at either end.
export async function prepareRecording(blob, { headCut = 0, tailCut = 0 } = {}) {
  const arrayBuffer = await blob.arrayBuffer()
  const decoded = await decodeAudio(arrayBuffer)
  // Never cut more than a small share of a very short take
  const room = decoded.duration * 0.25
  cutEdges(decoded, Math.min(headCut, room), Math.min(tailCut, room))
  const analysis = analyzeBuffer(decoded)
  const { samples, sampleRate } = analysis
  const { start } = analysis.trim
  const end = Math.min(analysis.trim.end, start + Math.round(MAX_SECONDS * sampleRate))

  const clip = samples.slice(start, end)
  let maxAbs = 0
  for (let i = 0; i < clip.length; i++) maxAbs = Math.max(maxAbs, Math.abs(clip[i]))
  const gain = maxAbs > 0 ? Math.min(4, 0.89 / maxAbs) : 1
  const fade = Math.min(Math.round(0.01 * sampleRate), Math.floor(clip.length / 4))
  for (let i = 0; i < clip.length; i++) {
    let g = gain > 1.05 ? gain : 1
    if (i < fade) g *= i / fade
    if (i >= clip.length - fade) g *= (clip.length - 1 - i) / fade
    clip[i] *= g
  }

  const resampled = await resample(clip, sampleRate, TARGET_SAMPLE_RATE)
  const wav = encodeWav(resampled.samples, resampled.sampleRate)
  const clipDuration = clip.length / sampleRate
  // The server takes ~1.1 MB of audio. A WAV only gets that big if resampling
  // failed on a high-sample-rate device — then send the original compressed file.
  const useWav = wav.size <= MAX_UPLOAD_BYTES || blob.size > wav.size

  return {
    blob: useWav ? wav : blob,
    mimeType: useWav ? 'audio/wav' : blob.type,
    // "Length" is the sound itself; the clip keeps a little padding around it.
    duration: Math.round(Math.min(soundSeconds(analysis), clipDuration) * 10) / 10,
    clipDuration: useWav ? clipDuration : analysis.duration,
    trimmedSeconds: useWav ? Math.max(0, analysis.duration - clipDuration) : 0,
    // Where the kept clip sits inside the raw take (seconds), for showing the trim
    rawDuration: analysis.duration,
    keptStart: useWav ? start / sampleRate : 0,
    keptEnd: useWav ? end / sampleRate : analysis.duration,
    peaks: useWav ? waveformPeaks(clip, 0, clip.length, 72) : waveformPeaks(samples, 0, samples.length, 72),
    quiet: analysis.quiet,
    peakDb: analysis.peakDb,
    meanDb: analysis.meanDb,
    volume: analysis.volume,
    peakVolume: analysis.peakVolume,
    pitchHz: analysis.pitchHz,
  }
}

// Fetch + decode + analyze a posted recording (cached per id) so every
// player can draw the real waveform and show real numbers.
const analysisCache = new Map()
const MAX_CACHE = 40

// The analysis runs in a worker where possible (falls back to this thread).
let worker = null
let workerBroken = false
let nextJob = 0
const jobs = new Map()

function analyzeHere(buffer) {
  const { samples, ...rest } = analyzeBuffer(buffer)
  return rest
}

function analysisWorker() {
  if (workerBroken || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./analysisWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      const job = jobs.get(data.key)
      if (!job) return
      jobs.delete(data.key)
      clearTimeout(job.timer)
      if (data.error) job.reject(new Error(data.error))
      else job.resolve(data.result)
    }
    worker.onerror = () => {
      // e.g. no module workers in this browser: do everything here from now on
      workerBroken = true
      worker?.terminate()
      worker = null
      for (const job of jobs.values()) job.fallback()
      jobs.clear()
    }
  } catch {
    workerBroken = true
    worker = null
  }
  return worker
}

function analyzeOffThread(buffer) {
  const target = analysisWorker()
  if (!target) return Promise.resolve().then(() => analyzeHere(buffer))
  const mono = mixToMono(buffer)
  // Send a copy: transferring the AudioBuffer's own channel data would empty it
  const samples = buffer.numberOfChannels === 1 ? mono.slice() : mono
  return new Promise((resolve, reject) => {
    const key = ++nextJob
    const job = {
      resolve,
      reject,
      fallback: () => {
        clearTimeout(job.timer)
        try { resolve(analyzeHere(buffer)) } catch (error) { reject(error) }
      },
      timer: setTimeout(() => {
        if (jobs.delete(key)) job.fallback()
      }, 6000),
    }
    jobs.set(key, job)
    target.postMessage({ key, samples, sampleRate: buffer.sampleRate }, [samples.buffer])
  })
}

export function loadRecordingAnalysis(id) {
  if (analysisCache.has(id)) return analysisCache.get(id)
  const promise = fetch(recordingAudioUrl(id))
    .then(res => {
      if (!res.ok) throw new Error(`Audio unavailable (${res.status})`)
      return res.arrayBuffer()
    })
    .then(decodeAudio)
    .then(analyzeOffThread)
  promise.catch(() => analysisCache.delete(id))
  analysisCache.set(id, promise)
  if (analysisCache.size > MAX_CACHE) {
    analysisCache.delete(analysisCache.keys().next().value)
  }
  return promise
}
