// Stage 2 — ENRICH. For each business with a website, fetch homepage +
// /contact + /about (compliantly), extract email/phone/owner/socials via regex
// + Claude Haiku, and fall back to Hunter.io when no on-site email is found.
//
// The concatenated lowercased HTML is stashed on the lead as `_html` so the
// fingerprint and score stages can reuse it without re-fetching.

import { FETCH } from '../../config/default.js';
import { extractContacts } from '../clients/claude.js';
import { hunterDomainSearch } from '../clients/hunter.js';
import { fetchPage } from '../lib/httpCache.js';
import { log } from '../lib/logger.js';
import { mockWebsite } from '../lib/mocks.js';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const SOCIAL_RE = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\/-]+/i,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\/-]+/i,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/[A-Za-z0-9_.\/-]+/i,
  nextdoor: /https?:\/\/(?:www\.)?nextdoor\.com\/[A-Za-z0-9_.\/-]+/i,
};

// Junk that regularly turns up in mailto/href noise.
const EMAIL_BLOCKLIST = /(sentry|wixpress|example\.com|\.png|\.jpg|\.gif|\.svg)/i;

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function regexExtract(html) {
  const text = htmlToText(html);
  const emails = uniq((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase())).filter(
    (e) => !EMAIL_BLOCKLIST.test(e),
  );
  const phones = uniq(text.match(PHONE_RE) || []).map((p) => p.trim());
  const socials = {};
  for (const [k, re] of Object.entries(SOCIAL_RE)) {
    const m = html.match(re);
    if (m) socials[k] = m[0];
  }
  return { emails, phones, socials, text };
}

function domainOf(website) {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function fetchAllPages(lead, dryRun) {
  if (dryRun) return mockWebsite(lead);
  let base;
  try {
    base = new URL(lead.website);
  } catch {
    return '';
  }
  const urls = [base.origin + (base.pathname === '/' ? '' : base.pathname) || base.origin];
  for (const p of FETCH.paths) urls.push(base.origin + p);

  const htmls = [];
  for (const u of uniq(urls)) {
    const r = await fetchPage(u);
    if (r.blocked) log.debug('page blocked by robots', { url: u });
    if (r.html) htmls.push(r.html);
    // Homepage is enough if the sub-pages 404; keep going but don't require all.
  }
  return htmls.join('\n');
}

export async function enrich({ leads, dryRun, counters }) {
  for (const lead of leads) {
    lead.emails = [];
    lead.phones = uniq([lead.formatted_phone]);
    lead.owner_name = null;
    lead.socials = {};
    lead.email = '';
    lead.email_confidence = null;
    lead._html = '';

    if (!lead.website) {
      counters.inc('enrich.no_website');
    } else {
      let html = '';
      try {
        html = await fetchAllPages(lead, dryRun);
      } catch (e) {
        log.warn('enrich fetch failed', { website: lead.website, err: String(e) });
        counters.inc('enrich.fetch_failed');
      }
      lead._html = html.toLowerCase();

      if (html) {
        const rx = regexExtract(html);
        lead.emails = uniq([...lead.emails, ...rx.emails]);
        lead.phones = uniq([...lead.phones, ...rx.phones]);
        lead.socials = { ...rx.socials };

        // Claude Haiku pass to catch what regex misses + owner name.
        try {
          const ai = await extractContacts(rx.text, { dryRun });
          lead.emails = uniq([...lead.emails, ...(ai.emails || [])]);
          lead.phones = uniq([...lead.phones, ...(ai.phones || [])]);
          lead.owner_name = lead.owner_name || ai.owner_name || null;
          lead.socials = { ...(ai.socials || {}), ...lead.socials };
        } catch (e) {
          log.warn('enrich extract failed', { website: lead.website, err: String(e) });
        }
        counters.inc('enrich.site_fetched');
      }
    }

    // Choose a primary email; else Hunter.io fallback by domain.
    if (lead.emails.length) {
      lead.email = lead.emails[0];
      lead.email_confidence = 100; // on-site email = high confidence
      lead._emailSource = 'onsite';
    } else if (lead.website) {
      const domain = domainOf(lead.website);
      const h = await hunterDomainSearch(domain, { dryRun });
      if (h?.email) {
        lead.email = h.email;
        lead.email_confidence = h.confidence ?? 0;
        lead._emailSource = 'hunter';
        if (!lead.owner_name && (h.first_name || h.last_name)) {
          lead.owner_name = [h.first_name, h.last_name].filter(Boolean).join(' ') || null;
        }
        counters.inc('enrich.hunter_hit');
      } else {
        counters.inc('enrich.no_email');
      }
    }

    lead.has_social = Object.keys(lead.socials).length > 0;
    if (lead.email || lead.has_social) counters.inc('enriched');
  }

  log.info('enrich complete', {
    enriched: counters.get('enriched'),
    hunter_hits: counters.get('enrich.hunter_hit'),
  });
  return leads;
}
