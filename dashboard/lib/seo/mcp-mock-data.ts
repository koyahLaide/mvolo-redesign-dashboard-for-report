export type RemediationType =
  | 'kb_new'
  | 'kb_update'
  | 'kb_fix_urgent'
  | 'content_new'
  | 'product_data_gap'
  | 'product_data_critical';

export type Priority = 'Critical' | 'High' | 'Medium';
export type QueueStatus = 'Pending' | 'Approved' | 'Published' | 'Rejected';
export type FaqScore = 'Pass' | 'Partial' | 'Fail';
export type RunType = 'FAQ' | 'Catalog';
export type TriggerType = 'Cron' | 'Manual';

export interface RemediationItem {
  id: string;
  date: string;
  type: RemediationType;
  priority: Priority;
  question: string;
  contentSnippet: string;
  fullContent: string;
  destination: 'Knowledge Base' | 'Blog' | 'Shopify Admin';
  status: QueueStatus;
  currentResponse?: string;
  generatedImprovement?: string;
  blogOutline?: {
    title: string;
    sections: { h2: string; summary: string }[];
    faqSummary: string;
  };
  missingFields?: string[];
  suggestedFix?: string;
}

export interface CheckHistoryRun {
  id: string;
  date: string;
  type: RunType;
  totalChecks: number;
  pass: number;
  partial: number;
  fail: number;
  passRate: number;
  delta: number | null;
  triggeredBy: TriggerType;
}

export interface FaqQuestion {
  id: string;
  question: string;
  score: FaqScore;
  prevScore: FaqScore | null;
  mcpResponseSnippet: string;
  mcpResponseFull: string;
  expectedAnswerFull: string;
  missingInfo: string | null;
  remediationStatus: 'In Queue' | 'Published' | 'N/A';
}

