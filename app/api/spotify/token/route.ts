import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Get current Spotify token (refreshing if needed)
export async function GET() {
  const supabase = createServerClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's Spotify tokens
  const { data: user } = await supabase
    .from("users")
    .select("spotify_access_token, spotify_refresh_token, spotify_token_expires_at")
    .eq("id", session.user.id)
    .single();

  if (!user?.spotify_refresh_token) {
    return NextResponse.json({ error: "Spotify not connected" }, { status: 401 });
  }

  // Check if token is expired or will expire in next 5 minutes
  const expiresAt = user.spotify_token_expires_at ? new Date(user.spotify_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired) {
    // Refresh the token
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Spotify not configured" }, { status: 500 });
    }

    try {
      const refreshResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: user.spotify_refresh_token,
        }),
      });

      if (!refreshResponse.ok) {
        // Token might be revoked, clear it
        await supabase
          .from("users")
          .update({
            spotify_access_token: null,
            spotify_refresh_token: null,
            spotify_token_expires_at: null,
          })
          .eq("id", session.user.id);
        
        return NextResponse.json({ error: "Token refresh failed - please reconnect Spotify" }, { status: 401 });
      }

      const tokens = await refreshResponse.json();
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Update tokens in database
      await supabase
        .from("users")
        .update({
          spotify_access_token: tokens.access_token,
          spotify_token_expires_at: newExpiresAt,
          // Spotify may or may not return a new refresh token
          ...(tokens.refresh_token && { spotify_refresh_token: tokens.refresh_token }),
        })
        .eq("id", session.user.id);

      return NextResponse.json({ access_token: tokens.access_token });
    } catch (err) {
      console.error("Token refresh error:", err);
      return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
    }
  }

  // Token is still valid
  return NextResponse.json({ access_token: user.spotify_access_token });
}

// Disconnect Spotify
export async function DELETE() {
  const supabase = createServerClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await supabase
    .from("users")
    .update({
      spotify_access_token: null,
      spotify_refresh_token: null,
      spotify_token_expires_at: null,
      spotify_user_id: null,
    })
    .eq("id", session.user.id);

  return NextResponse.json({ success: true });
}

