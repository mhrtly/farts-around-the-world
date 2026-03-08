export const liveOpsItems = [
  {
    id: 'ops-01',
    severity: 'critical',
    region: 'US Midwest',
    title: 'Lunch-hour surge exceeded rolling baseline by 212%',
    detail: 'Audio-bearing uploads clustered across three metros within fourteen minutes.',
    timestamp: '4m ago',
  },
  {
    id: 'ops-02',
    severity: 'watch',
    region: 'Northern Italy',
    title: 'Silence anomaly detected after expected dinner window',
    detail: 'System flagged under-reporting versus seasonal baseline. Could indicate cultural drift or no signal.',
    timestamp: '11m ago',
  },
  {
    id: 'ops-03',
    severity: 'elevated',
    region: 'Tokyo Corridor',
    title: 'High-rating audio burst lifted regional score',
    detail: 'Community verification and replay volume moved the corridor into top five trending zones.',
    timestamp: '18m ago',
  },
]

export const intelStories = [
  {
    id: 'intel-01',
    topic: 'methane',
    source: 'Guardian-style science desk',
    trust: 92,
    title: 'Methane monitoring tech keeps getting cheaper and more precise',
    summary: 'Good fit for a product sidebar explaining why methane gets used as both joke material and real-world scientific framing.',
    region: 'Global',
    published: '2h ago',
  },
  {
    id: 'intel-02',
    topic: 'gut-health',
    source: 'Health journal brief',
    trust: 88,
    title: 'Diet diversity and microbiome balance continue to dominate digestion coverage',
    summary: 'Could inspire weekly app themes, educational sidebars, or lighter-touch copy around dietary patterns.',
    region: 'Europe',
    published: '5h ago',
  },
  {
    id: 'intel-03',
    topic: 'food-science',
    source: 'Food systems reporter',
    trust: 84,
    title: 'Fermentation, legumes, and fiber remain central to digestive trend reporting',
    summary: 'A clean topic cluster for bean-heavy challenges, regional explainers, and “digestive intel” tagging.',
    region: 'South America',
    published: '7h ago',
  },
  {
    id: 'intel-04',
    topic: 'climate',
    source: 'Climate desk',
    trust: 90,
    title: 'Livestock methane remains one of the clearest public-entry methane stories',
    summary: 'Useful if the app wants a serious tangent that broadens the joke without becoming preachy.',
    region: 'Oceania',
    published: '9h ago',
  },
]

export const topicSignals = [
  { topic: 'methane', score: 94, direction: 'rising' },
  { topic: 'gut-health', score: 87, direction: 'steady' },
  { topic: 'food-science', score: 79, direction: 'rising' },
  { topic: 'microbiome', score: 72, direction: 'steady' },
  { topic: 'climate', score: 61, direction: 'watch' },
]

export const architectureNotes = [
  'Fetch news server-side, not from the browser.',
  'Cache normalized stories and topic tags before shipping anything to the HUD.',
  'Keep “Live Ops” separate from external journalism so the information model stays honest.',
  'Use source labels and publish time in every story card.',
]

export const mergeTargets = [
  'server/news/ or equivalent cached ingest layer',
  'src/data/newsClient.ts or .js helper',
  'src/components/HUD/NewsTicker.jsx refactor into dual-channel presentation',
  'src/App.jsx feed orchestration once schema is approved',
]
