import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Spotify OAuth scopes needed for playback
const SCOPES = [
  "streaming",                    // Web Playback SDK
  "user-read-email",              // Get user email
  "user-read-private",            // Get user profile
  "user-read-playback-state",     // Read playback state
  "user-modify-playback-state",   // Control playback
].join(" ");

export async function GET() {
  const supabase = createServerClient();
  
  // Check if user is logged in
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/spotify/callback`;

  if (!clientId) {
    return NextResponse.json({ error: "Spotify client ID not configured" }, { status: 500 });
  }

  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15);
  
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

