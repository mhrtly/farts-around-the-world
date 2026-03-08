export const commandActions = [
  'Jump to Brazil hotspot',
  'Toggle audio-only emissions',
  'Open my uploads',
  'Open quiet anomaly preset',
]

export const regionPresets = [
  'Global',
  'North America',
  'Europe',
  'Latin America',
  'Spice Belt',
  'Quiet Anomalies',
]

export const timeWindows = ['1h', '6h', '24h', '7d']

export const layerToggles = [
  { name: 'Audio beacons', state: 'on' },
  { name: 'Community heat', state: 'on' },
  { name: 'Report risk', state: 'off' },
  { name: 'Digestive intel', state: 'on' },
  { name: 'Replay trails', state: 'off' },
  { name: 'Cuisine tags', state: 'standby' },
]

export const scorecards = [
  { label: 'Global flatulence index', value: '78', tone: 'active' },
  { label: 'Authenticity confidence', value: '91%', tone: 'active' },
  { label: 'Community delight', value: '8.7', tone: 'review' },
  { label: 'Report risk', value: '12%', tone: 'deleted' },
]

export const activeRegion = {
  name: 'Sao Paulo Corridor',
  status: 'hot',
  summary: 'High audio density, strong rating velocity, low report pressure, and cross-links to digestive-intel stories about legumes and fermentation.',
  stats: [
    { label: 'Audio-bearing clips', value: '43' },
    { label: 'Avg delight score', value: '9.1' },
    { label: 'Under review', value: '2' },
    { label: 'Volatility index', value: '66' },
  ],
}

export const liveSignals = [
  {
    title: 'Bean corridor pulse widening',
    detail: 'A 24-minute burst across Brazil and Argentina pushed community heat into the top tier.',
    tone: 'review',
  },
  {
    title: 'Quiet anomaly detected in Germany',
    detail: 'Expected dinner-hour activity failed to materialize in three urban clusters.',
    tone: 'deleted',
  },
  {
    title: 'Audio-rich cluster in Chicago',
    detail: 'Replay and rating volume suggest a strong candidate for event-of-the-day surfacing.',
    tone: 'active',
  },
]

export const productMoves = [
  'Region presets should be one-click, not buried.',
  'A command palette can expose power without cluttering the shell.',
  'Country and city dossiers should feel like briefings, not bland modals.',
  'Scoring systems must stay legible and funny, not pseudo-scientific sludge.',
]
