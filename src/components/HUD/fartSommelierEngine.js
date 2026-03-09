const PERSONAS = [
  {
    id: 'poet',
    name: 'Velvet Reed',
    title: 'The Taster',
    color: '#ff9fcf',
    accent: 'Leans on texture, body, and finish.',
    weights: {
      pitch: 1.1,
      duration: 1.0,
      rumble: 1.25,
      texture: 1.2,
      bursts: 0.85,
      tail: 1.1,
      force: 0.9,
    },
  },
  {
    id: 'naturalist',
    name: 'Dr. Fenwick Loam',
    title: 'The Field Guide',
    color: '#b7ff70',
    accent: 'Tracks recurring acoustic families.',
    weights: {
      pitch: 0.95,
      duration: 1.15,
      rumble: 1.0,
      texture: 0.95,
      bursts: 1.2,
      tail: 1.0,
      force: 0.9,
    },
  },
  {
    id: 'engineer',
    name: 'A. Resonance',
    title: 'The Acoustician',
    color: '#6cefff',
    accent: 'Listens for structure, onset, and decay.',
    weights: {
      pitch: 1.0,
      duration: 1.15,
      rumble: 0.95,
      texture: 1.2,
      bursts: 1.3,
      tail: 1.05,
      force: 1.2,
    },
  },
]

