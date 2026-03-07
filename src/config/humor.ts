import type { GasconLevel } from '../types/events.ts';

// ---------------------------------------------------------------------------
// FIELD OPERATIVE ALIASES
// Codenames assigned to anonymous reporters per OPSEC Directive 7.12.
// All aliases are sanitized and approved by the Office of Gaseous Affairs.
// ---------------------------------------------------------------------------

export const REPORTER_ALIASES: string[] = [
  'BEANSTALK',
  'WINDBREAKER',
  'GASTRONAUT',
  'SILENT SENTINEL',
  'METHANE HAWK',
  'THUNDER BOTTOM',
  'CROP DUSTER',
  'BROWN CLOUD',
  'SULFUR KING',
  'PHANTOM LIMB',
  'DAIRY QUEEN',
  'GAS GIANT',
  'WIND TUNNEL',
  'DUTCH OVEN',
  'PROTEIN PUNISHER',
  'FIBER OPTIC',
  'CABBAGE PATCH',
  'BEAN COUNTER',
  'BOTTOM FEEDER',
  'WIND SHEAR',
  'FOGHORN',
  'STEALTH BOMBER',
  'AIR BISCUIT',
  'BACK DRAFT',
  'TROUSER TRUMPET',
  'BARKING SPIDER',
  'CHAIR WARMER',
  'ELEVATOR OPERATOR',
  'UNDER COVER',
  'TAIL WIND',
];

// ---------------------------------------------------------------------------
// OLFACTORY SENSOR NETWORK IDENTIFIERS
// Deployed sensor arrays across 20 strategic monitoring stations.
// Maintained by the Global Atmospheric Surveillance Command (GASC).
// ---------------------------------------------------------------------------

export const SENSOR_IDS: string[] = [
  'OLFACTORY-ARRAY-7',
  'ACOUSTIC-GRID-12',
  'METHANE-SWEEP-3',
  'NOSINT-RELAY-9',
  'SULFUR-WATCH-15',
  'THERMAL-PLUME-4',
  'GASTRO-SAT-22',
  'WIND-TRACE-8',
  'BIO-SNIFFER-11',
  'DEEP-SNIFF-6',
  'AERO-DETECT-19',
  'FECAL-SPEC-2',
  'RUMBLE-NET-14',
  'VAPOR-TRAIL-17',
  'BROWN-NOTE-5',
  'SILENT-EAR-20',
  'PLUME-HAWK-1',
  'GUT-PULSE-16',
  'ECHO-BOWEL-10',
  'TAINT-SCAN-13',
];

// ---------------------------------------------------------------------------
// ANALYST NOTES
// Standard-issue contextual observations appended to signal intelligence
// reports. All notes have been reviewed by the Classification Authority.
// ---------------------------------------------------------------------------

export const ANALYST_NOTES: string[] = [
  'Signature consistent with post-lunch surge. Recommend continued monitoring.',
  'Acoustic profile suggests confined space. Elevator scenario probable.',
  'Duration exceeds 4 seconds. Reclassify as sustained emission event.',
  'Multiple witnesses corroborate. Verified by independent nasal assets.',
  'Subject attributed emission to nearby canine. Assessment: DECEPTION.',
  'Spectral analysis indicates high sulfur content. Dairy origin confirmed.',
  'Event occurred during formal dinner. Collateral embarrassment: SEVERE.',
  'Sequential emissions detected. Reclassify as machine-gun pattern.',
  'Source attempted blame-shift to chair noise. Acoustic analysis refutes.',
  'Thermal bloom detected on satellite pass. Intensity: UNPRECEDENTED.',
  'Embassy staff evacuated. Diplomatic incident assessment: MODERATE.',
  'Subject consumed military rations 4 hours prior. Causation: ESTABLISHED.',
  'Wind direction shifted post-event. Downwind casualties reported.',
  'Emission detected in sealed conference room. No survivors olfactorily.',
  'Pattern matches known repeat offender. Asset BEANSTALK on watchlist.',
  'Ventilation system compromised. Building-wide contamination in progress.',
  'Silent variant detected by chemical sensors only. Acoustic signature: NULL.',
  'Subject in denial. Physiological indicators confirm origin with HIGH confidence.',
  'Preceded by audible gastrointestinal disturbance. 12-second warning window.',
  'Recovery teams deployed. Ambient levels returning to baseline.',
  'Cross-referencing with local restaurant data. Correlation: BEANS.',
  'Suspect attempted to mask emission with cough. Temporal offset: 0.3s. FAILED.',
  'Atmospheric sample secured for lab analysis. Chain of custody maintained.',
  'Third event from this grid square in 90 minutes. Designating as hotspot.',
  'Emission coincided with elevator door closure. Timing assessed as DELIBERATE.',
  'Foreign liaison reports similar signature in adjacent territory. Coordinated?',
  'Satellite imagery shows visible thermal distortion. Intensity: REMARKABLE.',
  'All-source assessment: Subject had tikka masala at 1900 hours local.',
  'Ambient temperature spike of 0.3C recorded at point of origin.',
  'Recommend upgrading regional GASCON level. This is not a drill.',
  'Witness reports audible component lasted longer than national anthem.',
  'Payload dispersal pattern consistent with crop-duster classification.',
  'NOTE: This analyst requests hazard pay for olfactory review of this event.',
];

