export const lexiconSource = {
  label: 'Wiktionary: fart translations',
  url: 'https://en.wiktionary.org/wiki/fart',
}

export const scienceSources = {
  niddk: {
    label: 'NIDDK: Gas in the Digestive Tract',
    url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/gas-digestive-tract/symptoms-causes',
  },
  medline: {
    label: 'MedlinePlus: Gas - flatulence',
    url: 'https://medlineplus.gov/ency/article/003124.htm',
  },
  britannica: {
    label: 'Britannica: flatulence',
    url: 'https://www.britannica.com/science/flatulence',
  },
}

export const historySources = {
  pliny: {
    label: 'Britannica: coleslaw history / Pliny reference',
    url: 'https://www.britannica.com/topic/coleslaw',
  },
  chaucer: {
    label: 'Britannica: The Summoner\'s Tale',
    url: 'https://www.britannica.com/topic/The-Summoners-Tale',
  },
  pdr: {
    label: 'Public Domain Review: The Games and Pleasures of Childhood (1657)',
    url: 'https://publicdomainreview.org/collection/the-games-and-pleasures-of-childhood-1657/',
  },
  loc1910: {
    label: 'Library of Congress: The Annoyance of Flatulence (1910)',
    url: 'https://chroniclingamerica.loc.gov/lccn/sn86090451/1910-01-27/ed-1/seq-14/',
  },
}

export const fartLexiconEntries = [
  {
    language: 'Spanish',
    term: 'peer',
    transliteration: 'peer',
    region: 'Spain and Latin America',
    note: 'Common verb; noun forms like "pedo" vary by register and region.',
    source: lexiconSource,
  },
  {
    language: 'French',
    term: 'peter',
    transliteration: 'péter',
    region: 'France and Francophone regions',
    note: 'Common informal verb; French also has playful phrases for softer tones.',
    source: lexiconSource,
  },
  {
    language: 'German',
    term: 'furzen',
    transliteration: 'furzen',
    region: 'Germany, Austria, Switzerland',
    note: 'Standard informal verb; softer or regional variants also exist.',
    source: lexiconSource,
  },
  {
    language: 'Mandarin',
    term: '放屁',
    transliteration: 'fangpi',
    region: 'Mandarin Chinese',
    note: 'Common colloquial verb phrase.',
    source: lexiconSource,
  },
  {
    language: 'Japanese',
    term: 'おならをする',
    transliteration: 'onara o suru',
    region: 'Japanese',
    note: 'Everyday phrasing; more formal medical language also exists.',
    source: lexiconSource,
  },
  {
    language: 'Korean',
    term: '방귀뀌다',
    transliteration: 'banggwikkwida',
    region: 'Korean',
    note: 'Common everyday verb phrase.',
    source: lexiconSource,
  },
  {
    language: 'Hindi',
    term: 'पादना',
    transliteration: 'padna',
    region: 'Hindi',
    note: 'Common verb; other idioms describe "releasing air."',
    source: lexiconSource,
  },
  {
    language: 'Arabic',
    term: 'ضَرَطَ',
    transliteration: 'darata',
    region: 'Arabic',
    note: 'Wiktionary lists audible and quiet variants; this one is the audible form.',
    source: lexiconSource,
  },
  {
    language: 'Indonesian',
    term: 'kentut',
    transliteration: 'kentut',
    region: 'Indonesia and Malay sphere',
    note: 'Short, memorable, and excellent as a playful UI label.',
    source: lexiconSource,
  },
  {
    language: 'Quechua',
    term: 'supiy',
    transliteration: 'supiy',
    region: 'Quechua',
    note: 'Wiktionary notes this as an audible form, with a different inaudible variant.',
    source: lexiconSource,
  },
]

export const scienceFactCards = [
  {
    title: 'Normal is wider than people think',
    body: 'NIDDK says studies suggest people often pass gas 8 to 14 times a day, and up to 25 times a day can still be normal.',
    tone: 'baseline',
    source: scienceSources.niddk,
  },
  {
    title: 'Most gas has two main entry points',
    body: 'Gas gets in when we swallow air and when gut microbes break down carbohydrates that were not fully digested earlier in the tract.',
    tone: 'mechanism',
    source: scienceSources.niddk,
  },
  {
    title: 'The smell is not the bulk of the gas',
    body: 'Britannica notes that the common gases are odorless, and the recognizable smell comes from a much smaller mix that can include sulfur-containing gases.',
    tone: 'odor',
    source: scienceSources.britannica,
  },
  {
    title: 'Food and intolerance both matter',
    body: 'MedlinePlus points to fiber shifts, lactose intolerance, fructose, and other hard-to-digest foods as common reasons people feel especially gassy.',
    tone: 'food',
    source: scienceSources.medline,
  },
]

