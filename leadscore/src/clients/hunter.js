// Hunter.io domain search — fallback when no email is found on-site.

import { requireEnv } from '../lib/env.js';
import { log } from '../lib/logger.js';
import { mockHunter } from '../lib/mocks.js';

/**
 * Look up the best-guess email for a domain. Returns
 * { email, confidence (0-100), first_name, last_name } or null. Never throws;
 * logs and returns null on failure so one lookup can't kill the run.
 */
export async function hunterDomainSearch(domain, { dryRun = false } = {}) {
  if (!domain) return null;
  if (dryRun) return mockHunter(domain);

  try {
    const apiKey = requireEnv('HUNTER_API_KEY', 'Hunter.io');
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(
      domain,
    )}&limit=5&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      log.warn('hunter lookup failed', { domain, status: res.status });
      return null;
    }
    const data = await res.json();
    const emails = data?.data?.emails || [];
    if (!emails.length) return null;
    // Prefer personal/generic owner-ish emails with highest confidence.
    emails.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const best = emails[0];
    return {
      email: best.value,
      confidence: best.confidence ?? 0,
      first_name: best.first_name || null,
      last_name: best.last_name || null,
      source: 'hunter',
    };
  } catch (e) {
    log.warn('hunter error', { domain, err: String(e) });
    return null;
  }
}
