// api/generate-post.js
// Generates factual, anti-scam, Facebook-optimized posts for Pakistan government schemes
import { addLog } from './lib/storage.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  try {
    const {
      title,
      category,
      summary,
      facts = [],
      sourceName,
      sourceUrl,
      location,
      language = 'Urdu + Roman Urdu',
      beneficiaries,
      includeScamWarning = true
    } = req.body || {};

    if (!title || !summary) {
      return res.status(400).json({
        success: false,
        message: 'Research item title and summary are required to generate post.'
      });
    }

    const factsList = Array.isArray(facts) ? facts : [facts];
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    let generatedText = '';
    let generationSource = 'deterministic_factual_engine';

    // 1. Attempt generation via Google Gemini API if key is present in environment
    if (geminiKey) {
      try {
        const prompt = `You are the official editor for "SocialPilotPro — Pakistan Government Schemes Updates Desk".
Generate a factual, professional Facebook post based STRICTLY on the official facts provided below.

CRITICAL FACTUAL SAFETY RULES:
- NEVER invent payment amounts, dates, registration links, eligibility rules, or telephone numbers not explicitly provided.
- NEVER use clickbait ("100% CONFIRMED!", "SECRET CODE!", "GET MONEY NOW!").
- Keep tone objective, transparent, and authoritative.
- Include official source verification and scam alert against fake 11-digit SMS.

INPUT DATA:
- Title: ${title}
- Department / Scheme Category: ${category}
- Jurisdiction: ${location || 'Pakistan-wide'}
- Summary: ${summary}
- Verified Facts:
${factsList.map((f) => `  * ${f}`).join('\n')}
- Target Beneficiaries: ${beneficiaries || 'Eligible citizens'}
- Official Source: ${sourceName} (${sourceUrl || 'Official Portal'})
- Requested Language Format: ${language} (Urdu, Roman Urdu, English, or Urdu + Roman Urdu)
- Include Scam Advisory: ${includeScamWarning ? 'YES' : 'NO'}

Output ONLY the complete Facebook post copy. Do not include markdown code block quotes.`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const aiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2, // low temperature for strict adherence to facts
              maxOutputTokens: 1024
            }
          })
        });

        const aiData = await aiRes.json();
        if (
          aiData &&
          aiData.candidates &&
          aiData.candidates[0] &&
          aiData.candidates[0].content &&
          aiData.candidates[0].content.parts[0]
        ) {
          generatedText = aiData.candidates[0].content.parts[0].text.trim();
          generationSource = 'gemini-1.5-flash';
        }
      } catch (err) {
        console.warn('Gemini API call failed, falling back to deterministic template:', err);
      }
    }

    // 2. High-Quality Deterministic Factual Template Fallback
    if (!generatedText) {
      generatedText = buildDeterministicPost({
        title,
        category,
        summary,
        facts: factsList,
        sourceName,
        sourceUrl,
        location,
        language,
        beneficiaries,
        includeScamWarning
      });
      generationSource = 'deterministic_factual_engine';
    }

    await addLog({
      action: 'AI Post Generated',
      target: title,
      details: `Generated via ${generationSource} in language: ${language}`,
      status: 'SUCCESS'
    });

    return res.status(200).json({
      success: true,
      postText: generatedText,
      engine: generationSource
    });
  } catch (error) {
    console.error('Error generating post:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate post draft.',
      error: error.message
    });
  }
}

