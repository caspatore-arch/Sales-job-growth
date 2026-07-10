#!/usr/bin/env node
// leadscore CLI.
//
//   node src/index.js [--dry-run] [--cities="A, ST; B, ST"] [--target=N] [--out=DIR]
//
// Flags:
//   --dry-run        Mock every paid API (Places/Hunter/Twilio/Claude/Supabase)
//                    with realistic fake data. No keys required, no cost.
//   --cities="a;b"   Semicolon-separated cities. Defaults to the Marin list.
//   --target=N       Cap total discovered businesses at N.
//   --out=DIR        Output directory (default: ./out).

import { DEFAULT_CITIES } from '../config/default.js';
import { log } from './lib/logger.js';
import { run } from './pipeline.js';

function parseArgs(argv) {
  const args = { dryRun: false, cities: null, target: null, out: 'out' };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--cities=')) {
      // Split on ';' — city entries themselves contain commas ("San Rafael, CA").
      args.cities = a
        .slice('--cities='.length)
        .replace(/^["']|["']$/g, '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith('--target=')) {
      const n = parseInt(a.slice('--target='.length), 10);
      if (Number.isFinite(n) && n > 0) args.target = n;
    } else if (a.startsWith('--out=')) {
      args.out = a.slice('--out='.length).replace(/^["']|["']$/g, '') || 'out';
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      log.warn('unknown argument ignored', { arg: a });
    }
  }
  return args;
}

const HELP = `leadscore — home-service lead discovery + AI-call-handling scoring

Usage:
  node src/index.js [--dry-run] [--cities="A, B"] [--target=N] [--out=DIR]

  --dry-run        Mock all paid APIs with fake data (no keys, no cost).
  --cities="a;b"   Semicolon-separated cities (default: Marin County list).
                   Use ';' because city names contain commas, e.g.
                   --cities="San Rafael, CA; Novato, CA"
  --target=N       Cap total discovered businesses at N.
  --out=DIR        Output directory (default: ./out).
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  const cities = args.cities && args.cities.length ? args.cities : DEFAULT_CITIES;
  try {
    const { qualified, files } = await run({
      cities,
      target: args.target,
      dryRun: args.dryRun,
      outDir: args.out,
    });
    if (files) {
      log.info('done', { qualified: qualified.length, out: args.out });
      console.log(
        `\n✅ ${qualified.length} qualified leads → ${files.xlsxPath}\n` +
          `   Instantly CSV → ${files.csvPath}\n` +
          `   Call queue    → ${files.queuePath}\n`,
      );
    } else {
      log.info('done (no qualified leads)', { out: args.out });
    }
  } catch (e) {
    log.error('run failed', { err: String(e && e.stack ? e.stack : e) });
    process.exitCode = 1;
  }
}

main();
