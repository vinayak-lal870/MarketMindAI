import type {
  AdaptedPlaybookResponse,
  AnonymizedPlaybookDraft,
  BusinessDna,
  DailyBriefingResponse,
  LanguageCode,
  MarketRadarResponse,
  OutcomeLedgerEntry,
  SharedPlaybook,
  WhatIfCheckResponse,
} from '../types.ts';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed with status ${res.status}`);
  }
  return payload as T;
}

export function fetchDailyBriefing(params: {
  businessDna: BusinessDna;
  peerPlaybooks: SharedPlaybook[];
  language: LanguageCode;
  currentDate: string;
}): Promise<DailyBriefingResponse> {
  return postJson<DailyBriefingResponse>('/api/gemini/daily-briefing', params);
}

export function fetchAdaptedPlaybook(params: {
  businessDna: BusinessDna;
  playbook: SharedPlaybook;
  language: LanguageCode;
}): Promise<AdaptedPlaybookResponse> {
  return postJson<AdaptedPlaybookResponse>('/api/gemini/adapt-playbook', params);
}

export function fetchMarketRadar(params: {
  businessDna: BusinessDna;
  peerPlaybooks: SharedPlaybook[];
  language: LanguageCode;
}): Promise<MarketRadarResponse> {
  return postJson<MarketRadarResponse>('/api/gemini/market-radar', params);
}

export function fetchWhatIfCheck(params: {
  businessDna: BusinessDna;
  adSpendChangePct: number;
  discountPct: number;
  projectedRevenue: number;
  projectedNetProfit: number;
  projectedOrders: number;
  language: LanguageCode;
}): Promise<WhatIfCheckResponse> {
  return postJson<WhatIfCheckResponse>('/api/gemini/what-if-check', params);
}

export function fetchAnonymizedPlaybook(params: {
  businessDna: BusinessDna;
  entry: OutcomeLedgerEntry;
}): Promise<AnonymizedPlaybookDraft> {
  return postJson<AnonymizedPlaybookDraft>('/api/gemini/anonymize-playbook', params);
}

export function transcribeAudio(params: {
  audioBase64: string;
  mimeType: string;
  language: LanguageCode;
}): Promise<{ transcript: string }> {
  return postJson<{ transcript: string }>('/api/gemini/transcribe-audio', params);
}

export function synthesizeSpeech(params: {
  text: string;
  language: LanguageCode;
}): Promise<{ audioBase64: string; mimeType: string }> {
  return postJson<{ audioBase64: string; mimeType: string }>('/api/gemini/tts', params);
}
