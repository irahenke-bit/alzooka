/**
 * Environment Variable Validation
 * 
 * This file validates required environment variables at build/startup time.
 * Import this in your app's root layout to ensure all required vars are set.
 * 
 * Required Environment Variables:
 * ================================
 * 
 * NEXT_PUBLIC_SUPABASE_URL
 *   - Your Supabase project URL
 *   - Example: https://xxxxx.supabase.co
 *   - Required: Always
 * 
 * NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - Your Supabase anonymous/public key
 *   - Safe to expose to browser (RLS protects data)
 *   - Required: Always
 * 
 * SUPABASE_SERVICE_ROLE_KEY
 *   - Service role key that bypasses RLS
 *   - NEVER expose to browser!
 *   - Required: Production (optional for preview)
 * 
 * Optional Environment Variables:
 * ================================
 * 
 * SPOTIFY_CLIENT_ID
 *   - Spotify OAuth client ID
 *   - Required: Only if using Spotify integration
 * 
 * SPOTIFY_CLIENT_SECRET
 *   - Spotify OAuth client secret
 *   - Required: Only if using Spotify integration
 * 
 * GOOGLE_CLOUD_API_KEY
 *   - Google Cloud Vision API key for image moderation
 *   - Required: Only if using image moderation
 * 
 * YOUTUBE_API_KEY
 *   - YouTube Data API key for video search
 *   - Required: Only if using YouTube integration
 * 
 * TURNSTILE_SECRET_KEY
 *   - Cloudflare Turnstile secret for captcha verification
 *   - Required: Only if using Turnstile captcha
 * 
 * SEED_TRIVIA_ENABLED
 *   - Safety switch for /api/seed-trivia endpoint
 *   - Set to "true" to allow admins to run database seeding
 *   - Default: off (endpoint returns 404)
 *   - Recommended: Keep off in production unless actively seeding
 */

// Required vars that must always be present
const REQUIRED_PUBLIC_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

// Server-only vars required in production but optional in preview
const REQUIRED_SERVER_VARS_PRODUCTION = [
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Validates that all required environment variables are set.
 * Call this at app startup to fail fast if config is missing.
 */
export function validateEnv() {
  const missing: string[] = [];
  
  // VERCEL_ENV is only set in Vercel deployments
  // "production" = main branch, "preview" = PR branches, "development" = vercel dev
  const vercelEnv = process.env.VERCEL_ENV;
  const isVercelProduction = vercelEnv === "production";
  const isVercelPreview = vercelEnv === "preview";

  // Always required (browser + basic server functionality)
  for (const varName of REQUIRED_PUBLIC_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Service role key is only strictly required in Vercel production deployments
  // - Local dev: optional (gracefully disabled admin features)
  // - Preview deploys: optional (gracefully disabled admin features)
  // - Production: required (full functionality)
  if (isVercelProduction) {
    for (const varName of REQUIRED_SERVER_VARS_PRODUCTION) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
  }

  // Warn (but don't fail) in preview deploys if service key is missing
  if (isVercelPreview && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[env] SUPABASE_SERVICE_ROLE_KEY not set in preview - admin features disabled"
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n` +
      missing.map(v => `  - ${v}`).join("\n") +
      `\n\nPlease add these to your .env.local file or Vercel project settings.`
    );
  }
}

/**
 * Check if admin features are available (service role key is set)
 */
export function isAdminEnabled(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Get environment info for debugging (safe to log, no secrets)
 */
export function getEnvInfo() {
  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSpotifyCredentials: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    hasGoogleApiKey: !!process.env.GOOGLE_CLOUD_API_KEY,
    hasYoutubeApiKey: !!process.env.YOUTUBE_API_KEY,
    hasTurnstileKey: !!process.env.TURNSTILE_SECRET_KEY,
  };
}
