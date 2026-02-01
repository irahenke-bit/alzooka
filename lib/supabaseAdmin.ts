import { createClient } from "@supabase/supabase-js";

// =============================================================================
// ⚠️  ADMIN CLIENT - BYPASSES ROW LEVEL SECURITY (RLS)  ⚠️
// =============================================================================
//
// ██████╗  █████╗ ███╗   ██╗ ██████╗ ███████╗██████╗ 
// ██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔════╝██╔══██╗
// ██║  ██║███████║██╔██╗ ██║██║  ███╗█████╗  ██████╔╝
// ██║  ██║██╔══██║██║╚██╗██║██║   ██║██╔══╝  ██╔══██╗
// ██████╔╝██║  ██║██║ ╚████║╚██████╔╝███████╗██║  ██║
// ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
//
// NEVER use this in user-facing routes!
// NEVER import this file in client components!
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser!
//
// This client uses the service role key which bypasses ALL Row Level Security.
// Only use this for:
//   - Admin-only server scripts
//   - Database seeding/migrations
//   - Background jobs that need to modify any user's data
//   - Server-side operations where RLS cannot apply
//
// For user-facing routes, use getServerClient() from lib/supabase.ts instead.
// =============================================================================

/**
 * Check if the admin client is available (service role key is set).
 * Use this to gracefully disable admin features in preview deployments.
 */
export function isAdminClientAvailable(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Creates an admin Supabase client that bypasses RLS.
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is not set (e.g., preview deployments).
 * 
 * ⚠️  NEVER use this in user-facing routes! ⚠️
 * ⚠️  NEVER import this file in client components! ⚠️
 * 
 * This is for admin-only server operations like:
 * - Database seeding scripts
 * - Background jobs
 * - Admin dashboards (server-side only)
 * 
 * Usage:
 *   const admin = createAdminClient();
 *   if (!admin) {
 *     return NextResponse.json({ error: "Admin features disabled" }, { status: 503 });
 *   }
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Return null instead of throwing - allows preview deployments to work
  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
