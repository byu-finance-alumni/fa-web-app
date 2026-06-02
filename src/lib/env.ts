/**
 * Centralized, typed access to public environment variables.
 *
 * Only `NEXT_PUBLIC_*` variables are exposed to the browser. Server-only
 * secrets must never be read through this module. See `.env.example` for the
 * full list and `CLAUDE.md` for usage rules.
 */
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
} as const;

/**
 * Throws if a required public env var is missing. Call from places that
 * genuinely need the value (e.g. when initializing the API/Supabase client)
 * rather than at module load, so the placeholder pages still render locally.
 */
export function requireEnv(key: keyof typeof env): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable for "${key}".`);
  }
  return value;
}
