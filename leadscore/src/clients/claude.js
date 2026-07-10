// Claude Haiku helper — used for (a) extracting contacts/socials/owner from
// website text and (b) a one-line personalisation hook per qualified lead.
// Uses the Anthropic Messages API over native fetch; no SDK required.

import { env, requireEnv } from '../lib/env.js';
import { log } from '../lib/logger.js';
import { mockClaudeExtract, mockClaudePersonalization } from '../lib/mocks.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

async function callHaiku(system, user, maxTokens) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY', 'Claude Haiku');
  const model = env('ANTHROPIC_MODEL') || DEFAULT_MODEL;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).map((b) => b.text || '').join('').trim();
}

function firstJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const EXTRACT_SYSTEM =
  'You extract structured contact data from a home-service business website. ' +
  'Return ONLY minified JSON with keys: emails (string[]), phones (string[]), ' +
  'owner_name (string|null), socials (object with any of instagram, facebook, ' +
  'linkedin, nextdoor as full URLs). Use only information present in the text. ' +
  'Never invent data. If a field is unknown, use an empty array/null/omit.';

/**
 * Extract contacts + socials + owner from page text. Returns
 * { emails, phones, owner_name, socials }. Never throws.
 */
export async function extractContacts(text, { dryRun = false } = {}) {
  const empty = { emails: [], phones: [], owner_name: null, socials: {} };
  if (dryRun) return mockClaudeExtract(text);
  try {
    const clipped = text.slice(0, 6000);
    const out = await callHaiku(EXTRACT_SYSTEM, clipped, 500);
    const parsed = firstJson(out);
    if (!parsed) return empty;
    return {
      emails: Array.isArray(parsed.emails) ? parsed.emails : [],
      phones: Array.isArray(parsed.phones) ? parsed.phones : [],
      owner_name: parsed.owner_name || null,
      socials: parsed.socials && typeof parsed.socials === 'object' ? parsed.socials : {},
    };
  } catch (e) {
    log.warn('claude extract failed', { err: String(e) });
    return empty;
  }
}

const NOTE_SYSTEM =
  'You write a single-sentence cold-outreach hook for a home-service business ' +
  'that misses phone calls. Nexus texts missed callers back instantly and books ' +
  'the job. Given one lead as JSON, return ONE sentence (max 25 words), no ' +
  'preamble, no quotes, grounded in the lead data (review theme, rating, hiring ' +
  'signal, or bare website). Do not fabricate specifics not implied by the data.';

/**
 * One-line personalisation note for a qualified lead. Never throws; falls back
 * to a generic-but-grounded line on failure.
 */
export async function personalizationNote(lead, { dryRun = false } = {}) {
  if (dryRun) return mockClaudePersonalization(lead);
  try {
    const payload = JSON.stringify({
      name: lead.business_name,
      category: lead.category,
      rating: lead.rating,
      review_count: lead.review_count,
      hiring_signal: lead.hiring_signal,
      line_type: lead.line_type,
      has_booking: lead._hasBooking ?? null,
    });
    const out = await callHaiku(NOTE_SYSTEM, payload, 120);
    return out.replace(/^["']|["']$/g, '').split('\n')[0].trim() || fallbackNote(lead);
  } catch (e) {
    log.warn('claude note failed', { err: String(e) });
    return fallbackNote(lead);
  }
}

function fallbackNote(lead) {
  if (lead.hiring_signal) return `They're hiring front-office help — the phone-coverage pain is live.`;
  return `${lead.review_count} reviews at ${lead.rating}★ but callers who don't get through just move on.`;
}
