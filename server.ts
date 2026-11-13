import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  BusinessDna,
  LanguageCode,
  OutcomeLedgerEntry,
  SharedPlaybook,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const LANGUAGE_INSTRUCTIONS: Record<LanguageCode, string> = {
  en: 'English (clear, practical Indian SMB/D2C business English; use ₹ for Rupee values).',
  hi: 'Hindi (हिंदी in Devanagari script). Use simple, everyday conversational business Hindi that a D2C founder in Jaipur or Delhi immediately understands. Use ₹ for Rupee amounts.',
  te: 'Telugu (తెలుగు in Telugu script). Use simple, everyday conversational business Telugu that a D2C founder in Hyderabad or Vijayawada immediately understands. Use ₹ for Rupee amounts.',
  ta: 'Tamil (தமிழ் in Tamil script). Use simple, everyday conversational business Tamil that a D2C founder in Chennai or Coimbatore immediately understands. Use ₹ for Rupee amounts.',
  mr: 'Marathi (मराठी in Devanagari script). Use simple, everyday conversational business Marathi that a D2C founder in Pune or Mumbai immediately understands. Use ₹ for Rupee amounts.',
};

function getLanguageInstruction(code?: string): string {
  if (code && code in LANGUAGE_INSTRUCTIONS) {
    return LANGUAGE_INSTRUCTIONS[code as LanguageCode];
  }
  return LANGUAGE_INSTRUCTIONS.en;
}

async function generateStructuredJson<T>(params: {
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
}): Promise<T> {
  const ai = getGeminiClient();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        },
      });

      const raw = (response.text ?? '{}').trim();
      return JSON.parse(raw) as T;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini API request failed.');
}

function scrubSensitiveNames(text: string, dna?: Partial<BusinessDna>): string {
  let clean = text;
  const terms = [dna?.brandName, dna?.competitorOne, dna?.competitorTwo]
    .map((t) => (t || '').trim())
    .filter((t) => t.length >= 2);
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(escaped, 'gi'), 'the brand');
  }
  return clean;
}

