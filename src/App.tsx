import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut,
  type User,
} from 'firebase/auth';
import {
  BookOpenCheck,
  Calculator,
  Dna,
  Globe,
  LogOut,
  Menu,
  Radar,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
import { auth } from './firebase.ts';
import {
  DEMO_BUSINESS_DNA,
  DEMO_OUTCOME_LEDGER,
  SEED_SHARED_PLAYBOOKS,
  TAB_LABELS,
} from './data/seedData.ts';
import {
  addOutcomeLedgerEntry,
  deleteOutcomeLedgerEntry,
  ensureUserAccount,
  recordOutcomeAndOptionallyPublish,
  saveBusinessDna,
  seedSharedPlaybooksIfEmpty,
  subscribeBusinessDna,
  subscribeOutcomeLedger,
  subscribeSharedPlaybooks,
  updateOutcomeLedgerProgress,
  updateUserPreferredLanguage,
} from './services/firestoreService.ts';
import { stopSpeaking } from './utils/speech.ts';
import {
  SUPPORTED_LANGUAGES,
  type AnonymizedPlaybookDraft,
  type BusinessDna,
  type DecisionStatus,
  type LanguageCode,
  type OutcomeLedgerEntry,
  type SharedPlaybook,
} from './types.ts';
import { LoginGate } from './components/LoginGate.tsx';
import { DailyPulseTab } from './components/DailyPulseTab.tsx';
import { BusinessDnaTab } from './components/BusinessDnaTab.tsx';
import { MarketRadarTab } from './components/MarketRadarTab.tsx';
import { WhatIfSimulatorTab } from './components/WhatIfSimulatorTab.tsx';
import { OutcomeLedgerTab } from './components/OutcomeLedgerTab.tsx';

type TabKey = 'pulse' | 'dna' | 'radar' | 'simulator' | 'ledger';

const INITIAL_SEED_PLAYBOOKS: SharedPlaybook[] = SEED_SHARED_PLAYBOOKS.map((p) => ({
  ...p,
  authorUid: 'network_seed',
}));

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('pulse');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);

  const [businessDna, setBusinessDna] = useState<BusinessDna>(DEMO_BUSINESS_DNA);
  const [hasSavedDna, setHasSavedDna] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<OutcomeLedgerEntry[]>(DEMO_OUTCOME_LEDGER);
  const [sharedPlaybooks, setSharedPlaybooks] = useState<SharedPlaybook[]>(INITIAL_SEED_PLAYBOOKS);

  const [syncError, setSyncError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  // Stop speech synthesis on unmount or tab change
  useEffect(() => {
    stopSpeaking();
    setActiveSpeakingId(null);
  }, [activeTab, language]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        setIsDemoMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore two-tier memory when signed in
  useEffect(() => {
    if (!user) {
      if (isDemoMode) {
        setBusinessDna(DEMO_BUSINESS_DNA);
        setLedgerEntries(DEMO_OUTCOME_LEDGER);
        setSharedPlaybooks(INITIAL_SEED_PLAYBOOKS);
        setHasSavedDna(true);
      }
      return;
    }

    setSyncError(null);

    if (user.emailVerified) {
      ensureUserAccount(user, language).catch((err) => {
        console.error(err);
      });
      seedSharedPlaybooksIfEmpty(user).catch((err) => {
        console.error(err);
      });
    }

    const unsubDna = subscribeBusinessDna(
      user.uid,
      (dna) => {
        if (dna) {
          setBusinessDna(dna);
          setHasSavedDna(true);
          if (dna.preferredLanguage) {
            setLanguage(dna.preferredLanguage);
          }
        } else {
          setHasSavedDna(false);
          setBusinessDna({
            ownerId: user.uid,
            brandName: user.displayName ? `${user.displayName.split(' ')[0]}'s D2C Brand` : 'My Indian D2C Brand',
            category: 'Specialty Coffee & Beverages',
            productDescription:
              'Small-batch consumer products crafted for urban & Tier-2 Indian households.',
            targetAudience: 'Digital-first Indian shoppers aged 22–40 using UPI & Instagram.',
            aovInr: 799,
            grossMarginPct: 58,
            monthlyAdBudgetInr: 60000,
            competitorOne: 'Leading Category Brand',
            competitorTwo: 'Marketplace Private Label',
            preferredLanguage: language,
          });
        }
      },
      (err) => {
        setSyncError(err.message);
      }
    );

    const unsubLedger = subscribeOutcomeLedger(
      user.uid,
      (entries) => {
        setLedgerEntries(entries);
      },
      (err) => {
        setSyncError(err.message);
      }
    );

    const unsubPlaybooks = subscribeSharedPlaybooks(
      (playbooks) => {
        if (playbooks.length > 0) {
          setSharedPlaybooks(playbooks);
        } else {
          setSharedPlaybooks(INITIAL_SEED_PLAYBOOKS);
        }
      },
      (err) => {
        console.warn('Shared playbooks listener fallback:', err.message);
        setSharedPlaybooks(INITIAL_SEED_PLAYBOOKS);
      }
    );

    return () => {
      unsubDna();
      unsubLedger();
      unsubPlaybooks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, user?.emailVerified, isDemoMode]);

  const handleLanguageChange = async (newLang: LanguageCode) => {
    setLanguage(newLang);
    if (user && user.emailVerified) {
      updateUserPreferredLanguage(user, newLang).catch(() => {});
    }
  };

  const handleSaveBusinessDna = async (
    dnaInput: Omit<BusinessDna, 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (isDemoMode || !user || !user.emailVerified) {
      setBusinessDna({
        ...dnaInput,
        ownerId: user?.uid || DEMO_BUSINESS_DNA.ownerId,
      });
      setHasSavedDna(true);
      return;
    }
    await saveBusinessDna(user.uid, dnaInput);
    setHasSavedDna(true);
  };

  const handleAddLedgerEntry = async (
    entry: Omit<OutcomeLedgerEntry, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (isDemoMode || !user || !user.emailVerified) {
      const demoEntry: OutcomeLedgerEntry = {
        ...entry,
        id: `demo_${Date.now()}`,
        ownerId: user?.uid || DEMO_BUSINESS_DNA.ownerId,
      };
      setLedgerEntries((prev) => [demoEntry, ...prev]);
      return;
    }
    await addOutcomeLedgerEntry(user.uid, entry);
  };

  const handleUpdateLedgerStatus = async (
    entryId: string,
    status: DecisionStatus,
    actionPlan: string
  ) => {
    if (isDemoMode || !user || !user.emailVerified) {
      setLedgerEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status, actionPlan } : e))
      );
      return;
    }
    await updateOutcomeLedgerProgress(user.uid, entryId, status, actionPlan);
  };

  const handleRecordOutcome = async (
    entryId: string,
    payload: {
      howImplemented: string;
      actualResult: string;
      shareAnonymously: boolean;
      anonymizedDraft?: AnonymizedPlaybookDraft;
    }
  ) => {
    if (isDemoMode || !user || !user.emailVerified) {
      let publishedId = '';
      if (payload.shareAnonymously && payload.anonymizedDraft) {
        publishedId = `demo_pb_${Date.now()}`;
        const newPb: SharedPlaybook = {
          id: publishedId,
          authorUid: 'demo_contributor',
          isAnonymized: true,
          ...payload.anonymizedDraft,
        };
        setSharedPlaybooks((prev) => [newPb, ...prev]);
      }
      setLedgerEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                status: 'Succeeded',
                howImplemented: payload.howImplemented,
                actualResult: payload.actualResult,
                sharedAnonymously: payload.shareAnonymously,
                publishedPlaybookId: publishedId,
              }
            : e
        )
      );
      return;
    }
    await recordOutcomeAndOptionallyPublish(user.uid, entryId, payload);
  };

  const handleDeleteLedgerEntry = async (entryId: string) => {
    if (isDemoMode || !user || !user.emailVerified) {
      setLedgerEntries((prev) => prev.filter((e) => e.id !== entryId));
      return;
    }
    await deleteOutcomeLedgerEntry(user.uid, entryId);
  };

  const handleLogout = async () => {
    stopSpeaking();
    setActiveSpeakingId(null);
    if (user) {
      await signOut(auth);
    }
    setIsDemoMode(false);
    setActiveTab('pulse');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">Loading MarketMind AI...</div>
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return (
      <LoginGate
        onStartDemo={() => {
          setBusinessDna(DEMO_BUSINESS_DNA);
          setLedgerEntries(DEMO_OUTCOME_LEDGER);
          setSharedPlaybooks(INITIAL_SEED_PLAYBOOKS);
          setIsDemoMode(true);
          setActiveTab('pulse');
        }}
      />
    );
  }

  const labels = TAB_LABELS[language];
  const navItems: { key: TabKey; label: string; icon: typeof Sun }[] = [
    { key: 'pulse', label: labels.pulse, icon: Sun },
    { key: 'dna', label: labels.dna, icon: Dna },
    { key: 'radar', label: labels.radar, icon: Radar },
    { key: 'simulator', label: labels.simulator, icon: Calculator },
    { key: 'ledger', label: labels.ledger, icon: BookOpenCheck },
  ];

  const currentTabTitle = navItems.find((n) => n.key === activeTab)?.label || 'Daily Growth Pulse';
  const founderName = isDemoMode
    ? 'RoastCraft India'
    : user?.displayName || user?.email?.split('@')[0] || 'Founder';
  const founderSub = isDemoMode
    ? 'Instant Demo Session'
    : user?.email || 'Verified Founder';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (260px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Sidebar Brand Header */}
          <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              MarketMind AI
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-900"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Active Brand Context */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            {isDemoMode ? (
              <img
                src="/src/assets/images/roastcraft_brand_mark_1794558547489.jpg"
                alt="RoastCraft India Coffee"
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-blue-700 text-white flex items-center justify-center font-display text-sm font-bold shrink-0">
                {businessDna.brandName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {businessDna.brandName}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{businessDna.category}</p>
            </div>
          </div>

          {/* 5-Tab Navigation */}
          <nav className="p-3 space-y-1" aria-label="Main Dashboard Tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Founder Profile & Logout */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={founderName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {founderName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{founderName}</p>
              <p className="text-[11px] text-slate-500 truncate">{founderSub}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isDemoMode ? 'Exit Demo & Sign In' : labels.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                MarketMind AI
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{currentTabTitle}</span>
            </div>
          </div>

          {/* Prominent Multilingual Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <Globe className="h-4 w-4 text-slate-500 hidden sm:block" />
            <label htmlFor="language-selector" className="sr-only">
              Select Language
            </label>
            <select
              id="language-selector"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-300 focus:border-blue-600 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel} ({lang.label})
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Notices: Email Verification or New Account Setup */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
          {user && !user.emailVerified && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-amber-900 space-y-0.5">
                <p className="font-semibold">
                  Verify your email address to enable permanent Cloud Firestore sync
                </p>
                <p>
                  We sent a verification link to {user.email}. Meanwhile, your changes stay active in this browser session.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await sendEmailVerification(user).catch(() => {});
                    setVerificationSent(true);
                  }}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap cursor-pointer"
                >
                  {verificationSent ? 'Link Sent' : 'Resend Email'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await reload(user);
                    if (auth.currentUser) {
                      setUser({ ...auth.currentUser } as User);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>I&apos;ve Verified</span>
                </button>
              </div>
            </div>
          )}

          {user && user.emailVerified && !hasSavedDna && activeTab !== 'dna' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-blue-900">
                <strong>Welcome!</strong> Save your brand&apos;s real AOV, margins, and competitors in{' '}
                <strong>Business DNA</strong> so MarketMind AI tailors every insight to your unit economics.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('dna')}
                className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Set Up Business DNA
              </button>
            </div>
          )}

          {syncError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              Firestore sync notice: {syncError}
            </div>
          )}

          {activeTab === 'pulse' && (
            <DailyPulseTab
              businessDna={businessDna}
              peerPlaybooks={sharedPlaybooks}
              language={language}
              activeSpeakingId={activeSpeakingId}
              onSpeakingChange={setActiveSpeakingId}
              onSaveDecision={handleAddLedgerEntry}
              onGoToDna={() => setActiveTab('dna')}
            />
          )}

          {activeTab === 'dna' && (
            <BusinessDnaTab
              businessDna={businessDna}
              language={language}
              isDemo={isDemoMode || !user?.emailVerified}
              onSave={handleSaveBusinessDna}
            />
          )}

          {activeTab === 'radar' && (
            <MarketRadarTab
              businessDna={businessDna}
              peerPlaybooks={sharedPlaybooks}
              language={language}
              activeSpeakingId={activeSpeakingId}
              onSpeakingChange={setActiveSpeakingId}
              onSaveDecision={handleAddLedgerEntry}
            />
          )}

          {activeTab === 'simulator' && (
            <WhatIfSimulatorTab
              businessDna={businessDna}
              language={language}
              activeSpeakingId={activeSpeakingId}
              onSpeakingChange={setActiveSpeakingId}
              onSaveDecision={handleAddLedgerEntry}
            />
          )}

          {activeTab === 'ledger' && (
            <OutcomeLedgerTab
              businessDna={businessDna}
              entries={ledgerEntries}
              language={language}
              isDemo={isDemoMode || !user?.emailVerified}
              onAddEntry={handleAddLedgerEntry}
              onUpdateStatus={handleUpdateLedgerStatus}
              onRecordOutcome={handleRecordOutcome}
              onDeleteEntry={handleDeleteLedgerEntry}
            />
          )}
        </main>
      </div>
    </div>
  );
}
