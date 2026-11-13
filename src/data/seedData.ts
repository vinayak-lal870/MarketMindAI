import type {
  BusinessDna,
  LanguageCode,
  OutcomeLedgerEntry,
  SharedPlaybook,
} from '../types.ts';

export const DEMO_BUSINESS_DNA: BusinessDna = {
  ownerId: 'demo-roastcraft-india',
  brandName: 'RoastCraft India Coffee',
  category: 'Specialty Coffee & Beverages',
  productDescription:
    'Small-batch Chikmagalur Arabica & Monsoon Malabar whole beans, cold brew bags, and brass South Indian filter decoction kits roasted fresh every Tuesday.',
  targetAudience:
    'Urban remote professionals & home-brewers aged 24–40 in Bengaluru, Mumbai, Delhi NCR, Pune, and Hyderabad buying monthly refill packs.',
  aovInr: 850,
  grossMarginPct: 62,
  monthlyAdBudgetInr: 120000,
  competitorOne: 'Blue Tokai',
  competitorTwo: 'Sleepy Owl',
  preferredLanguage: 'en',
};

export const DEMO_OUTCOME_LEDGER: OutcomeLedgerEntry[] = [
  {
    id: 'demo_entry_1',
    ownerId: 'demo-roastcraft-india',
    title: 'WhatsApp 21-Day Refill Reminder + Brass Filter Gift Bundling',
    sourceType: 'Daily Pulse',
    angleCategory: 'Best Offer Angle',
    hypothesis:
      'First-time 250g pack buyers run out around day 22; triggering a WhatsApp one-tap UPI reorder link with free 50g sample sachet raises repeat conversion.',
    actionPlan:
      '1. Segment orders at Day 21.\n2. Send automated WhatsApp template with 1-click UPI link.\n3. Add complimentary tasting sachet on prepaid orders.',
    status: 'Succeeded',
    howImplemented:
      'Triggered automated WhatsApp reminder at Day 21 after delivery with a 1-tap ₹80 UPI reorder perk and complimentary 25g Monsoon Malabar tasting sachet.',
    actualResult: '+26% 45-day repeat purchase rate',
    sharedAnonymously: false,
    publishedPlaybookId: '',
  },
  {
    id: 'demo_entry_2',
    ownerId: 'demo-roastcraft-india',
    title: 'Prepaid UPI Instant ₹60 Discount to Cut COD RTO',
    sourceType: 'Market Radar',
    angleCategory: 'Low-CAC Channel',
    hypothesis:
      'COD orders above ₹750 from Tier-2 pin codes show higher return-to-origin rates; shifting buyers to UPI preserves net contribution margin.',
    actionPlan:
      'Add ₹60 instant UPI discount badge directly inside checkout drawer above COD option.',
    status: 'In Progress',
    howImplemented: '',
    actualResult: '',
    sharedAnonymously: false,
    publishedPlaybookId: '',
  },
  {
    id: 'demo_entry_3',
    ownerId: 'demo-roastcraft-india',
    title: 'Target Competitor Grind-Freshness Pain in Meta Reels',
    sourceType: 'Market Radar',
    angleCategory: 'Competitor Weakness',
    hypothesis:
      'Marketplace coffee brands ship 4–8 week old inventory; highlighting our Tuesday roast-date stamp on every pouch wins switcher trust.',
    actionPlan:
      'Shoot 20-second vertical Founder Reel showing live roast date stamping in Chikmagalur.',
    status: 'Planned',
    howImplemented: '',
    actualResult: '',
    sharedAnonymously: false,
    publishedPlaybookId: '',
  },
];

