/**
 * Stadium Pulse AI — Complete TypeScript Type Contracts & AST Schemas
 * FIFA World Cup 2026 Operations & Digital Twin Engine
 */

export type DensityBand = 'low' | 'moderate' | 'high' | 'critical';
export type SeverityLevel = 'info' | 'warning' | 'critical';
export type MatchPhase = 'pre-match' | 'first-half' | 'halftime' | 'second-half' | 'post-match';
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'pt' | 'ar';

export interface ZoneState {
  id: string;
  label: string;
  category: string;
  capacity: number;
  status: 'open' | 'restricted' | 'closed';
  currentOccupancy: number;
  density: number;
  densityBand: DensityBand;
  incidents: string[];
}

export interface QueuePointState {
  id: string;
  label: string;
  zone: string;
  currentWaitMinutes: number;
  forecastWaitMinutes: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface WeatherState {
  condition: string;
  severity: 'none' | 'warning' | 'severe';
  temperature: number;
  windSpeed: number;
  forecastChange?: string | null;
  operationalImpact: string[];
}

export interface TransportState {
  transitLoad: DensityBand;
  rideshareWaitMinutes: number;
  shuttleStatus: 'running' | 'delayed' | 'suspended';
  parkingAvailability: number;
}

export interface AccessibilityState {
  brokenRoutes: Array<{ from: string; to: string; reason: string }>;
  alternativeRoutes: Array<{ from: string; to: string; path: string[] }>;
  sensoryRoomStatus: 'available' | 'at-capacity';
  wheelchairAssistAvailable: number;
}

export interface SustainabilityMetrics {
  wasteDivertedPercent: number;
  energyEfficiencyKW: number;
  waterRefillsCount: number;
  co2SavedKg: number;
  recyclingStatus: 'optimal' | 'attention-required';
}

export interface VolunteerState {
  id: string;
  name: string;
  role: 'steward' | 'accessibility' | 'medical' | 'guest-services' | 'transport';
  languages: SupportedLanguage[];
  assignedZone: string;
  status: 'available' | 'assigned' | 'off-duty';
  currentAssignment?: string | null;
}

export interface IncidentState {
  id: string;
  type: string;
  zone: string;
  severity: SeverityLevel;
  description: string;
  reportedAt: string;
  status: 'open' | 'resolving' | 'resolved';
}

export interface GroundedFacts {
  from: string;
  to: string;
  crowdLevel: DensityBand;
  occupancy: string;
  stepFreeRequired: boolean;
  visualSupportRequired: boolean;
  hearingSupportRequired: boolean;
  weather: string;
  brokenRoutes: number;
  sustainabilityStatus: string;
}

export interface StadiumSnapshot {
  timestamp: string;
  matchPhase: MatchPhase;
  zones: Record<string, ZoneState>;
  queues: Record<string, QueuePointState>;
  weather: WeatherState;
  transport: TransportState;
  accessibility: AccessibilityState;
  sustainability: SustainabilityMetrics;
  volunteers: VolunteerState[];
  incidents: Record<string, IncidentState>;
  pendingDecisions: string[];
}

export interface StadiumEvent {
  id: string;
  timestamp: string;
  source: 'sensor' | 'weather' | 'operator' | 'system' | 'fan-feedback' | 'simulation';
  category:
    | 'crowd'
    | 'queue'
    | 'weather'
    | 'incident'
    | 'accessibility'
    | 'sentiment'
    | 'transport'
    | 'sustainability'
    | 'operational';
  type: string;
  zone?: string | null;
  severity: SeverityLevel;
  data: Record<string, unknown>;
  triggeredBy?: string;
  cascadeDepth?: number;
}

export interface CoordinatedAction {
  id: string;
  team: 'security' | 'volunteers' | 'accessibility' | 'announcements' | 'rerouting';
  action: string;
  targetZone: string;
  priority: 'p1' | 'p2' | 'p3';
  parameters?: Record<string, unknown>;
}

export interface GeminiDecisionPlan {
  id: string;
  timestamp: string;
  source: 'gemini' | 'rules';
  riskSummary: string;
  actions: CoordinatedAction[];
  multilingualAlerts: Record<SupportedLanguage, string>;
  confidence: number;
}
