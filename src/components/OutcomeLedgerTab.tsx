import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  Globe2,
  Lock,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  BusinessDna,
  DecisionStatus,
  LanguageCode,
  OutcomeLedgerEntry,
} from '../types.ts';
import { fetchAnonymizedPlaybook } from '../services/geminiApi.ts';
import { VoiceInputButton } from './VoiceControls.tsx';

interface OutcomeLedgerTabProps {
  businessDna: BusinessDna;
  entries: OutcomeLedgerEntry[];
  language: LanguageCode;
  isDemo: boolean;
  onAddEntry: (
    entry: Omit<OutcomeLedgerEntry, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateStatus: (entryId: string, status: DecisionStatus, actionPlan: string) => Promise<void>;
  onRecordOutcome: (
    entryId: string,
    payload: {
      howImplemented: string;
      actualResult: string;
      shareAnonymously: boolean;
      anonymizedDraft?: Awaited<ReturnType<typeof fetchAnonymizedPlaybook>>;
    }
  ) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
}

export function OutcomeLedgerTab({
  businessDna,
  entries,
  language,
  onAddEntry,
  onUpdateStatus,
  onRecordOutcome,
  onDeleteEntry,
}: OutcomeLedgerTabProps) {
  const [filter, setFilter] = useState<'All' | DecisionStatus>('All');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add new manual decision state
  const [newTitle, setNewTitle] = useState('');
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [adding, setAdding] = useState(false);

  // Draft outcome capture keyed by entry ID
  const [draftImpl, setDraftImpl] = useState<Record<string, string>>({});
  const [draftResult, setDraftResult] = useState<Record<string, string>>({});
  const [shareToggle, setShareToggle] = useState<Record<string, boolean>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const filteredEntries =
    filter === 'All' ? entries : entries.filter((e) => e.status === filter);

  const handleCreateManual = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newHypothesis.trim()) return;
    setAdding(true);
    setErrorMsg(null);
    try {
      await onAddEntry({
        title: newTitle.trim(),
        sourceType: 'Manual',
        angleCategory: 'Founder Experiment',
        hypothesis: newHypothesis.trim(),
        actionPlan: newPlan.trim(),
        status: 'Planned',
        howImplemented: '',
        actualResult: '',
        sharedAnonymously: false,
        publishedPlaybookId: '',
      });
      setNewTitle('');
      setNewHypothesis('');
      setNewPlan('');
      setShowAddForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save decision.');
    } finally {
      setAdding(false);
    }
  };

  const handleSaveSucceededOutcome = async (entry: OutcomeLedgerEntry) => {
    const howImplemented = (draftImpl[entry.id] ?? entry.howImplemented).trim();
    const actualResult = (draftResult[entry.id] ?? entry.actualResult).trim();
    const shouldShare = shareToggle[entry.id] ?? true;

    if (!howImplemented || !actualResult) {
      setErrorMsg('Please fill in both "How I Implemented It" and "Actual Result" first.');
      return;
    }

    setSubmittingId(entry.id);
    setErrorMsg(null);
    setPublishNotice(null);

    try {
      let anonymizedDraft: Awaited<ReturnType<typeof fetchAnonymizedPlaybook>> | undefined;
      if (shouldShare) {
        anonymizedDraft = await fetchAnonymizedPlaybook({
          businessDna,
          entry: { ...entry, howImplemented, actualResult },
        });
      }

      await onRecordOutcome(entry.id, {
        howImplemented,
        actualResult,
        shareAnonymously: shouldShare,
        anonymizedDraft,
      });

      if (shouldShare) {
        setPublishNotice(
          'Outcome saved and anonymized playbook published to the Collective SMB Network!'
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to record outcome.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Outcome Ledger &amp; Playbook Publisher
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track experiments from Planned to Succeeded, and optionally publish anonymized wins to help peer Indian SMBs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{showAddForm ? 'Close Form' : 'Log Decision'}</span>
        </button>
      </div>

      {publishNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <Globe2 className="h-4 w-4 shrink-0" />
          <span>{publishNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Quick Log Decision Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateManual}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-slate-900">
            Log a Growth Decision
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Decision Title
            </label>
            <input
              type="text"
              required
              maxLength={180}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Launch ₹499 Trial Pack on Instagram Reels"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Hypothesis / Expected Growth Impact
              </label>
              <VoiceInputButton
                language={language}
                label="Speak"
                onTranscript={(text) =>
                  setNewHypothesis((prev) => (prev ? `${prev} ${text}` : text))
                }
              />
            </div>
            <textarea
              rows={2}
              required
              maxLength={1500}
              value={newHypothesis}
              onChange={(e) => setNewHypothesis(e.target.value)}
              placeholder="Why do you expect this move to lift conversion, AOV, or repeat rate?"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Execution Steps (Optional)
            </label>
            <input
              type="text"
              maxLength={1500}
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              placeholder="e.g. Create 2 regional reels + add WhatsApp reorder QR"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-60"
            >
              {adding ? 'Saving...' : 'Save to Ledger'}
            </button>
          </div>
        </form>
      )}

      {/* Segmented Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['All', 'Planned', 'In Progress', 'Succeeded'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-mono-num">
          {filteredEntries.length} decision{filteredEntries.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Ledger Entries */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No decisions in &ldquo;{filter}&rdquo; yet.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Save strategies from Daily Growth Pulse, Market Radar, or What-If Simulator—or log one manually above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const isLockedPublished = entry.status === 'Succeeded' && entry.sharedAnonymously;
            const currentImpl = draftImpl[entry.id] ?? entry.howImplemented;
            const currentResult = draftResult[entry.id] ?? entry.actualResult;
            const currentShare = shareToggle[entry.id] ?? true;

            return (
              <article
                key={entry.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{entry.sourceType}</span>
                      {entry.angleCategory && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{entry.angleCategory}</span>
                        </>
                      )}
                      {isLockedPublished && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <Globe2 className="h-3.5 w-3.5" />
                            <span>Published Anonymously</span>
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="font-display text-lg font-bold text-slate-900">
                      {entry.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {entry.hypothesis}
                    </p>
                    {entry.actionPlan && (
                      <p className="text-xs text-slate-500 pt-1 whitespace-pre-line">
                        Plan: {entry.actionPlan}
                      </p>
                    )}
                  </div>

                  {/* Status Toggle Group */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {(['Planned', 'In Progress', 'Succeeded'] as DecisionStatus[]).map((st) => {
                        const active = entry.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            disabled={isLockedPublished}
                            onClick={() => onUpdateStatus(entry.id, st, entry.actionPlan)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed ${
                              active
                                ? st === 'Succeeded'
                                  ? 'bg-emerald-700 text-white'
                                  : st === 'In Progress'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {st === 'Succeeded' && <CheckCircle2 className="h-3 w-3" />}
                            {st === 'In Progress' && <Clock className="h-3 w-3" />}
                            <span>{st}</span>
                          </button>
                        );
                      })}
                    </div>

                    {!isLockedPublished && (
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        aria-label="Delete decision"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Succeeded Outcome Capture & Anonymized Publisher */}
                {entry.status === 'Succeeded' && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    {isLockedPublished ? (
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-800">
                          <span className="inline-flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5" />
                            <span>Verified Win Published to Shared Playbooks</span>
                          </span>
                          <span className="font-mono-num">{entry.actualResult}</span>
                        </div>
                        <p className="text-xs text-slate-700">{entry.howImplemented}</p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-700">
                                How I Implemented It
                              </label>
                              <VoiceInputButton
                                language={language}
                                label="Speak"
                                onTranscript={(text) =>
                                  setDraftImpl((prev) => ({
                                    ...prev,
                                    [entry.id]: currentImpl ? `${currentImpl} ${text}` : text,
                                  }))
                                }
                              />
                            </div>
                            <textarea
                              rows={3}
                              maxLength={2000}
                              value={currentImpl}
                              onChange={(e) =>
                                setDraftImpl((prev) => ({
                                  ...prev,
                                  [entry.id]: e.target.value,
                                }))
                              }
                              placeholder="Describe the exact steps your team executed..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-700">
                                Actual Result (e.g., +22% repeat orders)
                              </label>
                              <VoiceInputButton
                                language={language}
                                label="Speak"
                                onTranscript={(text) =>
                                  setDraftResult((prev) => ({
                                    ...prev,
                                    [entry.id]: currentResult ? `${currentResult} ${text}` : text,
                                  }))
                                }
                              />
                            </div>
                            <input
                              type="text"
                              maxLength={300}
                              value={currentResult}
                              onChange={(e) =>
                                setDraftResult((prev) => ({
                                  ...prev,
                                  [entry.id]: e.target.value,
                                }))
                              }
                              placeholder="e.g. +22% repeat orders in 30 days"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                            <p className="text-[11px] text-slate-500 mt-2">
                              Brand names &amp; private rupee amounts are automatically stripped before sharing.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200/70">
                          <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentShare}
                              onChange={(e) =>
                                setShareToggle((prev) => ({
                                  ...prev,
                                  [entry.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                            />
                            <span>
                              Share Anonymized Playbook to Help Other SMBs
                            </span>
                          </label>

                          <button
                            type="button"
                            disabled={submittingId === entry.id}
                            onClick={() => handleSaveSucceededOutcome(entry)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>
                              {submittingId === entry.id
                                ? 'Anonymizing & Saving...'
                                : currentShare
                                  ? 'Save & Publish Anonymized Win'
                                  : 'Save Private Outcome'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