export const scienceCaution = {
  title: 'Grounding note',
  body: 'If the app ever presents science cards, they should reassure rather than alarm: normal variation is broad, but sudden changes with pain, diarrhea, constipation, or weight loss deserve actual medical attention.',
  source: scienceSources.niddk,
}

export const historyTimeline = [
  {
    year: '4th c. BCE to 77 CE',
    title: 'Ancient digestion lore treated gas as worth discussing',
    detail: 'Britannica\'s history note on coleslaw traces cabbage remedies for flatulence back through Greek and Roman medical writing, including Pliny the Elder.',
    source: historySources.pliny,
  },
  {
    year: 'Late 14th century',
    title: 'Chaucer turns a fart into literary engineering',
    detail: 'In The Summoner\'s Tale, a patron offers a friar a fart and the story then puzzles over how to divide it equally among twelve colleagues.',
    source: historySources.chaucer,
  },
  {
    year: '1657',
    title: 'French print culture turns flatulence into a children\'s game engraving',
    detail: 'The Public Domain Review highlights a plate from Les Jeux et Plaisirs de l\'Enfance depicting a game literally glossed as "fart in the face."',
    source: historySources.pdr,
  },
  {
    year: '1910',
    title: 'Newspapers framed flatulence as embarrassment plus digestion',
    detail: 'A Library of Congress newspaper page titled The Annoyance of Flatulence links gas to swallowed air, fermentation, and the social discomfort of public rumbling.',
    source: historySources.loc1910,
  },
]

export const vintageClippings = [
  {
    year: '1833',
    headline: 'Patent medicine culture listed flatulence beside everything else',
    outlet: 'The New Hampshire Gazette',
    summary: 'An advertisement pitched one bottle as useful for jaundice, cholic, headache, hysteria, asthma, and flatulence, which is a good reminder that old newspaper health advice often doubled as sales copy.',
    source: {
      label: 'Library of Congress: The New Hampshire Gazette, March 5, 1833',
      url: 'https://chroniclingamerica.loc.gov/lccn/sn83025588/1833-03-05/ed-1/seq-4/',
    },
  },
  {
    year: '1890',
    headline: 'Every meal is a trial',
    outlet: 'Los Angeles Herald',
    summary: 'A dyspepsia ad grouped flatulence with heartburn and stomach fullness, packaging digestive distress as a daily melodrama to sell bitters.',
    source: {
      label: 'Library of Congress: Los Angeles Herald, April 28, 1890',
      url: 'https://chroniclingamerica.loc.gov/lccn/sn84025968/1890-04-28/ed-1/seq-7/ocr/',
    },
  },
  {
    year: '1906',
    headline: 'Indigestion arrives with companions',
    outlet: 'Lovelock Tribune',
    summary: 'A Nevada newspaper ad treated heartburn, flatulence, constipation, and "torpidity of the liver" as a gang of problems a single bottle could solve.',
    source: {
      label: 'Library of Congress: Lovelock Tribune, July 13, 1906',
      url: 'https://chroniclingamerica.loc.gov/lccn/sn86091313/1906-07-13/ed-1/seq-1/',
    },
  },
  {
    year: '1910',
    headline: 'The Annoyance of Flatulence',
    outlet: 'The National Prohibitionist',
    summary: 'This Chicago page mixes digestive explanation with a strong sense of public embarrassment, which feels oddly modern even when the remedies do not.',
    source: historySources.loc1910,
  },
]

export const emotionalJourneyWidgets = [
  {
    title: 'First laugh',
    feeling: 'Relief',
    body: 'Open with delight and permission. Let the user laugh before you ask them to learn or do anything.',
    action: 'Play a global starter reel',
  },
  {
    title: 'Cultural curiosity',
    feeling: 'Wonder',
    body: 'The language shelf works because it turns one silly word into proof that the whole planet shares the joke.',
    action: 'Browse words from 10 languages',
  },
  {
    title: 'Science grounding',
    feeling: 'Reassurance',
    body: 'After comedy peaks, give the user one clean science card so the experience feels anchored, not random.',
    action: 'Open the field guide',
  },
  {
    title: 'Soft next step',
    feeling: 'Care',
    body: 'When the user is warmed up, offer eco mode, kindness prompts, or acts of repair as optional choices rather than moral homework.',
    action: 'Toggle eco mode',
  },
]
