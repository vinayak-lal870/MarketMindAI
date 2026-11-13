import { useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  BusinessDna,
  LanguageCode,
  MarketRadarCard,
  OutcomeLedgerEntry,
  SharedPlaybook,
} from '../types.ts';
import { fetchMarketRadar } from '../services/geminiApi.ts';
import { SpeakButton } from './VoiceControls.tsx';

interface MarketRadarTabProps {
  businessDna: BusinessDna;
  peerPlaybooks: SharedPlaybook[];
  language: LanguageCode;
  activeSpeakingId: string | null;
  onSpeakingChange: (id: string | null) => void;
  onSaveDecision: (
    entry: Omit<OutcomeLedgerEntry, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export function MarketRadarTab({
  businessDna,
  peerPlaybooks,
  language,
  activeSpeakingId,
  onSpeakingChange,
  onSaveDecision,
}: MarketRadarTabProps) {
  const [cards, setCards] = useState<MarketRadarCard[]>([]);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedIndices, setSavedIndices] = useState<Record<number, boolean>>({});

  const handleScan = async () => {
    setScanning(true);
    setErrorMsg(null);
    setSavedIndices({});
    try {
      const res = await fetchMarketRadar({
        businessDna,
        peerPlaybooks,
        language,
      });
      setCards(res.cards || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Market scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveCard = async (card: MarketRadarCard, idx: number) => {
    await onSaveDecision({
      title: card.title,
      sourceType: 'Market Radar',
      angleCategory: card.angleType,
      hypothesis: `${card.insight}\n\nConfidence: ${card.confidenceType} — ${card.confidenceRationale}`,
      actionPlan: card.actionPlan,
      status: 'Planned',
      howImplemented: '',
      actualResult: '',
      sharedAnonymously: false,
      publishedPlaybookId: '',
    });
    setSavedIndices((prev) => ({ ...prev, [idx]: true }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Market Radar (Blind-Spot Scanner)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Cross-references {businessDna.brandName}&apos;s private Business DNA with {peerPlaybooks.length} anonymized peer wins to surface competitor gaps, offer angles, and low-CAC channels.
          </p>
        </div>
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <Radar className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Scanning Market...' : 'Scan Market Blind Spots'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {cards.length === 0 && !scanning ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-2xl mx-auto">
          <Target className="h-9 w-9 text-blue-700 mx-auto" />
          <h2 className="font-display text-lg font-bold text-slate-900 mt-3">
            Ready to scan blind spots for {businessDna.brandName}
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Click &ldquo;Scan Market Blind Spots&rdquo; to inspect weaknesses against{' '}
            {businessDna.competitorOne || 'your competitors'} and uncover proven low-CAC acquisition channels from the collective network.
          </p>
          <button
            type="button"
            onClick={handleScan}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            <Radar className="h-3.5 w-3.5" />
            <span>Run Blind-Spot Scan</span>
          </button>
        </div>
      ) : null}

      {scanning && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((skeleton) => (
            <div
              key={skeleton}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-pulse"
            >
              <div className="h-4 w-1/2 bg-slate-100 rounded" />
              <div className="h-6 w-5/6 bg-slate-100 rounded" />
              <div className="h-20 w-full bg-slate-50 rounded" />
              <div className="h-16 w-full bg-slate-50 rounded" />
            </div>
          ))}
        </div>
      )}

      {!scanning && cards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {cards.map((card, idx) => {
            const isPeerVerified = card.confidenceType === 'Verified Peer Pattern';
            const isSaved = !!savedIndices[idx];
            const speakContent = `${card.angleType}: ${card.title}. ${card.insight}. Action plan: ${card.actionPlan}. ${card.projectedLift}`;

            return (
              <article
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  {/* Unboxed confidence & angle header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-700">{card.angleType}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isPeerVerified ? 'text-emerald-700' : 'text-blue-700'
                      }`}
                    >
                      {isPeerVerified ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>{card.confidenceType}</span>
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-slate-900 leading-snug">
                    {card.title}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">{card.insight}</p>

                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-800">Recommended Execution</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{card.actionPlan}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <p className="text-xs font-medium text-emerald-700">
                      Projected Lift: {card.projectedLift}
                    </p>
                    <p className="text-[11px] text-slate-500">{card.confidenceRationale}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <SpeakButton
                    id={`radar-${idx}`}
                    activeSpeakingId={activeSpeakingId}
                    onSpeakingChange={onSpeakingChange}
                    text={speakContent}
                    language={language}
                    label="Listen"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveCard(card, idx)}
                    disabled={isSaved}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isSaved
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        <span>Save to Ledger</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
