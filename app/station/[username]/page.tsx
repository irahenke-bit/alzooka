"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Header from "@/app/components/Header";
import { useMiniPlayer, TrackInfo, SpotifyPlayer } from "@/app/contexts/MiniPlayerContext";
import Link from "next/link";

type StationAlbum = {
  id: string;
  spotify_uri: string;
  spotify_name: string;
  spotify_artist: string;
  spotify_image_url: string;
  is_selected: boolean;
  display_order: number;
};

type StationGroup = {
  id: string;
  name: string;
  color: string;
  display_order: number;
};

type StationPlaylist = {
  id: string;
  name: string;
  display_order: number;
};

type SpotifyTrack = {
  uri: string;
  name: string;
  artist: string;
  album?: string;
  image: string;
  duration_ms: number;
};

type Station = {
  id: string;
  name: string;
  owner_id: string;
};

type StationOwner = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ViewStationPage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();
  const supabase = createBrowserClient();
  const miniPlayer = useMiniPlayer();

  // Current user (viewer)
  const [user, setUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Station owner info
  const [stationOwner, setStationOwner] = useState<StationOwner | null>(null);
  const [station, setStation] = useState<Station | null>(null);

  // Station content (read-only)
  const [albums, setAlbums] = useState<StationAlbum[]>([]);
  const [groups, setGroups] = useState<StationGroup[]>([]);
  const [albumGroups, setAlbumGroups] = useState<Record<string, string[]>>({});
  const [playlists, setPlaylists] = useState<StationPlaylist[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, SpotifyTrack[]>>({});
  const [playlistGroups, setPlaylistGroups] = useState<Record<string, string[]>>({});

  // Viewer's own station (for adding albums)
  const [viewerStation, setViewerStation] = useState<{ id: string } | null>(null);
  const [viewerAlbumUris, setViewerAlbumUris] = useState<Set<string>>(new Set());

  // UI state
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [addingAlbum, setAddingAlbum] = useState<string | null>(null);
  const [copiedAlbums, setCopiedAlbums] = useState<Set<string>>(new Set());
  const [copyingPlaylist, setCopyingPlaylist] = useState<string | null>(null);
  const [copiedPlaylists, setCopiedPlaylists] = useState<Set<string>>(new Set());

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyPlayer, setSpotifyPlayer] = useState<SpotifyPlayer | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  // Sync player from context
  useEffect(() => {
    if (miniPlayer.spotifyPlayer && miniPlayer.spotifyDeviceId) {
      setSpotifyPlayer(miniPlayer.spotifyPlayer);
      setSpotifyDeviceId(miniPlayer.spotifyDeviceId);
      setPlayerReady(miniPlayer.playerReady);
      setSpotifyToken(miniPlayer.spotifyToken);
    }
  }, [miniPlayer.spotifyPlayer, miniPlayer.spotifyDeviceId, miniPlayer.playerReady, miniPlayer.spotifyToken]);

  // Sync current track from context
  useEffect(() => {
    if (miniPlayer.currentTrack) {
      setCurrentTrack(miniPlayer.currentTrack);
    }
    setIsPlaying(miniPlayer.isPlaying);
  }, [miniPlayer.currentTrack, miniPlayer.isPlaying]);

  useEffect(() => {
    async function init() {
      // Get current user (viewer)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      // Get viewer's username and avatar
      const { data: viewerData } = await supabase
        .from("users")
        .select("username, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (viewerData) {
        setUserUsername(viewerData.username);
        setUserAvatarUrl(viewerData.avatar_url);
      }

      // Get viewer's station (for adding albums)
      const { data: viewerStationData } = await supabase
        .from("stations")
        .select("id")
        .eq("owner_id", session.user.id)
        .single();

      if (viewerStationData) {
        setViewerStation(viewerStationData);

        // Get viewer's existing album URIs
        const { data: viewerAlbums } = await supabase
          .from("station_albums")
          .select("spotify_uri")
          .eq("station_id", viewerStationData.id);

        if (viewerAlbums) {
          setViewerAlbumUris(new Set(viewerAlbums.map(a => a.spotify_uri)));
        }
      }

      // Get station owner by username
      const { data: ownerData, error: ownerError } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .ilike("username", username)
        .single();

      console.log("Owner lookup:", { ownerData, ownerError, username });

      if (!ownerData) {
        // User not found
        setLoading(false);
        return;
      }

      // Check if viewing own station - redirect to main station page
      if (ownerData.id === session.user.id) {
        router.push("/station");
        return;
      }

      setStationOwner(ownerData);

      // Get their station
      const { data: stationData, error: stationError } = await supabase
        .from("stations")
        .select("id, name, owner_id")
        .eq("owner_id", ownerData.id)
        .single();

      console.log("Station lookup:", { stationData, stationError });

      if (!stationData) {
        // No station
        setLoading(false);
        return;
      }

      setStation(stationData);

      // Load albums
      const { data: albumsData, error: albumsError } = await supabase
        .from("station_albums")
        .select("*")
        .eq("station_id", stationData.id)
        .order("created_at", { ascending: false });

      console.log("Albums query result:", { albumsData, albumsError, stationId: stationData.id });

      if (albumsData) {
        setAlbums(albumsData);

        // Load album-group relationships
        const albumIds = albumsData.map(a => a.id);
        if (albumIds.length > 0) {
          const { data: albumGroupsData } = await supabase
            .from("station_album_groups")
            .select("album_id, group_id")
            .in("album_id", albumIds);

          if (albumGroupsData) {
            const mapping: Record<string, string[]> = {};
            for (const ag of albumGroupsData) {
              if (!mapping[ag.album_id]) mapping[ag.album_id] = [];
              mapping[ag.album_id].push(ag.group_id);
            }
            setAlbumGroups(mapping);
          }
        }
      }

      // Load groups
      const { data: groupsData } = await supabase
        .from("station_groups")
        .select("*")
        .eq("station_id", stationData.id)
        .order("display_order", { ascending: true });

      if (groupsData) {
        setGroups(groupsData);
      }

      // Load playlists
      const { data: playlistsData } = await supabase
        .from("station_playlists")
        .select("*")
        .eq("station_id", stationData.id)
        .order("display_order", { ascending: true });

      if (playlistsData) {
        setPlaylists(playlistsData);

        // Load playlist-group relationships
        const playlistIds = playlistsData.map(p => p.id);
        if (playlistIds.length > 0) {
          const { data: playlistGroupsData } = await supabase
            .from("station_playlist_groups")
            .select("playlist_id, group_id")
            .in("playlist_id", playlistIds);

          if (playlistGroupsData) {
            const mapping: Record<string, string[]> = {};
            for (const pg of playlistGroupsData) {
              if (!mapping[pg.playlist_id]) mapping[pg.playlist_id] = [];
              mapping[pg.playlist_id].push(pg.group_id);
            }
            setPlaylistGroups(mapping);
          }
        }
      }

      // Initialize Spotify for viewer
      await miniPlayer.initializeSpotify(session.user.id);

      setLoading(false);
    }

    init();
  }, [supabase, router, username, miniPlayer]);

  // Add album to viewer's station
  async function handleAddAlbumToMyStation(album: StationAlbum) {
    if (!viewerStation || viewerAlbumUris.has(album.spotify_uri)) return;

    setAddingAlbum(album.id);

    try {
      // Get current max display order
      const { data: existingAlbums } = await supabase
        .from("station_albums")
        .select("display_order")
        .eq("station_id", viewerStation.id)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = existingAlbums && existingAlbums.length > 0 
        ? (existingAlbums[0].display_order || 0) + 1 
        : 0;

      // Add album to viewer's station
      await supabase
        .from("station_albums")
        .insert({
          station_id: viewerStation.id,
          spotify_uri: album.spotify_uri,
          spotify_name: album.spotify_name,
          spotify_artist: album.spotify_artist,
          spotify_image_url: album.spotify_image_url,
          is_selected: false,
          display_order: nextOrder,
        });

      // Update local state
      setViewerAlbumUris(prev => new Set([...prev, album.spotify_uri]));
      setCopiedAlbums(prev => new Set([...prev, album.id]));
    } catch (err) {
      console.error("Failed to add album:", err);
    }

    setAddingAlbum(null);
  }

  // Load playlist tracks
  async function loadPlaylistTracks(playlistId: string) {
    if (playlistTracks[playlistId]) return;

    const { data } = await supabase
      .from("station_playlist_tracks")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("track_order", { ascending: true });

    if (data) {
      const tracks: SpotifyTrack[] = data.map(t => ({
        uri: t.spotify_uri,
        name: t.spotify_name,
        artist: t.spotify_artist,
        album: t.spotify_album,
        image: t.spotify_image_url || "",
        duration_ms: t.duration_ms || 0,
      }));
      setPlaylistTracks(prev => ({ ...prev, [playlistId]: tracks }));
    }
  }

  // Copy entire playlist to viewer's station
  async function handleCopyPlaylistToMyStation(playlist: StationPlaylist) {
    if (!viewerStation || copiedPlaylists.has(playlist.id)) return;

    setCopyingPlaylist(playlist.id);

    try {
      // Load tracks if not already loaded
      let tracks = playlistTracks[playlist.id];
      if (!tracks) {
        const { data } = await supabase
          .from("station_playlist_tracks")
          .select("*")
          .eq("playlist_id", playlist.id)
          .order("track_order", { ascending: true });

        if (data) {
          tracks = data.map(t => ({
            uri: t.spotify_uri,
            name: t.spotify_name,
            artist: t.spotify_artist,
            album: t.spotify_album,
            image: t.spotify_image_url || "",
            duration_ms: t.duration_ms || 0,
          }));
        }
      }

      if (!tracks || tracks.length === 0) {
        setCopyingPlaylist(null);
        return;
      }

      // Get current max display order for playlists
      const { data: existingPlaylists } = await supabase
        .from("station_playlists")
        .select("display_order")
        .eq("station_id", viewerStation.id)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = existingPlaylists && existingPlaylists.length > 0 
        ? (existingPlaylists[0].display_order || 0) + 1 
        : 0;

      // Create the playlist in viewer's station
      const { data: newPlaylist, error: playlistError } = await supabase
        .from("station_playlists")
        .insert({
          station_id: viewerStation.id,
          name: `${playlist.name} (from ${stationOwner?.username})`,
          display_order: nextOrder,
        })
        .select()
        .single();

      if (playlistError || !newPlaylist) {
        console.error("Failed to create playlist:", playlistError);
        setCopyingPlaylist(null);
        return;
      }

      // Add all tracks to the new playlist
      const trackInserts = tracks.map((track, idx) => ({
        playlist_id: newPlaylist.id,
        spotify_uri: track.uri,
        spotify_name: track.name,
        spotify_artist: track.artist,
        spotify_album: track.album || "",
        spotify_image_url: track.image || "",
        duration_ms: track.duration_ms || 0,
        track_order: idx,
      }));

      await supabase
        .from("station_playlist_tracks")
        .insert(trackInserts);

      setCopiedPlaylists(prev => new Set([...prev, playlist.id]));
    } catch (err) {
      console.error("Failed to copy playlist:", err);
    }

    setCopyingPlaylist(null);
  }

  // Shuffle play all albums
  async function handleShufflePlayAll() {
    if (!spotifyDeviceId || !spotifyToken || !spotifyPlayer) {
      alert("Please connect Spotify on your station first");
      return;
    }

    if (albums.length === 0) {
      alert("No albums to play");
      return;
    }

    try {
      await spotifyPlayer.activateElement();

      // Transfer playback to device
      await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [spotifyDeviceId],
          play: false,
        }),
      });

      // Fetch tracks from all albums in parallel
      const trackPromises = albums.map(async (album) => {
        const albumId = album.spotify_uri.split(":")[2];
        const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`, {
          headers: { "Authorization": `Bearer ${spotifyToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data.items.map((t: { uri: string }) => t.uri);
        }
        return [];
      });

      const trackArrays = await Promise.all(trackPromises);
      const allTracks = trackArrays.flat();

      if (allTracks.length === 0) {
        alert("No tracks found");
        return;
      }

      // Shuffle
      for (let i = allTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
      }

      // Start playback
      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: allTracks.slice(0, 100),
          position_ms: 0,
        }),
      });

      if (playRes.ok) {
        miniPlayer.setPlaybackContext({
          type: "shuffle_group",
          trackUris: allTracks.slice(0, 100),
          sourceStation: stationOwner ? {
            username: stationOwner.username,
            displayName: stationOwner.display_name || stationOwner.username,
            avatarUrl: stationOwner.avatar_url || undefined,
          } : undefined,
        });
        miniPlayer.setPlayerState("playing");
      }
    } catch (err) {
      console.error("Playback error:", err);
    }
  }

  // Shuffle play a specific group
  async function handleShuffleGroup(groupId: string) {
    if (!spotifyDeviceId || !spotifyToken || !spotifyPlayer) {
      alert("Please connect Spotify on your station first");
      return;
    }

    // Get albums in this group
    const groupAlbums = albums.filter(a => (albumGroups[a.id] || []).includes(groupId));
    
    if (groupAlbums.length === 0) {
      alert("No albums in this group");
      return;
    }

    try {
      await spotifyPlayer.activateElement();

      // Transfer playback
      await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [spotifyDeviceId],
          play: false,
        }),
      });

      // Fetch tracks in parallel
      const trackPromises = groupAlbums.map(async (album) => {
        const albumId = album.spotify_uri.split(":")[2];
        const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`, {
          headers: { "Authorization": `Bearer ${spotifyToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data.items.map((t: { uri: string }) => t.uri);
        }
        return [];
      });

      const trackArrays = await Promise.all(trackPromises);
      const allTracks = trackArrays.flat();

      // Shuffle
      for (let i = allTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
      }

      // Start playback
      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: allTracks.slice(0, 100),
          position_ms: 0,
        }),
      });

      if (playRes.ok) {
        miniPlayer.setPlaybackContext({
          type: "shuffle_group",
          trackUris: allTracks.slice(0, 100),
          sourceStation: stationOwner ? {
            username: stationOwner.username,
            displayName: stationOwner.display_name || stationOwner.username,
            avatarUrl: stationOwner.avatar_url || undefined,
          } : undefined,
        });
        miniPlayer.setPlayerState("playing");
      }
    } catch (err) {
      console.error("Playback error:", err);
    }
  }

  // Play a single album
  async function handlePlayAlbum(album: StationAlbum) {
    if (!spotifyDeviceId || !spotifyToken || !spotifyPlayer) {
      alert("Please connect Spotify on your station first");
      return;
    }

    try {
      await spotifyPlayer.activateElement();

      // Transfer playback
      await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [spotifyDeviceId],
          play: false,
        }),
      });

      // Fetch album tracks
      const albumId = album.spotify_uri.split(":")[2];
      const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`, {
        headers: { "Authorization": `Bearer ${spotifyToken}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      const trackUris = data.items.map((t: { uri: string }) => t.uri);

      // Start playback
      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: trackUris,
          position_ms: 0,
        }),
      });

      if (playRes.ok) {
        miniPlayer.setPlaybackContext({
          type: "album",
          uri: album.spotify_uri,
          trackUris,
          sourceStation: stationOwner ? {
            username: stationOwner.username,
            displayName: stationOwner.display_name || stationOwner.username,
            avatarUrl: stationOwner.avatar_url || undefined,
          } : undefined,
        });
        miniPlayer.setPlayerState("playing");
      }
    } catch (err) {
      console.error("Playback error:", err);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading station...</p>
      </div>
    );
  }

  if (!stationOwner) {
    return (
      <>
        <Header user={user} userUsername={userUsername} userAvatarUrl={userAvatarUrl} />
        <div className="container" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
          <h1>User not found</h1>
          <p className="text-muted">The user &quot;{username}&quot; doesn't exist.</p>
          <Link href="/" style={{ color: "var(--accent)" }}>← Back to Feed</Link>
        </div>
      </>
    );
  }

  if (!station) {
    return (
      <>
        <Header user={user} userUsername={userUsername} userAvatarUrl={userAvatarUrl} />
        <div className="container" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
          <h1>{stationOwner.display_name || stationOwner.username}'s Station</h1>
          <p className="text-muted">This user hasn't set up their station yet.</p>
          <Link href={`/profile/${stationOwner.username}`} style={{ color: "var(--accent)" }}>
            ← Visit their profile
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Header user={user} userUsername={userUsername} userAvatarUrl={userAvatarUrl} />

      <div className="container" style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px" }}>
        {/* Station Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(30, 215, 96, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            {stationOwner.avatar_url && (
              <img
                src={stationOwner.avatar_url}
                alt=""
                style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
              />
            )}
            <div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 }}>
                Visiting Station
              </p>
              <h1 style={{ margin: "4px 0", fontSize: 28 }}>{station.name}</h1>
              <p style={{ margin: 0, opacity: 0.7 }}>
                by <Link href={`/profile/${stationOwner.username}`} style={{ color: "var(--accent)" }}>
                  {stationOwner.display_name || stationOwner.username}
                </Link>
              </p>
            </div>
          </div>

          {/* Your current playback */}
          {currentTrack && (
            <div style={{
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              {currentTrack.image && (
                <img src={currentTrack.image} alt="" style={{ width: 40, height: 40, borderRadius: 4 }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  {isPlaying ? "🎵 Now Playing" : "⏸ Paused"}
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                  {currentTrack.name} • {currentTrack.artist}
                </p>
              </div>
              <button
                onClick={() => miniPlayer.onTogglePlay()}
                style={{
                  background: "#1DB954",
                  border: "none",
                  borderRadius: 20,
                  padding: "8px 16px",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
            </div>
          )}

          {/* Shuffle Play Button */}
          {albums.length > 0 && playerReady && (
            <button
              onClick={handleShufflePlayAll}
              style={{
                marginTop: 16,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                background: "#1DB954",
                color: "#fff",
                border: "none",
                borderRadius: 24,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🔀 Shuffle Play ({albums.length} albums)
            </button>
          )}

          {!playerReady && (
            <p style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>
              Connect Spotify on <Link href="/station" style={{ color: "var(--accent)" }}>your station</Link> to play music
            </p>
          )}
        </div>

        {/* Groups */}
        {groups.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Groups</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {groups.map(group => {
                const groupAlbumCount = albums.filter(a => (albumGroups[a.id] || []).includes(group.id)).length;
                return (
                  <button
                    key={group.id}
                    onClick={() => handleShuffleGroup(group.id)}
                    disabled={!playerReady || groupAlbumCount === 0}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      background: `${group.color}22`,
                      color: group.color,
                      border: `1px solid ${group.color}`,
                      borderRadius: 20,
                      cursor: playerReady && groupAlbumCount > 0 ? "pointer" : "not-allowed",
                      opacity: groupAlbumCount === 0 ? 0.5 : 1,
                    }}
                  >
                    🔀 {group.name} ({groupAlbumCount})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Albums Grid */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Albums ({albums.length})</h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}>
            {albums.map(album => {
              const alreadyHave = viewerAlbumUris.has(album.spotify_uri);
              const justCopied = copiedAlbums.has(album.id);
              const isAdding = addingAlbum === album.id;
              const albumGroupsList = (albumGroups[album.id] || [])
                .map(gid => groups.find(g => g.id === gid))
                .filter(Boolean);

              return (
                <div
                  key={album.id}
                  style={{
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <img
                      src={album.spotify_image_url}
                      alt={album.spotify_name}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }}
                    />
                    {/* Play button overlay */}
                    {playerReady && (
                      <button
                        onClick={() => handlePlayAlbum(album)}
                        style={{
                          position: "absolute",
                          bottom: 8,
                          right: 8,
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "#1DB954",
                          border: "none",
                          color: "#fff",
                          fontSize: 16,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        }}
                        title="Play album"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                  <div style={{ padding: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                      {album.spotify_name}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.7 }}>
                      {album.spotify_artist}
                    </p>

                    {/* Group labels */}
                    {albumGroupsList.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {albumGroupsList.map(g => g && (
                          <span
                            key={g.id}
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: `${g.color}33`,
                              color: g.color,
                            }}
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Add to my station button */}
                    <button
                      onClick={() => handleAddAlbumToMyStation(album)}
                      disabled={alreadyHave || isAdding || !viewerStation}
                      style={{
                        marginTop: 8,
                        width: "100%",
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        background: alreadyHave || justCopied
                          ? "rgba(30, 215, 96, 0.2)"
                          : "rgba(107, 140, 174, 0.2)",
                        color: alreadyHave || justCopied
                          ? "#1DB954"
                          : "var(--accent)",
                        border: alreadyHave || justCopied
                          ? "1px solid rgba(30, 215, 96, 0.4)"
                          : "1px solid rgba(107, 140, 174, 0.4)",
                        borderRadius: 6,
                        cursor: alreadyHave || isAdding ? "not-allowed" : "pointer",
                        opacity: isAdding ? 0.5 : 1,
                      }}
                    >
                      {isAdding ? "Adding..." : alreadyHave ? "✓ In My Station" : justCopied ? "✓ Added!" : "+ Add to My Station"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playlists */}
        {playlists.length > 0 && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Playlists ({playlists.length})</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {playlists.map(playlist => {
                const isExpanded = expandedPlaylist === playlist.id;
                const tracks = playlistTracks[playlist.id] || [];
                const playlistGroupsList = (playlistGroups[playlist.id] || [])
                  .map(gid => groups.find(g => g.id === gid))
                  .filter(Boolean);

                return (
                  <div
                    key={playlist.id}
                    style={{
                      background: "rgba(0, 0, 0, 0.2)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedPlaylist(null);
                        } else {
                          setExpandedPlaylist(playlist.id);
                          loadPlaylistTracks(playlist.id);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: 12,
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>📋</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{playlist.name}</span>
                      {playlistGroupsList.map(g => g && (
                        <span
                          key={g.id}
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: `${g.color}33`,
                            color: g.color,
                          }}
                        >
                          {g.name}
                        </span>
                      ))}
                      <span style={{ opacity: 0.5 }}>{isExpanded ? "▼" : "▶"}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: "0 12px 12px" }}>
                        {tracks.length === 0 ? (
                          <p style={{ opacity: 0.5, fontSize: 13 }}>Loading tracks...</p>
                        ) : (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {tracks.map((track, idx) => (
                                <div
                                  key={track.uri}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: 8,
                                    background: "rgba(255,255,255,0.03)",
                                    borderRadius: 4,
                                  }}
                                >
                                  <span style={{ opacity: 0.5, fontSize: 12, width: 20 }}>{idx + 1}</span>
                                  {track.image && (
                                    <img src={track.image} alt="" style={{ width: 32, height: 32, borderRadius: 4 }} />
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{track.name}</p>
                                    <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{track.artist}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Copy playlist button */}
                            {viewerStation && (
                              <button
                                onClick={() => handleCopyPlaylistToMyStation(playlist)}
                                disabled={copiedPlaylists.has(playlist.id) || copyingPlaylist === playlist.id}
                                style={{
                                  marginTop: 12,
                                  width: "100%",
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: copiedPlaylists.has(playlist.id)
                                    ? "rgba(30, 215, 96, 0.2)"
                                    : "rgba(107, 140, 174, 0.2)",
                                  color: copiedPlaylists.has(playlist.id)
                                    ? "#1DB954"
                                    : "var(--accent)",
                                  border: copiedPlaylists.has(playlist.id)
                                    ? "1px solid rgba(30, 215, 96, 0.4)"
                                    : "1px solid rgba(107, 140, 174, 0.4)",
                                  borderRadius: 6,
                                  cursor: copiedPlaylists.has(playlist.id) || copyingPlaylist === playlist.id 
                                    ? "not-allowed" 
                                    : "pointer",
                                  opacity: copyingPlaylist === playlist.id ? 0.5 : 1,
                                }}
                              >
                                {copyingPlaylist === playlist.id 
                                  ? "Copying..." 
                                  : copiedPlaylists.has(playlist.id) 
                                    ? "✓ Copied to My Station" 
                                    : `+ Copy Playlist (${tracks.length} songs)`}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {albums.length === 0 && playlists.length === 0 && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p className="text-muted">This station is empty.</p>
          </div>
        )}
      </div>
    </>
  );
}

