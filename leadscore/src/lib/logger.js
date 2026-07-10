// Minimal structured logger: timestamped, level-tagged lines plus a per-stage
// counter registry that the pipeline prints as a summary at the end.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const suffix = fields && Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
  const line = `${ts} [${level.toUpperCase()}] ${msg}${suffix}`;
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}

export const log = {
  debug: (m, f) => emit('debug', m, f),
  info: (m, f) => emit('info', m, f),
  warn: (m, f) => emit('warn', m, f),
  error: (m, f) => emit('error', m, f),
};

// Per-stage / per-reason counters.
export class Counters {
  constructor() {
    this.counts = new Map();
  }
  inc(key, by = 1) {
    this.counts.set(key, (this.counts.get(key) ?? 0) + by);
  }
  get(key) {
    return this.counts.get(key) ?? 0;
  }
  snapshot() {
    return Object.fromEntries([...this.counts.entries()]);
  }
  print() {
    log.info('run summary', this.snapshot());
  }
}