// ---------------------------------------------------------------------------
// PAYLOAD DESCRIPTION GENERATOR
// Constructs standardized emission characterizations per FM 3-11.7
// (Field Manual: Atmospheric Hazard Description Protocols).
// ---------------------------------------------------------------------------

export const PAYLOAD_ADJECTIVES: string[] = [
  'Sulfurous',
  'Pungent',
  'Acrid',
  'Musty',
  'Rancid',
  'Earthy',
  'Sharp',
  'Dense',
  'Lingering',
  'Cloying',
  'Noxious',
  'Oppressive',
  'Eye-watering',
  'Weaponized',
  'Industrial-grade',
  'Fermented',
  'Putrid',
  'Tangy',
  'Thick',
  'Caustic',
];

export const PAYLOAD_BASES: string[] = [
  'with notes of regret',
  'with undertones of last night\'s curry',
  'with a lingering finish of despair',
  'with hints of aged cheese',
  'reminiscent of a neglected dumpster',
  'evoking memories of a sulfur mine',
  'with a bouquet of broken promises',
  'carrying traces of protein isolate',
  'with an unmistakable cabbage signature',
  'suggesting prolonged bean exposure',
  'with a base layer of existential dread',
  'redolent of a forgotten lunchbox',
  'carrying the weight of poor decisions',
  'with a persistent methane backbone',
  'suggesting advanced decomposition',
  'with an aggressive dairy profile',
  'evoking a recently fertilized field',
  'with complex fast-food overtones',
  'bearing the hallmarks of gas station sushi',
  'with a disturbingly organic quality',
];

export const PAYLOAD_MODIFIERS: string[] = [
  'Recommend immediate area evacuation.',
  'Nasal protection mandatory within 5-meter radius.',
  'Ambient recovery estimated at 4-7 minutes.',
  'Secondary wave possible. Maintain alert posture.',
  'Ventilation countermeasures advised.',
  'Wallpaper damage reported in adjacent room.',
  'Paint peeling observed at point of origin.',
  'Canary in coal mine equivalent: DECEASED.',
  'Civilians self-evacuating without instruction.',
  'Air freshener reserves depleted in sector.',
  'Local flora showing signs of distress.',
  'Building management has been notified.',
  'HAZMAT assessment pending.',
  'Scented candle deployed as countermeasure. Status: OVERWHELMED.',
  'Pets in vicinity exhibiting avoidance behavior.',
];

/**
 * Generates a standardized payload description by combining randomly
 * selected adjective, base note, and operational modifier.
 */
export function generatePayloadDescription(): string {
  const adj = PAYLOAD_ADJECTIVES[Math.floor(Math.random() * PAYLOAD_ADJECTIVES.length)];
  const base = PAYLOAD_BASES[Math.floor(Math.random() * PAYLOAD_BASES.length)];
  const mod = PAYLOAD_MODIFIERS[Math.floor(Math.random() * PAYLOAD_MODIFIERS.length)];
  return `${adj} ${base}. ${mod}`;
}

// ---------------------------------------------------------------------------
// GLOBAL OPERATIONS CLOCK CITIES
// Six strategic monitoring stations displayed on the command center clock
// array. Each station maintains 24/7 olfactory surveillance coverage.
// ---------------------------------------------------------------------------

export const CLOCK_CITIES: { real: string; pun: string; tz: string }[] = [
  { real: 'Washington D.C.', pun: 'WASHINGWIND D.C.', tz: 'America/New_York' },
  { real: 'London', pun: 'LONDON BROIL', tz: 'Europe/London' },
  { real: 'Moscow', pun: 'METHANE-COW', tz: 'Europe/Moscow' },
  { real: 'Beijing', pun: 'BEAN-JING', tz: 'Asia/Shanghai' },
  { real: 'Sydney', pun: 'SIT-NEY', tz: 'Australia/Sydney' },
  { real: 'Brasilia', pun: 'BRAZIL-IA BLAST', tz: 'America/Sao_Paulo' },
];

// ---------------------------------------------------------------------------
// GASCON LEVEL EXTENDED DESCRIPTIONS
// Detailed operational guidance for each GASCON readiness state.
// Distributed to all commands via OPREP-3 FLATULENCE PINNACLE.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// EMISSION CLASSIFICATION SYSTEM
// Categorizes recorded emissions based on acoustic analysis parameters
// per Standard Operating Procedure: Flatulence Taxonomy v3.2
// ---------------------------------------------------------------------------

export interface EmissionClassification {
  label: string;
  code: string;
  color: string;
  description: string;
}

/**
 * Classifies a fart based on duration and volume measurements.
 * Returns a structured classification with label, tactical code,
 * display color, and operational description.
 */