function buildDeterministicPost({
  title,
  category,
  summary,
  facts,
  sourceName,
  sourceUrl,
  location,
  language,
  beneficiaries,
  includeScamWarning
}) {
  const isUrduOnly = language === 'Urdu';
  const isEnglish = language === 'English';

  const factsBullet = facts.map((f) => `✓ ${f}`).join('\n');
  const sourceRef = `${sourceName || 'حکومتی پورٹل'} ${sourceUrl ? `(${sourceUrl})` : ''}`;

  if (isEnglish) {
    return `📢 OFFICIAL GOVERNMENT ANNOUNCEMENT / PUBLIC ADVISORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Topic: ${title}
📍 Scope: ${location || 'Pakistan-wide'} | Category: ${category}

Summary:
${summary}

Important Verified Facts:
${factsBullet}

👥 Eligible Citizens:
${beneficiaries || 'Individuals and families meeting official criteria in the National Socio-Economic Registry (NSER).'}

📌 What You Should Do:
1. Always confirm your status only through official government portals or designated Tehsil offices.
2. Official survey registration is completely free of charge. Never pay any fee or commission to any unauthorized agent.
3. Original CNIC must be presented during official verification.

${includeScamWarning ? `⚠️ Fraud & Scam Advisory:
Beware of fraudulent SMS from ordinary 11-digit mobile numbers or unverified WhatsApp groups. Official government notifications are only dispatched through authorized government codes such as "8171".` : ''}

🔗 Verified Source:
${sourceRef}

#PakistanSchemes #BISP #PunjabGovernment #PublicRelief #OfficialUpdate #FactualInformation`;
  }

  if (isUrduOnly) {
    return `📢 اہم اور تصدیق شدہ سرکاری اعلامیہ / عوامی آگاہی
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 موضوع: ${title}
📍 دائرہ کار: ${location || 'پاکستان بھر'} | کیٹیگری: ${category}

اردو تفصیل:
${summary}

اہم اور تصدیق شدہ نکات:
${factsBullet}

👥 کون مستفید ہو سکتا ہے؟
${beneficiaries || 'وہ تمام شہری اور مستحق خاندان جو متعلقہ سرکاری پروگرام کے مصدقہ معیار پر پورا اترتے ہیں۔'}

📌 ضروری ہدایات:
۱۔ کسی بھی حکومتی سکیم یا رقم کی تصدیق صرف آفیشل ویب پورٹل یا متعلقہ سرکاری تحصیل دفتر سے کریں۔
۲۔ رجسٹریشن اور سروے کا عمل بالکل مفت ہے۔ کسی نمائندے یا ایجنٹ کو کوئی فیس یا کٹوتی نہ دیں۔
۳۔ تصدیق کے وقت اصل قومی شناختی کارڈ ہمراہ رکھیں۔

${includeScamWarning ? `⚠️ فراڈ اور دھوکہ دہی سے ہوشیار رہیں:
کسی بھی ذاتی 11 ہندسی موبائل نمبر یا واٹس ایپ میسج پر یقین نہ کریں۔ حکومت کا واحد آفیشل ایس ایم ایس صرف "8171" یا سرکاری ہیلپ لائن سے آتا ہے۔` : ''}

🔗 مستند سرکاری ذریعہ:
${sourceRef}

#حکومتی_ریلیف #عوامی_آگاہی #بینظیر_انکم_سپورٹ #پنجاب_حکومت #تصدیق_شدہ`;
  }

  // Default: Urdu + Roman Urdu (Highest engagement across Pakistan)
  return `📢 اہم اور تصدیق شدہ حکومتی اپڈیٹ / Official Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 موضوع / Topic: ${title}
📍 علاقہ: ${location || 'پاکستان بھر'} | ادارہ: ${category}

اردو تفصیل:
${summary}

Roman Urdu Khulasa:
Tamam shehrion ko aagah kiya jata hai ke official notification jari kar diya gaya hai. Kisi bhi ghair tasdeeq shuda afwah par yaqeen na karein.

اہم اور تصدیق شدہ معلومات / Key Facts:
${factsBullet}

👥 کون مستفید ہو سکتا ہے؟ / Who Is Eligible:
${beneficiaries || 'Mustahiq shehri jo mutaliqa government criteria ya BISP / Punjab Registry par verified hain.'}

📌 شہری کیا کریں؟ / What You Should Do:
1. Apni maloomat ki tasdeeq sirf official portal ya qareebi Tehsil Registration Desk se karein.
2. Asal CNIC hamesha sath rakhein.
3. Registration ya survey ki koi fees nahi hai, kisi middleman ya agent ko paise na dein.

${includeScamWarning ? `⚠️ فراڈ سے ہوشیار رہیں / Scam Warning:
BISP ya kisi bhi sarkari scheme ka message kisi aam 11-digit mobile number se nahi aata. Sirf "8171" se anay walay message par yaqeen karein.` : ''}

🔗 مستند سرکاری ذریعہ / Verified Source:
${sourceRef}

#BISP #8171Update #PunjabGovt #PakistanSchemes #SocialProtection #PublicAwareness`;
}
