import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("spotify_auth_state")?.value;
  
  // Get the full origin including www from the host header
  const host = request.headers.get("host") || "alzooka.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const siteUrl = `${protocol}://${host}`;
  const supabase = createServerClient();

  // Handle errors or user denial
  if (error) {
    return NextResponse.redirect(new URL(`/station?error=${error}`, siteUrl));
  }

  // Verify state for CSRF protection
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL("/station?error=state_mismatch", siteUrl));
  }

  // Extract userId from state (format: "userId_randomString")
  const userId = state.split("_")[0];
  if (!userId) {
    return NextResponse.redirect(new URL("/station?error=no_user", siteUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/station?error=no_code", siteUrl));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = `${siteUrl}/api/spotify/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/station?error=config_missing", siteUrl));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Spotify token error:", errorData);
      return NextResponse.redirect(new URL("/station?error=token_exchange_failed", siteUrl));
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get Spotify user profile
    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { "Authorization": `Bearer ${access_token}` },
    });
    
    const profile = profileResponse.ok ? await profileResponse.json() : null;

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Save tokens to user's profile using userId from state
    const { error: updateError } = await supabase
      .from("users")
      .update({
        spotify_access_token: access_token,
        spotify_refresh_token: refresh_token,
        spotify_token_expires_at: expiresAt,
        spotify_user_id: profile?.id || null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to save Spotify tokens:", updateError);
      return NextResponse.redirect(
        new URL(`/station?error=save_failed&details=${encodeURIComponent(updateError.message)}`, siteUrl)
      );
    }

    // Clear the state cookie and redirect to station
    const response = NextResponse.redirect(new URL("/station?spotify=connected", siteUrl));
    response.cookies.delete("spotify_auth_state");
    
    return response;
  } catch (err) {
    console.error("Spotify callback error:", err);
    return NextResponse.redirect(new URL("/station?error=callback_failed", siteUrl));
  }
}

