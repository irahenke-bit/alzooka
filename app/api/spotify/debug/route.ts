import { NextResponse } from "next/server";
import { createServerClient, createServerClientWithCookies } from "@/lib/supabase";
import { cookies } from "next/headers";

// Debug endpoint to check Spotify token status
export async function GET() {
  // Get all cookies for debugging
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map(c => c.name);
  
  // Try the new cookie-aware client
  const { supabase, cookies: authCookies } = await createServerClientWithCookies();
  
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  // Also try a direct lookup by a known user ID to test DB access
  const testSupabase = createServerClient();
  const { data: anyUser } = await testSupabase
    .from("users")
    .select("id, spotify_access_token, spotify_refresh_token")
    .not("spotify_refresh_token", "is", null)
    .limit(1);
  
  if (!session) {
    return NextResponse.json({ 
      error: "Not authenticated",
      hasSession: false,
      cookieNames,
      authCookies,
      sessionError: sessionError?.message || null,
      // Check if any user has Spotify connected
      anyUserWithSpotify: anyUser && anyUser.length > 0,
    });
  }

  // Get user's Spotify tokens
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, spotify_access_token, spotify_refresh_token, spotify_token_expires_at, spotify_user_id")
    .eq("id", session.user.id)
    .single();

  if (userError) {
    return NextResponse.json({ 
      error: "User fetch error",
      details: userError.message,
      code: userError.code,
      userId: session.user.id
    }, { status: 500 });
  }

  return NextResponse.json({
    userId: session.user.id,
    hasAccessToken: !!user?.spotify_access_token,
    hasRefreshToken: !!user?.spotify_refresh_token,
    tokenExpiresAt: user?.spotify_token_expires_at || null,
    spotifyUserId: user?.spotify_user_id || null,
    accessTokenPreview: user?.spotify_access_token 
      ? `${user.spotify_access_token.slice(0, 10)}...${user.spotify_access_token.slice(-5)}`
      : null,
  });
}

