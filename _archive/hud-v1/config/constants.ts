import type { FartClassification, ThreatLevel, DietCorrelation, GasconLevel } from '../types/events.ts';

// ---------------------------------------------------------------------------
// GASCON READINESS LEVELS
// Adapted from DEFCON. The nation's bowel-threat posture at a glance.
// ---------------------------------------------------------------------------

export const GASCON_LEVELS: Record<GasconLevel, { label: string; description: string; color: string }> = {
  1: {
    label: 'MAXIMUM FLATULENCE',
    description: 'Atmospheric saturation imminent. All personnel don respiratory protection. Civilian evacuation protocols in effect.',
    color: '#ff0040',
  },
  2: {
    label: 'GAS ALERT',
    description: 'Sustained high-intensity emissions detected across multiple theaters. Forward-deployed nasal assets at risk.',
    color: '#ff4400',
  },
  3: {
    label: 'ELEVATED EMISSIONS',
    description: 'Above-baseline gaseous activity observed. Olfactory surveillance networks on heightened alert.',
    color: '#ffaa00',
  },
  4: {
    label: 'GUARDED',
    description: 'Routine emissions within expected parameters. Standard monitoring protocols in effect.',
    color: '#00aaff',
  },
  5: {
    label: 'STABLE BOWELS',
    description: 'Minimal gaseous activity worldwide. Atmospheric conditions nominal. Stand down authorized.',
    color: '#2d8a6e',
  },
};

// ---------------------------------------------------------------------------
// FART CLASSIFICATION COLORS
// Each classification type is assigned a distinct color for rapid threat
// identification on the tactical display.
// ---------------------------------------------------------------------------

export const CLASSIFICATION_COLORS: Record<FartClassification, string> = {
  'silent-but-deadly': '#8b0000',
  'thunderclap': '#ff4500',
  'squeaker': '#ffd700',
  'rumbler': '#ff8c00',
  'machine-gun': '#dc143c',
  'the-leaker': '#9932cc',
  'wet-warning': '#2e8b57',
  'phantom': '#708090',
  'crop-duster': '#8b4513',
  'unclassified': '#a9a9a9',
};

// ---------------------------------------------------------------------------
// FART CLASSIFICATION LABELS
// Official nomenclature per STANAG 4489 (Standard NATO Agreement on
// Gaseous Emission Taxonomy).
// ---------------------------------------------------------------------------

export const CLASSIFICATION_LABELS: Record<FartClassification, string> = {
  'silent-but-deadly': 'Silent But Deadly',
  'thunderclap': 'Thunderclap',
  'squeaker': 'Squeaker',
  'rumbler': 'Rumbler',
  'machine-gun': 'Machine Gun',
  'the-leaker': 'The Leaker',
  'wet-warning': 'Wet Warning',
  'phantom': 'Phantom',
  'crop-duster': 'Crop Duster',
  'unclassified': 'Unclassified',
};

// ---------------------------------------------------------------------------
// THREAT LEVEL COLORS
// Color assignments per the National Flatulence Advisory System (NFAS).
// ---------------------------------------------------------------------------

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  CRITICAL: '#ff0040',
  SEVERE: '#ff4400',
  ELEVATED: '#ffaa00',
  GUARDED: '#00aaff',
  LOW: '#2d8a6e',
};

// ---------------------------------------------------------------------------
// INTENSITY LABELS (Beaufort-Analogous Gaseous Output Scale)
// Rated 1-10. Field operatives must log intensity at time of intercept.
// ---------------------------------------------------------------------------

export const INTENSITY_LABELS: Record<number, string> = {
  1: 'Barely perceptible',
  2: 'Faint trace detected',
  3: 'Confirmed presence',
  4: 'Moderate contamination',
  5: 'Significant atmospheric event',
  6: 'Severe localized saturation',
  7: 'Area denial achieved',
  8: 'Mass casualty potential',
  9: 'Theatre-wide NBC alert',
  10: 'Extinction-level event',
};

// ---------------------------------------------------------------------------
// CLASSIFICATION WEIGHTS
// Probability distribution for simulated event generation. Based on
// aggregated field data from 14 allied olfactory intelligence networks.
// Weights sum to 1.0.
// ---------------------------------------------------------------------------

export const CLASSIFICATION_WEIGHTS: Record<FartClassification, number> = {
  'silent-but-deadly': 0.18,
  'thunderclap': 0.08,
  'squeaker': 0.15,
  'rumbler': 0.14,
  'machine-gun': 0.05,
  'the-leaker': 0.10,
  'wet-warning': 0.04,
  'phantom': 0.12,
  'crop-duster': 0.09,
  'unclassified': 0.05,
};

// ---------------------------------------------------------------------------
// DIET CORRELATION WEIGHTS
// Default probability weights for diet-attribution modeling.
// Derived from Joint Gastro-Intelligence Estimate FY2026.
// ---------------------------------------------------------------------------

export const DIET_WEIGHTS: Record<DietCorrelation, number> = {
  'beans': 0.18,
  'dairy': 0.14,
  'cruciferous': 0.12,
  'red-meat': 0.08,
  'spicy': 0.09,
  'beer': 0.11,
  'protein-shake': 0.06,
  'fiber-heavy': 0.07,
  'fast-food': 0.08,
  'sugar-alcohols': 0.03,
  'unknown': 0.04,
};

// ---------------------------------------------------------------------------
// REGIONAL EMISSION WEIGHTS
// Geographic distribution model for global event simulation.
// Based on population density, dietary patterns, and verified sensor data.
// ---------------------------------------------------------------------------

export const REGION_WEIGHTS: Record<string, number> = {
  'East Asia': 0.28,
  'South Asia': 0.22,
  'Europe': 0.15,
  'North America': 0.12,
  'South America': 0.08,
  'Middle East': 0.05,
  'Africa': 0.04,
  'Central Asia': 0.04,
  'Oceania': 0.02,
};

export const REGIONS: string[] = [
  'East Asia',
  'South Asia',
  'Europe',
  'North America',
  'South America',
  'Middle East',
  'Africa',
  'Central Asia',
  'Oceania',
];
