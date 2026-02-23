import type { GasEvent, SignalIntercept, ThreatLevel, GasconLevel, FartClassification } from './events.ts';
import type { CountryGasProfile } from './country.ts';

export interface DashboardState {
  globalFlatulenceIndex: number;
  gfiTrend: number;
  gasconLevel: GasconLevel;
  currentThreatLevel: ThreatLevel;
  atmosphericContaminationPct: number;
  activeEvents: GasEvent[];
  recentSignals: SignalIntercept[];
  countryProfiles: Map<string, CountryGasProfile>;
  selectedCountry: string | null;
  showReportForm: boolean;
  showCountryDossier: boolean;
  mapView: MapViewState;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d' | 'all';
  activeLayers: Set<string>;
}

export interface MapViewState {
  zoom: number;
  center: [number, number];
  pitch: number;
  bearing: number;
}

export interface GlobalMetrics {
  gfi: number;
  gfiTrend: number;
  totalEventsToday: number;
  totalEventsThisHour: number;
  eventsPerMinute: number;
  atmosphericContaminationLevel: number;
  peakActivityRegion: string;
  topProducingNations: NationRanking[];
  classificationBreakdown: Record<string, number>;
  dietBreakdown: Record<string, number>;
  timeSeriesData: TimeSeriesPoint[];
}

export interface NationRanking {
  countryCode: string;
  countryName: string;
  eventCount: number;
  avgIntensity: number;
  perCapita: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TimeSeriesPoint {
  timestamp: number;
  eventCount: number;
  avgIntensity: number;
  peakClassification: FartClassification;
}
