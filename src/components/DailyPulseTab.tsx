import { useEffect, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import type {
  AdaptedPlaybookResponse,
  BusinessDna,
  DailyBriefingResponse,
  LanguageCode,
  OutcomeLedgerEntry,
  SharedPlaybook,
} from '../types.ts';
import { fetchAdaptedPlaybook, fetchDailyBriefing } from '../services/geminiApi.ts';
import { SpeakButton } from './VoiceControls.tsx';

interface DailyPulseTabProps {
  businessDna: BusinessDna;
  peerPlaybooks: SharedPlaybook[];
  language: LanguageCode;
  activeSpeakingId: string | null;
  onSpeakingChange: (id: string | null) => void;
  onSaveDecision: (
    entry: Omit<OutcomeLedgerEntry, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onGoToDna: () => void;
}

export function DailyPulseTab({
  businessDna,
  peerPlaybooks,
  language,
  activeSpeakingId,
  onSpeakingChange,
  onSaveDecision,
  onGoToDna,
}: DailyPulseTabProps) {
  const [briefing, setBriefing] = useState<DailyBriefingResponse | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [savedBriefing, setSavedBriefing] = useState(false);

  const [adaptingId, setAdaptingId] = useState<string | null>(null);
  const [adaptedMap, setAdaptedMap] = useState<Record<string, AdaptedPlaybookResponse>>({});
  const [adaptError, setAdaptError] = useState<string | null>(null);
  const [savedPlaybookIds, setSavedPlaybookIds] = useState<Record<string, boolean>>({});

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const loadBriefing = async () => {
    setLoadingBriefing(true);
    setBriefingError(null);
    setSavedBriefing(false);
    try {
      const result = await fetchDailyBriefing({
        businessDna,
        peerPlaybooks,
        language,
        currentDate: new Date().toISOString().slice(0, 10),
      });
      setBriefing(result);
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : 'Unable to load daily briefing.');
    } finally {
      setLoadingBriefing(false);
    }
  };

  useEffect(() => {
    loadBriefing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessDna.brandName, businessDna.category, businessDna.aovInr, language]);

  const handleSaveBriefingMove = async () => {
    if (!briefing) return;
    await onSaveDecision({
      title: briefing.priorityActionTitle,
      sourceType: 'Daily Pulse',
      angleCategory: 'Daily Priority',
      hypothesis: briefing.summary,
      actionPlan: briefing.priorityActionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      status: 'Planned',
      howImplemented: '',
      actualResult: '',
      sharedAnonymously: false,
      publishedPlaybookId: '',
    });
    setSavedBriefing(true);
  };

  const handleAdaptPlaybook = async (playbook: SharedPlaybook) => {
    setAdaptingId(playbook.id);
    setAdaptError(null);
    try {
      const adapted = await fetchAdaptedPlaybook({
        businessDna,
        playbook,
        language,
      });
      setAdaptedMap((prev) => ({ ...prev, [playbook.id]: adapted }));
    } catch (err) {
      setAdaptError(err instanceof Error ? err.message : 'Failed to adapt playbook.');
    } finally {
      setAdaptingId(null);
    }
  };

  const handleSaveAdapted = async (playbook: SharedPlaybook, adapted: AdaptedPlaybookResponse) => {
    await onSaveDecision({
      title: adapted.adaptedTitle,
      sourceType: 'Peer Playbook',
      angleCategory: playbook.channel,
      hypothesis: adapted.whyItFitsYourBrand,
      actionPlan: adapted.customizedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      status: 'Planned',
      howImplemented: '',
      actualResult: '',
      sharedAnonymously: false,
      publishedPlaybookId: '',
    });
    setSavedPlaybookIds((prev) => ({ ...prev, [playbook.id]: true }));
  };

  const briefingSpeakText = briefing
    ? `${briefing.headline}. ${briefing.summary}. ${briefing.priorityActionTitle}. ${briefing.priorityActionSteps.join('. ')}. ${briefing.expectedImpact}`
    : '';

  return (
    <div className="space-y-8">
      {/* Brand Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">{todayDisplay}</p>
          <h1 className="font-display text-2xl font-bold text-slate-900 mt-1">
            Today&apos;s Autonomous Briefing — {businessDna.brandName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-1.5">
            <span>{businessDna.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">AOV ₹{businessDna.aovInr.toLocaleString('en-IN')}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{businessDna.grossMarginPct}% Gross Margin</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              Ad Budget ₹{businessDna.monthlyAdBudgetInr.toLocaleString('en-IN')}/mo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onGoToDna}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Edit Business DNA
          </button>
          <button
            type="button"
            onClick={loadBriefing}
            disabled={loadingBriefing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingBriefing ? 'animate-spin' : ''}`} />
            <span>{loadingBriefing ? 'Generating...' : 'Refresh Briefing'}</span>
          </button>
        </div>
      </div>

      {/* Autonomous Briefing Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        {loadingBriefing ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-2/3 bg-slate-100 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-5/6 bg-slate-100 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="h-20 bg-slate-50 rounded-lg border border-slate-100" />
              <div className="h-20 bg-slate-50 rounded-lg border border-slate-100" />
              <div className="h-20 bg-slate-50 rounded-lg border border-slate-100" />
            </div>
          </div>
        ) : briefingError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between gap-4">
            <span>{briefingError}</span>
            <button
              type="button"
              onClick={loadBriefing}
              className="rounded-md bg-white border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : briefing ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 max-w-3xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Daily Growth Briefing</span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 text-balance">
                  {briefing.headline}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {briefing.summary}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SpeakButton
                  id="daily-briefing"
                  activeSpeakingId={activeSpeakingId}
                  onSpeakingChange={onSpeakingChange}
                  text={briefingSpeakText}
                  language={language}
                  label="Listen to Daily Briefing"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-3">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Priority Move: {briefing.priorityActionTitle}
                </h3>
                <ol className="space-y-2.5">
                  {briefing.priorityActionSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="font-mono-num text-xs font-semibold text-blue-700 pt-0.5 shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="lg:col-span-4 flex flex-col justify-between gap-4 lg:border-l lg:border-slate-100 lg:pl-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Expected Impact</p>
                    <p className="text-sm font-semibold text-emerald-700 mt-1">
                      {briefing.expectedImpact}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Unit-Economics Watchout</p>
                    <p className="text-sm text-amber-800 mt-1">{briefing.watchoutRisk}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveBriefingMove}
                  disabled={savedBriefing}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    savedBriefing
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {savedBriefing ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Saved to Outcome Ledger</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      <span>Save Move to Ledger</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Proven in the Field (Peer Wins) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Proven in the Field (Peer Wins)
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Anonymized, verified implementations published by Indian D2C &amp; SMB founders in the collective network.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono-num">
            {peerPlaybooks.length} verified playbooks
          </span>
        </div>

        {adaptError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            {adaptError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {peerPlaybooks.map((pb) => {
            const adapted = adaptedMap[pb.id];
            const isAdapting = adaptingId === pb.id;
            const isSaved = savedPlaybookIds[pb.id];
            const pbSpeakText = `${pb.category}, ${pb.priceTier}. ${pb.strategySummary}. Verified result: ${pb.verifiedResult}. Steps: ${pb.implementationSteps.join('. ')}`;

            return (
              <article
                key={pb.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  {/* Unboxed zero-pill metadata line */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{pb.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{pb.priceTier}</span>
                    <span aria-hidden="true">·</span>
                    <span>{pb.channel}</span>
                  </div>

                  <p className="text-sm text-slate-800 leading-relaxed font-medium">
                    {pb.strategySummary}
                  </p>

                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 pt-1">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span>Verified Result: {pb.verifiedResult}</span>
                  </div>

                  <ul className="space-y-1.5 pt-2 border-t border-slate-100">
                    {pb.implementationSteps.map((step, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="font-mono-num text-slate-400 shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <SpeakButton
                      id={`pb-${pb.id}`}
                      activeSpeakingId={activeSpeakingId}
                      onSpeakingChange={onSpeakingChange}
                      text={pbSpeakText}
                      language={language}
                      label="Listen"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdaptPlaybook(pb)}
                      disabled={isAdapting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>{isAdapting ? 'Adapting...' : 'Adapt for My Business'}</span>
                    </button>
                  </div>

                  {/* Adapted Output Drawer */}
                  {adapted && (
                    <div className="pt-4 border-t border-blue-100 bg-blue-50/50 -mx-6 -mb-6 px-6 py-5 rounded-b-xl space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-display text-sm font-bold text-slate-900">
                          Customized for {businessDna.brandName}: {adapted.adaptedTitle}
                        </h4>
                        <SpeakButton
                          id={`adapted-${pb.id}`}
                          activeSpeakingId={activeSpeakingId}
                          onSpeakingChange={onSpeakingChange}
                          text={`${adapted.adaptedTitle}. ${adapted.whyItFitsYourBrand}. ${adapted.customizedSteps.join('. ')}`}
                          language={language}
                          label="Listen"
                        />
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {adapted.whyItFitsYourBrand}
                      </p>
                      <ol className="space-y-1.5">
                        {adapted.customizedSteps.map((s, idx) => (
                          <li key={idx} className="text-xs text-slate-800 flex items-start gap-2">
                            <span className="font-mono-num text-blue-700 font-semibold shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <span className="text-xs font-medium text-emerald-700">
                          Target: {adapted.estimatedOutcome}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSaveAdapted(pb, adapted)}
                          disabled={isSaved}
                          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                            isSaved
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Saved to Ledger</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="h-3.5 w-3.5" />
                              <span>Save to Outcome Ledger</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
