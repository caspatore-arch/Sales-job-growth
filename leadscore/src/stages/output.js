// Stage 5 — OUTPUT. Generates a personalisation note per qualified lead, then
// writes leads.xlsx (hottest-first), an Instantly-ready CSV, a manual-verify
// queue, and upserts rows to Supabase.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { MANUAL_VERIFY_TOP_N } from '../../config/default.js';
import { personalizationNote } from '../clients/claude.js';
import { writeLeads } from '../clients/supabase.js';
import { log } from '../lib/logger.js';

// Column order for the spreadsheet (matches the plan exactly).
const COLUMNS = [
  { header: 'business_name', key: 'business_name', width: 28 },
  { header: 'owner_name', key: 'owner_name', width: 18 },
  { header: 'category', key: 'category', width: 14 },
  { header: 'city', key: 'city', width: 18 },
  { header: 'phone', key: 'phone', width: 16 },
  { header: 'line_type', key: 'line_type', width: 12 },
  { header: 'carrier', key: 'carrier', width: 18 },
  { header: 'email', key: 'email', width: 26 },
  { header: 'email_confidence', key: 'email_confidence', width: 16 },
  { header: 'website', key: 'website', width: 30 },
  { header: 'gbp_url', key: 'gbp_url', width: 30 },
  { header: 'instagram', key: 'instagram', width: 26 },
  { header: 'facebook', key: 'facebook', width: 26 },
  { header: 'linkedin', key: 'linkedin', width: 26 },
  { header: 'review_count', key: 'review_count', width: 12 },
  { header: 'rating', key: 'rating', width: 8 },
  { header: 'ai_handling_detected', key: 'ai_handling_detected', width: 18 },
  { header: 'maturity_score', key: 'maturity_score', width: 14 },
  { header: 'hiring_signal', key: 'hiring_signal', width: 12 },
  { header: 'personalization_note', key: 'personalization_note', width: 50 },
  { header: 'lead_score', key: 'lead_score', width: 10 },
];

// Flatten the internal lead object into the stable, serialisable shape used by
// every output target.
function flatten(lead) {
  return {
    place_id: lead.place_id,
    business_name: lead.name,
    owner_name: lead.owner_name || null,
    category: lead.category,
    city: lead.city,
    phone: lead.formatted_phone,
    line_type: lead.line_type || null,
    carrier: lead.carrier || null,
    email: lead.email || null,
    email_confidence: lead.email_confidence ?? null,
    website: lead.website || null,
    gbp_url: lead.gbp_url || null,
    socials: lead.socials || {},
    review_count: lead.user_ratings_total ?? 0,
    rating: lead.rating ?? null,
    ai_handling_detected: Boolean(lead.ai_handling_detected),
    maturity_score: lead.maturity_score ?? null,
    hiring_signal: Boolean(lead.hiring_signal),
    personalization_note: lead.personalization_note || null,
    lead_score: lead.lead_score ?? 0,
  };
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toInstantlyCsv(rows) {
  const headers = [
    'email',
    'first_name',
    'last_name',
    'company_name',
    'phone',
    'website',
    'city',
    'personalization',
    'lead_score',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    if (!r.email) continue; // Instantly needs an email address
    const [first, ...rest] = (r.owner_name || '').split(' ');
    lines.push(
      [
        r.email,
        first || '',
        rest.join(' '),
        r.business_name,
        r.phone,
        r.website,
        r.city,
        r.personalization_note,
        r.lead_score,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n');
}

export async function output({ leads, dryRun, outDir, counters }) {
  await mkdir(outDir, { recursive: true });

  // 1) Personalisation note per qualified lead.
  for (const lead of leads) {
    lead.personalization_note = await personalizationNote(
      {
        place_id: lead.place_id,
        business_name: lead.name,
        category: lead.category,
        rating: lead.rating,
        review_count: lead.user_ratings_total,
        hiring_signal: lead.hiring_signal,
        line_type: lead.line_type,
        _hasBooking: lead._hasBooking,
      },
      { dryRun },
    );
    counters.inc('personalized');
  }

  const flat = leads.map(flatten);

  // 2) leads.xlsx (already sorted hottest-first by the score stage).
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('leads');
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const r of flat) ws.addRow(toRowFromFlat(r));
  const xlsxPath = path.join(outDir, 'leads.xlsx');
  await wb.xlsx.writeFile(xlsxPath);

  // 3) Instantly-ready CSV.
  const csvPath = path.join(outDir, 'instantly.csv');
  await writeFile(csvPath, toInstantlyCsv(flat), 'utf8');

  // 4) manual-verify-queue.txt — top N by lead_score, name + phone.
  const queue = flat
    .slice(0, MANUAL_VERIFY_TOP_N)
    .map((r, i) => `${String(i + 1).padStart(2, '0')}. ${r.business_name} — ${r.phone} (score ${r.lead_score})`)
    .join('\n');
  const queuePath = path.join(outDir, 'manual-verify-queue.txt');
  await writeFile(
    queuePath,
    `Manual verification queue — top ${Math.min(MANUAL_VERIFY_TOP_N, flat.length)} leads.\n` +
      `Call each by hand, listen to the greeting, log human / voicemail / AI.\n` +
      `Do NOT auto-dial. One at a time, no recording.\n\n${queue}\n`,
    'utf8',
  );

  // 5) Supabase upsert.
  const written = await writeLeads(flat, { dryRun });
  counters.inc('supabase_written', written);

  log.info('output complete', {
    xlsx: xlsxPath,
    csv: csvPath,
    queue: queuePath,
    rows: flat.length,
    supabase_written: written,
  });

  return { xlsxPath, csvPath, queuePath, rows: flat.length };
}

// Build a worksheet row directly from the flattened record.
function toRowFromFlat(r) {
  return {
    business_name: r.business_name,
    owner_name: r.owner_name || '',
    category: r.category,
    city: r.city,
    phone: r.phone,
    line_type: r.line_type || '',
    carrier: r.carrier || '',
    email: r.email || '',
    email_confidence: r.email_confidence ?? '',
    website: r.website || '',
    gbp_url: r.gbp_url || '',
    instagram: r.socials?.instagram || '',
    facebook: r.socials?.facebook || '',
    linkedin: r.socials?.linkedin || '',
    review_count: r.review_count,
    rating: r.rating ?? '',
    ai_handling_detected: r.ai_handling_detected,
    maturity_score: r.maturity_score,
    hiring_signal: r.hiring_signal,
    personalization_note: r.personalization_note || '',
    lead_score: r.lead_score,
  };
}
