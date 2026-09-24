import { v4 as uuidv4 } from 'uuid'

const COUNTRIES = [
  'US','GB','DE','FR','JP','CN','BR','IN','AU','CA',
  'MX','RU','NG','ZA','EG','AR','KR','ID','TR','IT',
]

const TYPES = ['standard', 'standard', 'standard', 'epic', 'silent-but-deadly']

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function generateEvent() {
  return {
    id: uuidv4(),
    lat: randomBetween(-70, 70),
    lng: randomBetween(-180, 180),
    intensity: Math.ceil(randomBetween(1, 10)),
    country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
    timestamp: Date.now(),
    type: TYPES[Math.floor(Math.random() * TYPES.length)],
  }
}

export function createFartStream(onEvent) {
  let running = true
  let timeoutId

  function scheduleNext() {
    if (!running) return
    const burstMode = Math.random() < 0.15
    const delay = burstMode ? randomBetween(80, 200) : randomBetween(400, 1200)

    timeoutId = setTimeout(() => {
      if (!running) return
      const count = burstMode ? Math.floor(randomBetween(3, 8)) : 1
      for (let i = 0; i < count; i++) onEvent(generateEvent())
      scheduleNext()
    }, delay)
  }

  scheduleNext()
  return { stop() { running = false; clearTimeout(timeoutId) } }
}

export { generateEvent }
