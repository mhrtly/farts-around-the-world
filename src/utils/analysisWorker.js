// Runs the waveform / loudness / pitch analysis off the main thread, so
// opening a card never stalls the camera glide on a phone.

import { analyzeBuffer } from './audioAnalysis.js'

self.onmessage = event => {
  const { key, samples, sampleRate } = event.data
  try {
    const buffer = {
      numberOfChannels: 1,
      sampleRate,
      length: samples.length,
      duration: samples.length / sampleRate,
      getChannelData: () => samples,
    }
    const { samples: _mono, ...result } = analyzeBuffer(buffer)
    self.postMessage({ key, result })
  } catch (error) {
    self.postMessage({ key, error: error?.message || 'Analysis failed' })
  }
}
