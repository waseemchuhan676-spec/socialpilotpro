// api/lib/storage.js
// Persistent serverless storage layer for SocialPilotPro
// Compatible with Vercel KV, Upstash Redis, Neon/Postgres, or in-memory/tmp persistence

import fs from 'fs';
import path from 'path';

// Initial Seed Data for Official Research
export const DEFAULT_RESEARCH = [
  {
    id: 'bisp-8171-auth-01',
    cat: 'BISP / 8171',
    title: 'Official 8171 Verification Protocol & Survey Zero-Fee Advisory',
    desc: 'BISP headquarters reissued strict public awareness instructions confirming that 8171 is the sole authorized government SMS code for BISP notifications. Citizens are strictly warned not to entertain messages or calls from ordinary 11-digit mobile numbers.',
    status: 'VERIFIED',
    source: 'BISP Official Headquarters & DGPR',
    url: 'https://bisp.gov.pk/news-events',
    pubDate: '2026-09-26',
    time: '07:15 PKT',
    location: 'Pakistan-wide',
    facts: [
      '8171 is the only authentic shortcode used by BISP.',
      'BISP dynamic survey registration at Tehsil offices is 100% free of charge.',
      'No bank agent, retailer, or middleman has the right to deduct fee or commission.',
      'Beneficiaries must file complaints on BISP helpline 0800-26477 against any retailer demanding cuts.'
    ],
    beneficiaries: 'Underprivileged families, Kafaalat beneficiaries, general public'
  },
  {
    id: 'bisp-dynamic-registry-02',
    cat: 'BISP Registration',
    title: 'BISP Dynamic Registry (NSER) Mandatory 3-Year Resurvey Guidelines',
    desc: 'Families registered more than three years ago are required to update their household socio-economic roster at the nearest BISP Tehsil Dynamic Registry Desk to ensure continuity of financial assistance and updated PMT score calculations.',
    status: 'VERIFIED',
    source: 'Ministry of Poverty Alleviation & Social Safety (PASS)',
    url: 'https://pass.gov.pk',
    pubDate: '2026-09-25',
    time: '07:20 PKT',
    location: 'Pakistan-wide',
    facts: [
      'Survey renewal applies to households whose last NSER registration occurred before 2023.',
      'Required documents: Computerized National Identity Card (CNIC) of the female applicant and NADRA B-Form for all children.',
      'Applicants receive an automated confirmation SMS solely from 8171 upon survey completion.',
      'There is no online self-registration form on unofficial websites.'
    ],
    beneficiaries: 'Existing BISP beneficiaries and newly eligible households'
  },
  {
    id: 'punjab-kisan-card-03',
    cat: 'Punjab Schemes',
    title: 'Punjab Maryam Nawaz Kisan Card: Biometric Distribution & Subsidy Schedule',
    desc: 'Punjab Agriculture Department announced operational milestones for the Maryam Nawaz Kisan Card, providing interest-free agricultural loans up to Rs. 150,000 per crop season for fertilizer, seeds, and agrochemicals for farmers holding 1 to 12.5 acres of land.',
    status: 'VERIFIED',
    source: 'Govt of Punjab — Agriculture Department & Bank of Punjab',
    url: 'https://agripunjab.gov.pk',
    pubDate: '2026-09-25',
    time: '07:30 PKT',
    location: 'Punjab Only',
    facts: [
      'Card distribution takes place through designated Agriculture Model Centers across Punjab districts.',
      'Total interest-free loan ceiling: up to Rs. 150,000 per season (six-month cycle).',
      'Eligibility: Verified land ownership records on the Punjab Land Record Authority (PLRA) portal.',
      'Purchases can only be made from registered dealer biometric POS machines.'
    ],
    beneficiaries: 'Small and medium farmers of Punjab'
  },
  {
    id: 'punjab-apni-chhat-04',
    cat: 'Punjab Schemes',
    title: 'Apni Chhat Apna Ghar Housing Scheme: Verification Desks Active Across 36 Districts',
    desc: 'Punjab Housing Department launched on-ground verification counters for applicants of the interest-free home construction loan scheme (up to Rs. 1.5 Million) in all 36 districts of Punjab.',
    status: 'VERIFIED',
    source: 'Punjab Housing and Town Planning Agency (PHATA)',
    url: 'https://phata.punjab.gov.pk',
    pubDate: '2026-09-24',
    time: '07:45 PKT',
    location: 'Punjab Only',
    facts: [
      'Loan amount: Up to Rs. 1.5 Million interest-free, repayable in monthly installments over 7 years.',
      'Eligibility criteria: Plot ownership up to 5 marlas in urban areas or up to 10 marlas in rural areas.',
      'All applicants must apply exclusively through the official portal (acag.punjab.gov.pk) or DC offices.',
      'Warning: No fee or token money is charged by the Punjab Government during application review.'
    ],
    beneficiaries: 'Homeless or land-owning low-income families in Punjab'
  },
  {
    id: 'bisp-taleemi-wazaif-05',
    cat: 'Benazir Taleemi Wazaif',
    title: 'Benazir Taleemi Wazaif: 70% School Attendance Requirement for Quarterly Stipend',
    desc: 'BISP issued a notification reminding mothers enrolled in Benazir Kafaalat that quarterly Taleemi Wazaif stipends for their school-going children depend on verified school attendance records of at least 70% for the quarter.',
    status: 'VERIFIED',
    source: 'BISP Central Directorate of Education Stipends',
    url: 'https://bisp.gov.pk/taleemi-wazaif',
    pubDate: '2026-09-23',
    time: '08:00 PKT',
    location: 'Pakistan-wide',
    facts: [
      'School enrollment slip must be stamped by the government school or approved private institution.',
      'Higher stipend rates are provided for female students to encourage girl-child education.',
      'Attendance verification is conducted through BISP field officers and school headmasters.',
      'Stipends are disbursed alongside quarterly Kafaalat payments upon biometric clearance.'
    ],
    beneficiaries: 'Children of active Benazir Kafaalat beneficiary mothers'
  },
  {
    id: 'scam-alert-fake-apk-06',
    cat: 'Scam Alert',
    title: 'Urgent Fraud Alert: Unofficial Android APK Apps & WhatsApp Groups Impersonating 8171',
    desc: 'BISP and FIA have identified malicious links circulated on WhatsApp and social media groups pretending to provide an "8171 BISP Online Balance Check App". These APKs steal biometric and CNIC credentials.',
    status: 'VERIFIED',
    source: 'FIA Cybercrime Wing & BISP Anti-Fraud Cell',
    url: 'https://fia.gov.pk',
    pubDate: '2026-09-26',
    time: '08:15 PKT',
    location: 'Pakistan-wide',
    facts: [
      'BISP has NO official Android APK available on third-party links or unofficial blogs.',
      'Beneficiary balance checks can only be accessed via the official secure website (8171.bisp.gov.pk).',
      'Scammers ask victims to deposit an "activation fee" via EasyPaisa or JazzCash — BISP never charges any fee.',
      'Report fraud WhatsApp numbers and fake callers immediately to FIA Cybercrime toll-free 1991.'
    ],
    beneficiaries: 'General public and digital social media users'
  },
  {
    id: 'punjab-himmat-card-07',
    cat: 'Punjab Financial Assistance',
    title: 'Punjab Himmat Card Financial Assistance: Medical Assessment Boards in Faisalabad & Multan',
    desc: 'Medical assessment boards for the registration of persons with disabilities (PWDs) under the Punjab Himmat Card scheme are conducting special sessions in divisional headquarters including Faisalabad and Multan.',
    status: 'CROSS-CHECK',
    source: 'Punjab Social Protection Authority (PSPA)',
    url: 'https://pspa.punjab.gov.pk',
    pubDate: '2026-09-24',
    time: '08:30 PKT',
    location: 'Faisalabad / Multan / Punjab',
    facts: [
      'Himmat Card provides targeted financial stipend to certified persons with disabilities who are unable to work.',
      'Applicants require special CNIC with disability logo issued by NADRA.',
      'District assessment boards are operating at Divisional and District Headquarters (DHQ) hospitals.',
      'Secondary news confirms board dates; official gazette notification on payment tranche timeline is pending.'
    ],
    beneficiaries: 'Certified persons with disabilities in Punjab'
  },
  {
    id: 'fed-pm-ramzan-relief-08',
    cat: 'Federal Schemes',
    title: 'Federal Ramzan & Targeted Essential Subsidies: Utility Stores Mechanism Review',
    desc: 'The Federal Government is reviewing targeted subsidy disbursement through PMT score data integration with Utility Stores Corporation. PMT score below 32 is utilized as benchmark.',
    status: 'NEEDS REVIEW',
    source: 'Ministry of Industries and Production / BISP Procurement Cell',
    url: 'https://moip.gov.pk',
    pubDate: '2026-09-22',
    time: '08:45 PKT',
    location: 'Pakistan-wide',
    facts: [
      'Subsidies target flour, sugar, ghee, and pulses for verified BISP households.',
      'Draft framework undergoing inter-ministerial approval.',
      'Exact subsidy quota per family and final launch dates have NOT been officially notified yet.',
      'Beware of clickbait videos on YouTube claiming free distribution without official ministerial notification.'
    ],
    beneficiaries: 'BISP-registered vulnerable families across Pakistan'
  },
  {
    id: 'district-rawalpindi-desk-09',
    cat: 'District Update',
    title: 'Rawalpindi District: Special Registration Desks Opened for Benazir Nashonuma',
    desc: 'Special nutritional support centers (Benazir Nashonuma Facilitation Centers) have been made operational at THQ Hospital Gujar Khan, Kahuta, and Holy Family Hospital Rawalpindi to provide specialized nutritious food and quarterly cash transfers.',
    status: 'VERIFIED',
    source: 'Rawalpindi District Administration & BISP Regional Office',
    url: 'https://rawalpindi.punjab.gov.pk',
    pubDate: '2026-09-25',
    time: '09:00 PKT',
    location: 'Rawalpindi',
    facts: [
      'Targeted at pregnant and lactating mothers and infants up to 24 months of age.',
      'Cash transfer: Conditional on attending health checkups, immunization, and nutritional awareness sessions.',
      'Registration takes place at the hospital-based Nashonuma counter upon presenting CNIC and Child Immunization Card.',
      'Free nutritional food sachets are distributed on-site.'
    ],
    beneficiaries: 'Pregnant and lactating mothers in Rawalpindi district'
  },
  {
    id: 'punjab-green-tractor-10',
    cat: 'Agriculture',
    title: 'Punjab CM Green Tractor Scheme: Balloting Process and Subsidy Allocation',
    desc: 'The Punjab Government has initiated transparent computer-based balloting for the Green Tractor Scheme, providing a flat subsidy of Rs. 1 Million per tractor to verified farmers owning between 1 and 50 acres of agricultural land.',
    status: 'CROSS-CHECK',
    source: 'Punjab Directorate General of Agriculture (Field)',
    url: 'https://agripunjab.gov.pk',
    pubDate: '2026-09-23',
    time: '09:15 PKT',
    location: 'Punjab Only',
    facts: [
      'Government subsidy: Rs. 10 Lakh (1 Million) per tractor.',
      'Selection via transparent automated e-balloting.',
      'Results will be published on the official Agriculture Department portal with district-wise quotas.',
      'Farmers are advised not to pay any token advance to private showrooms claiming early delivery.'
    ],
    beneficiaries: 'Punjab agricultural landholders'
  }
];

