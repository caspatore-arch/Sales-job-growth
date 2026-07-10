// Supabase writer — upserts qualified leads via the PostgREST REST API.
// No SDK: native fetch with the service-role key.

import { env } from '../lib/env.js';
import { log } from '../lib/logger.js';

export function supabaseConfigured() {
  return Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * Upsert an array of lead rows (keyed on place_id). Returns the number of rows
 * written. In dry-run, logs and writes nothing. Never throws.
 */
export async function writeLeads(rows, { dryRun = false } = {}) {
  if (!rows.length) return 0;
  if (dryRun) {
    log.info('supabase (dry-run) would upsert rows', { count: rows.length });
    return rows.length;
  }
  if (!supabaseConfigured()) {
    log.warn('supabase not configured; skipping DB write');
    return 0;
  }
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const table = env('SUPABASE_TABLE') || 'leads';
  try {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=place_id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log.warn('supabase write failed', { status: res.status, body: text.slice(0, 300) });
      return 0;
    }
    log.info('supabase upsert ok', { count: rows.length, table });
    return rows.length;
  } catch (e) {
    log.warn('supabase error', { err: String(e) });
    return 0;
  }
}
