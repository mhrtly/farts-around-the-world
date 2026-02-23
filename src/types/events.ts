export type FartClassification =
  | 'silent-but-deadly'
  | 'thunderclap'
  | 'squeaker'
  | 'rumbler'
  | 'machine-gun'
  | 'the-leaker'
  | 'wet-warning'
  | 'phantom'
  | 'crop-duster'
  | 'unclassified';

export type ThreatLevel = 'CRITICAL' | 'SEVERE' | 'ELEVATED' | 'GUARDED' | 'LOW';

export type GasconLevel = 1 | 2 | 3 | 4 | 5;

export type DietCorrelation =
  | 'beans' | 'dairy' | 'cruciferous' | 'red-meat' | 'spicy'
  | 'beer' | 'protein-shake' | 'fiber-heavy' | 'fast-food'
  | 'sugar-alcohols' | 'unknown';

export type IntelligenceType = 'SIGINT' | 'HUMINT' | 'NOSINT' | 'OLFINT';

export type ClassificationMarking =
  | 'TOP SECRET//SCI//NOFART'
  | 'TOP SECRET//SCI'
  | 'SECRET//REL TO FVEY'
  | 'SECRET'
  | 'CONFIDENTIAL'
  | 'UNCLASSIFIED//FOUO';

export type SignalPriority = 'FLASH' | 'IMMEDIATE' | 'PRIORITY' | 'ROUTINE';

export interface GasEvent {
  id: string;
  timestamp: number;
  coordinates: [number, number]; // [lng, lat]
  country: string;
  city: string;
  classification: FartClassification;
  intensity: number;
  duration: number;
  decibels: number;
  payloadDescription: string;
  dietCorrelation: DietCorrelation;
  anonymous: boolean;
  reporterAlias?: string;
  verified: boolean;
  threatLevel: ThreatLevel;
  areaOfEffect: number;
  nasalCasualties: number;
  indoorOutdoor: 'indoor' | 'outdoor' | 'vehicle' | 'elevator';
  ventilation: 'none' | 'poor' | 'moderate' | 'good';
}

export interface SignalIntercept {
  id: string;
  timestamp: number;
  type: IntelligenceType;
  classification: ClassificationMarking;
  originCoordinates: [number, number];
  originCountry: string;
  originCity: string;
  summary: string;
  relatedEventId: string;
  priority: SignalPriority;
  sensorId: string;
  analystNote?: string;
}