// Initial Seed Data for Posts
export const DEFAULT_POSTS = [
  {
    id: 'post-1',
    refId: 'bisp-8171-auth-01',
    title: 'BISP 8171 Official Number & Zero-Fee Advisory',
    status: 'pending', // pending (draft), approved, scheduled, publishing, published, failed, cancelled
    category: 'BISP / 8171',
    source: 'BISP Official Headquarters',
    sourceUrl: 'https://bisp.gov.pk/news-events',
    language: 'Urdu + Roman Urdu',
    targetAudience: 'General Public',
    verificationStatus: 'VERIFIED',
    createdTime: '2026-09-28 08:30 PKT',
    updatedTime: '2026-09-28 08:30 PKT',
    scheduledTime: '',
    publishedTime: '',
    fbPostId: '',
    errorMessage: '',
    text: `📢 اہم اور تصدیق شدہ حکومتی اپڈیٹ / Official Update
━━━━━━━━━━━━━━━━━━━━
📌 موضوع / Topic: BISP 8171 Official Protocol & Survey Advisory
📍 علاقہ: پاکستان بھر (Pakistan-wide) | ادارہ: بینظیر انکم سپورٹ پروگرام

اردو تفصیل:
بینظیر انکم سپورٹ پروگرام (BISP) نے تمام مستحقین اور عوام کو مطلع کیا ہے کہ بی آئی ایس پی کا واحد اور مستند سرکاری ایس ایم ایس کوڈ صرف "8171" ہے۔ کسی عام 11 ہندسی موبائل نمبر یا واٹس ایپ پر آنے والے پیغامات جعلی اور فراڈ ہیں۔

Roman Urdu Khulasa:
Tamam shehrion ko aagah kiya jata hai ke BISP ka official number sirf 8171 hai. Kisi bhi ghair tasdeeq shuda mobile number ya WhatsApp message par yaqeen na karein.

اہم اور تصدیق شدہ معلومات / Key Facts:
✓ بی آئی ایس پی ڈائنامک رجسٹری سروے تحصیل دفتر میں بالکل مفت ہے۔
✓ کوئی بھی نمائندہ، ایجنٹ یا دکاندار فیس یا کٹوتی لینے کا مجاز نہیں ہے۔
✓ کٹوتی کی شکایت کے لیے فوری ٹول فری ہیلپ لائن 080026477 پر رابطہ کریں۔

👥 کون مستفید ہو سکتا ہے؟
تمام مستحق خاندان اور کفالت کے لیے رجسٹرڈ خواتین۔

⚠️ فراڈ سے ہوشیار رہیں / Scam Warning:
بی آئی ایس پی کبھی بھی ایزی پیسہ، جیز کیش یا انعام کا جھانسہ دے کر فیس کا مطالبہ نہیں کرتا۔

🔗 مستند سرکاری ذریعہ:
BISP Official Press Release (bisp.gov.pk)

#BISP #8171Update #BenazirKafaalat #PublicAwareness #PakistanSchemes #SocialProtection`
  },
  {
    id: 'post-2',
    refId: 'punjab-kisan-card-03',
    title: 'Punjab Maryam Nawaz Kisan Card Distribution',
    status: 'approved',
    category: 'Punjab Schemes',
    source: 'Govt of Punjab — Agriculture Department',
    sourceUrl: 'https://agripunjab.gov.pk',
    language: 'Urdu + Roman Urdu',
    targetAudience: 'Farmers',
    verificationStatus: 'VERIFIED',
    createdTime: '2026-09-27 17:00 PKT',
    updatedTime: '2026-09-28 09:00 PKT',
    scheduledTime: '2026-09-29 09:00 PKT',
    publishedTime: '',
    fbPostId: '',
    errorMessage: '',
    text: `📢 مریم نواز کسان کارڈ: بلا سود قرض اور ڈسٹری بیوشن کی تفصیلات
━━━━━━━━━━━━━━━━━━━━
📌 موضوع / Topic: Punjab Kisan Card Biometric Distribution
📍 علاقہ: پنجاب (Punjab Only) | محکمہ: زراعت پنجاب

اردو تفصیل:
حکومت پنجاب کے اعلان کے مطابق مریم نواز کسان کارڈ کے ذریعے 1 سے ساڑھے 12 ایکڑ اراضی کے حامل کاشتکاروں کو کھاد، بیج اور زرعی ادویات کی خریداری کے لیے 1 لاکھ 50 ہزار روپے فی فصل بلاسود قرض فراہم کیا جا رہا ہے۔

Roman Urdu Khulasa:
Punjab bhar ke chotay kashtkaron ke liye Maryam Nawaz Kisan Card ki biometric distribution jari hai.

اہم نکات / Key Facts:
✓ بلا سود قرض کی حد: 1 لاکھ 50 ہزار روپے فی سیزن۔
✓ اہلیت: پنجاب لینڈ ریکارڈ اتھارٹی (PLRA) کے مطابق تصدیق شدہ اراضی۔
✓ کارڈ کی فراہمی ضلع سطح کے ایگریکلچر ماڈل سینٹرز پر بائیومیٹرک سے ہو رہی ہے۔

👥 کون مستفید ہو سکتا ہے؟
پنجاب کے چھوٹے اور درمیانے کاشتکار۔

⚠️ احتیاطی ہدایت:
کسی غیر رجسٹرڈ ڈیلر کو کارڈ نہ دیں اور صرف بائیو میٹرک تصدیق شدہ مجاز ڈیلرز سے خریداری کریں۔

🔗 مستند سرکاری ذریعہ:
Govt of Punjab Agriculture Department (agripunjab.gov.pk)

#PunjabGovt #KisanCard #MaryamNawazKisanCard #AgriculturePunjab #FarmersRelief`
  }
];

