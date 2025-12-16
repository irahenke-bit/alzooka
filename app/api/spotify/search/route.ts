import { NextRequest, NextResponse } from "next/server";

// Cache the access token
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Spotify credentials not configured");
    return null;
  }

  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      console.error("Failed to get Spotify access token:", await response.text());
      return null;
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Set expiry 5 minutes before actual expiry to be safe
    tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    return accessToken;
  } catch (error) {
    console.error("Error getting Spotify access token:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const type = searchParams.get("type") || "album"; // album, track, artist

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Spotify API not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?${new URLSearchParams({
        q: query,
        type: type,
        limit: "10",
      })}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Spotify API error:", error);
      return NextResponse.json({ error: "Spotify API error" }, { status: response.status });
    }

    const data = await response.json();

    // Transform based on type
    let results: Array<{
      id: string;
      name: string;
      artist: string;
      image: string;
      uri: string;
      type: string;
    }> = [];

    if (type === "album" && data.albums) {
      results = data.albums.items.map((album: {
        id: string;
        name: string;
        artists: Array<{ name: string }>;
        images: Array<{ url: string }>;
        uri: string;
      }) => ({
        id: album.id,
        name: album.name,
        artist: album.artists.map((a) => a.name).join(", "),
        image: album.images[0]?.url || "",
        uri: album.uri,
        type: "album",
      }));
    } else if (type === "track" && data.tracks) {
      results = data.tracks.items.map((track: {
        id: string;
        name: string;
        artists: Array<{ name: string }>;
        album: { images: Array<{ url: string }> };
        uri: string;
      }) => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        image: track.album.images[0]?.url || "",
        uri: track.uri,
        type: "track",
      }));
    } else if (type === "artist" && data.artists) {
      results = data.artists.items.map((artist: {
        id: string;
        name: string;
        images: Array<{ url: string }>;
        uri: string;
      }) => ({
        id: artist.id,
        name: artist.name,
        artist: "",
        image: artist.images[0]?.url || "",
        uri: artist.uri,
        type: "artist",
      }));
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Spotify search error:", error);
    return NextResponse.json({ error: "Failed to search Spotify" }, { status: 500 });
  }
}
