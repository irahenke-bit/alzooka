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
 * Creates an admin Supabase client that bypasses RLS.
 * 
 * ⚠️  NEVER use this in user-facing routes! ⚠️
 * ⚠️  NEVER import this file in client components! ⚠️
 * 
 * This is for admin-only server operations like:
 * - Database seeding scripts
 * - Background jobs
 * - Admin dashboards (server-side only)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
      "This should only be set on the server, never exposed to the browser."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