// Initial Seed Settings
export const DEFAULT_SETTINGS = {
  researchSchedule: 'daily_7am',
  geoFocus: 'punjab_pk',
  defaultLanguage: 'Urdu + Roman Urdu',
  postingFrequency: '2_per_day',
  preferredTimes: ['08:00', '18:00'],
  contentStyle: 'Detailed update',
  categories: [
    'BISP',
    '8171',
    'Punjab Government schemes',
    'Federal relief packages',
    'Education schemes',
    'Health schemes',
    'Agriculture schemes',
    'Kisan Card',
    'Apni Chhat',
    'Himmat Card'
  ],
  includeScamWarning: true,
  autoPublish: false, // Auto-Publish is OFF by default for safety
  manualApprovalRequired: true, // Manual approval is ON by default
  testMode: false // Test Mode toggle
};

// In-Memory store for warm serverless invocations
let memoryStore = {
  posts: [...DEFAULT_POSTS],
  research: [...DEFAULT_RESEARCH],
  settings: { ...DEFAULT_SETTINGS },
  logs: [
    {
      id: 'log-init',
      timestamp: new Date().toISOString(),
      action: 'System Initialized',
      target: 'SocialPilotPro Desk',
      details: 'Serverless storage mounted with official verification rules',
      status: 'SUCCESS'
    }
  ],
  fbConfig: {
    pageId: process.env.FB_PAGE_ID || '',
    pageName: process.env.FB_PAGE_NAME || 'Official GovUpdate Desk',
    pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN || '',
    appId: process.env.FB_APP_ID || '',
    connectedAt: process.env.FB_PAGE_ID ? new Date().toISOString() : ''
  }
};

