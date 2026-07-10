// Orchestrates the five stages. Each stage is wrapped so a thrown error is
// logged and (where sensible) the run continues rather than dying.

import path from 'node:path';
import { Counters, log } from './lib/logger.js';
import { discover } from './stages/discover.js';
import { enrich } from './stages/enrich.js';
import { fingerprint } from './stages/fingerprint.js';
import { output } from './stages/output.js';
import { score } from './stages/score.js';

export async function run({ cities, target, dryRun, outDir }) {
  const counters = new Counters();
  const started = Date.now();
  log.info('leadscore start', { cities: cities.length, target: target || 'all', dryRun });

  // Stage 1 — Discover
  const discovered = await discover({ cities, target, dryRun, counters });
  if (!discovered.length) {
    log.warn('no businesses discovered; nothing to do');
    counters.print();
    return { qualified: [], counters: counters.snapshot() };
  }

  // Stage 2 — Enrich
  await enrich({ leads: discovered, dryRun, counters });

  // Stage 3 — Fingerprint
  await fingerprint({ leads: discovered, dryRun, counters });

  // Stage 4 — Score & filter
  const qualified = score({ leads: discovered, counters });

  // Stage 5 — Output
  let files = null;
  if (qualified.length) {
    files = await output({
      leads: qualified,
      dryRun,
      outDir: path.resolve(outDir),
      counters,
    });
  } else {
    log.warn('no qualified leads; skipping output');
  }

  counters.inc('elapsed_ms', Date.now() - started);
  counters.print();
  return { qualified, files, counters: counters.snapshot() };
}
