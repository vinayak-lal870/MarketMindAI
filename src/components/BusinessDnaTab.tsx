import { useEffect, useState, type FormEvent } from 'react';
import { Check, Save, ShieldCheck } from 'lucide-react';
import type { BusinessDna, LanguageCode } from '../types.ts';
import { VoiceInputButton } from './VoiceControls.tsx';

interface BusinessDnaTabProps {
  businessDna: BusinessDna;
  language: LanguageCode;
  isDemo: boolean;
  onSave: (dna: Omit<BusinessDna, 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const CATEGORIES = [
  'Specialty Coffee & Beverages',
  'Ayurvedic Skincare & Wellness',
  'Artisanal Snacks & F&B',
  'Ethnic Apparel & Handloom',
  'Home & Kitchen D2C',
  'Consumer Electronics & Accessories',
  'B2B Wholesale / Local SMB',
  'Beauty & Personal Care',
];

export function BusinessDnaTab({
  businessDna,
  language,
  isDemo,
  onSave,
}: BusinessDnaTabProps) {
  const [form, setForm] = useState({
    brandName: businessDna.brandName,
    category: businessDna.category,
    productDescription: businessDna.productDescription,
    targetAudience: businessDna.targetAudience,
    aovInr: businessDna.aovInr,
    grossMarginPct: businessDna.grossMarginPct,
    monthlyAdBudgetInr: businessDna.monthlyAdBudgetInr,
    competitorOne: businessDna.competitorOne,
    competitorTwo: businessDna.competitorTwo,
  });

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      brandName: businessDna.brandName,
      category: businessDna.category,
      productDescription: businessDna.productDescription,
      targetAudience: businessDna.targetAudience,
      aovInr: businessDna.aovInr,
      grossMarginPct: businessDna.grossMarginPct,
      monthlyAdBudgetInr: businessDna.monthlyAdBudgetInr,
      competitorOne: businessDna.competitorOne,
      competitorTwo: businessDna.competitorTwo,
    });
  }, [businessDna]);

  const grossProfitPerOrder = Math.round((form.aovInr * form.grossMarginPct) / 100);
  const breakEvenRoas = form.grossMarginPct > 0 ? (100 / form.grossMarginPct).toFixed(2) : '—';
  const priceTierLabel =
    form.aovInr < 500
      ? 'Mass (Under ₹499)'
      : form.aovInr <= 1499
        ? 'Mid-Premium (₹500–₹1,499)'
        : 'Luxury (₹1,500+)';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedBanner(false);
    setSaving(true);
    try {
      await onSave({
        ...form,
        aovInr: Math.max(1, Number(form.aovInr) || 1),
        grossMarginPct: Math.min(99, Math.max(1, Number(form.grossMarginPct) || 1)),
        monthlyAdBudgetInr: Math.max(0, Number(form.monthlyAdBudgetInr) || 0),
        preferredLanguage: language,
      });
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save Business DNA.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Business DNA (Private Memory)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isDemo
              ? 'Demo session active. Edit any field to immediately update your MarketMind AI recommendations.'
              : 'Saved strictly under your private Firebase account. Never visible to other founders.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 shrink-0">
          <ShieldCheck className="h-4 w-4" />
          <span>{isDemo ? 'Demo Workspace' : 'Private Founder Scope'}</span>
        </div>
      </div>

      {/* Live Unit Economics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <p className="text-xs text-slate-500">Gross Profit / Order</p>
          <p className="font-mono-num text-lg font-bold text-slate-900 mt-1">
            ₹{grossProfitPerOrder.toLocaleString('en-IN')}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Break-Even ROAS</p>
          <p className="font-mono-num text-lg font-bold text-slate-900 mt-1">{breakEvenRoas}x</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Price Tier</p>
          <p className="text-sm font-semibold text-slate-900 mt-1.5">{priceTierLabel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Max Target CAC</p>
          <p className="font-mono-num text-lg font-bold text-blue-700 mt-1">
            ₹{Math.round(grossProfitPerOrder * 0.65).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Brand Name
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={form.brandName}
              onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
              placeholder="e.g. RoastCraft India Coffee"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={CATEGORIES.includes(form.category) ? form.category : 'Custom'}
              onChange={(e) => {
                if (e.target.value !== 'Custom') {
                  setForm((f) => ({ ...f, category: e.target.value }));
                }
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              {!CATEGORIES.includes(form.category) && (
                <option value="Custom">{form.category}</option>
              )}
            </select>
          </div>
        </div>

        {/* Product Description with Mic */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Product Description &amp; Hero SKUs
            </label>
            <VoiceInputButton
              language={language}
              label="Voice Input"
              onTranscript={(text) =>
                setForm((f) => ({
                  ...f,
                  productDescription: f.productDescription
                    ? `${f.productDescription} ${text}`
                    : text,
                }))
              }
            />
          </div>
          <textarea
            rows={3}
            required
            maxLength={1200}
            value={form.productDescription}
            onChange={(e) => setForm((f) => ({ ...f, productDescription: e.target.value }))}
            placeholder="Describe your hero products, pricing structure, and unique differentiator..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Target Audience with Mic */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Target Audience &amp; Geography
            </label>
            <VoiceInputButton
              language={language}
              label="Voice Input"
              onTranscript={(text) =>
                setForm((f) => ({
                  ...f,
                  targetAudience: f.targetAudience ? `${f.targetAudience} ${text}` : text,
                }))
              }
            />
          </div>
          <textarea
            rows={2}
            required
            maxLength={600}
            value={form.targetAudience}
            onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            placeholder="Who buys from you, where do they live (Metro vs Tier-2), and how do they pay?"
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Financials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Average Order Value (₹)
            </label>
            <input
              type="number"
              required
              min={1}
              max={10000000}
              value={form.aovInr}
              onChange={(e) => setForm((f) => ({ ...f, aovInr: Number(e.target.value) }))}
              className="w-full font-mono-num rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Gross Margin (%)
            </label>
            <input
              type="number"
              required
              min={1}
              max={99}
              value={form.grossMarginPct}
              onChange={(e) => setForm((f) => ({ ...f, grossMarginPct: Number(e.target.value) }))}
              className="w-full font-mono-num rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Monthly Ad Budget (₹)
            </label>
            <input
              type="number"
              required
              min={0}
              max={100000000}
              value={form.monthlyAdBudgetInr}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthlyAdBudgetInr: Number(e.target.value) }))
              }
              className="w-full font-mono-num rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Competitors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Top Competitor 1
            </label>
            <input
              type="text"
              maxLength={120}
              value={form.competitorOne}
              onChange={(e) => setForm((f) => ({ ...f, competitorOne: e.target.value }))}
              placeholder="e.g. Blue Tokai"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Top Competitor 2
            </label>
            <input
              type="text"
              maxLength={120}
              value={form.competitorTwo}
              onChange={(e) => setForm((f) => ({ ...f, competitorTwo: e.target.value }))}
              placeholder="e.g. Sleepy Owl"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div>
            {savedBanner && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check className="h-4 w-4" />
                <span>Business DNA saved!</span>
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Business DNA'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