// Check if Upstash/KV is available via REST
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await res.json();
    if (data && data.result) {
      return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    }
    return null;
  } catch (err) {
    console.error('KV get error:', err);
    return null;
  }
}

async function kvSet(key, value) {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const payload = JSON.stringify(value);
    await fetch(`${KV_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([key, payload])
    });
    return true;
  } catch (err) {
    console.error('KV set error:', err);
    return false;
  }
}

// Fallback to /tmp JSON file on serverless filesystem
const TMP_FILE = path.join('/tmp', 'socialpilot_db.json');

function readTmpFile() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // /tmp might not be accessible or empty
  }
  return null;
}

function writeTmpFile(data) {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {
    // ignore
  }
}

// Ensure state is loaded
async function ensureLoaded() {
  // Check KV
  if (KV_URL && KV_TOKEN) {
    const kvData = await kvGet('socialpilot_state');
    if (kvData) {
      memoryStore = { ...memoryStore, ...kvData };
      return;
    }
  }

  // Check /tmp file
  const tmpData = readTmpFile();
  if (tmpData) {
    memoryStore = { ...memoryStore, ...tmpData };
  }
}

async function persistState() {
  if (KV_URL && KV_TOKEN) {
    await kvSet('socialpilot_state', memoryStore);
  }
  writeTmpFile(memoryStore);
}

// Storage API Exports

export async function getPosts() {
  await ensureLoaded();
  return memoryStore.posts || [];
}

export async function getPostById(id) {
  await ensureLoaded();
  return (memoryStore.posts || []).find((p) => p.id === id);
}

export async function savePost(newPost) {
  await ensureLoaded();
  if (!memoryStore.posts) memoryStore.posts = [];
  const existingIdx = memoryStore.posts.findIndex((p) => p.id === newPost.id);
  if (existingIdx >= 0) {
    memoryStore.posts[existingIdx] = {
      ...memoryStore.posts[existingIdx],
      ...newPost,
      updatedTime: new Date().toISOString()
    };
  } else {
    memoryStore.posts.unshift({
      ...newPost,
      id: newPost.id || `post_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdTime: newPost.createdTime || new Date().toISOString(),
      updatedTime: new Date().toISOString()
    });
  }
  await persistState();
  return memoryStore.posts;
}