export const REMEDIATION_QUEUE: RemediationItem[] = [
  {
    id: '1',
    date: 'Jun 7, 2026',
    type: 'kb_new',
    priority: 'High',
    question: 'Do you ship to Germany?',
    contentSnippet: 'Mvolo currently ships to the Netherlands and Belgium only...',
    fullContent: 'Mvolo currently ships to the Netherlands and Belgium only. We are actively exploring expansion to Germany and other EU countries, expected to launch in Q3 2026. Sign up for our newsletter to be notified when shipping to your country becomes available.',
    destination: 'Knowledge Base',
    status: 'Pending',
    currentResponse: 'No answer was found in the Mvolo knowledge base for this question.',
    generatedImprovement: 'Mvolo currently ships to the Netherlands and Belgium only. We are actively exploring expansion to Germany and other EU countries, expected to launch in Q3 2026. Sign up for our newsletter to be notified when shipping to your country becomes available.',
  },
  {
    id: '2',
    date: 'Jun 7, 2026',
    type: 'kb_update',
    priority: 'Medium',
    question: 'What is the warranty period?',
    contentSnippet: 'All Mvolo products come with a minimum 2-year warranty covering manufacturing defects...',
    fullContent: 'All Mvolo products come with a minimum 2-year warranty covering manufacturing defects. The premium Elite and Platinum lines include an extended 3-year warranty. Warranty claims can be initiated via our support portal at support.mvolo.nl.',
    destination: 'Knowledge Base',
    status: 'Pending',
    currentResponse: 'Mvolo products come with a standard warranty. Please contact support for details.',
    generatedImprovement: 'All Mvolo products come with a minimum 2-year warranty covering manufacturing defects. The premium Elite and Platinum lines include an extended 3-year warranty. Warranty claims can be initiated via our support portal at support.mvolo.nl.',
  },
  {
    id: '3',
    date: 'Jun 7, 2026',
    type: 'product_data_gap',
    priority: 'High',
    question: 'Mvolo Elite 300 Panel',
    contentSnippet: 'Missing: description, variant distinguishing attributes...',
    fullContent: 'Product page is missing a full description, variant distinguishing attributes (wavelength per variant), and comparison copy vs Elite 150.',
    destination: 'Shopify Admin',
    status: 'Pending',
    missingFields: ['Product description (>150 words)', 'Variant attribute: wavelength', 'Comparison: Elite 150 vs Elite 300', 'Alt text on 3 product images'],
    suggestedFix: 'Add a 200-word description covering the 300W output, dual-wavelength (660nm + 850nm), and recommended treatment areas. Tag wavelength per variant. Add a comparison table in the product body.',
  },
  {
    id: '4',
    date: 'Jun 1, 2026',
    type: 'content_new',
    priority: 'Medium',
    question: 'How does red light therapy work for psoriasis?',
    contentSnippet: 'Blog outline: Red light therapy and psoriasis research...',
    fullContent: 'Full blog post exploring red light therapy and psoriasis based on peer-reviewed research.',
    destination: 'Blog',
    status: 'Approved',
    blogOutline: {
      title: 'Red Light Therapy for Psoriasis: What the Research Says',
      sections: [
        { h2: 'What is psoriasis and why is it so hard to treat?', summary: 'Overview of psoriasis as an autoimmune skin condition, prevalence in NL, conventional treatment limitations.' },
        { h2: 'How red light therapy reduces inflammation', summary: 'Mechanism: photobiomodulation activates mitochondria, reduces pro-inflammatory cytokines (IL-6, TNF-alpha).' },
        { h2: 'Clinical evidence: what studies show', summary: 'Review of 3 clinical trials (2019–2024) showing 30–60% PASI score reduction after 8 weeks of 3x/week 660nm + 850nm treatment.' },
        { h2: 'Which Mvolo products are suitable?', summary: 'Elite 300 Panel (full body), LED Face Mask (face/scalp). Protocol: 10 min, 15 cm distance, 3x/week.' },
        { h2: 'Safety, contraindications and what to expect', summary: 'Generally safe, avoid photosensitising medications. Improvement timeline: 4–8 weeks. Manage expectations.' },
      ],
      faqSummary: 'Q: Can red light therapy cure psoriasis? A: It does not cure psoriasis but clinical evidence supports significant symptom reduction in many patients. Results vary by individual and severity.',
    },
  },
  {
    id: '5',
    date: 'Jun 1, 2026',
    type: 'kb_new',
    priority: 'High',
    question: 'Do you offer free shipping?',
    contentSnippet: 'Yes, Mvolo offers free shipping on all orders within NL and BE...',
    fullContent: 'Yes, Mvolo offers free shipping on all orders within the Netherlands and Belgium. Orders placed before 22:00 are dispatched the same day and typically arrive next business day via PostNL.',
    destination: 'Knowledge Base',
    status: 'Published',
    currentResponse: 'No answer found for shipping costs in the knowledge base.',
    generatedImprovement: 'Yes, Mvolo offers free shipping on all orders within the Netherlands and Belgium. Orders placed before 22:00 are dispatched the same day and typically arrive next business day via PostNL.',
  },
  {
    id: '6',
    date: 'May 25, 2026',
    type: 'kb_fix_urgent',
    priority: 'Critical',
    question: 'What is your return policy?',
    contentSnippet: 'Mvolo offers a 90-day return policy on all products...',
    fullContent: 'Mvolo offers a 90-day return policy on all products. Items must be in original condition and packaging. Initiate returns via support.mvolo.nl/returns. Refunds are processed within 5 business days of receiving the returned item.',
    destination: 'Knowledge Base',
    status: 'Approved',
    currentResponse: 'Returns are accepted within 30 days. Contact support to initiate a return.',
    generatedImprovement: 'Mvolo offers a 90-day return policy on all products. Items must be in original condition and packaging. Initiate returns via support.mvolo.nl/returns. Refunds are processed within 5 business days of receiving the returned item.',
  },
  {
    id: '7',
    date: 'May 25, 2026',
    type: 'product_data_critical',
    priority: 'Critical',
    question: 'Mvolo RLT Cap',
    contentSnippet: 'Product not found via catalog search. Investigate visibility...',
    fullContent: 'The Mvolo RLT Cap (SKU: RLT-CAP-001) returns zero results in MCP catalog queries. The product exists in Shopify but may be hidden from the storefront API or missing required tags.',
    destination: 'Shopify Admin',
    status: 'Pending',
    missingFields: ['Storefront API visibility', 'Product type tag: rlt-device', 'Description (completely missing)', 'Product images (0 uploaded)'],
    suggestedFix: 'Check that the product is set to "Available on Online Store" in Shopify Admin. Add at least one product image, a full description, and the rlt-device category tag so it appears in MCP catalog responses.',
  },
  {
    id: '8',
    date: 'May 25, 2026',
    type: 'content_new',
    priority: 'Medium',
    question: 'What wavelength is best for pain relief?',
    contentSnippet: 'Blog outline: Best wavelengths for pain relief...',
    fullContent: 'Blog post covering the science of optimal wavelengths for pain relief applications.',
    destination: 'Blog',
    status: 'Rejected',
    blogOutline: {
      title: 'Best Wavelengths for Pain Relief: 660nm vs 850nm vs 1072nm',
      sections: [
        { h2: 'Why wavelength matters in light therapy', summary: 'Tissue penetration depth by wavelength. 660nm=surface, 850nm=deep tissue, 1072nm=bone/joint.' },
        { h2: '660nm red light: surface and skin', summary: 'Best for wound healing, skin inflammation, muscle surface tension.' },
        { h2: '850nm near-infrared: deep muscle and joint', summary: 'Most researched for musculoskeletal pain, arthritis, post-workout recovery.' },
        { h2: '1072nm infrared: bone and nerve pain', summary: "Mvolo's unique 1072nm output for deep joint pain and nerve-related discomfort." },
        { h2: 'Choosing the right Mvolo product for your pain', summary: 'Product selector: Elite Panel for full-body, Infrared Double Head for targeted areas, Knee/Joint Wrap for specific joints.' },
      ],
      faqSummary: 'Q: Which wavelength does Mvolo use? A: Mvolo products use 660nm, 850nm, and 1072nm wavelengths depending on the product line.',
    },
  },
  {
    id: '9',
    date: 'May 18, 2026',
    type: 'kb_update',
    priority: 'Medium',
    question: 'Which payment methods do you accept?',
    contentSnippet: 'Mvolo accepts iDEAL, Bancontact, credit card, Klarna, PayPal, Apple Pay...',
    fullContent: 'Mvolo accepts iDEAL, Bancontact, Visa/Mastercard credit card, Klarna (pay later), PayPal, Apple Pay, and Google Pay. All transactions are secured via SSL encryption.',
    destination: 'Knowledge Base',
    status: 'Published',
    currentResponse: 'Mvolo accepts iDEAL and credit cards.',
    generatedImprovement: 'Mvolo accepts iDEAL, Bancontact, Visa/Mastercard credit card, Klarna (pay later), PayPal, Apple Pay, and Google Pay. All transactions are secured via SSL encryption.',
  },
  {
    id: '10',
    date: 'May 18, 2026',
    type: 'kb_new',
    priority: 'High',
    question: 'Is the LED Face Mask wireless?',
    contentSnippet: 'Yes, the Mvolo LED Face Mask is completely wireless...',
    fullContent: 'Yes, the Mvolo LED Face Mask is completely wireless and charges via USB-C. Battery life is approximately 45 minutes per charge, which is sufficient for multiple treatment sessions. The mask includes a charging cable and travel case.',
    destination: 'Knowledge Base',
    status: 'Published',
    currentResponse: 'No specific answer found about the LED Face Mask connectivity.',
    generatedImprovement: 'Yes, the Mvolo LED Face Mask is completely wireless and charges via USB-C. Battery life is approximately 45 minutes per charge, sufficient for multiple treatment sessions. The mask includes a charging cable and travel case.',
  },
  {
    id: '11',
    date: 'May 11, 2026',
    type: 'product_data_gap',
    priority: 'Medium',
    question: 'Recovery accessories',
    contentSnippet: 'Missing: descriptions for 3 accessory variants...',
    fullContent: 'Three recovery accessory variants are missing product descriptions: Eye Protect Goggles, Therapy Timer, and USB Extension Cable.',
    destination: 'Shopify Admin',
    status: 'Published',
    missingFields: ['Description: Eye Protect Goggles', 'Description: Therapy Timer', 'Description: USB Extension Cable'],
    suggestedFix: 'Add 80–120 word descriptions for each accessory focusing on compatibility with Mvolo devices and safety benefits.',
  },
  {
    id: '12',
    date: 'May 11, 2026',
    type: 'content_new',
    priority: 'Medium',
    question: 'Can I use red light therapy every day?',
    contentSnippet: 'Blog outline: Daily red light therapy usage guide...',
    fullContent: 'A practical guide for daily red light therapy usage, safety, and protocol.',
    destination: 'Blog',
    status: 'Pending',
    blogOutline: {
      title: 'Can You Use Red Light Therapy Every Day? The Complete Usage Guide',
      sections: [
        { h2: 'Is daily red light therapy safe?', summary: 'Research consensus: yes, daily use is safe for most people. No UV, no heat damage.' },
        { h2: 'Recommended session frequency by goal', summary: 'Pain relief: daily. Skin rejuvenation: 3–5x/week. Recovery: post-workout every session.' },
        { h2: 'How long should each session be?', summary: '10–20 minutes per area at 15–20 cm distance. Diminishing returns beyond 20 min.' },
        { h2: 'Signs you\'re overdoing it', summary: 'Mild redness, fatigue. Rare. If occurs, reduce to every other day and reduce session length.' },
        { h2: 'Building a sustainable daily routine', summary: 'Morning routine suggestion: 10 min face mask during coffee. Evening: 15 min panel post-shower.' },
      ],
      faqSummary: 'Q: How often should I use my Mvolo device? A: Daily use is safe and recommended for most goals. Start with 10-minute sessions and build up based on your response.',
    },
  },
];

