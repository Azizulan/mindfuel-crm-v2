// Tier — In-call Bengali script generator.
//
// Picks the right script for a customer based on the CRM signals already on
// their queue card (RFM segment, last sentiment, reorder status) and fills in
// their name, last product, and the recommended upsell. Pure function, no deps
// — used by CallScriptPanel on both the Call Queue and Win-Back pages.

export interface ScriptInput {
  name: string;
  rfmSegment?: string | null;
  lastSentiment?: string | null;
  reorderStatus?: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null;
  recommendedProduct?: string | null;
  lastProduct?: string | null;
  bestCallSummary?: string | null;
  predictedReorderDays?: number | null;
}

export interface ScriptLine {
  label: string;   // Bengali step label
  text: string;    // Bengali script line, fully personalised
}

export interface CallScript {
  scenarioKey: string;
  scenario: string;    // Bengali scenario name
  accent: string;      // tailwind color hint for the panel header
  tone: string;        // Bengali one-line tone guidance
  lines: ScriptLine[];
  objections: { q: string; a: string }[];
}

const firstNameOf = (full: string) => (full || '').trim().split(/\s+/)[0] || 'গ্রাহক';

// Standard objection-handling block (shared across scenarios).
const OBJECTIONS: { q: string; a: string }[] = [
  { q: 'দাম বেশি', a: 'এক প্যাক অনেকদিন চলে — হিসাব করলে দিনে খুব সামান্য খরচ। কম্বো নিলে আরও সাশ্রয় হয়।' },
  { q: 'এখনো আছে', a: 'ভালো! তাহলে কবে শেষ হবে বলুন — ওই সময়ের জন্য এখনই বুক করে রাখি, ডেলিভারি রেডি থাকবে।' },
  { q: 'পরে অর্ডার দিবো', a: 'অবশ্যই — কোন তারিখে দরকার হবে? ওই দিন অগ্রাধিকার দিয়ে রেডি রাখবো।' },
  { q: 'অন্য জায়গা থেকে নিয়েছি', a: 'বুঝলাম। আমাদেরটা একবার ট্রাই করবেন? এই অর্ডারে আপনার জন্য একটা ছাড় রাখছি।' },
  { q: 'WhatsApp-এ পাঠান', a: 'অবশ্যই পাঠাচ্ছি — সাথে একটা প্যাক আপনার জন্য রেডি রাখছি, কনফার্ম করলেই পাঠিয়ে দেবো।' },
  { q: 'আগ্রহী না', a: 'কোনো সমস্যা নেই ভাই/আপা। যখন দরকার হবে আমরা তো আছিই। ভালো থাকবেন।' },
];

