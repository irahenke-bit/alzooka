import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Debug endpoint to check Spotify token status
export async function GET() {
  const supabase = createServerClient();
  
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    return NextResponse.json({ 
      error: "Session error", 
      details: sessionError.message 
    }, { status: 401 });
  }
  
  if (!session) {
    return NextResponse.json({ 
      error: "Not authenticated",
      hasSession: false
    }, { status: 401 });
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
    // Show first/last chars of tokens for debugging
    accessTokenPreview: user?.spotify_access_token 
      ? `${user.spotify_access_token.slice(0, 10)}...${user.spotify_access_token.slice(-5)}`
      : null,
  });
}

