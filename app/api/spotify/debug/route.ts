import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Debug endpoint to check Spotify token status
export async function GET() {
  // Get all cookies for debugging
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map(c => c.name);
  
  // Get auth cookies specifically
  const authCookies: Record<string, string> = {};
  for (const cookie of allCookies) {
    if (cookie.name.includes('auth') || cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
      authCookies[cookie.name] = cookie.value.slice(0, 50) + '...';
    }
  }
  
  // Find the session token cookie and try to parse it
  const sessionCookie = allCookies.find(c => 
    c.name.includes('auth-token') || 
    (c.name.includes('sb-') && c.name.includes('-auth-token'))
  );
  
  let sessionFromCookie = null;
  if (sessionCookie) {
    try {
      const tokenData = JSON.parse(sessionCookie.value);
      if (tokenData.access_token) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(url, key, { auth: { persistSession: false } });
        await supabase.auth.setSession({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
        });
        const { data: { session } } = await supabase.auth.getSession();
        sessionFromCookie = session;
      }
    } catch {
      // Cookie might not be JSON
    }
  }
  
  // Also try a direct lookup to see if Spotify tokens were saved
  const testSupabase = createServerClient();
  const { data: anyUser } = await testSupabase
    .from("users")
    .select("id, spotify_refresh_token")
    .not("spotify_refresh_token", "is", null)
    .limit(1);
  
  // Also check the specific user we know about
  const knownUserId = "5aa34cc1-ed8e-4b31-9b88-12ffe6de250a";
  const { data: knownUser, error: knownUserError } = await testSupabase
    .from("users")
    .select("id, spotify_access_token, spotify_refresh_token, spotify_token_expires_at, spotify_user_id")
    .eq("id", knownUserId)
    .single();

  return NextResponse.json({
    cookieNames,
    authCookies,
    sessionCookieFound: !!sessionCookie,
    sessionFromCookie: sessionFromCookie ? { userId: sessionFromCookie.user?.id } : null,
    anyUserWithSpotify: anyUser && anyUser.length > 0 ? anyUser[0].id : null,
    knownUser: {
      id: knownUser?.id,
      hasAccessToken: !!knownUser?.spotify_access_token,
      hasRefreshToken: !!knownUser?.spotify_refresh_token,
      spotifyUserId: knownUser?.spotify_user_id,
      error: knownUserError?.message,
    }
  });
}

