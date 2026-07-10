// Stage 4 — SCORE & FILTER.
// Hard-drop leads missing a must-have, then rank survivors by a weighted
// lead_score (0-100). All weights live in config/weights.js.

import {
  AI_HANDLING_THRESHOLD,
  HIRING_KEYWORDS,
  LEAD,
  MUST_HAVES,
  RATING_FLOOR,
  REVIEW_BAND,
} from '../../config/weights.js';
import { log } from '../lib/logger.js';

function hasValidPhone(lead) {
  const digits = (lead.formatted_phone || '').replace(/\D/g, '');
  return digits.length >= 10;
}

function hasContactChannel(lead) {
  return Boolean(lead.email) || Boolean(lead.has_social);
}

// --- Sub-score helpers (each returns 0..1) ---
function reviewBandScore(count) {
  const { min, ideal, max, hardCeiling } = REVIEW_BAND;
  if (!count || count <= 0) return 0;
  if (count < min) return (count / min) * 0.5; // too quiet, partial credit
  if (count <= max) {
    // Peak at `ideal`, gently lower toward the band edges (0.8..1.0).
    const dist = Math.abs(count - ideal) / Math.max(ideal - min, max - ideal);
    return 1 - 0.2 * Math.min(1, dist);
  }
  if (count <= hardCeiling) {
    // Taper 1.0 -> 0 across (max, hardCeiling].
    return Math.max(0, 1 - (count - max) / (hardCeiling - max));
  }
  return 0; // enterprise-scale, out of sweet spot
}

function ratingScore(rating) {
  if (rating == null) return 0;
  if (rating >= RATING_FLOOR) {
    return 0.6 + 0.4 * Math.min(1, (rating - RATING_FLOOR) / (5 - RATING_FLOOR));
  }
  return Math.max(0, (rating / RATING_FLOOR) * 0.4);
}

function detectHiringSignal(lead) {
  const html = lead._html || '';
  if (!html) return false;
  // Require a careers/jobs context near a front-office keyword.
  const hasCareers = /(careers?|jobs?|hiring|join our team|we're hiring|were hiring)/i.test(
    html,
  );
  const hasRole = HIRING_KEYWORDS.some((k) => html.includes(k));
  return hasCareers && hasRole;
}

export function score({ leads, counters }) {
  const qualified = [];

  for (const lead of leads) {
    // Hiring signal is computed here (used only for ranking).
    lead.hiring_signal = detectHiringSignal(lead);

    // --- Must-haves (hard filter) ---
    if (MUST_HAVES.requireValidPhone && !hasValidPhone(lead)) {
      counters.inc('dropped.no_valid_phone');
      continue;
    }
    if (MUST_HAVES.requireContactChannel && !hasContactChannel(lead)) {
      counters.inc('dropped.no_contact_channel');
      continue;
    }
    if (MUST_HAVES.dropIfAiHandling && lead.ai_handling_detected) {
      counters.inc('dropped.ai_handling_detected');
      continue;
    }

    // --- Weighted ranking ---
    const s = {
      reviewCountBand: reviewBandScore(lead.user_ratings_total),
      ratingReputation: ratingScore(lead.rating),
      hiringSignal: lead.hiring_signal ? 1 : 0,
      ownerNameFound: lead.owner_name ? 1 : 0,
      emailConfidence: (lead.email_confidence ?? 0) / 100,
    };
    let weighted = 0;
    let totalW = 0;
    for (const [k, w] of Object.entries(LEAD)) {
      weighted += w * (s[k] ?? 0);
      totalW += w;
    }
    lead.lead_score = Math.round((100 * weighted) / totalW);
    lead._subscores = s;

    qualified.push(lead);
    counters.inc('qualified');
  }

  qualified.sort((a, b) => b.lead_score - a.lead_score);

  log.info('score complete', {
    qualified: qualified.length,
    dropped_no_phone: counters.get('dropped.no_valid_phone'),
    dropped_no_contact: counters.get('dropped.no_contact_channel'),
    dropped_ai: counters.get('dropped.ai_handling_detected'),
    ai_threshold: AI_HANDLING_THRESHOLD,
  });
  return qualified;
}