export function classifyEmission(duration: number | null, volume: number | null): EmissionClassification {
  const d = duration ?? 0;
  const v = volume ?? 0;

  // Duration bands: short (<1s), medium (1-3s), long (3-6s), epic (6+s)
  // Volume bands: silent (<5), quiet (5-15), moderate (15-30), loud (30-50), thunderous (50+)

  if (d < 1) {
    if (v < 5)  return { label: 'Ghost Puff',       code: 'SBD-1', color: '#b088ff', description: 'Detected by chemical sensors only. Zero acoustic signature.' };
    if (v < 15) return { label: 'Cheeky Pop',       code: 'POP-1', color: '#9dff4a', description: 'Brief, playful emission. Low collateral impact.' };
    if (v < 30) return { label: 'Quick Snap',       code: 'SNP-2', color: '#ffb020', description: 'Sharp burst of moderate intensity. Rapid dispersal expected.' };
    if (v < 50) return { label: 'Firecracker',      code: 'FRC-3', color: '#ff6b6b', description: 'High-energy short-duration blast. Immediate area affected.' };
    return            { label: 'Sonic Blip',        code: 'SON-4', color: '#ff4d5a', description: 'Extreme acoustic event compressed into sub-second window.' };
  }

  if (d < 3) {
    if (v < 5)  return { label: 'Stealth Drift',    code: 'STL-1', color: '#b088ff', description: 'Extended silent emission. Maximum deniability achieved.' };
    if (v < 15) return { label: 'Soft Roller',      code: 'ROL-2', color: '#38f3ff', description: 'Gentle sustained release. Moderate ambient contamination.' };
    if (v < 30) return { label: 'Standard Issue',   code: 'STD-2', color: '#38f3ff', description: 'Textbook emission. Well within operational parameters.' };
    if (v < 50) return { label: 'Brass Section',    code: 'BRS-3', color: '#ffb020', description: 'Muscular sustained output with distinct tonal qualities.' };
    return            { label: 'Power Chord',       code: 'PWR-4', color: '#ff6b6b', description: 'Sustained high-volume emission. Building management notified.' };
  }

  if (d < 6) {
    if (v < 5)  return { label: 'Silent Assassin',  code: 'ASN-2', color: '#b088ff', description: 'Prolonged covert emission. Casualties discovered retroactively.' };
    if (v < 15) return { label: 'Low Rumbler',      code: 'RMB-2', color: '#38f3ff', description: 'Extended low-frequency emission with seismic undertones.' };
    if (v < 30) return { label: 'Rolling Thunder',  code: 'THD-3', color: '#ffb020', description: 'Sustained multi-phase event with variable acoustic profile.' };
    if (v < 50) return { label: 'Foghorn',          code: 'FOG-4', color: '#ff6b6b', description: 'Dominant sustained blast. Audible across multiple rooms.' };
    return            { label: 'Tectonic Event',    code: 'TEC-5', color: '#ff4d5a', description: 'Structural vibrations detected. Richter scale consultation advised.' };
  }

  // Epic duration (6+ seconds)
  if (v < 15) return  { label: 'Marathon Drift',    code: 'MRT-3', color: '#ff64ff', description: 'Extraordinary sustained silent emission. Record-setting endurance.' };
  if (v < 30) return  { label: 'Grand Passage',     code: 'GRP-4', color: '#ff64ff', description: 'Extended ceremonial emission. Witnesses report temporal distortion.' };
  if (v < 50) return  { label: 'Extinction Event',  code: 'EXT-5', color: '#ff4d5a', description: 'Catastrophic sustained emission. Area quarantine recommended.' };
  return              { label: 'Chamber of Horrors', code: 'COH-5', color: '#ff4d5a', description: 'Beyond classification. Multiple international treaties violated.' };
}

export const GASCON_DESCRIPTIONS: Record<GasconLevel, string> = {
  1: 'Global atmospheric contamination at critical threshold. All military and civilian installations on maximum alert. Respiratory protection equipment mandatory for all personnel. Non-essential movement prohibited. Strategic reserve of air freshener activated. The National Command Authority has been briefed.',
  2: 'Widespread high-intensity gaseous events across multiple continents. Allied olfactory networks reporting sensor saturation. Regional evacuation plans on standby. International Flatulence Treaty Organization (IFTO) emergency session convened. Population advised to seal windows.',
  3: 'Above-normal emissions detected across key monitoring zones. Intelligence indicates elevated dietary risk factors in multiple regions. Sensor networks on heightened alert. Field operatives report increased ambient sulfur readings. Situation bears close monitoring.',
  4: 'Routine flatulence activity within established norms. Standard monitoring and collection operations continue. Quarterly emissions report on schedule. Minor localized events handled through normal channels. No immediate action required.',
  5: 'Minimal atmospheric disturbance worldwide. All monitoring stations report nominal conditions. The global bowel is at peace. Sensor maintenance windows authorized. Personnel may stand down from olfactory watch. A rare and fragile calm prevails.',
};
