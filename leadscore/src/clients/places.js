// Google Places API (New) — Text Search. Discovers businesses by
// `<category> in <city>`. Built on native fetch; no SDK required.

import { requireEnv } from '../lib/env.js';
import { log } from '../lib/logger.js';
import { mockPlaces } from '../lib/mocks.js';

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

function normalize(place) {
  return {
    place_id: place.id,
    name: place.displayName?.text || '',
    formatted_phone: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
    website: place.websiteUri || '',
    rating: place.rating ?? null,
    user_ratings_total: place.userRatingCount ?? 0,
    business_status: place.businessStatus || 'UNKNOWN',
    gbp_url: place.googleMapsUri || '',
  };
}

/**
 * Search one category × city. Returns an array of normalized place records.
 * In dry-run, returns deterministic mock data and makes no network calls.
 */
export async function searchPlaces(category, city, { dryRun = false } = {}) {
  if (dryRun) return mockPlaces(category, city);

  const apiKey = requireEnv('GOOGLE_PLACES_API_KEY', 'Google Places');
  const results = [];
  let pageToken;
  let page = 0;

  do {
    const body = { textQuery: `${category} in ${city}` };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Places searchText ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    for (const p of data.places || []) results.push(normalize(p));

    pageToken = data.nextPageToken;
    page++;
    if (pageToken) await new Promise((r) => setTimeout(r, 2000)); // token settle
  } while (pageToken && page < 3); // up to ~60 results per query

  log.debug('places search', { category, city, count: results.length });
  return results;
}
