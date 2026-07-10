// Default run configuration. Override cities on the CLI with --cities="a,b,c".

// Home-service categories to iterate. These map to Google Places (New) text
// queries of the form `<category> in <city>`.
export const CATEGORIES = [
  'plumber',
  'HVAC',
  'electrician',
  'roofer',
  'pest control',
  'pool service',
  'garage door',
  'junk removal',
  'locksmith',
  'landscaper',
];

// Default target market — Marin County, CA.
export const DEFAULT_CITIES = [
  'San Rafael, CA',
  'Novato, CA',
  'Mill Valley, CA',
  'San Anselmo, CA',
  'Larkspur, CA',
  'Corte Madera, CA',
  'Fairfax, CA',
  'Sausalito, CA',
  'Tiburon, CA',
  'Greenbrae, CA',
];

// Website fetch behaviour (Stage 2). Respects the plan's compliance constraints.
export const FETCH = {
  userAgent:
    'NexusLeadScoreBot/1.0 (+https://caspatore-arch.github.io/Sales-job-growth/; contact: caspatore@gmail.com)',
  requestsPerSecond: 1.5, // ~1-2 req/sec across all outbound website fetches
  maxRetries: 3, // exponential backoff on 429/403
  timeoutMs: 15000,
  // Extra pages to try beyond the homepage.
  paths: ['/contact', '/about', '/contact-us', '/about-us'],
};

// Manual verification queue size (top N leads to hand-dial).
export const MANUAL_VERIFY_TOP_N = 25;
