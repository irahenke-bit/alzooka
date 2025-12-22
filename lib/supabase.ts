import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton browser client
let browserClient: SupabaseClient | null = null

// Browser client for auth and client-side operations
export function createBrowserClient() {
  if (browserClient) {
    return browserClient
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  browserClient = createClient(url, key, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'implicit',
    }
  })
  return browserClient
}

// Server client for API routes and server components
export function createServerClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient(url, key, {
    auth: { persistSession: false }
  })
}