export const CHECK_HISTORY: CheckHistoryRun[] = [
  { id: 'h1', date: 'Jun 8, 2026',  type: 'FAQ',     totalChecks: 79, pass: 62, partial: 12, fail: 5,  passRate: 78.5, delta: 5.1,   triggeredBy: 'Cron'   },
  { id: 'h2', date: 'Jun 8, 2026',  type: 'Catalog', totalChecks: 6,  pass: 5,  partial: 1,  fail: 0,  passRate: 83.3, delta: 16.7,  triggeredBy: 'Cron'   },
  { id: 'h3', date: 'Jun 1, 2026',  type: 'FAQ',     totalChecks: 79, pass: 57, partial: 14, fail: 8,  passRate: 72.2, delta: 3.8,   triggeredBy: 'Cron'   },
  { id: 'h4', date: 'Jun 1, 2026',  type: 'Catalog', totalChecks: 6,  pass: 4,  partial: 2,  fail: 0,  passRate: 66.7, delta: 0,     triggeredBy: 'Cron'   },
  { id: 'h5', date: 'May 25, 2026', type: 'FAQ',     totalChecks: 79, pass: 54, partial: 16, fail: 9,  passRate: 68.4, delta: 7.6,   triggeredBy: 'Cron'   },
  { id: 'h6', date: 'May 25, 2026', type: 'Catalog', totalChecks: 6,  pass: 4,  partial: 1,  fail: 1,  passRate: 66.7, delta: 16.7,  triggeredBy: 'Cron'   },
  { id: 'h7', date: 'May 18, 2026', type: 'FAQ',     totalChecks: 79, pass: 48, partial: 19, fail: 12, passRate: 60.8, delta: -2.5,  triggeredBy: 'Cron'   },
  { id: 'h8', date: 'May 18, 2026', type: 'Catalog', totalChecks: 6,  pass: 3,  partial: 2,  fail: 1,  passRate: 50.0, delta: 16.7,  triggeredBy: 'Manual' },
];

