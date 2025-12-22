import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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

// Server client that reads auth from cookies (for API routes)
export async function createServerClientWithCookies() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }
  
  const cookieStore = await cookies()
  
  // Get all auth-related cookies
  const allCookies = cookieStore.getAll()
  const authCookies: Record<string, string> = {}
  
  for (const cookie of allCookies) {
    if (cookie.name.includes('auth') || cookie.name.includes('supabase')) {
      authCookies[cookie.name] = cookie.value
    }
  }
  
  // Find the session token cookie
  const sessionCookie = allCookies.find(c => 
    c.name.includes('auth-token') || 
    c.name.includes('sb-') && c.name.includes('-auth-token')
  )
  
  const supabase = createClient(url, key, {
    auth: { persistSession: false }
  })
  
  // If we have a session cookie, try to set the session
  if (sessionCookie) {
    try {
      const tokenData = JSON.parse(sessionCookie.value)
      if (tokenData.access_token) {
        await supabase.auth.setSession({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
        })
      }
    } catch {
      // Cookie might not be JSON, ignore
    }
  }
  
  return { supabase, cookies: authCookies }
}

