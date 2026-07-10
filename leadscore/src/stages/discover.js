// Stage 1 — DISCOVER. Iterate categories × cities via Google Places (New),
// dedupe by place_id, tag each with its category/city, and cap at --target.

import { CATEGORIES } from '../../config/default.js';
import { searchPlaces } from '../clients/places.js';
import { log } from '../lib/logger.js';

export async function discover({ cities, target, dryRun, counters }) {
  const byId = new Map();

  outer: for (const city of cities) {
    for (const category of CATEGORIES) {
      let found;
      try {
        found = await searchPlaces(category, city, { dryRun });
      } catch (e) {
        log.warn('discover query failed', { category, city, err: String(e) });
        counters.inc('discover.query_failed');
        continue;
      }
      for (const place of found) {
        counters.inc('discover.raw');
        if (!place.place_id) continue;
        if (byId.has(place.place_id)) {
          counters.inc('discover.dedup_skipped');
          continue;
        }
        // Drop non-operational businesses early.
        if (place.business_status && place.business_status !== 'OPERATIONAL') {
          counters.inc('discover.not_operational');
          continue;
        }
        byId.set(place.place_id, { ...place, category, city });
        counters.inc('discovered');
        if (target && byId.size >= target) {
          log.info('discover target reached', { target });
          break outer;
        }
      }
    }
  }

  const leads = [...byId.values()];
  log.info('discover complete', { discovered: leads.length });
  return leads;
}
