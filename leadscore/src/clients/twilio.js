// Twilio Lookup v2 — line type intelligence for call-handling fingerprinting.
// No SDK: HTTP Basic auth over native fetch.

import { env, requireEnv } from '../lib/env.js';
import { log } from '../lib/logger.js';
import { mockTwilio } from '../lib/mocks.js';

/**
 * Look up line type + carrier for a phone number. Returns
 * { line_type, carrier } (line_type ∈ landline|mobile|voip|null). Never throws.
 */
export async function twilioLookup(phone, { dryRun = false } = {}) {
  if (!phone) return { line_type: null, carrier: null };
  if (dryRun) return mockTwilio(phone);

  try {
    const sid = requireEnv('TWILIO_ACCOUNT_SID', 'Twilio Lookup');
    const token = requireEnv('TWILIO_AUTH_TOKEN', 'Twilio Lookup');
    const e164 = phone.replace(/[^\d+]/g, '');
    const url =
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}` +
      `?Fields=line_type_intelligence`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) {
      log.warn('twilio lookup failed', { phone, status: res.status });
      return { line_type: null, carrier: null };
    }
    const data = await res.json();
    const lti = data.line_type_intelligence || {};
    // Twilio types: landline, mobile, voip, nonFixedVoip, fixedVoip, tollFree...
    let line_type = lti.type || null;
    if (line_type && /voip/i.test(line_type)) line_type = 'voip';
    return { line_type, carrier: lti.carrier_name || null };
  } catch (e) {
    log.warn('twilio error', { phone, err: String(e) });
    return { line_type: null, carrier: null };
  }
}

export function twilioConfigured() {
  return Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN'));
}
