import 'dotenv/config';

// Read an env var, returning undefined if unset/empty.
export function env(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

// Read a required env var or throw a clear error (skipped entirely in dry-run,
// where clients are never constructed).
export function requireEnv(name, forClient) {
  const v = env(name);
  if (!v) {
    throw new Error(
      `Missing env var ${name}${forClient ? ` (required by ${forClient})` : ''}. ` +
        `Copy .env.example to .env and fill it in, or run with --dry-run.`,
    );
  }
  return v;
}
