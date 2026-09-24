const COUNTRY_FLAG_OVERRIDES = {
  'United States': '🇺🇸',
  USA: '🇺🇸',
  US: '🇺🇸',
  Canada: '🇨🇦',
  Mexico: '🇲🇽',
  Brazil: '🇧🇷',
  Argentina: '🇦🇷',
  UK: '🇬🇧',
  'United Kingdom': '🇬🇧',
  England: '🏴',
  Scotland: '🏴',
  Wales: '🏴',
  Ireland: '🇮🇪',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Italy: '🇮🇹',
  Spain: '🇪🇸',
  Portugal: '🇵🇹',
  Netherlands: '🇳🇱',
  Belgium: '🇧🇪',
  Switzerland: '🇨🇭',
  Sweden: '🇸🇪',
  Norway: '🇳🇴',
  Finland: '🇫🇮',
  Denmark: '🇩🇰',
  Poland: '🇵🇱',
  Ukraine: '🇺🇦',
  Russia: '🇷🇺',
  Turkey: '🇹🇷',
  India: '🇮🇳',
  Pakistan: '🇵🇰',
  Bangladesh: '🇧🇩',
  China: '🇨🇳',
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  Korea: '🇰🇷',
  Indonesia: '🇮🇩',
  Philippines: '🇵🇭',
  Thailand: '🇹🇭',
  Vietnam: '🇻🇳',
  Australia: '🇦🇺',
  'New Zealand': '🇳🇿',
  'South Africa': '🇿🇦',
  Nigeria: '🇳🇬',
  Egypt: '🇪🇬',
  Kenya: '🇰🇪',
  Saudi: '🇸🇦',
  'Saudi Arabia': '🇸🇦',
  UAE: '🇦🇪',
  Israel: '🇮🇱',
};

function countryCodeToFlag(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '';
  const points = [...normalized].map((letter) => 127397 + letter.charCodeAt(0));
  return String.fromCodePoint(...points);
}

function getEventTimestamp(event) {
  if (!event) return 0;
  if (typeof event.timestamp === 'number') return event.timestamp;
  if (typeof event.time === 'number') return event.time;
  if (typeof event.createdAt === 'number') return event.createdAt;
  if (typeof event.timestamp === 'string') {
    const parsed = Date.parse(event.timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function getCountryName(event) {
  const country =
    event?.country ||
    event?.originCountry ||
    event?.countryName ||
    'Unknown';
  return String(country).trim() || 'Unknown';
}

function getCountryFlag(event, country) {
  if (event?.flag && String(event.flag).trim()) return event.flag;

  const code =
    event?.countryCode ||
    event?.country_code ||
    event?.iso2 ||
    event?.isoCode;
  const codeFlag = countryCodeToFlag(code);
  if (codeFlag) return codeFlag;

  // country value itself may be a 2-letter ISO code (e.g. 'GB', 'JP')
  const directFlag = countryCodeToFlag(country);
  if (directFlag) return directFlag;

  return COUNTRY_FLAG_OVERRIDES[country] || '🌐';
}

export function buildTimelineBuckets(events, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000)
  const buckets = []
  for (let i = 0; i < windowSeconds; i++) {
    buckets.push({ second: now - (windowSeconds - 1 - i), count: 0 })
  }
  const cutoff = (now - windowSeconds + 1) * 1000
  for (const e of events) {
    if (e.timestamp < cutoff) continue
    const sec = Math.floor(e.timestamp / 1000)
    const idx = sec - (now - windowSeconds + 1)
    if (idx >= 0 && idx < windowSeconds) buckets[idx].count++
  }
  return buckets
}

export function getLeaderboard(events, windowMs = 60000) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const now = Date.now();
  const cutoff = now - windowMs;
  const byCountry = new Map();

  for (const event of events) {
    const timestamp = getEventTimestamp(event);
    if (timestamp < cutoff) continue;

    const country = getCountryName(event);
    const flag = getCountryFlag(event, country);
    const current = byCountry.get(country);

    if (current) {
      current.count += 1;
    } else {
      byCountry.set(country, { country, flag, count: 1 });
    }
  }

  return [...byCountry.values()]
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))
    .slice(0, 5)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
