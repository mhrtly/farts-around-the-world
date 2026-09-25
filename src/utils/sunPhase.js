// Was the sun up where (and when) this was recorded? A small, standard solar
// position calculation (good to a fraction of a degree), so a recording can
// honestly say "NIGHT". Civil twilight (sun between −6° and +6°) reads as DAWN
// or DUSK depending on whether the sun is rising or setting.

const RAD = Math.PI / 180

export function sunElevation(lat, lng, timestamp) {
  const d = timestamp / 86400000 - 10957.5 // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD // mean anomaly
  const q = 280.459 + 0.98564736 * d // mean longitude (deg)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD // ecliptic longitude
  const e = (23.439 - 0.00000036 * d) * RAD // obliquity
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24 // hours
  const hourAngle = (gmst * 15 + lng) * RAD - ra
  const phi = lat * RAD
  const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle))
  // Normalised hour angle: negative before local solar noon (morning)
  const h = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle))
  return { elevation: elevation / RAD, morning: h < 0 }
}

export function sunPhase(lat, lng, timestamp) {
  if (![lat, lng, timestamp].every(value => Number.isFinite(Number(value)))) return null
  const { elevation, morning } = sunElevation(Number(lat), Number(lng), Number(timestamp))
  if (elevation > 6) return 'DAY'
  if (elevation < -6) return 'NIGHT'
  return morning ? 'DAWN' : 'DUSK'
}