const DIMENSIONS = [
  {
    key: 'pitch',
    metric: features => features.pitchHz || (features.brightnessScore * 260 + 80),
    highBadge: 'soprano',
    lowBadge: 'baritone',
    poet: {
      high: ['a bright upper-register edge', 'a narrow, high thread', 'a lightly squeaking top note'],
      low: ['a low rolling body', 'a deeper register', 'a low-bellied body note'],
    },
    naturalist: {
      high: ['the highest-pitched specimen in the flight', 'a clearly elevated register', 'a more treble-led specimen'],
      low: ['the lowest-voiced specimen in the flight', 'a lower-register specimen', 'a more grounded register'],
    },
    engineer: {
      high: ['the highest pitch center in the set', 'a treble-biased profile', 'a clearly elevated pitch center'],
      low: ['the lowest pitch center in the set', 'a low-register profile', 'a deeper fundamental center'],
    },
  },
  {
    key: 'duration',
    metric: features => features.activeDuration,
    highBadge: 'linger',
    lowBadge: 'blink-fast',
    poet: {
      high: ['it opens out and lingers', 'it holds its shape for a moment', 'it takes a little time to finish'],
      low: ['it is brief and clipped', 'it passes quickly', 'it cuts off almost at once'],
    },
    naturalist: {
      high: ['a long-bodied release', 'one of the more sustained calls here', 'a specimen with clear hold time'],
      low: ['a short-bodied release', 'one of the briefest calls here', 'a compact specimen with minimal hold time'],
    },
    engineer: {
      high: ['the longest active duration in the trio', 'an extended release window', 'a sustained envelope'],
      low: ['the shortest active duration in the trio', 'a compressed release window', 'a fast cutoff envelope'],
    },
  },
  {
    key: 'rumble',
    metric: features => features.rumbleScore,
    highBadge: 'rumble-backed',
    lowBadge: 'light-bodied',
    poet: {
      high: ['there is a warm low-end bloom underneath it', 'it carries a noticeable low body', 'it lands with some depth underneath'],
      low: ['it stays light in the body', 'there is very little low-end bloom', 'it sits higher than it sits deep'],
    },
    naturalist: {
      high: ['a distinctly rumble-backed specimen', 'noticeable low-body resonance', 'one of the heavier-bodied calls in the flight'],
      low: ['a comparatively light-bodied specimen', 'minimal low-body resonance', 'one of the less rumble-rich calls in the flight'],
    },
    engineer: {
      high: ['strong low-body energy relative to the others', 'the most rumble-loaded profile here', 'a heavier low-register payload'],
      low: ['reduced low-body energy relative to the others', 'a leaner low-register payload', 'very little low-band substructure'],
    },
  },
  {
    key: 'texture',
    metric: features => features.textureScore,
    highBadge: 'papery',
    lowBadge: 'velvety',
    poet: {
      high: ['a papery rasp rides the edge', 'there is a dry grain to the surface', 'the texture stays audible throughout'],
      low: ['its surface is quite smooth', 'the sound stays rounded at the edge', 'there is very little rasp in the finish'],
    },
    naturalist: {
      high: ['a high-texture specimen with audible grain', 'a rasp-forward call', 'one of the more textured members of the flight'],
      low: ['a smooth-surfaced specimen', 'a low-texture call', 'one of the rounder members of the flight'],
    },
    engineer: {
      high: ['elevated texture and edge activity', 'high surface grain in the waveform', 'a rougher envelope'],
      low: ['suppressed texture and edge activity', 'a smoother waveform surface', 'a relatively polished envelope'],
    },
  },
  {
    key: 'bursts',
    metric: features => features.burstCount,
    highBadge: 'staccato',
    lowBadge: 'single-roll',
    poet: {
      high: ['it breaks into several quick pulses', 'the phrase comes in small steps', 'it arrives in short repeated beats'],
      low: ['it holds to a single roll', 'it stays mostly unbroken', 'it moves as one continuous phrase'],
    },
    naturalist: {
      high: ['a clearly multi-burst specimen', 'a clustered release with several pulses', 'one of the more segmented calls in the set'],
      low: ['a mostly single-burst specimen', 'a cleaner one-roll release', 'one of the less segmented calls in the set'],
    },
    engineer: {
      high: ['the highest burst count in the trio', 'a segmented multi-pulse release', 'multiple clear pressure packets'],
      low: ['the lowest burst count in the trio', 'a mostly single-pulse release', 'one continuous packet rather than repeated pulses'],
    },
  },
  {
    key: 'tail',
    metric: features => features.tailRatio,
    highBadge: 'afterglow',
    lowBadge: 'hard cutoff',
    poet: {
      high: ['it leaves a soft trailing finish', 'the tail hangs on a little longer', 'the finish tapers rather than stops'],
      low: ['the finish snaps off cleanly', 'it ends with a firm cutoff', 'there is almost no trailing tail'],
    },
    naturalist: {
      high: ['a trailing tail is clearly present', 'a specimen with noticeable release decay', 'one of the longer-finished calls here'],
      low: ['very little trailing tail is present', 'a specimen with abrupt decay', 'one of the shortest-finished calls here'],
    },
    engineer: {
      high: ['extended post-peak decay is visible', 'the release tail persists after the main impulse', 'a longer decay window than the others'],
      low: ['post-peak decay drops away quickly', 'the tail collapses almost immediately', 'an abrupt cutoff profile'],
    },
  },
  {
    key: 'force',
    metric: features => features.forceScore,
    highBadge: 'full-bodied',
    lowBadge: 'delicate',
    poet: {
      high: ['it enters with a firm body', 'there is a full-bodied push behind it', 'it has a more present physical weight'],
      low: ['it stays delicate rather than forceful', 'the body is relatively restrained', 'it keeps its force in check'],
    },
    naturalist: {
      high: ['a forceful specimen', 'one of the stronger-bodied calls in the flight', 'a notably assertive release'],
      low: ['a comparatively delicate specimen', 'one of the quieter-bodied calls in the flight', 'a restrained release'],
    },
    engineer: {
      high: ['peak energy is elevated versus the others', 'a strong-body pressure event', 'high overall drive through the release'],
      low: ['peak energy is modest versus the others', 'a lower-drive pressure event', 'overall force stays comparatively restrained'],
    },
  },
]

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function stringHash(input) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickVariant(seed, options) {
  if (!options.length) {
    return ''
  }
  const hash = stringHash(seed)
  return options[hash % options.length]
}