export const SEED_SHARED_PLAYBOOKS: Omit<SharedPlaybook, 'authorUid' | 'createdAt'>[] = [
  {
    id: 'seed_coffee_01',
    isAnonymized: true,
    category: 'Specialty Coffee & Beverages',
    priceTier: 'Mid-Premium (₹500–₹1,499)',
    strategySummary:
      'Inserted a 15g single-serve tasting sachet with a QR code inside every mid-ticket order, unlocking an instant ₹100 UPI credit on the buyer’s next 250g refill via WhatsApp.',
    implementationSteps: [
      'Pack 15g secondary roast sachet inside all orders above ₹699.',
      'Print high-contrast QR card linking directly to a pre-filled WhatsApp reorder message.',
      'Trigger a Day-18 automated nudge reminding customers before their pack finishes.',
    ],
    verifiedResult: '+28% repeat orders within 45 days',
    channel: 'WhatsApp Broadcast + QR Sampling',
  },
  {
    id: 'seed_skincare_02',
    isAnonymized: true,
    category: 'Ayurvedic Skincare & Wellness',
    priceTier: 'Mid-Premium (₹500–₹1,499)',
    strategySummary:
      'Replaced polished studio English creatives with 30-second regional creator explainer reels in Hindi and Marathi demonstrating honest 7-day morning routines under ₹999.',
    implementationSteps: [
      'Partner with 8 micro-creators across Pune, Indore, and Jaipur on barter + affiliate fees.',
      'Feature vernacular captions and transparent ingredient breakdown in the first 3 seconds.',
      'Retarget 50% video viewers with a prepaid combo starter kit.',
    ],
    verifiedResult: '-34% Meta CAC & 2.4x ROAS in Tier-2 cities',
    channel: 'Regional Creator Reels (Meta)',
  },
  {
    id: 'seed_snacks_03',
    isAnonymized: true,
    category: 'Artisanal Snacks & F&B',
    priceTier: 'Mass (Under ₹499)',
    strategySummary:
      'Raised the free-shipping threshold from ₹299 to ₹499 and introduced a 3-flavour trial pack at ₹449 paired with a ₹60 single-click cart add-on.',
    implementationSteps: [
      'Introduce a curated 3-flavour discovery box priced just below free shipping.',
      'Add a 1-click ₹60 mini-jar upsell inside the slide-out cart drawer.',
      'Highlight shipping savings visually on the progress bar.',
    ],
    verifiedResult: '+31% AOV lift & +19% contribution margin',
    channel: 'D2C Cart Drawer & Combo Bundling',
  },
  {
    id: 'seed_apparel_04',
    isAnonymized: true,
    category: 'Ethnic Apparel & Handloom',
    priceTier: 'Luxury (₹1,500+)',
    strategySummary:
      'Offered an instant ₹120 UPI prepayment perk plus priority 24-hour dispatch badge at checkout to shift high-ticket Cash-on-Delivery orders to prepaid UPI.',
    implementationSteps: [
      'Display UPI instant savings directly inside the payment method selector.',
      'Confirm remaining COD orders via automated WhatsApp address-verification pin.',
      'Prioritize dispatch queue for prepaid orders to improve delivery speed.',
    ],
    verifiedResult: '-41% RTO losses & +16% net cash flow',
    channel: 'Checkout Prepaid UPI Nudge',
  },
];

export const TAB_LABELS: Record<
  LanguageCode,
  {
    pulse: string;
    dna: string;
    radar: string;
    simulator: string;
    ledger: string;
    logout: string;
  }
> = {
  en: {
    pulse: 'Daily Growth Pulse',
    dna: 'Business DNA',
    radar: 'Market Radar',
    simulator: 'What-If Simulator',
    ledger: 'Outcome Ledger',
    logout: 'Logout',
  },
  hi: {
    pulse: 'दैनिक ग्रोथ पल्स',
    dna: 'बिज़नेस DNA',
    radar: 'मार्केट रडार',
    simulator: 'व्हाट-इफ सिम्युलेटर',
    ledger: 'आउटकम लेज़र',
    logout: 'लॉग आउट',
  },
  te: {
    pulse: 'డైలీ గ్రోత్ పల్స్',
    dna: 'బిజినెస్ DNA',
    radar: 'మార్కెట్ రాడార్',
    simulator: 'వాట్-ఇఫ్ సిమ్యులేటర్',
    ledger: 'అవుట్‌కమ్ లెడ్జర్',
    logout: 'లాగ్ అవుట్',
  },
  ta: {
    pulse: 'தினசரி வளர்ச்சி',
    dna: 'வணிக DNA',
    radar: 'சந்தை ரேடார்',
    simulator: 'என்ன-எனில் சிமுலேட்டர்',
    ledger: 'விளைவு பதிவேடு',
    logout: 'வெளியேறு',
  },
  mr: {
    pulse: 'दैनिक ग्रोथ पल्स',
    dna: 'बिझनेस DNA',
    radar: 'मार्केट रडार',
    simulator: 'व्हॉट-इफ सिम्युलेटर',
    ledger: 'आउटकम लेजर',
    logout: 'लॉग आउट',
  },
};