export const FAQ_QUESTIONS: FaqQuestion[] = [
  {
    id: 'f1',
    question: 'What is your return policy?',
    score: 'Pass',
    prevScore: 'Pass',
    mcpResponseSnippet: 'Mvolo offers a 90-day return policy on all products...',
    mcpResponseFull: 'Mvolo offers a 90-day return policy on all products. Items must be in original condition and packaging. Initiate returns via support.mvolo.nl/returns. Refunds are processed within 5 business days.',
    expectedAnswerFull: 'Should cover: 90-day window, original packaging required, return portal URL, refund timeline (5 business days).',
    missingInfo: null,
    remediationStatus: 'N/A',
  },
  {
    id: 'f2',
    question: 'Do you offer free shipping?',
    score: 'Pass',
    prevScore: 'Partial',
    mcpResponseSnippet: 'Yes, free shipping on all orders within NL and BE...',
    mcpResponseFull: 'Yes, Mvolo offers free shipping on all orders within the Netherlands and Belgium. Orders placed before 22:00 are dispatched the same day and typically arrive next business day via PostNL.',
    expectedAnswerFull: 'Should cover: free shipping for NL + BE, same-day dispatch before 22:00, next business day delivery via PostNL.',
    missingInfo: null,
    remediationStatus: 'Published',
  },
  {
    id: 'f3',
    question: 'What is the warranty period?',
    score: 'Partial',
    prevScore: 'Fail',
    mcpResponseSnippet: 'All products come with warranty coverage...',
    mcpResponseFull: 'All Mvolo products come with warranty coverage. Contact support for specific warranty terms for your product.',
    expectedAnswerFull: 'Should cover: 2-year minimum warranty, 3-year for Elite/Platinum, claims via support.mvolo.nl/returns.',
    missingInfo: 'Missing: 2-year minimum duration, Elite/Platinum 3-year extension, warranty claim URL',
    remediationStatus: 'In Queue',
  },
  {
    id: 'f4',
    question: 'Which payment methods do you accept?',
    score: 'Pass',
    prevScore: 'Pass',
    mcpResponseSnippet: 'iDEAL, Bancontact, Visa/Mastercard, Klarna, PayPal, Apple Pay...',
    mcpResponseFull: 'Mvolo accepts iDEAL, Bancontact, Visa/Mastercard credit card, Klarna (pay later), PayPal, Apple Pay, and Google Pay. All transactions are secured via SSL encryption.',
    expectedAnswerFull: 'Should list all payment methods including Klarna, all card types, and digital wallets.',
    missingInfo: null,
    remediationStatus: 'N/A',
  },
  {
    id: 'f5',
    question: 'How long does delivery take?',
    score: 'Pass',
    prevScore: 'Pass',
    mcpResponseSnippet: 'Next business day via PostNL for NL and BE...',
    mcpResponseFull: 'Orders placed before 22:00 are dispatched same day. Delivery within the Netherlands and Belgium takes 1 business day via PostNL. International shipping (when available) takes 3–7 business days.',
    expectedAnswerFull: 'Should cover NL/BE next-day, dispatch cutoff 22:00, international timeline.',
    missingInfo: null,
    remediationStatus: 'N/A',
  },
  {
    id: 'f6',
    question: 'Do you ship to Germany?',
    score: 'Fail',
    prevScore: 'Fail',
    mcpResponseSnippet: 'No answer found for international shipping...',
    mcpResponseFull: 'No answer found for this question in the Mvolo knowledge base.',
    expectedAnswerFull: 'Should state that Mvolo ships to NL and BE only, with note about Q3 2026 EU expansion.',
    missingInfo: 'No FAQ exists for international shipping destinations',
    remediationStatus: 'In Queue',
  },
  {
    id: 'f7',
    question: 'Is the LED Face Mask wireless?',
    score: 'Pass',
    prevScore: 'Fail',
    mcpResponseSnippet: 'Yes, completely wireless and charges via USB-C...',
    mcpResponseFull: 'Yes, the Mvolo LED Face Mask is completely wireless and charges via USB-C. Battery life is approximately 45 minutes per charge, sufficient for multiple treatment sessions.',
    expectedAnswerFull: 'Should confirm wireless, USB-C charging, ~45 min battery life, travel case included.',
    missingInfo: null,
    remediationStatus: 'Published',
  },
  {
    id: 'f8',
    question: 'What wavelengths do your panels use?',
    score: 'Partial',
    prevScore: 'Partial',
    mcpResponseSnippet: 'Panels use red and near-infrared light wavelengths...',
    mcpResponseFull: 'Mvolo panels use red and near-infrared light wavelengths for therapeutic benefits.',
    expectedAnswerFull: 'Should specify exact nm values: 660nm (red), 850nm (near-infrared), 1072nm (infrared, Elite/Platinum only).',
    missingInfo: 'Missing: specific nm values (660nm, 850nm, 1072nm) and which products use each',
    remediationStatus: 'In Queue',
  },
  {
    id: 'f9',
    question: 'Can I use red light therapy every day?',
    score: 'Partial',
    prevScore: null,
    mcpResponseSnippet: 'Red light therapy is generally safe for regular use...',
    mcpResponseFull: 'Red light therapy is generally safe for regular use. Most users can benefit from sessions several times per week.',
    expectedAnswerFull: 'Should cover: daily is safe, recommended 10–20 min sessions, diminishing returns beyond 20 min, specific protocol by goal.',
    missingInfo: 'Missing: specific usage guidelines (session length, distance), protocol by goal (pain vs skin), max session time',
    remediationStatus: 'In Queue',
  },
  {
    id: 'f10',
    question: 'Do you have a physical store?',
    score: 'Pass',
    prevScore: 'Pass',
    mcpResponseSnippet: 'Mvolo is an online-only brand with no physical store locations...',
    mcpResponseFull: 'Mvolo is an online-only brand with no physical store locations. All products are available exclusively at mvolo.nl and on Bol.com.',
    expectedAnswerFull: 'Should confirm online-only, mention mvolo.nl and Bol.com as purchase channels.',
    missingInfo: null,
    remediationStatus: 'N/A',
  },
  {
    id: 'f11',
    question: 'What is the 1072nm wavelength?',
    score: 'Fail',
    prevScore: null,
    mcpResponseSnippet: 'No answer found for this question...',
    mcpResponseFull: 'No answer found for this question in the Mvolo knowledge base or product catalog.',
    expectedAnswerFull: 'Should explain 1072nm infrared wavelength: deep tissue penetration, bone/joint applications, unique to Mvolo Elite/Platinum line.',
    missingInfo: 'No content exists explaining the 1072nm wavelength or its benefits',
    remediationStatus: 'In Queue',
  },
  {
    id: 'f12',
    question: 'Are your products CE certified?',
    score: 'Pass',
    prevScore: 'Pass',
    mcpResponseSnippet: 'Yes, all Mvolo products carry CE certification and comply with EU safety standards...',
    mcpResponseFull: 'Yes, all Mvolo products carry CE certification and comply with EU electromagnetic compatibility and safety directives. Certificates are available upon request via support.mvolo.nl.',
    expectedAnswerFull: 'Should confirm CE certification, EU compliance, and how to obtain certificates.',
    missingInfo: null,
    remediationStatus: 'N/A',
  },
  {
    id: 'f13',
    question: 'Can I use the panel for my back?',
    score: 'Partial',
    prevScore: 'Partial',
    mcpResponseSnippet: 'The panel can be used for various body areas including the back...',
    mcpResponseFull: 'The panel can be used for various body areas including the back. Position at the recommended distance for best results.',
    expectedAnswerFull: 'Should include: recommended distance (15–20 cm), session duration (10–15 min), positioning tips for back use, suggested products (Elite 300 or Infrared Double Head).',
    missingInfo: 'Missing: specific back treatment guidance, optimal distance (15–20 cm), session duration for back, product recommendation',
    remediationStatus: 'N/A',
  },
  {
    id: 'f14',
    question: 'What is the difference between Elite and Platinum?',
    score: 'Partial',
    prevScore: 'Fail',
    mcpResponseSnippet: 'Platinum is the premium line with advanced features compared to Elite...',
    mcpResponseFull: 'Platinum is the premium Mvolo line with more advanced features compared to the Elite range. Both use red and near-infrared wavelengths.',
    expectedAnswerFull: 'Should cover: Elite uses 660nm+850nm, Platinum adds 1072nm; Platinum has higher irradiance; Platinum includes advanced timer and memory settings.',
    missingInfo: 'Missing: specific wavelength differences (Platinum adds 1072nm), irradiance comparison, feature list differences',
    remediationStatus: 'In Queue',
  },
  {
    id: 'f15',
    question: 'Do you offer Klarna payment?',
    score: 'Pass',
    prevScore: 'Pass',
    mcpResponseSnippet: 'Yes, Klarna is accepted as a payment method at checkout...',
    mcpResponseFull: 'Yes, Klarna is accepted as a payment method at checkout on mvolo.nl. You can choose to pay in installments or defer payment by up to 30 days.',
    expectedAnswerFull: 'Should confirm Klarna availability, mention pay-later and installment options.',
    missingInfo: null,
    remediationStatus: 'N/A',
  },
];