export function buildCallScript(input: ScriptInput, agentName: string): CallScript {
  const name = firstNameOf(input.name);
  const agent = (agentName || '').trim().split(/\s+/)[0] || 'MINDFUEL';
  const productPhrase = input.lastProduct ? `আপনার ${input.lastProduct}` : 'আপনার আগের অর্ডারটা';
  const rec = input.recommendedProduct;

  // Upsell sentence, only when we have a recommendation.
  const upsell = rec
    ? ` সাথে আমাদের অনেক নিয়মিত গ্রাহক এখন ${rec}-ও নিচ্ছেন — দুইটা একসাথে দিয়ে দিই?`
    : '';

  const greet = `আসসালামু আলাইকুম ${name} ভাই/আপা! MINDFUEL থেকে ${agent} বলছি।`;
  const lockClose = 'ঠিকানা আগেরটাই আছে তো? ক্যাশ অন ডেলিভারি — কনফার্ম করে দিলাম, দ্রুত পাঠিয়ে দিচ্ছি।';

  // ── Scenario selection (priority order) ──
  const seg = input.rfmSegment;
  const isChurn = seg === "Can't Lose" || seg === 'At Risk' || input.reorderStatus === 'churn-risk';

  // 1. Win-back (highest priority — most value at stake)
  if (isChurn) {
    return {
      scenarioKey: 'winback',
      scenario: 'উইন-ব্যাক — মূল্যবান গ্রাহক ফিরিয়ে আনুন',
      accent: 'red',
      tone: 'আন্তরিক ও ব্যক্তিগত। কোনো চাপ নয় — আগে কারণ জানুন, তারপর অফার দিন।',
      lines: [
        { label: 'ওপেনিং', text: `আসসালামু আলাইকুম ${name} ভাই/আপা, MINDFUEL থেকে ${agent} বলছি। অনেক দিন আপনার সাথে কথা হয় না — ভালো আছেন তো?` },
        { label: 'কারণ (শুনুন)', text: 'আপনি আমাদের অনেক পুরোনো ও মূল্যবান গ্রাহক, তাই ব্যক্তিগতভাবে খোঁজ নিচ্ছি। প্রোডাক্টে কি কোনো সমস্যা হয়েছিল, নাকি একটু ব্যস্ত ছিলেন? — (এখানে থামুন, ওনাকে বলতে দিন)' },
        { label: 'অফার', text: `আপনার মতো গ্রাহকের জন্য এই অর্ডারে একটা বিশেষ ব্যবস্থা রেখেছি।${rec ? ` অনেকেই এখন ${rec} নিচ্ছেন।` : ''} ${productPhrase} আবার পাঠিয়ে দিই?` },
        { label: 'ক্লোজিং', text: 'আমি আজকেই রেডি করে দিচ্ছি, দ্রুত ডেলিভারি — ঠিক আছে?' },
      ],
      objections: OBJECTIONS,
    };
  }

  // 2. Honor a scheduled callback
  if (input.lastSentiment === 'Call Back Later') {
    return {
      scenarioKey: 'callback',
      scenario: 'কলব্যাক — কথা রেখে শুরু করুন',
      accent: 'blue',
      tone: 'যেহেতু উনি এই সময়ে কল করতে বলেছিলেন, সেটা স্বীকার করেই শুরু করুন — বিশ্বাস তৈরি হয়।',
      lines: [
        { label: 'ওপেনিং', text: `${greet} আপনি এই সময়ে কল করতে বলেছিলেন, তাই ফোন দিলাম।` },
        { label: 'কারণ', text: `আগের কথা অনুযায়ী ${productPhrase}-এর ব্যাপারে জানতে চাইছিলাম।` },
        { label: 'অফার', text: `এখন রেডি করে দিই?${upsell}` },
        { label: 'ক্লোজিং', text: lockClose },
      ],
      objections: OBJECTIONS,
    };
  }

  // 3. New customer — satisfaction, not a second sale
  if (seg === 'New') {
    return {
      scenarioKey: 'new',
      scenario: 'নতুন গ্রাহক — সন্তুষ্টি নিশ্চিত করুন',
      accent: 'teal',
      tone: 'কৃতজ্ঞ ও আশ্বস্তকারী। এখনই ২য় বিক্রির চাপ দেবেন না — পরের অর্ডারের বীজ বপন করুন।',
      lines: [
        { label: 'ওপেনিং', text: `${greet} আপনার প্রথম অর্ডারটা পেয়েছেন তো? সবকিছু ঠিকঠাক ছিল?` },
        { label: 'ভ্যালু', text: 'একটা পরামর্শ — ভালো ফল পেতে নিয়মিত ব্যবহার করবেন। সাধারণত কিছুদিনের মধ্যে এক প্যাক শেষ হয়।' },
        { label: 'বীজ বপন', text: 'শেষ হওয়ার আগে জানাবেন, আমি অগ্রাধিকার দিয়ে রেডি করে দেবো। আপনাকে আমাদের নিয়মিত গ্রাহক তালিকায় রাখলাম।' },
        { label: 'ক্লোজিং', text: 'কোনো প্রশ্ন থাকলে এই নাম্বারে জানাবেন। ভালো থাকবেন!' },
      ],
      objections: OBJECTIONS,
    };
  }

  // 4. Ripe reorder — in their personal window
  if (input.reorderStatus === 'ripe') {
    return {
      scenarioKey: 'ripe',
      scenario: 'রিপ — রিঅর্ডারের উপযুক্ত সময়',
      accent: 'emerald',
      tone: 'পরিচিত, আত্মবিশ্বাসী, দ্রুত। উনি আপনাকে চেনেন — সরাসরি অফারে যান।',
      lines: [
        { label: 'ওপেনিং', text: `${greet} ${productPhrase} তো এই সময়ের মধ্যে প্রায় শেষ হওয়ার কথা, তাই একটু খোঁজ নিলাম।` },
        { label: 'কারণ', text: 'আপনি যাতে কখনো প্রোডাক্ট ছাড়া না থাকেন, সেজন্যই আগেভাগে জানাচ্ছি।' },
        { label: 'অফার', text: `আগেরটার মতো একটা রেডি করে দিই?${upsell}` },
        { label: 'ক্লোজিং', text: lockClose },
      ],
      objections: OBJECTIONS,
    };
  }

  // 5. Overdue — past their cycle but not yet churn
  if (input.reorderStatus === 'overdue') {
    return {
      scenarioKey: 'overdue',
      scenario: 'ওভারডিউ — সময় পেরিয়ে যাচ্ছে',
      accent: 'amber',
      tone: 'নরম, যত্নশীল। "শেষ হয়ে গেছে কিনা" — এই অ্যাঙ্গেলে হালকা তাগিদ দিন।',
      lines: [
        { label: 'ওপেনিং', text: `${greet} ${productPhrase} তো মনে হয় শেষ হয়ে গেছে — ঠিক বললাম?` },
        { label: 'কারণ', text: 'অনেকে ব্যস্ততায় রিঅর্ডার করতে ভুলে যান, তাই মনে করিয়ে দিতে ফোন দিলাম।' },
        { label: 'অফার', text: `আগেরটা আবার পাঠিয়ে দিই?${upsell}` },
        { label: 'ক্লোজিং', text: 'আজকেই রেডি করে দিচ্ছি, দ্রুত ডেলিভারি — ঠিক আছে?' },
      ],
      objections: OBJECTIONS,
    };
  }

  // 6. Potential Loyalist — nudge to the next order
  if (seg === 'Potential Loyalist') {
    return {
      scenarioKey: 'potential',
      scenario: 'সম্ভাবনাময় — নিয়মিত গ্রাহক বানান',
      accent: 'sky',
      tone: 'উৎসাহব্যঞ্জক। ছোট একটা ইনসেনটিভ দিয়ে অভ্যাসটা পাকা করুন।',
      lines: [
        { label: 'ওপেনিং', text: `${greet} আগের ${productPhrase} কেমন লাগলো?` },
        { label: 'কারণ', text: 'আমাদের অনেক গ্রাহক ২য়-৩য় অর্ডারের পর নিয়মিত হয়ে যান।' },
        { label: 'অফার', text: rec ? `এইবার অর্ডার করলে ${rec}-টাও কম্বোতে দিয়ে দিই, আর আপনাকে নিয়মিত গ্রাহক রেটে রাখবো।` : 'এইবার অর্ডার করলে আপনাকে নিয়মিত গ্রাহক রেটে রাখবো।' },
        { label: 'ক্লোজিং', text: 'একটা প্যাক রেডি করে দিই?' },
      ],
      objections: OBJECTIONS,
    };
  }

  // 7. Hibernating / Lost — light, single-shot recapture
  if (seg === 'Hibernating' || seg === 'Lost') {
    return {
      scenarioKey: 'recapture',
      scenario: 'পুনরুদ্ধার — হালকা একটা চেষ্টা',
      accent: 'gray',
      tone: 'হালকা ও সংক্ষিপ্ত। একবারই অফার দিন — না বললে সম্মানের সাথে শেষ করুন।',
      lines: [
        { label: 'ওপেনিং', text: `আসসালামু আলাইকুম ${name} ভাই/আপা, অনেক দিন পর — MINDFUEL থেকে ${agent} বলছি।` },
        { label: 'অফার', text: `এখন নতুন ${rec || 'অফার'} এসেছে। ট্রাই করতে চাইলে আজকে একটা স্পেশাল প্রাইসে পাঠাই?` },
        { label: 'ক্লোজিং', text: 'পাঠিয়ে দিই?' },
      ],
      objections: OBJECTIONS,
    };
  }

  // 8. Champion / Loyal (default warm reorder)
  if (seg === 'Champion' || seg === 'Loyal') {
    return {
      scenarioKey: 'warm',
      scenario: 'নিয়মিত গ্রাহক — উষ্ণ রিঅর্ডার',
      accent: 'violet',
      tone: 'পরিচিত ও উষ্ণ। আত্মবিশ্বাসের সাথে আপসেল করুন — উনি আপনাকে বিশ্বাস করেন।',
      lines: [
        { label: 'ওপেনিং', text: `${greet} কেমন আছেন? ${productPhrase} নিয়ে একটু খোঁজ নিতে ফোন দিলাম।` },
        { label: 'অফার', text: `আগেরটার মতো একটা রেডি করে দিই?${upsell}` },
        { label: 'ক্লোজিং', text: lockClose },
      ],
      objections: OBJECTIONS,
    };
  }

  // 9. Generic fallback
  return {
    scenarioKey: 'generic',
    scenario: 'সাধারণ রিঅর্ডার কল',
    accent: 'gray',
    tone: 'উষ্ণ ও সহায়ক। নাম ধরে শুরু করুন, এক লাইনে কারণ বলুন।',
    lines: [
      { label: 'ওপেনিং', text: `${greet}` },
      { label: 'অফার', text: `${productPhrase} আবার লাগবে কিনা জানতে ফোন দিলাম — রেডি করে দিই?${upsell}` },
      { label: 'ক্লোজিং', text: lockClose },
    ],
    objections: OBJECTIONS,
  };
}
