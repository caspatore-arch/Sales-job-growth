// Realistic fake data for --dry-run so the whole flow can be exercised for free.
// Deterministic per input (seeded hash) so repeated runs are stable.

import { createHash } from 'node:crypto';

function seed(str) {
  const h = createHash('md5').update(str).digest();
  return h.readUInt32BE(0);
}
function rng(s) {
  // Mulberry32
  let a = s >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

const FIRST = ['Mike', 'Dave', 'Tony', 'Sam', 'Rick', 'Joe', 'Carlos', 'Ken', 'Bill', 'Frank'];
const LAST = ['Nguyen', 'Sullivan', 'Ramirez', 'OBrien', 'Patel', 'Delgado', 'Foster', 'Marino'];
const SUFFIX = ['Plumbing', 'Services', 'HVAC', 'Electric', 'Roofing', '& Sons', 'Pros', 'Co'];

// Mock a Google Places (New) searchText response for one category × city.
export function mockPlaces(category, city, howMany) {
  const r = rng(seed(category + '|' + city));
  const n = Math.max(1, Math.round(2 + r() * (howMany ?? 6)));
  const cityName = city.split(',')[0].trim();
  const out = [];
  for (let i = 0; i < n; i++) {
    const first = pick(r, FIRST);
    const last = pick(r, LAST);
    const name = `${last} ${pick(r, SUFFIX)}`;
    const hasWebsite = r() > 0.15;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const area = 415;
    const phone = `+1${area}${String(2000000 + Math.floor(r() * 7999999)).slice(0, 7)}`;
    out.push({
      place_id: `mock_${slug}_${cityName.toLowerCase().replace(/\W+/g, '')}_${i}`,
      name,
      formatted_phone: phone,
      website: hasWebsite ? `https://www.${slug}.com` : '',
      rating: Math.round((3.4 + r() * 1.6) * 10) / 10,
      user_ratings_total: Math.floor(5 + r() * 420),
      business_status: r() > 0.05 ? 'OPERATIONAL' : 'CLOSED_TEMPORARILY',
      gbp_url: `https://maps.google.com/?cid=${Math.floor(r() * 1e15)}`,
      _mockOwner: `${first} ${last}`,
    });
  }
  return out;
}

// Mock a business website's HTML. Deterministically varies automation signals
// so scoring/filtering produce a realistic spread.
export function mockWebsite(business) {
  const r = rng(seed('site|' + business.place_id));
  const owner = business._mockOwner || `${pick(r, FIRST)} ${pick(r, LAST)}`;
  const domain = (business.website || 'https://example.com').replace(/^https?:\/\/(www\.)?/, '');
  const email = `info@${domain.replace(/\/.*$/, '')}`;
  const slug = domain.split('.')[0];

  const hasBooking = r() > 0.6;
  const hasChat = r() > 0.75;
  const hasAiReceptionist = r() > 0.85;
  const hasHiring = r() > 0.7;

  const parts = [
    `<html><head><title>${business.name}</title></head><body>`,
    `<h1>${business.name}</h1>`,
    `<p>Owner ${owner} has served the area for years. Call us at ${business.formatted_phone}.</p>`,
    `<a href="mailto:${email}">${email}</a>`,
    r() > 0.4 ? `<a href="https://instagram.com/${slug}">Instagram</a>` : '',
    r() > 0.5 ? `<a href="https://facebook.com/${slug}">Facebook</a>` : '',
    r() > 0.8 ? `<a href="https://www.linkedin.com/company/${slug}">LinkedIn</a>` : '',
    hasBooking ? `<script src="https://assets.calendly.com/widget.js"></script><a>Book Now</a>` : '',
    hasChat ? `<script src="https://widget.intercom.io/widget/abc"></script>` : '',
    hasAiReceptionist ? `<p>Calls answered by Smith.ai virtual receptionist.</p>` : '',
    hasHiring ? `<a href="/careers">We're hiring a front office receptionist</a>` : '',
    `</body></html>`,
  ];
  return parts.filter(Boolean).join('\n');
}

// Mock Hunter.io domain-search result.
export function mockHunter(domain) {
  const r = rng(seed('hunter|' + domain));
  const base = domain.replace(/^www\./, '').split('.')[0];
  return {
    email: `owner@${domain.replace(/^www\./, '')}`,
    confidence: Math.floor(40 + r() * 55),
    first_name: pick(r, FIRST),
    last_name: pick(r, LAST),
    source: 'hunter-mock',
    _label: base,
  };
}

// Mock Twilio Lookup line-type result.
export function mockTwilio(phone) {
  const r = rng(seed('twilio|' + phone));
  const roll = r();
  let type;
  let carrier;
  if (roll < 0.45) {
    type = 'landline';
    carrier = pick(r, ['AT&T', 'Comcast', 'Frontier', 'Verizon']);
  } else if (roll < 0.75) {
    type = 'mobile';
    carrier = pick(r, ['Verizon Wireless', 'T-Mobile', 'AT&T Mobility']);
  } else {
    type = 'voip';
    carrier = pick(r, ['Twilio', 'RingCentral', 'Bandwidth', 'OpenPhone', 'Local VoIP LLC']);
  }
  return { line_type: type, carrier };
}

// Mock a Claude Haiku extraction/personalisation response.
export function mockClaudeExtract(text) {
  // Regex already pulls emails/phones/socials in dry-run; here we mimic Claude's
  // value-add: pulling the owner name out of prose ("Owner Mike Nguyen has...").
  const m = /Owner\s+([A-Z][a-z]+\s+[A-Z][A-Za-z]+)/.exec(text || '');
  return { emails: [], phones: [], owner_name: m ? m[1] : null, socials: {} };
}

export function mockClaudePersonalization(lead) {
  const hooks = [
    `Reviews mention phone tag before booking — a same-second text-back would close that gap.`,
    `${lead.review_count} reviews at ${lead.rating}★ but a bare "call us" site — missed calls are leaking jobs.`,
    `Hiring a front-office role signals they feel the phone-coverage pain right now.`,
    `Strong reputation, no online booking — after-hours callers have nowhere to go.`,
  ];
  const r = rng(seed('note|' + lead.place_id));
  return hooks[Math.floor(r() * hooks.length)];
}
