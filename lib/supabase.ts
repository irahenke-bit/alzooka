import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// =============================================================================
// BROWSER CLIENT - For client components ("use client")
// =============================================================================

let browserClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client for browser/client components.
 * Uses PKCE flow (default) for secure auth.
 * This is a singleton - reuses the same client instance.
 */
export function createBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient;
}

// =============================================================================
// SERVER CLIENT - For server components, route handlers, and server actions
// =============================================================================

/**
 * Creates a Supabase client for server-side code that needs user auth.
 * This client reads/writes cookies so it acts as the logged-in user.
 * RLS policies are respected based on the authenticated user.
 * 
 * IMPORTANT: Must be called inside a request context (not at module level).
 * 
 * Usage:
 *   const supabase = await createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export async function createServerClient() {
  // Dynamic import to avoid "next/headers" being evaluated at module level
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method is called from Server Components where
            // cookies cannot be modified. This is expected and can be ignored
            // when just reading the session.
          }
        },
      },
    }
  );
}

// =============================================================================
// ANON SERVER CLIENT - For server code that doesn't need user context
// =============================================================================

/**
 * Creates a simple Supabase client for server-side code that doesn't need
 * user authentication (e.g., public data queries, health checks).
 * Does NOT have access to user session - use createServerClient() for that.
 */
export function createAnonServerClient() {
  // Using dynamic import to avoid issues with createClient in edge runtime
  const { createClient } = require("@supabase/supabase-js");
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}
