// ---------------------------------------------------------------------------
// SCORING WEIGHTS — tune everything here.
//
// Two-part model, matching the plan:
//   1. MUST-HAVES  → hard filter. Fail any and the lead is dropped.
//   2. WEIGHTED SIGNALS → rank the survivors. lead_score is the weighted sum,
//      normalised to 0-100.
//
// maturity_score (0-100) is computed separately in the fingerprint stage:
//   LOW maturity = no detected AI/automation = HOT lead. A lead is dropped
//   when ai_handling_detected is true (maturity >= AI_HANDLING_THRESHOLD).
// ---------------------------------------------------------------------------

// --- Must-haves (hard filter) ---------------------------------------------
export const MUST_HAVES = {
  requireValidPhone: true,
  // At least one reachable channel: email OR any social profile URL.
  requireContactChannel: true,
  // Drop leads that already appear to run AI/automated call handling.
  dropIfAiHandling: true,
};

// A lead counts as "AI handling detected" when its maturity_score is at or
// above this threshold. Raise it to be more permissive (keep more leads).
export const AI_HANDLING_THRESHOLD = 60;

// --- Maturity signal weights (Stage 3) ------------------------------------
// Each contributes points toward maturity_score (higher = more automated =
// colder). Sum is clamped to 100.
export const MATURITY = {
  voipCarrier: 30, // VoIP line via a known receptionist/telephony SaaS
  voipGeneric: 15, // VoIP but unknown carrier
  onlineBooking: 25, // scheduling / booking widget on site
  embeddedChat: 15, // live-chat / chatbot widget
  aiReceptionistBrand: 40, // explicit "powered by / answered by <AI brand>"
  // Landline / basic mobile and a bare "call us" site contribute 0 (hot).
};

// --- Lead-score signal weights (Stage 4) ----------------------------------
// Each signal yields a 0..1 sub-score; lead_score = 100 * (Σ w·s) / (Σ w).
export const LEAD = {
  reviewCountBand: 30, // busy-but-not-enterprise sweet spot
  ratingReputation: 20, // >= 4.0 and they care about reputation
  hiringSignal: 15, // careers/jobs link mentioning front-office roles
  ownerNameFound: 15, // enables personalisation
  emailConfidence: 20, // Hunter.io confidence (or 1.0 for on-site email)
};

// Review-count sweet spot: full credit inside [min,max], tapering to 0 outside.
export const REVIEW_BAND = { min: 20, ideal: 120, max: 300, hardCeiling: 800 };

// Rating threshold for full reputation credit.
export const RATING_FLOOR = 4.0;

// Keywords that mark a front-office / receptionist hiring signal in page HTML.
export const HIRING_KEYWORDS = [
  'receptionist',
  'front office',
  'front desk',
  'office manager',
  'office assistant',
  'customer service rep',
  'scheduler',
  'dispatcher',
];

// Automation fingerprints searched for in fetched HTML (Stage 3).
export const BOOKING_SIGNATURES = [
  'calendly',
  'acuityscheduling',
  'housecallpro',
  'jobber',
  'servicetitan',
  'setmore',
  'squareup.com/appointments',
  'book now',
  'schedule online',
  'schedule service',
  'booking widget',
];

export const CHAT_SIGNATURES = [
  'intercom',
  'drift',
  'tawk.to',
  'livechat',
  'zendesk',
  'crisp.chat',
  'tidio',
  'gorgias',
];

// Known AI-receptionist / voice-agent brand strings. Presence => colder.
export const AI_RECEPTIONIST_SIGNATURES = [
  'goodcall',
  'smith.ai',
  'ruby receptionist',
  'answerconnect',
  'abby connect',
  'rosie',
  'slang.ai',
  'bland.ai',
  'air.ai',
  'synthflow',
  'retell',
  'vapi',
  'powered by ai',
  'answered by ai',
  'ai receptionist',
  'virtual receptionist',
  'ai answering',
];

// Carrier-name fragments that indicate receptionist/telephony SaaS VoIP.
export const SAAS_VOIP_CARRIERS = [
  'twilio',
  'bandwidth',
  'ringcentral',
  'vonage',
  'nextiva',
  'grasshopper',
  'openphone',
  'dialpad',
  'google voice',
  '8x8',
  'goto',
  'onvoy',
  'level 3',
  'peerless',
];
