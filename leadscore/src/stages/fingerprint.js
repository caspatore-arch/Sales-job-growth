// Stage 3 — FINGERPRINT call-handling maturity.
// Combines Twilio Lookup line type with website automation signatures into a
// maturity_score (0-100). LOW maturity = no detected AI handling = HOT lead.
// ai_handling_detected flips true once maturity >= AI_HANDLING_THRESHOLD.

import {
  AI_HANDLING_THRESHOLD,
  AI_RECEPTIONIST_SIGNATURES,
  BOOKING_SIGNATURES,
  CHAT_SIGNATURES,
  MATURITY,
  SAAS_VOIP_CARRIERS,
} from '../../config/weights.js';
import { twilioLookup } from '../clients/twilio.js';
import { log } from '../lib/logger.js';

function anyMatch(haystack, needles) {
  return needles.some((n) => haystack.includes(n));
}

export async function fingerprint({ leads, dryRun, counters }) {
  for (const lead of leads) {
    const html = lead._html || '';

    // --- Website automation signatures ---
    const hasBooking = anyMatch(html, BOOKING_SIGNATURES);
    const hasChat = anyMatch(html, CHAT_SIGNATURES);
    const hasAiBrand = anyMatch(html, AI_RECEPTIONIST_SIGNATURES);
    lead._hasBooking = hasBooking;

    // --- Twilio line type on the main number ---
    let line = { line_type: null, carrier: null };
    if (lead.formatted_phone) {
      line = await twilioLookup(lead.formatted_phone, { dryRun });
    }
    lead.line_type = line.line_type;
    lead.carrier = line.carrier;

    const carrierLc = (line.carrier || '').toLowerCase();
    const isSaasVoip =
      line.line_type === 'voip' && anyMatch(carrierLc, SAAS_VOIP_CARRIERS);
    const isGenericVoip = line.line_type === 'voip' && !isSaasVoip;

    // --- Composite maturity score ---
    let score = 0;
    const reasons = [];
    if (isSaasVoip) {
      score += MATURITY.voipCarrier;
      reasons.push('voip-saas-carrier');
    } else if (isGenericVoip) {
      score += MATURITY.voipGeneric;
      reasons.push('voip-generic');
    }
    if (hasBooking) {
      score += MATURITY.onlineBooking;
      reasons.push('online-booking');
    }
    if (hasChat) {
      score += MATURITY.embeddedChat;
      reasons.push('embedded-chat');
    }
    if (hasAiBrand) {
      score += MATURITY.aiReceptionistBrand;
      reasons.push('ai-receptionist-brand');
    }

    lead.maturity_score = Math.min(100, score);
    lead.maturity_reasons = reasons;
    lead.ai_handling_detected = lead.maturity_score >= AI_HANDLING_THRESHOLD;

    counters.inc('fingerprinted');
    if (lead.ai_handling_detected) counters.inc('fingerprint.ai_detected');
  }

  log.info('fingerprint complete', {
    fingerprinted: counters.get('fingerprinted'),
    ai_detected: counters.get('fingerprint.ai_detected'),
  });
  return leads;
}
