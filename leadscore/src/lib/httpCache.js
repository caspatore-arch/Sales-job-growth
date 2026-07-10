import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FETCH } from '../../config/default.js';
import { log } from './logger.js';

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'html');

// --- Global rate limiter: serialises outbound website fetches to ~N req/sec.
let chain = Promise.resolve();
let lastAt = 0;
const minGapMs = 1000 / FETCH.requestsPerSecond;

function schedule(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastAt + minGapMs - Date.now());
    if (wait) await sleep(wait);
    lastAt = Date.now();
    return fn();
  });
  // Keep the chain alive even if this task rejects.
  chain = run.then(
    () => {},
    () => {},
  );
  return run;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheKey(url) {
  return createHash('sha1').update(url).digest('hex') + '.html';
}

async function readCache(url) {
  try {
    return await readFile(path.join(CACHE_DIR, cacheKey(url)), 'utf8');
  } catch {
    return null;
  }
}

async function writeCache(url, body) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, cacheKey(url)), body);
  } catch (e) {
    log.debug('cache write failed', { url, err: String(e) });
  }
}

// --- robots.txt: fetched + cached per origin, minimal Disallow matching for *.
const robotsByOrigin = new Map();

async function robotsAllows(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  if (!robotsByOrigin.has(origin)) {
    robotsByOrigin.set(origin, fetchRobots(origin));
  }
  const rules = await robotsByOrigin.get(origin);
  const pathName = new URL(url).pathname || '/';
  return !rules.some((dis) => dis && pathName.startsWith(dis));
}

async function fetchRobots(origin) {
  try {
    const res = await schedule(() =>
      fetchWithTimeout(`${origin}/robots.txt`, FETCH.timeoutMs),
    );
    if (!res.ok) return []; // no robots => allow all
    const text = await res.text();
    return parseRobotsDisallow(text);
  } catch {
    return [];
  }
}

// Collect Disallow paths that apply to `User-agent: *` (conservative default).
function parseRobotsDisallow(text) {
  const lines = text.split(/\r?\n/);
  const disallow = [];
  let appliesToStar = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      appliesToStar = val === '*';
    } else if (key === 'disallow' && appliesToStar) {
      if (val) disallow.push(val);
    }
  }
  return disallow;
}

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': FETCH.userAgent,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch a public web page respecting robots.txt, rate limits, retries, and an
 * on-disk cache. Returns { url, status, html, cached, blocked } — never throws.
 */
export async function fetchPage(url, { useCache = true } = {}) {
  if (useCache) {
    const hit = await readCache(url);
    if (hit !== null) {
      log.debug('cache hit', { url });
      return { url, status: 200, html: hit, cached: true, blocked: false };
    }
  }

  if (!(await robotsAllows(url))) {
    log.debug('robots disallow', { url });
    return { url, status: 0, html: '', cached: false, blocked: true };
  }

  let attempt = 0;
  while (attempt <= FETCH.maxRetries) {
    try {
      const res = await schedule(() => fetchWithTimeout(url, FETCH.timeoutMs));
      if ((res.status === 429 || res.status === 403) && attempt < FETCH.maxRetries) {
        const backoff = 2 ** attempt * 1000;
        log.debug('backoff', { url, status: res.status, backoff, attempt });
        await sleep(backoff);
        attempt++;
        continue;
      }
      if (!res.ok) {
        return { url, status: res.status, html: '', cached: false, blocked: false };
      }
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('html') && !ctype.includes('text')) {
        return { url, status: res.status, html: '', cached: false, blocked: false };
      }
      const html = await res.text();
      if (useCache) await writeCache(url, html);
      return { url, status: res.status, html, cached: false, blocked: false };
    } catch (e) {
      if (attempt < FETCH.maxRetries) {
        const backoff = 2 ** attempt * 1000;
        log.debug('fetch error, retrying', { url, err: String(e), backoff });
        await sleep(backoff);
        attempt++;
        continue;
      }
      log.warn('fetch failed', { url, err: String(e) });
      return { url, status: 0, html: '', cached: false, blocked: false };
    }
  }
  return { url, status: 0, html: '', cached: false, blocked: false };
}
