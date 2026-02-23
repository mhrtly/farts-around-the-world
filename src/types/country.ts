import type { FartClassification, DietCorrelation } from './events.ts';

export interface CountryGasProfile {
  countryCode: string;
  countryName: string;
  population: number;
  gasIndex: number;
  trend: 'escalating' | 'stable' | 'de-escalating';
  trendDelta: number;
  perCapitaEmissions: number;
  dominantClassification: FartClassification;
  topDietCorrelation: DietCorrelation;
  totalEvents: number;
  totalEventsLast24h: number;
  notableEvents: NotableGasEvent[];
  riskAssessment: string;
  componentScores: {
    frequency: number;
    intensity: number;
    toxicity: number;
    publicExposure: number;
  };
  dietProfile: Record<string, number>;
  peakHours: number[];
  activeAlerts: string[];
}

export interface NotableGasEvent {
  date: string;
  title: string;
  description: string;
  classification: FartClassification;
  impact: 'catastrophic' | 'severe' | 'moderate' | 'minor';
  location: string;
}
