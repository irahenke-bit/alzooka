import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getServerClient } from "@/lib/supabase";

// =============================================================================
// USER-SCOPED ROUTE - Spotify token management
// Requires authentication + userId must match logged-in user
// =============================================================================

// Get current Spotify token (refreshing if needed)
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "No user ID provided" }, { status: 400 });
  }

  // GUARD: Require authenticated user and verify ownership
  const supabaseAuth = await getServerClient();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // GUARD: User can only access their own Spotify tokens
  if (user.id !== userId) {
    return NextResponse.json(
      { error: "You can only access your own Spotify tokens" },
      { status: 403 }
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 });
  }

  // Get user's Spotify tokens
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("spotify_access_token, spotify_refresh_token, spotify_token_expires_at")
    .eq("id", userId)
    .single();

  if (fetchError || !userData?.spotify_refresh_token) {
    return NextResponse.json({ error: "Spotify not connected" }, { status: 401 });
  }

  // Check if token is expired or will expire in next 5 minutes
  const expiresAt = userData.spotify_token_expires_at ? new Date(userData.spotify_token_expires_at) : null;
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
          refresh_token: userData.spotify_refresh_token,
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
          .eq("id", userId);
        
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
        .eq("id", userId);

      return NextResponse.json({ access_token: tokens.access_token });
    } catch (err) {
      console.error("Token refresh error:", err);
      return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
    }
  }

  // Token is still valid
  return NextResponse.json({ access_token: userData.spotify_access_token });
}

// Disconnect Spotify
export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "No user ID provided" }, { status: 400 });
  }

  // GUARD: Require authenticated user and verify ownership
  const supabaseAuth = await getServerClient();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // GUARD: User can only disconnect their own Spotify
  if (user.id !== userId) {
    return NextResponse.json(
      { error: "You can only disconnect your own Spotify" },
      { status: 403 }
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 });
  }

  await supabase
    .from("users")
    .update({
      spotify_access_token: null,
      spotify_refresh_token: null,
      spotify_token_expires_at: null,
      spotify_user_id: null,
    })
    .eq("id", userId);

  return NextResponse.json({ success: true });
}
