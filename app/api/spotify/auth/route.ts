import { NextRequest, NextResponse } from "next/server";

// Spotify OAuth scopes needed for playback
const SCOPES = [
  "streaming",                    // Web Playback SDK
  "user-read-email",              // Get user email
  "user-read-private",            // Get user profile
  "user-read-playback-state",     // Read playback state
  "user-modify-playback-state",   // Control playback
].join(" ");

export async function GET(request: NextRequest) {
  // Get the full origin including www from the host header
  const host = request.headers.get("host") || "alzooka.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  
  // Get user ID from the query param (passed from client)
  const userId = request.nextUrl.searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.redirect(new URL("/station?error=no_user_id", origin));
  }
  
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = `${origin}/api/spotify/callback`;

  if (!clientId) {
    return NextResponse.json({ error: "Spotify client ID not configured" }, { status: 500 });
  }

  // Generate a random state for CSRF protection, include userId
  const state = `${userId}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Store state in cookie for verification
  const response = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${state}`
  );
  
  response.cookies.set("spotify_auth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}

