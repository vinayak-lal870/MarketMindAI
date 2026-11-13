export type LanguageCode = 'en' | 'hi' | 'te' | 'ta' | 'mr';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  locale: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी', locale: 'hi-IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', locale: 'te-IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', locale: 'ta-IN' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', locale: 'mr-IN' },
];

export type PriceTier =
  | 'Mass (Under ₹499)'
  | 'Mid-Premium (₹500–₹1,499)'
  | 'Luxury (₹1,500+)';

export interface BusinessDna {
  ownerId: string;
  brandName: string;
  category: string;
  productDescription: string;
  targetAudience: string;
  aovInr: number;
  grossMarginPct: number;
  monthlyAdBudgetInr: number;
  competitorOne: string;
  competitorTwo: string;
  preferredLanguage: LanguageCode;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DecisionStatus = 'Planned' | 'In Progress' | 'Succeeded';
export type DecisionSource =
  | 'Market Radar'
  | 'Daily Pulse'
  | 'What-If Simulator'
  | 'Peer Playbook'
  | 'Manual';

export interface OutcomeLedgerEntry {
  id: string;
  ownerId: string;
  title: string;
  sourceType: DecisionSource;
  angleCategory: string;
  hypothesis: string;
  actionPlan: string;
  status: DecisionStatus;
  howImplemented: string;
  actualResult: string;
  sharedAnonymously: boolean;
  publishedPlaybookId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SharedPlaybook {
  id: string;
  authorUid: string;
  isAnonymized: boolean;
  category: string;
  priceTier: PriceTier;
  strategySummary: string;
  implementationSteps: string[];
  verifiedResult: string;
  channel: string;
  createdAt?: unknown;
}

export interface DailyBriefingResponse {
  headline: string;
  summary: string;
  priorityActionTitle: string;
  priorityActionSteps: string[];
  expectedImpact: string;
  watchoutRisk: string;
}

export interface AdaptedPlaybookResponse {
  adaptedTitle: string;
  whyItFitsYourBrand: string;
  customizedSteps: string[];
  estimatedOutcome: string;
  channelRecommendation: string;
}

export interface MarketRadarCard {
  angleType: 'Competitor Weakness' | 'Best Offer Angle' | 'Low-CAC Channel';
  title: string;
  insight: string;
  actionPlan: string;
  confidenceType: 'Verified Peer Pattern' | 'AI Hypothesis';
  confidenceRationale: string;
  projectedLift: string;
}

export interface MarketRadarResponse {
  cards: MarketRadarCard[];
}

export interface WhatIfCheckResponse {
  verdict: 'Safe to Execute' | 'Proceed with Caution' | 'Margin Risk';
  summary: string;
  unitEconomicsNote: string;
  recommendedGuardrail: string;
}

export interface AnonymizedPlaybookDraft {
  category: string;
  priceTier: PriceTier;
  strategySummary: string;
  implementationSteps: string[];
  verifiedResult: string;
  channel: string;
}