export async function deletePost(id) {
  await ensureLoaded();
  if (!memoryStore.posts) return [];
  memoryStore.posts = memoryStore.posts.filter((p) => p.id !== id);
  await persistState();
  return memoryStore.posts;
}

export async function getResearch() {
  await ensureLoaded();
  return memoryStore.research || DEFAULT_RESEARCH;
}

export async function saveResearch(item) {
  await ensureLoaded();
  if (!memoryStore.research) memoryStore.research = [...DEFAULT_RESEARCH];
  const newItem = {
    ...item,
    id: item.id || `res_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: item.time || 'Just now',
    pubDate: item.pubDate || new Date().toISOString().split('T')[0]
  };
  memoryStore.research.unshift(newItem);
  await persistState();
  return memoryStore.research;
}

export async function updateResearchStatus(id, newStatus) {
  await ensureLoaded();
  const item = (memoryStore.research || []).find((r) => r.id === id);
  if (item) {
    item.status = newStatus;
    await persistState();
  }
  return memoryStore.research;
}

export async function getSettings() {
  await ensureLoaded();
  return memoryStore.settings || DEFAULT_SETTINGS;
}

export async function saveSettings(settings) {
  await ensureLoaded();
  memoryStore.settings = { ...DEFAULT_SETTINGS, ...(memoryStore.settings || {}), ...settings };
  await persistState();
  return memoryStore.settings;
}

export async function getLogs() {
  await ensureLoaded();
  return memoryStore.logs || [];
}

export async function addLog(entry) {
  await ensureLoaded();
  if (!memoryStore.logs) memoryStore.logs = [];
  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  memoryStore.logs.unshift(log);
  if (memoryStore.logs.length > 100) memoryStore.logs = memoryStore.logs.slice(0, 100);
  await persistState();
  return log;
}

export async function getFacebookConfig() {
  await ensureLoaded();
  return (
    memoryStore.fbConfig || {
      pageId: process.env.FB_PAGE_ID || '',
      pageName: process.env.FB_PAGE_NAME || 'Official GovUpdate Desk',
      pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN || '',
      appId: process.env.FB_APP_ID || '',
      connectedAt: ''
    }
  );
}

export async function saveFacebookConfig(config) {
  await ensureLoaded();
  memoryStore.fbConfig = {
    ...(memoryStore.fbConfig || {}),
    ...config,
    connectedAt: new Date().toISOString()
  };
  await persistState();
  return {
    pageId: memoryStore.fbConfig.pageId,
    pageName: memoryStore.fbConfig.pageName,
    connectedAt: memoryStore.fbConfig.connectedAt
  };
}

// Server-side publish lock to ensure idempotency and duplicate prevention
const publishLocks = new Set();

export function acquirePublishLock(postId) {
  if (publishLocks.has(postId)) return false;
  publishLocks.add(postId);
  return true;
}

export function releasePublishLock(postId) {
  publishLocks.delete(postId);
}