function derivePriceTier(aovInr?: number): 'Mass (Under ₹499)' | 'Mid-Premium (₹500–₹1,499)' | 'Luxury (₹1,500+)' {
  const aov = Number(aovInr || 0);
  if (aov < 500) return 'Mass (Under ₹499)';
  if (aov <= 1499) return 'Mid-Premium (₹500–₹1,499)';
  return 'Luxury (₹1,500+)';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: MODEL_NAME });
  });

  // 1. Daily Growth Pulse Briefing
  app.post('/api/gemini/daily-briefing', async (req, res) => {
    try {
      const { businessDna, peerPlaybooks = [], language = 'en', currentDate } = req.body as {
        businessDna: BusinessDna;
        peerPlaybooks?: SharedPlaybook[];
        language?: LanguageCode;
        currentDate?: string;
      };

      if (!businessDna?.brandName) {
        res.status(400).json({ error: 'Business DNA profile is required.' });
        return;
      }

      const langDesc = getLanguageInstruction(language);
      const todayLabel = currentDate || new Date().toISOString().slice(0, 10);

      const peerContext = peerPlaybooks
        .slice(0, 4)
        .map(
          (p, i) =>
            `${i + 1}. [${p.category} · ${p.priceTier}] ${p.strategySummary} -> Verified Result: ${p.verifiedResult}`
        )
        .join('\n');

      const data = await generateStructuredJson({
        systemInstruction: `You are MarketMind AI, an autonomous growth advisor for Indian D2C & SMB founders. Write ALL output fields in ${langDesc}. Keep advice grounded in Indian consumer realities (UPI vs COD/RTO, WhatsApp retention, Meta/Instagram CAC, Tier-1 vs Tier-2 buyer behaviour, Indian festive/seasonal timing). Never invent fake telemetry.`,
        prompt: `Date: ${todayLabel}
Brand: ${businessDna.brandName}
Category: ${businessDna.category}
Product: ${businessDna.productDescription}
Target Audience: ${businessDna.targetAudience}
AOV: ₹${businessDna.aovInr} | Gross Margin: ${businessDna.grossMarginPct}% | Monthly Ad Budget: ₹${businessDna.monthlyAdBudgetInr}
Competitors: ${businessDna.competitorOne || 'None listed'}, ${businessDna.competitorTwo || 'None listed'}

Recent Anonymized Peer Wins in the Network:
${peerContext || 'No peer playbooks supplied.'}

Generate Today's Autonomous Briefing with one high-leverage priority action tailored to this founder's unit economics and date.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING, description: 'Concise daily headline in selected language.' },
            summary: { type: Type.STRING, description: '2-3 practical sentences explaining today focus.' },
            priorityActionTitle: { type: Type.STRING, description: 'Actionable title for today top move.' },
            priorityActionSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exactly 3 concrete execution steps.',
            },
            expectedImpact: { type: Type.STRING, description: 'Realistic quantitative range or operational impact.' },
            watchoutRisk: { type: Type.STRING, description: 'One concise margin or execution watchout.' },
          },
          required: [
            'headline',
            'summary',
            'priorityActionTitle',
            'priorityActionSteps',
            'expectedImpact',
            'watchoutRisk',
          ],
        },
      });

      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate daily briefing.';
      res.status(500).json({ error: msg });
    }
  });

  // 2. Adapt Peer Playbook for Founder's Business
  app.post('/api/gemini/adapt-playbook', async (req, res) => {
    try {
      const { businessDna, playbook, language = 'en' } = req.body as {
        businessDna: BusinessDna;
        playbook: SharedPlaybook;
        language?: LanguageCode;
      };

      if (!businessDna?.brandName || !playbook?.strategySummary) {
        res.status(400).json({ error: 'Business DNA and playbook are required.' });
        return;
      }

      const langDesc = getLanguageInstruction(language);

      const data = await generateStructuredJson({
        systemInstruction: `You are MarketMind AI. Customize an anonymized peer SMB playbook specifically for the logged-in founder's brand, AOV, gross margin, and audience. Write ALL text in ${langDesc}.`,
        prompt: `Founder Brand: ${businessDna.brandName}
Category: ${businessDna.category}
Product: ${businessDna.productDescription}
Target Audience: ${businessDna.targetAudience}
AOV: ₹${businessDna.aovInr} | Gross Margin: ${businessDna.grossMarginPct}% | Monthly Ad Budget: ₹${businessDna.monthlyAdBudgetInr}

Peer Win to Adapt:
Category: ${playbook.category} | Price Tier: ${playbook.priceTier} | Channel: ${playbook.channel}
Strategy: ${playbook.strategySummary}
Steps: ${playbook.implementationSteps.join(' | ')}
Verified Result: ${playbook.verifiedResult}

Customize this exact winning mechanic for ${businessDna.brandName}.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            adaptedTitle: { type: Type.STRING },
            whyItFitsYourBrand: { type: Type.STRING },
            customizedSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            estimatedOutcome: { type: Type.STRING },
            channelRecommendation: { type: Type.STRING },
          },
          required: [
            'adaptedTitle',
            'whyItFitsYourBrand',
            'customizedSteps',
            'estimatedOutcome',
            'channelRecommendation',
          ],
        },
      });

      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to adapt playbook.';
      res.status(500).json({ error: msg });
    }
  });

  // 3. Market Radar (Blind-Spot Scanner)
  app.post('/api/gemini/market-radar', async (req, res) => {
    try {
      const { businessDna, peerPlaybooks = [], language = 'en' } = req.body as {
        businessDna: BusinessDna;
        peerPlaybooks?: SharedPlaybook[];
        language?: LanguageCode;
      };

      if (!businessDna?.brandName) {
        res.status(400).json({ error: 'Business DNA is required.' });
        return;
      }

      const langDesc = getLanguageInstruction(language);
      const peerContext = peerPlaybooks
        .slice(0, 6)
        .map(
          (p, i) =>
            `${i + 1}. [${p.category} · ${p.priceTier} · ${p.channel}] ${p.strategySummary} -> ${p.verifiedResult}`
        )
        .join('\n');

      const data = await generateStructuredJson<{ cards: Array<Record<string, unknown>> }>({
        systemInstruction: `You are MarketMind AI's Market Radar scanner for Indian D2C & SMBs. Generate EXACTLY 3 blind-spot cards covering: 1) Competitor Weakness, 2) Best Offer Angle, 3) Low-CAC Channel. Keep enum fields angleType and confidenceType strictly in their exact English enum strings; write title, insight, actionPlan, confidenceRationale, and projectedLift in ${langDesc}. Use "Verified Peer Pattern" when directly grounded in one of the supplied peer playbooks, otherwise use "AI Hypothesis".`,
        prompt: `Brand: ${businessDna.brandName}
Category: ${businessDna.category}
Product: ${businessDna.productDescription}
Target Audience: ${businessDna.targetAudience}
AOV: ₹${businessDna.aovInr} | Gross Margin: ${businessDna.grossMarginPct}% | Monthly Ad Budget: ₹${businessDna.monthlyAdBudgetInr}
Competitors: ${businessDna.competitorOne || 'Category leaders'}, ${businessDna.competitorTwo || 'Marketplace brands'}

Peer Network Playbooks:
${peerContext || 'None available.'}

Return 3 distinct, actionable blind-spot cards.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  angleType: {
                    type: Type.STRING,
                    enum: ['Competitor Weakness', 'Best Offer Angle', 'Low-CAC Channel'],
                  },
                  title: { type: Type.STRING },
                  insight: { type: Type.STRING },
                  actionPlan: { type: Type.STRING },
                  confidenceType: {
                    type: Type.STRING,
                    enum: ['Verified Peer Pattern', 'AI Hypothesis'],
                  },
                  confidenceRationale: { type: Type.STRING },
                  projectedLift: { type: Type.STRING },
                },
                required: [
                  'angleType',
                  'title',
                  'insight',
                  'actionPlan',
                  'confidenceType',
                  'confidenceRationale',
                  'projectedLift',
                ],
              },
            },
          },
          required: ['cards'],
        },
      });

      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to scan market blind spots.';
      res.status(500).json({ error: msg });
    }
  });

  // 4. What-If Simulator Safety Check
  app.post('/api/gemini/what-if-check', async (req, res) => {
    try {
      const {
        businessDna,
        adSpendChangePct,
        discountPct,
        projectedRevenue,
        projectedNetProfit,
        projectedOrders,
        language = 'en',
      } = req.body as {
        businessDna: BusinessDna;
        adSpendChangePct: number;
        discountPct: number;
        projectedRevenue: number;
        projectedNetProfit: number;
        projectedOrders: number;
        language?: LanguageCode;
      };

      if (!businessDna?.brandName) {
        res.status(400).json({ error: 'Business DNA is required.' });
        return;
      }

      const langDesc = getLanguageInstruction(language);

      const data = await generateStructuredJson({
        systemInstruction: `You are MarketMind AI's unit-economics CFO advisor for Indian D2C & SMBs. Keep verdict strictly as one of ["Safe to Execute", "Proceed with Caution", "Margin Risk"]. Write summary, unitEconomicsNote, and recommendedGuardrail in ${langDesc}.`,
        prompt: `Brand: ${businessDna.brandName} (${businessDna.category})
Baseline AOV: ₹${businessDna.aovInr} | Gross Margin: ${businessDna.grossMarginPct}% | Monthly Ad Budget: ₹${businessDna.monthlyAdBudgetInr}
Simulated Change: Ad Spend Change ${adSpendChangePct}%, Discount Change ${discountPct}%
Projected Monthly Orders: ${projectedOrders}
Projected Monthly Revenue: ₹${Math.round(projectedRevenue)}
Projected Monthly Net Profit (Contribution after COGS & Ads): ₹${Math.round(projectedNetProfit)}

Evaluate if this move is financially safe and provide one concrete guardrail (e.g., minimum cart threshold or prepaid-only rule).`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: {
              type: Type.STRING,
              enum: ['Safe to Execute', 'Proceed with Caution', 'Margin Risk'],
            },
            summary: { type: Type.STRING },
            unitEconomicsNote: { type: Type.STRING },
            recommendedGuardrail: { type: Type.STRING },
          },
          required: ['verdict', 'summary', 'unitEconomicsNote', 'recommendedGuardrail'],
        },
      });

      res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze scenario safety.';
      res.status(500).json({ error: msg });
    }
  });

  // 5. Anonymize & Format Outcome into Collective Playbook
  app.post('/api/gemini/anonymize-playbook', async (req, res) => {
    try {
      const { businessDna, entry } = req.body as {
        businessDna: BusinessDna;
        entry: OutcomeLedgerEntry;
      };

      if (!entry?.howImplemented || !entry?.actualResult) {
        res.status(400).json({ error: 'Implementation details and actual result are required.' });
        return;
      }

      const expectedTier = derivePriceTier(businessDna?.aovInr);

      const data = await generateStructuredJson<{
        category: string;
        priceTier: 'Mass (Under ₹499)' | 'Mid-Premium (₹500–₹1,499)' | 'Luxury (₹1,500+)';
        strategySummary: string;
        implementationSteps: string[];
        verifiedResult: string;
        channel: string;
      }>({
        systemInstruction: `You are a strict data-anonymization engine for an Indian SMB collective intelligence network. Convert the founder's winning outcome into a clean, anonymized English playbook. CRITICAL RULES: 1) Strictly REMOVE all brand names, founder names, competitor names, city names if identifying, and exact rupee revenue/budget numbers. 2) Preserve relative percentages/metrics (e.g. "+22% repeat orders", "-18% CAC"). 3) Return 2 to 4 concise implementationSteps. 4) Keep strategySummary under 350 characters.`,
        prompt: `Source Category: ${businessDna?.category || 'D2C Consumer Brand'}
Expected Price Tier: ${expectedTier}
Forbidden Names to Strip: ${businessDna?.brandName || ''}, ${businessDna?.competitorOne || ''}, ${businessDna?.competitorTwo || ''}
Decision Title: ${entry.title}
How Implemented: ${entry.howImplemented}
Actual Result: ${entry.actualResult}

Produce the anonymized SharedPlaybook JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            priceTier: {
              type: Type.STRING,
              enum: ['Mass (Under ₹499)', 'Mid-Premium (₹500–₹1,499)', 'Luxury (₹1,500+)'],
            },
            strategySummary: { type: Type.STRING },
            implementationSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            verifiedResult: { type: Type.STRING },
            channel: { type: Type.STRING },
          },
          required: [
            'category',
            'priceTier',
            'strategySummary',
            'implementationSteps',
            'verifiedResult',
            'channel',
          ],
        },
      });

      // Deterministic secondary scrub so brand/competitor names never leak
      const sanitized = {
        category: (data.category || businessDna?.category || 'D2C Brand').slice(0, 95),
        priceTier: expectedTier,
        strategySummary: scrubSensitiveNames(data.strategySummary || '', businessDna).slice(0, 420),
        implementationSteps: (data.implementationSteps || [])
          .slice(0, 6)
          .map((s) => scrubSensitiveNames(s, businessDna).slice(0, 280))
          .filter(Boolean),
        verifiedResult: scrubSensitiveNames(data.verifiedResult || entry.actualResult, businessDna).slice(0, 170),
        channel: scrubSensitiveNames(data.channel || 'D2C Direct', businessDna).slice(0, 90),
      };

      if (sanitized.implementationSteps.length === 0) {
        sanitized.implementationSteps = [
          scrubSensitiveNames(entry.howImplemented, businessDna).slice(0, 280),
        ];
      }

      res.json(sanitized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to anonymize playbook.';
      res.status(500).json({ error: msg });
    }
  });

  // 6. Audio Transcription Fallback (when browser SpeechRecognition is unavailable or blocked)
  app.post('/api/gemini/transcribe-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm', language = 'en' } = req.body as {
        audioBase64: string;
        mimeType?: string;
        language?: LanguageCode;
      };

      if (!audioBase64) {
        res.status(400).json({ error: 'Audio payload is required.' });
        return;
      }

      const ai = getGeminiClient();
      const langDesc = getLanguageInstruction(language);
      const audioPart = {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      };
      const promptText = `Transcribe this spoken business note accurately into ${langDesc}. Return only the clean transcribed text without quotes or commentary.`;

      let transcript = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: { parts: [audioPart, { text: promptText }] },
        });
        transcript = (response.text ?? '').trim();
      } catch {
        const fallback = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: { parts: [audioPart, { text: promptText }] },
        });
        transcript = (fallback.text ?? '').trim();
      }

      res.json({ transcript });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to transcribe audio.';
      res.status(500).json({ error: msg });
    }
  });

  // 7. Text-to-Speech (reliable multilingual WAV audio via gemini-3.8-flash-lite-tts)
  app.post('/api/gemini/tts', async (req, res) => {
    try {
      const { text, language = 'en' } = req.body as {
        text: string;
        language?: LanguageCode;
      };

      const cleanText = (text || '').trim().slice(0, 2000);
      if (!cleanText) {
        res.status(400).json({ error: 'Text is required for audio playback.' });
        return;
      }

      const langNames: Record<LanguageCode, string> = {
        en: 'Indian English',
        hi: 'Hindi',
        te: 'Telugu',
        ta: 'Tamil',
        mr: 'Marathi',
      };
      const targetLang = langNames[language] || 'Indian English';
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in the server environment.');
      }

      const callTts = async (apiVersion: string) => {
        const ttsAi = new GoogleGenAI({
          apiKey,
          apiVersion,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        return ttsAi.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: `Clear, warm, articulate ${targetLang} business advisor`,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });
      };

      let response;
      try {
        response = await callTts('v1beta');
      } catch {
        response = await callTts('v1alpha');
      }

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('No audio generated by TTS model.');
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to synthesize audio.';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MarketMind AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
