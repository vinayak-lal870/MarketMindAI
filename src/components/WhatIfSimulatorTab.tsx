import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  BusinessDna,
  LanguageCode,
  OutcomeLedgerEntry,
  WhatIfCheckResponse,
} from '../types.ts';
import { fetchWhatIfCheck } from '../services/geminiApi.ts';
import { SpeakButton } from './VoiceControls.tsx';

interface WhatIfSimulatorTabProps {
  businessDna: BusinessDna;
  language: LanguageCode;
  activeSpeakingId: string | null;
  onSpeakingChange: (id: string | null) => void;
  onSaveDecision: (
    entry: Omit<OutcomeLedgerEntry, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export function WhatIfSimulatorTab({
  businessDna,
  language,
  activeSpeakingId,
  onSpeakingChange,
  onSaveDecision,
}: WhatIfSimulatorTabProps) {
  const [adSpendChangePct, setAdSpendChangePct] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<WhatIfCheckResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedScenario, setSavedScenario] = useState(false);

  const metrics = useMemo(() => {
    const baseAov = Math.max(100, businessDna.aovInr || 850);
    const marginRatio = Math.min(0.95, Math.max(0.05, (businessDna.grossMarginPct || 55) / 100));
    const baseAdSpend = Math.max(10000, businessDna.monthlyAdBudgetInr || 50000);

    // Realistic Indian D2C baseline: blended CAC ~ 32% of AOV + organic repeat orders
    const baseCac = Math.max(140, baseAov * 0.32);
    const paidOrdersBase = baseAdSpend / baseCac;
    const organicOrdersBase = Math.max(40, paidOrdersBase * 0.45);
    const baseOrders = Math.round(paidOrdersBase + organicOrdersBase);
    const baseRevenue = baseOrders * baseAov;
    const baseGrossProfit = baseRevenue * marginRatio;
    const baseNetProfit = baseGrossProfit - baseAdSpend;

    // Simulated Ad Spend with diminishing marginal returns curve above +25%
    const simAdSpend = baseAdSpend * (1 + adSpendChangePct / 100);
    const spendFactor = 1 + adSpendChangePct / 100;
    const paidEfficiencyMultiplier =
      spendFactor <= 1
        ? Math.pow(Math.max(0.2, spendFactor), 0.85)
        : 1 + (spendFactor - 1) * 0.72;

    // Simulated Discount (+discountPct lowers effective price & boosts conversion; negative reduces discount / raises price)
    const effectiveAov = Math.max(50, baseAov * (1 - discountPct / 100));
    const cogsPerOrder = baseAov * (1 - marginRatio);
    const volumeElasticityFromPrice =
      discountPct >= 0
        ? 1 + (discountPct / 100) * 1.45
        : Math.max(0.6, 1 + (discountPct / 100) * 0.9);

    const simPaidOrders = paidOrdersBase * paidEfficiencyMultiplier * volumeElasticityFromPrice;
    const simOrganicOrders = organicOrdersBase * Math.sqrt(volumeElasticityFromPrice);
    const simOrders = Math.max(1, Math.round(simPaidOrders + simOrganicOrders));

    const simRevenue = simOrders * effectiveAov;
    const simTotalCogs = simOrders * cogsPerOrder;
    const simGrossProfit = simRevenue - simTotalCogs;
    const simNetProfit = simGrossProfit - simAdSpend;

    return {
      baseOrders,
      baseRevenue,
      baseNetProfit,
      simOrders,
      simRevenue,
      simGrossProfit,
      simNetProfit,
      simAdSpend,
      effectiveAov,
      revDeltaPct: baseRevenue > 0 ? ((simRevenue - baseRevenue) / baseRevenue) * 100 : 0,
      profitDeltaInr: simNetProfit - baseNetProfit,
    };
  }, [businessDna, adSpendChangePct, discountPct]);

  const handleAskGemini = async () => {
    setChecking(true);
    setErrorMsg(null);
    setSavedScenario(false);
    try {
      const res = await fetchWhatIfCheck({
        businessDna,
        adSpendChangePct,
        discountPct,
        projectedRevenue: metrics.simRevenue,
        projectedNetProfit: metrics.simNetProfit,
        projectedOrders: metrics.simOrders,
        language,
      });
      setCheckResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to evaluate scenario.');
    } finally {
      setChecking(false);
    }
  };

  const handleSaveScenario = async () => {
    await onSaveDecision({
      title: `What-If Scenario: Ad Spend ${adSpendChangePct >= 0 ? '+' : ''}${adSpendChangePct}%, Discount ${discountPct >= 0 ? '+' : ''}${discountPct}%`,
      sourceType: 'What-If Simulator',
      angleCategory: checkResult?.verdict || 'Unit Economics',
      hypothesis:
        checkResult?.summary ||
        `Projected monthly revenue ₹${Math.round(metrics.simRevenue).toLocaleString('en-IN')} with net profit ₹${Math.round(metrics.simNetProfit).toLocaleString('en-IN')}.`,
      actionPlan:
        checkResult?.recommendedGuardrail ||
        `Test change for 14 days while monitoring CAC and net contribution margin.`,
      status: 'Planned',
      howImplemented: '',
      actualResult: '',
      sharedAnonymously: false,
      publishedPlaybookId: '',
    });
    setSavedScenario(true);
  };

  const formatInr = (val: number) => {
    const sign = val < 0 ? '-' : '';
    return `${sign}₹${Math.abs(Math.round(val)).toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            What-If Unit Economics Simulator
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Model ad spend and discounting changes against {businessDna.brandName}&apos;s{' '}
            <span className="font-mono-num">{businessDna.grossMarginPct}%</span> gross margin before risking cash flow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdSpendChangePct(0);
            setDiscountPct(0);
            setCheckResult(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Baseline</span>
        </button>
      </div>

      {/* Live Projected KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Projected Monthly Revenue</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 mt-1.5">
            {formatInr(metrics.simRevenue)}
          </p>
          <p
            className={`font-mono-num text-xs mt-1 font-medium ${
              metrics.revDeltaPct >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {metrics.revDeltaPct >= 0 ? '+' : ''}
            {metrics.revDeltaPct.toFixed(1)}% vs baseline ({formatInr(metrics.baseRevenue)})
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Projected Net Profit</p>
          <p
            className={`font-mono-num text-2xl font-bold mt-1.5 ${
              metrics.simNetProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatInr(metrics.simNetProfit)}
          </p>
          <p
            className={`font-mono-num text-xs mt-1 font-medium ${
              metrics.profitDeltaInr >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {metrics.profitDeltaInr >= 0 ? '+' : ''}
            {formatInr(metrics.profitDeltaInr)} vs baseline ({formatInr(metrics.baseNetProfit)})
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Projected Monthly Orders</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 mt-1.5">
            {metrics.simOrders.toLocaleString('en-IN')}
          </p>
          <p className="font-mono-num text-xs text-slate-500 mt-1">
            Effective AOV {formatInr(metrics.effectiveAov)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Simulated Ad Spend</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 mt-1.5">
            {formatInr(metrics.simAdSpend)}
          </p>
          <p className="font-mono-num text-xs text-slate-500 mt-1">
            Baseline {formatInr(businessDna.monthlyAdBudgetInr)}
          </p>
        </div>
      </div>

      {/* Sliders + Gemini Safety Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h2 className="font-display text-base font-bold text-slate-900">
            Adjust Growth Levers
          </h2>

          {/* Ad Spend Slider */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="ad-spend-slider" className="text-sm font-medium text-slate-700">
                Ad Spend Change
              </label>
              <span className="font-mono-num text-sm font-bold text-blue-700">
                {adSpendChangePct >= 0 ? '+' : ''}
                {adSpendChangePct}%
              </span>
            </div>
            <input
              id="ad-spend-slider"
              type="range"
              min={-50}
              max={100}
              step={5}
              value={adSpendChangePct}
              onChange={(e) => {
                setAdSpendChangePct(Number(e.target.value));
                setCheckResult(null);
              }}
              className="w-full accent-blue-700 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-mono-num text-slate-400">
              <span>-50%</span>
              <span>0% (Current)</span>
              <span>+50%</span>
              <span>+100%</span>
            </div>
          </div>

          {/* Discount Slider */}
          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label htmlFor="discount-slider" className="text-sm font-medium text-slate-700">
                Discount Adjustment
              </label>
              <span className="font-mono-num text-sm font-bold text-blue-700">
                {discountPct >= 0 ? '+' : ''}
                {discountPct}%
              </span>
            </div>
            <input
              id="discount-slider"
              type="range"
              min={-25}
              max={25}
              step={1}
              value={discountPct}
              onChange={(e) => {
                setDiscountPct(Number(e.target.value));
                setCheckResult(null);
              }}
              className="w-full accent-blue-700 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-mono-num text-slate-400">
              <span>-25% (Price Up)</span>
              <span>0%</span>
              <span>+25% (Deeper Discount)</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Evaluates marginal CAC &amp; rupee contribution margin.
            </p>
            <button
              type="button"
              onClick={handleAskGemini}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              <span>{checking ? 'Checking Margins...' : 'Ask Gemini If Safe'}</span>
            </button>
          </div>
        </div>

        {/* Right: Gemini Verdict */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              CFO Safety Assessment
            </h2>
            {checkResult && (
              <SpeakButton
                id="whatif-verdict"
                activeSpeakingId={activeSpeakingId}
                onSpeakingChange={onSpeakingChange}
                text={`${checkResult.verdict}. ${checkResult.summary}. ${checkResult.unitEconomicsNote}. Guardrail: ${checkResult.recommendedGuardrail}`}
                language={language}
                label="Listen"
              />
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {checking ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-1/3 bg-slate-100 rounded" />
              <div className="h-16 w-full bg-slate-50 rounded" />
              <div className="h-12 w-full bg-slate-50 rounded" />
            </div>
          ) : checkResult ? (
            <div className="space-y-4">
              <div
                className={`inline-flex items-center gap-2 text-sm font-bold ${
                  checkResult.verdict === 'Safe to Execute'
                    ? 'text-emerald-700'
                    : checkResult.verdict === 'Proceed with Caution'
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {checkResult.verdict === 'Safe to Execute' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : checkResult.verdict === 'Proceed with Caution' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
                <span>{checkResult.verdict}</span>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{checkResult.summary}</p>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <p className="text-xs font-semibold text-slate-800">Unit Economics Note</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {checkResult.unitEconomicsNote}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <p className="text-xs font-semibold text-slate-800">Recommended Guardrail</p>
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                  {checkResult.recommendedGuardrail}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveScenario}
                  disabled={savedScenario}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer ${
                    savedScenario
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {savedScenario ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Saved to Outcome Ledger</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      <span>Save Scenario to Ledger</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              Move the Ad Spend or Discount sliders and click{' '}
              <strong className="text-slate-700">Ask Gemini If Safe</strong> for a margin &amp; cash-flow verdict.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