function joinPhrases(parts) {
  if (!parts.length) {
    return 'an oddly elusive little event'
  }
  if (parts.length === 1) {
    return parts[0]
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`
  }
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

function deterministicShuffle(items, seed) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = stringHash(`${seed}:${index}`) % (index + 1)
    const current = copy[index]
    copy[index] = copy[swapIndex]
    copy[swapIndex] = current
  }
  return copy
}

function mixToMono(audioBuffer) {
  if (!audioBuffer.numberOfChannels) {
    return new Float32Array(0)
  }

  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice()
  }

  const length = audioBuffer.length
  const mono = new Float32Array(length)
  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    const channel = audioBuffer.getChannelData(channelIndex)
    for (let frame = 0; frame < length; frame += 1) {
      mono[frame] += channel[frame]
    }
  }

  for (let frame = 0; frame < length; frame += 1) {
    mono[frame] /= audioBuffer.numberOfChannels
  }

  return mono
}

function trimSignal(signal, thresholdRatio = 0.045) {
  let peak = 0
  for (let index = 0; index < signal.length; index += 1) {
    peak = Math.max(peak, Math.abs(signal[index]))
  }

  if (peak <= 0) {
    return { trimmed: signal.slice(), start: 0, end: signal.length }
  }

  const threshold = peak * thresholdRatio
  let start = 0
  while (start < signal.length && Math.abs(signal[start]) < threshold) {
    start += 1
  }

  let end = signal.length
  while (end > start && Math.abs(signal[end - 1]) < threshold) {
    end -= 1
  }

  return {
    trimmed: signal.slice(start, end),
    start,
    end,
  }
}

function estimateBursts(signal, sampleRate) {
  if (!signal.length || !sampleRate) {
    return 0
  }

  const frameSize = Math.max(256, Math.min(2048, Math.floor(sampleRate * 0.032)))
  const hopSize = Math.max(128, Math.floor(frameSize / 2))
  const frameRms = []

  for (let start = 0; start < signal.length; start += hopSize) {
    const end = Math.min(signal.length, start + frameSize)
    let energy = 0
    for (let index = start; index < end; index += 1) {
      energy += signal[index] * signal[index]
    }
    const length = Math.max(1, end - start)
    frameRms.push(Math.sqrt(energy / length))
    if (end === signal.length) {
      break
    }
  }

  if (!frameRms.length) {
    return 0
  }

  const sorted = [...frameRms].sort((a, b) => a - b)
  const percentile = sorted[Math.floor(sorted.length * 0.65)] || 0
  const mean = frameRms.reduce((sum, value) => sum + value, 0) / frameRms.length
  const threshold = Math.max(percentile * 0.66, mean * 0.82)

  let bursts = 0
  let active = false
  for (const value of frameRms) {
    if (value >= threshold && !active) {
      bursts += 1
      active = true
    } else if (value < threshold) {
      active = false
    }
  }

  return bursts
}

function estimatePitchHz(signal, sampleRate) {
  if (!signal.length || !sampleRate) {
    return 0
  }

  const targetLength = Math.min(signal.length, Math.floor(sampleRate * 0.75))
  if (targetLength < 512) {
    return 0
  }

  const focus = signal.slice(0, targetLength)
  let mean = 0
  for (let index = 0; index < focus.length; index += 1) {
    mean += focus[index]
  }
  mean /= focus.length

  for (let index = 0; index < focus.length; index += 1) {
    focus[index] -= mean
  }

  let bestLag = 0
  let bestScore = 0
  const minLag = Math.max(16, Math.floor(sampleRate / 420))
  const maxLag = Math.min(Math.floor(sampleRate / 55), focus.length - 1)

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0
    let normA = 0
    let normB = 0
    for (let index = 0; index < focus.length - lag; index += 2) {
      const a = focus[index]
      const b = focus[index + lag]
      corr += a * b
      normA += a * a
      normB += b * b
    }

    const denom = Math.sqrt(normA * normB) || 1
    const score = corr / denom
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }

  if (!bestLag || bestScore < 0.14) {
    return 0
  }

  return sampleRate / bestLag
}

function analyzeEnvelope(signal, sampleRate) {
  if (!signal.length || !sampleRate) {
    return {
      tailRatio: 0,
      onsetRatio: 0,
      burstCount: 0,
    }
  }

  const frameSize = Math.max(256, Math.min(2048, Math.floor(sampleRate * 0.025)))
  const hopSize = Math.max(128, Math.floor(frameSize / 2))
  const values = []

  for (let start = 0; start < signal.length; start += hopSize) {
    const end = Math.min(signal.length, start + frameSize)
    let energy = 0
    for (let index = start; index < end; index += 1) {
      energy += signal[index] * signal[index]
    }
    values.push(Math.sqrt(energy / Math.max(1, end - start)))
    if (end === signal.length) {
      break
    }
  }

  if (!values.length) {
    return {
      tailRatio: 0,
      onsetRatio: 0,
      burstCount: 0,
    }
  }

  let peakValue = -Infinity
  let peakIndex = 0
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] > peakValue) {
      peakValue = values[index]
      peakIndex = index
    }
  }

  const onsetRatio = values.length > 1 ? peakIndex / (values.length - 1) : 0
  const tailRatio = values.length > 1 ? (values.length - 1 - peakIndex) / (values.length - 1) : 0

  return {
    onsetRatio,
    tailRatio,
    burstCount: estimateBursts(signal, sampleRate),
  }
}

export function analyzeAudioBuffer(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate
  const signal = mixToMono(audioBuffer)
  const { trimmed, start, end } = trimSignal(signal)

  let peak = 0
  let energy = 0
  let zeroCrossings = 0
  let absDiff = 0

  for (let index = 0; index < signal.length; index += 1) {
    const current = signal[index]
    const abs = Math.abs(current)
    peak = Math.max(peak, abs)
    energy += current * current
    if (index > 0) {
      if ((signal[index - 1] >= 0 && current < 0) || (signal[index - 1] < 0 && current >= 0)) {
        zeroCrossings += 1
      }
      absDiff += Math.abs(current - signal[index - 1])
    }
  }

  const rms = signal.length ? Math.sqrt(energy / signal.length) : 0
  const zeroCrossingRate = signal.length > 1 ? zeroCrossings / (signal.length - 1) : 0
  const brightnessScore = clamp((absDiff / Math.max(signal.length - 1, 1)) / (rms + 1e-4) / 2.4, 0, 1)
  const activeDuration = sampleRate ? trimmed.length / sampleRate : 0
  const duration = audioBuffer.duration || 0
  const pitchHz = estimatePitchHz(trimmed, sampleRate)
  const envelope = analyzeEnvelope(trimmed, sampleRate)
  const forceScore = clamp(rms * 4.4 + peak * 0.5, 0, 1.6)
  const bodyScore = clamp((rms / (brightnessScore + 0.12)) * 0.9, 0, 1.5)
  const rumbleScore = clamp(
    (pitchHz ? clamp(1 - pitchHz / 320, 0, 1) : 0.45) * 0.55
      + clamp(bodyScore / 1.2, 0, 1) * 0.45,
    0,
    1
  )
  const textureScore = clamp(brightnessScore * 0.7 + clamp(zeroCrossingRate * 7, 0, 1) * 0.3, 0, 1)

  return {
    duration,
    activeDuration,
    peak,
    rms,
    zeroCrossingRate,
    brightnessScore,
    rumbleScore,
    textureScore,
    forceScore,
    bodyScore,
    pitchHz,
    burstCount: envelope.burstCount,
    tailRatio: envelope.tailRatio,
    onsetRatio: envelope.onsetRatio,
    trimStartRatio: signal.length ? start / signal.length : 0,
    trimEndRatio: signal.length ? end / signal.length : 0,
  }
}

function percentilePosition(value, values) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = sorted.findIndex(item => value <= item)
  if (index === -1) {
    return 1
  }
  return sorted.length === 1 ? 0.5 : index / (sorted.length - 1)
}

function buildFacet(target, lineup, persona, dimension) {
  const values = lineup.map(item => dimension.metric(item.analysis))
  const targetValue = dimension.metric(target.analysis)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance) || 1
  const zScore = (targetValue - mean) / std
  const direction = zScore >= 0 ? 'high' : 'low'
  const relativeStrength = Math.abs(zScore) * (persona.weights[dimension.key] || 1)
  const percentile = percentilePosition(targetValue, values)
  const emphatic = Math.abs(zScore) >= 0.78 || percentile <= 0.1 || percentile >= 0.9
  const phrase = pickVariant(
    `${persona.id}:${target.id}:${dimension.key}:${direction}`,
    dimension[persona.id][direction]
  )

  return {
    key: dimension.key,
    direction,
    strength: relativeStrength,
    phrase,
    badge: direction === 'high' ? dimension.highBadge : dimension.lowBadge,
    emphatic,
  }
}

function pickTopFacets(target, lineup, persona) {
  const facets = DIMENSIONS.map(dimension => buildFacet(target, lineup, persona, dimension))
    .sort((a, b) => b.strength - a.strength)

  const emphaticFacets = facets.filter(facet => facet.emphatic)
  if (emphaticFacets.length >= 2) {
    const selected = emphaticFacets.slice(0, 3)
    if (selected.length < 3) {
      const selectedKeys = new Set(selected.map(facet => facet.key))
      for (const facet of facets) {
        if (selectedKeys.has(facet.key)) {
          continue
        }
        selected.push(facet)
        selectedKeys.add(facet.key)
        if (selected.length === 3) {
          break
        }
      }
    }
    return selected
  }
  return facets.slice(0, 3)
}

function buildSpeciesName(target) {
  const genus = target.analysis.rumbleScore > 0.58
    ? 'Rumbulus'
    : target.analysis.textureScore > 0.56
      ? 'Crepitus'
      : target.analysis.pitchHz > 210
        ? 'Sibila'
        : 'Ventoris'

  const species = target.analysis.burstCount >= 4
    ? 'triplex'
    : target.analysis.tailRatio > 0.56
      ? 'longicauda'
      : target.analysis.activeDuration < 0.35
        ? 'brevis'
        : target.analysis.textureScore > 0.56
          ? 'asper'
          : 'placidus'

  return `${genus} ${species}`
}

function buildPoetNote(persona, target, facets) {
  const openings = [
    'A compact release',
    'A close-miked release',
    'A more tactile release',
    'A low-bodied release',
  ]
  const closers = [
    'Overall it reads as controlled and specific.',
    'The finish tells you almost as much as the onset.',
    'It feels more textural than forceful.',
    'The body and the surface are both easy to hear.',
  ]

  return {
    note: `${pickVariant(`${persona.id}:${target.id}:open`, openings)}: ${joinPhrases(facets.map(facet => facet.phrase))}. ${pickVariant(`${persona.id}:${target.id}:close`, closers)}`,
    pullQuote: pickVariant(`${persona.id}:${target.id}:quote`, [
      'Listen for body, surface, and finish.',
      'The texture usually gives it away.',
      'A good note should help you hear it more clearly.',
    ]),
  }
}

function buildNaturalistNote(persona, target, facets) {
  const summaries = [
    'It belongs to a fairly stable acoustic family.',
    'The profile is consistent enough to group with close neighbors.',
    'It would sit comfortably inside a recognizable cluster.',
    'The signature is distinct without being extreme.',
  ]

  return {
    note: `Specimen ${buildSpeciesName(target)}. Field notes: ${joinPhrases(facets.map(facet => facet.phrase))}. ${pickVariant(`${persona.id}:${target.id}:summary`, summaries)}`,
    pullQuote: pickVariant(`${persona.id}:${target.id}:quote`, [
      'Similarity becomes a family when listeners keep agreeing.',
      'Clusters are built from repeated listening.',
      'Taxonomy starts with stable differences.',
    ]),
  }
}

function buildEngineerNote(persona, target, facets) {
  const verdicts = [
    'The structure is easy to separate from the other two clips.',
    'The timing and spectral shape are doing most of the work here.',
    'Its envelope is more informative than its raw loudness.',
    'The distinguishing features are stable across the whole release.',
  ]

  return {
    note: `Readout: ${joinPhrases(facets.map(facet => facet.phrase))}. ${pickVariant(`${persona.id}:${target.id}:verdict`, verdicts)}`,
    pullQuote: pickVariant(`${persona.id}:${target.id}:quote`, [
      'Signal first, story second.',
      'Texture is information.',
      'Attack, body, and decay each carry identity.',
    ]),
  }
}

function buildCriticNote(persona, target, lineup) {
  const facets = pickTopFacets(target, lineup, persona)
  const builder = persona.id === 'poet'
    ? buildPoetNote
    : persona.id === 'naturalist'
      ? buildNaturalistNote
      : buildEngineerNote

  const payload = builder(persona, target, facets)
  return {
    ...payload,
    facets,
  }
}

export function createSommelierFlight(clips) {
  const seed = clips.map(clip => clip.id).join('|')
  const lineup = clips.map((clip, index) => ({
    ...clip,
    slotLabel: String.fromCharCode(65 + index),
  }))
  const slotOrder = deterministicShuffle(lineup.map((_, index) => index), seed)

  const critics = PERSONAS.slice(0, lineup.length).map((persona, index) => {
    const target = lineup[slotOrder[index]]
    const note = buildCriticNote(persona, target, lineup)
    return {
      ...persona,
      ...note,
      targetClipId: target.id,
      targetSlot: target.slotLabel,
      targetFileName: target.fileName,
    }
  })

  const averageDifficulty = critics.reduce((sum, critic) => {
    const meanStrength = critic.facets.reduce((facetSum, facet) => facetSum + facet.strength, 0) / critic.facets.length
    return sum + meanStrength
  }, 0) / critics.length

  return {
    lineup,
    critics,
    researchNote: averageDifficulty > 1.2
      ? 'Tonight\'s flight is sharply differentiated. The critics have good material.'
      : 'Tonight\'s flight is subtle. If a note works here, it is earning its keep.',
  }
}

export const SOMMELIER_PERSONAS = PERSONAS
