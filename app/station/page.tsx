"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Header from "@/app/components/Header";
import { SpotifySearchModal } from "@/app/components/SpotifySearchModal";

type SpotifyResult = {
  id: string;
  name: string;
  artist: string;
  image: string;
  uri: string;
  type: string;
};

type Station = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type StationAlbum = {
  id: string;
  station_id: string;
  spotify_uri: string;
  spotify_type: string;
  spotify_name: string;
  spotify_artist: string | null;
  spotify_image_url: string | null;
  spotify_url: string;
  is_selected: boolean;
  created_at: string;
};

type StationGroup = {
  id: string;
  station_id: string;
  name: string;
  color: string;
  created_at: string;
};

// Spotify Player types
declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (state: unknown) => void) => void;
  removeListener: (event: string) => void;
  getCurrentState: () => Promise<unknown>;
  setName: (name: string) => void;
  getVolume: () => Promise<number>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (position_ms: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  activateElement: () => Promise<void>;
}

// Preset colors for groups
const GROUP_COLORS = [
  "#1DB954", // Spotify green
  "#E91E63", // Pink
  "#9C27B0", // Purple
  "#3F51B5", // Indigo
  "#2196F3", // Blue
  "#00BCD4", // Cyan
  "#FF9800", // Orange
  "#F44336", // Red
  "#795548", // Brown
  "#607D8B", // Blue Grey
];

export default function StationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState<Station | null>(null);
  const [albums, setAlbums] = useState<StationAlbum[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stationName, setStationName] = useState("");
  const [showSpotifySearch, setShowSpotifySearch] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectAll, setSelectAll] = useState(true);
  const [manualSelections, setManualSelections] = useState<Set<string>>(new Set());
  
  // Groups state
  const [groups, setGroups] = useState<StationGroup[]>([]);
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());
  const [albumGroups, setAlbumGroups] = useState<Record<string, string[]>>({}); // albumId -> groupIds
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingAlbumGroups, setEditingAlbumGroups] = useState<string | null>(null);
  const [bulkAddGroup, setBulkAddGroup] = useState<string | null>(null); // Group ID for bulk adding albums
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
  
  // Spotify state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyPlayer, setSpotifyPlayer] = useState<SpotifyPlayer | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ name: string; artist: string; image: string } | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  
  const router = useRouter();
  const supabase = createBrowserClient();
  
  // Check for error params in URL
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      const details = params.get("details");
      const uri = params.get("uri");
      if (error) {
        let msg = error;
        if (details) msg += `: ${details}`;
        if (uri) msg += ` (URI: ${uri})`;
        setAuthError(msg);
      }
    }
  }, []);

  // Check Spotify connection and load SDK
  useEffect(() => {
    if (!user) return;
    
    async function checkSpotifyConnection() {
      try {
        const response = await fetch(`/api/spotify/token?userId=${user!.id}`);
        if (response.ok) {
          const data = await response.json();
          setSpotifyToken(data.access_token);
          setSpotifyConnected(true);
        } else {
          setSpotifyConnected(false);
        }
      } catch {
        setSpotifyConnected(false);
      }
    }
    
    checkSpotifyConnection();
  }, [user]);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (!spotifyToken) return;

    // Load the Spotify SDK script
    if (!document.getElementById("spotify-sdk")) {
      const script = document.createElement("script");
      script.id = "spotify-sdk";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Alzooka FM",
        getOAuthToken: (cb) => {
          // Refresh token if needed
          if (user) {
            fetch(`/api/spotify/token?userId=${user.id}`)
              .then(res => res.json())
              .then(data => cb(data.access_token))
              .catch(() => cb(spotifyToken || ""));
          } else {
            cb(spotifyToken || "");
          }
        },
        volume: 0.5,
      });

      // Error handling
      player.addListener("initialization_error", (e) => {
        const error = e as { message: string };
        console.error("Spotify init error:", error.message);
      });
      player.addListener("authentication_error", (e) => {
        const error = e as { message: string };
        console.error("Spotify auth error:", error.message);
        setSpotifyConnected(false);
      });
      player.addListener("account_error", (e) => {
        const error = e as { message: string };
        console.error("Spotify account error:", error.message);
        alert("Spotify Premium is required for playback");
      });

      // Ready
      player.addListener("ready", (e) => {
        const data = e as { device_id: string };
        console.log("Spotify player ready, device ID:", data.device_id);
        setSpotifyDeviceId(data.device_id);
        setPlayerReady(true);
      });

      // Player state changes
      player.addListener("player_state_changed", (e) => {
        const state = e as {
          paused: boolean;
          track_window: {
            current_track: {
              name: string;
              artists: { name: string }[];
              album: { images: { url: string }[] };
            };
          };
        } | null;
        if (!state) return;
        setIsPlaying(!state.paused);
        if (state.track_window?.current_track) {
          setCurrentTrack({
            name: state.track_window.current_track.name,
            artist: state.track_window.current_track.artists.map(a => a.name).join(", "),
            image: state.track_window.current_track.album.images[0]?.url || "",
          });
        }
      });

      player.connect();
      setSpotifyPlayer(player);
    };

    // If SDK already loaded, initialize
    if (window.Spotify) {
      window.onSpotifyWebPlaybackSDKReady();
    }

    return () => {
      if (spotifyPlayer) {
        spotifyPlayer.disconnect();
      }
    };
  }, [spotifyToken]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }
      
      setUser(session.user);
      
      // Get user's profile data
      const { data: userData } = await supabase
        .from("users")
        .select("display_name, username, avatar_url")
        .eq("id", session.user.id)
        .single();
      
      if (userData) {
        const firstName = (userData.display_name || userData.username || "").split(" ")[0];
        setUserDisplayName(firstName);
        setUserUsername(userData.username);
        setUserAvatarUrl(userData.avatar_url);
        setStationName(`${firstName}'s Radio Station`);
      }
      
      // Check if user has a station
      const { data: stationData } = await supabase
        .from("stations")
        .select("*")
        .eq("owner_id", session.user.id)
        .single();
      
      if (stationData) {
        setStation(stationData);
        
        // Load albums
        const { data: albumsData } = await supabase
          .from("station_albums")
          .select("*")
          .eq("station_id", stationData.id)
          .order("created_at", { ascending: false });
        
        if (albumsData) {
          setAlbums(albumsData);
          
          // Build manual selections set from currently selected albums
          const selected = new Set(albumsData.filter(a => a.is_selected).map(a => a.id));
          setManualSelections(selected);
          
          // Check if all are selected
          setSelectAll(albumsData.length > 0 && albumsData.every(a => a.is_selected));
          
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
          .order("created_at", { ascending: true });
        
        if (groupsData) {
          setGroups(groupsData);
        }
      } else {
        setShowSetup(true);
      }
      
      setLoading(false);
    }
    
    init();
  }, [supabase, router]);

  async function handleCreateStation() {
    if (!user || !stationName.trim()) return;
    
    setCreating(true);
    
    const { data, error } = await supabase
      .from("stations")
      .insert({
        owner_id: user.id,
        name: stationName.trim(),
      })
      .select()
      .single();
    
    if (error) {
      alert("Failed to create station: " + error.message);
      setCreating(false);
      return;
    }
    
    setStation(data);
    setShowSetup(false);
    setCreating(false);
  }

  async function handleAddAlbum(result: SpotifyResult) {
    if (!station || !user) return;
    
    // Build Spotify URL from URI
    const spotifyUrl = `https://open.spotify.com/${result.type}/${result.id}`;
    
    const { data, error } = await supabase
      .from("station_albums")
      .insert({
        station_id: station.id,
        user_id: user.id,
        spotify_uri: result.uri,
        spotify_type: result.type,
        spotify_name: result.name,
        spotify_artist: result.artist || null,
        spotify_image_url: result.image || null,
        spotify_url: spotifyUrl,
        is_selected: true,
      })
      .select()
      .single();
    
    if (!error && data) {
      setAlbums(prev => [data, ...prev]);
      setManualSelections(prev => new Set([...prev, data.id]));
    }
    
    setShowSpotifySearch(false);
  }

  async function handleToggleAlbum(albumId: string) {
    const album = albums.find(a => a.id === albumId);
    if (!album) return;
    
    const newSelected = !album.is_selected;
    
    // Update in database
    await supabase
      .from("station_albums")
      .update({ is_selected: newSelected })
      .eq("id", albumId);
    
    // Update local state
    setAlbums(prev => prev.map(a => 
      a.id === albumId ? { ...a, is_selected: newSelected } : a
    ));
    
    // Update manual selections
    setManualSelections(prev => {
      const newSet = new Set(prev);
      if (newSelected) {
        newSet.add(albumId);
      } else {
        newSet.delete(albumId);
      }
      return newSet;
    });
    
    // Turn off select all if we unchecked something
    if (!newSelected) {
      setSelectAll(false);
    }
  }

  async function handleSelectAll(checked: boolean) {
    setSelectAll(checked);
    
    if (checked) {
      // Select all albums
      await supabase
        .from("station_albums")
        .update({ is_selected: true })
        .eq("station_id", station?.id);
      
      setAlbums(prev => prev.map(a => ({ ...a, is_selected: true })));
      setActiveGroups(new Set()); // Clear group selection
    } else {
      // Revert to manual selections
      const albumIds = albums.map(a => a.id);
      
      for (const albumId of albumIds) {
        const shouldBeSelected = manualSelections.has(albumId);
        await supabase
          .from("station_albums")
          .update({ is_selected: shouldBeSelected })
          .eq("id", albumId);
      }
      
      setAlbums(prev => prev.map(a => ({
        ...a,
        is_selected: manualSelections.has(a.id)
      })));
    }
  }

  async function handleUnselectAll() {
    setSelectAll(false);
    setActiveGroups(new Set()); // Clear group selection
    
    // Unselect all albums
    await supabase
      .from("station_albums")
      .update({ is_selected: false })
      .eq("station_id", station?.id);
    
    setAlbums(prev => prev.map(a => ({ ...a, is_selected: false })));
    setManualSelections(new Set());
  }

  async function handleRemoveAlbum(albumId: string) {
    await supabase
      .from("station_albums")
      .delete()
      .eq("id", albumId);
    
    setAlbums(prev => prev.filter(a => a.id !== albumId));
    setManualSelections(prev => {
      const newSet = new Set(prev);
      newSet.delete(albumId);
      return newSet;
    });
  }

  // Filter albums by active search (only when search is applied)
  const filteredAlbums = activeSearch.trim()
    ? albums.filter(a => 
        a.spotify_name.toLowerCase().includes(activeSearch.toLowerCase()) ||
        (a.spotify_artist?.toLowerCase().includes(activeSearch.toLowerCase()))
      )
    : albums;

  function handleSearch() {
    setActiveSearch(searchInput);
  }

  function clearSearch() {
    setSearchInput("");
    setActiveSearch("");
  }

  // Group management functions
  async function handleCreateGroup() {
    if (!station || !newGroupName.trim()) return;
    
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    
    const { data, error } = await supabase
      .from("station_groups")
      .insert({
        station_id: station.id,
        name: newGroupName.trim(),
        color,
      })
      .select()
      .single();
    
    if (!error && data) {
      setGroups(prev => [...prev, data]);
      setNewGroupName("");
      setShowCreateGroup(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    // Close confirmation
    setConfirmDeleteGroup(null);
    
    await supabase
      .from("station_groups")
      .delete()
      .eq("id", groupId);
    
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setActiveGroups(prev => {
      const newSet = new Set(prev);
      newSet.delete(groupId);
      return newSet;
    });
    
    // Remove this group from albumGroups mapping
    setAlbumGroups(prev => {
      const updated: Record<string, string[]> = {};
      for (const [albumId, groupIds] of Object.entries(prev)) {
        updated[albumId] = groupIds.filter(gid => gid !== groupId);
      }
      return updated;
    });
    
    // Exit bulk add mode if we deleted the bulk add group
    if (bulkAddGroup === groupId) {
      setBulkAddGroup(null);
    }
  }

  function startBulkAdd(groupId: string) {
    setBulkAddGroup(groupId);
    setEditingAlbumGroups(null);
  }

  function exitBulkAdd() {
    setBulkAddGroup(null);
  }

  async function toggleAlbumInBulkGroup(albumId: string) {
    if (!bulkAddGroup) return;
    await handleToggleAlbumGroup(albumId, bulkAddGroup);
  }

  async function handleToggleGroup(groupId: string) {
    const isActive = activeGroups.has(groupId);
    
    // Update active groups
    setActiveGroups(prev => {
      const newSet = new Set(prev);
      if (isActive) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
    
    // Calculate which albums should be selected based on all active groups
    const newActiveGroups = new Set(activeGroups);
    if (isActive) {
      newActiveGroups.delete(groupId);
    } else {
      newActiveGroups.add(groupId);
    }
    
    // If no groups are active, keep current selection
    if (newActiveGroups.size === 0) {
      return;
    }
    
    // Select albums that belong to ANY active group
    const albumsToSelect = new Set<string>();
    for (const [albumId, groupIds] of Object.entries(albumGroups)) {
      if (groupIds.some(gid => newActiveGroups.has(gid))) {
        albumsToSelect.add(albumId);
      }
    }
    
    // Update album selections in database and state
    for (const album of albums) {
      const shouldBeSelected = albumsToSelect.has(album.id);
      if (album.is_selected !== shouldBeSelected) {
        await supabase
          .from("station_albums")
          .update({ is_selected: shouldBeSelected })
          .eq("id", album.id);
      }
    }
    
    setAlbums(prev => prev.map(a => ({
      ...a,
      is_selected: albumsToSelect.has(a.id)
    })));
    
    setSelectAll(false);
  }

  async function handleToggleAlbumGroup(albumId: string, groupId: string) {
    const currentGroups = albumGroups[albumId] || [];
    const isInGroup = currentGroups.includes(groupId);
    
    if (isInGroup) {
      // Remove from group
      await supabase
        .from("station_album_groups")
        .delete()
        .eq("album_id", albumId)
        .eq("group_id", groupId);
      
      setAlbumGroups(prev => ({
        ...prev,
        [albumId]: (prev[albumId] || []).filter(gid => gid !== groupId)
      }));
    } else {
      // Add to group
      await supabase
        .from("station_album_groups")
        .insert({ album_id: albumId, group_id: groupId });
      
      setAlbumGroups(prev => ({
        ...prev,
        [albumId]: [...(prev[albumId] || []), groupId]
      }));
    }
  }

  function clearActiveGroups() {
    setActiveGroups(new Set());
  }

  const selectedCount = albums.filter(a => a.is_selected).length;

  // Spotify playback functions
  async function handleConnectSpotify() {
    if (!user) {
      alert("Not logged in - please refresh the page");
      return;
    }
    // Redirect to Spotify auth
    const authUrl = `/api/spotify/auth?userId=${user.id}`;
    console.log("Redirecting to:", authUrl);
    window.location.href = authUrl;
  }

  async function handleDisconnectSpotify() {
    try {
      await fetch("/api/spotify/token", { method: "DELETE" });
      setSpotifyConnected(false);
      setSpotifyToken(null);
      setPlayerReady(false);
      if (spotifyPlayer) {
        spotifyPlayer.disconnect();
        setSpotifyPlayer(null);
      }
    } catch (err) {
      console.error("Failed to disconnect Spotify:", err);
    }
  }

  async function handleShufflePlay() {
    if (!spotifyDeviceId || !spotifyToken) {
      alert("Please connect Spotify first");
      return;
    }

    const selectedAlbums = albums.filter(a => a.is_selected);
    if (selectedAlbums.length === 0) {
      alert("No albums selected");
      return;
    }

    // Get all album URIs
    const albumUris = selectedAlbums.map(a => a.spotify_uri);
    
    try {
      // First, transfer playback to our device
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

      // Enable shuffle
      await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${spotifyToken}` },
      });

      // For albums, we need to get the tracks and play them
      // Pick a random album to start
      const randomAlbum = albumUris[Math.floor(Math.random() * albumUris.length)];
      
      // Start playback
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context_uri: randomAlbum,
        }),
      });

      setIsPlaying(true);
    } catch (err) {
      console.error("Playback error:", err);
      alert("Failed to start playback. Make sure you have Spotify Premium.");
    }
  }

  async function handleTogglePlayback() {
    if (!spotifyPlayer) return;
    await spotifyPlayer.togglePlay();
  }

  async function handleNextTrack() {
    if (!spotifyPlayer) return;
    await spotifyPlayer.nextTrack();
  }

  async function handlePreviousTrack() {
    if (!spotifyPlayer) return;
    await spotifyPlayer.previousTrack();
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Setup screen
  if (showSetup) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header user={user} userUsername={userUsername} userAvatarUrl={userAvatarUrl} />
        <div style={{ maxWidth: 500, margin: "0 auto", padding: 20, paddingTop: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📻</div>
            <h1 style={{ fontSize: 28, margin: 0, marginBottom: 8 }}>Alzooka FM</h1>
            <p style={{ opacity: 0.7, margin: 0 }}>Create your personal radio station</p>
          </div>
          
          {/* Spotify Premium Warning */}
          <div style={{
            background: "rgba(30, 215, 96, 0.1)",
            border: "1px solid rgba(30, 215, 96, 0.3)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: "#1DB954", marginBottom: 4 }}>
                  Spotify Premium Required
                </p>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                  Playback features require an active Spotify Premium subscription. 
                  You can still browse and organize your collection, but playing music 
                  requires Premium.
                </p>
              </div>
            </div>
          </div>
          
          {/* Station Name Input */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              Station Name
            </label>
            <input
              type="text"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              placeholder="My Radio Station"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 16,
                borderRadius: 8,
                border: "1px solid rgba(240, 235, 224, 0.2)",
                background: "rgba(0, 0, 0, 0.2)",
                color: "var(--alzooka-cream)",
              }}
            />
          </div>
          
          {/* Create Button */}
          <button
            onClick={handleCreateStation}
            disabled={creating || !stationName.trim()}
            style={{
              width: "100%",
              padding: "14px 24px",
              fontSize: 16,
              fontWeight: 600,
              background: "var(--alzooka-gold)",
              color: "var(--alzooka-teal-dark)",
              border: "none",
              borderRadius: 8,
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating || !stationName.trim() ? 0.6 : 1,
            }}
          >
            {creating ? "Creating..." : "Create My Station"}
          </button>
        </div>
      </div>
    );
  }

  // Main station view
  return (
    <div style={{ minHeight: "100vh" }}>
      <Header user={user} userUsername={userUsername} userAvatarUrl={userAvatarUrl} />
      
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
        {/* Station Header */}
        <div style={{ 
          background: "linear-gradient(135deg, rgba(30, 215, 96, 0.15) 0%, rgba(212, 168, 75, 0.15) 100%)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
          border: "1px solid rgba(240, 235, 224, 0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 12,
              background: "var(--alzooka-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}>
              📻
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>
                Alzooka FM
              </p>
              <h1 style={{ margin: 0, fontSize: 24 }}>{station?.name}</h1>
            </div>
          </div>
          
          {/* Player Controls */}
          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: 12,
            padding: 16,
          }}>
            {/* Now Playing */}
            {currentTrack && isPlaying && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: "rgba(30, 215, 96, 0.1)",
                borderRadius: 8,
              }}>
                {currentTrack.image && (
                  <img
                    src={currentTrack.image}
                    alt=""
                    style={{ width: 48, height: 48, borderRadius: 6 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{currentTrack.name}</p>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{currentTrack.artist}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handlePreviousTrack}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      fontSize: 18,
                      cursor: "pointer",
                      padding: 8,
                    }}
                  >
                    ⏮
                  </button>
                  <button
                    onClick={handleTogglePlayback}
                    style={{
                      background: "#1DB954",
                      border: "none",
                      color: "#fff",
                      fontSize: 16,
                      cursor: "pointer",
                      padding: "8px 12px",
                      borderRadius: 20,
                    }}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button
                    onClick={handleNextTrack}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      fontSize: 18,
                      cursor: "pointer",
                      padding: 8,
                    }}
                  >
                    ⏭
                  </button>
                </div>
              </div>
            )}
            
            {/* Main Controls */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}>
              {spotifyConnected && playerReady ? (
                <>
                  <button
                    onClick={handleShufflePlay}
                    disabled={selectedCount === 0}
                    style={{
                      padding: "12px 24px",
                      fontSize: 14,
                      fontWeight: 600,
                      background: selectedCount > 0 ? "#1DB954" : "rgba(30, 215, 96, 0.3)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 24,
                      cursor: selectedCount > 0 ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    🔀 Shuffle Play ({selectedCount} albums)
                  </button>
                  <button
                    onClick={handleDisconnectSpotify}
                    style={{
                      padding: "8px 16px",
                      fontSize: 12,
                      background: "transparent",
                      color: "var(--alzooka-cream)",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      borderRadius: 20,
                      cursor: "pointer",
                      opacity: 0.7,
                    }}
                  >
                    Disconnect Spotify
                  </button>
                </>
              ) : spotifyConnected ? (
                <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
                  ⏳ Initializing Spotify player...
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  {user ? (
                    <>
                      <a
                        href={`/api/spotify/auth?userId=${user.id}`}
                        style={{
                          padding: "12px 24px",
                          fontSize: 14,
                          fontWeight: 600,
                          background: "#1DB954",
                          color: "#fff",
                          border: "none",
                          borderRadius: 24,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          textDecoration: "none",
                        }}
                      >
                        🎵 Connect Spotify
                      </a>
                      {/* Debug: show the URL */}
                      <p style={{ fontSize: 10, opacity: 0.5, wordBreak: "break-all", maxWidth: 300 }}>
                        Debug URL: /api/spotify/auth?userId={user.id}
                      </p>
                      {authError && (
                        <p style={{ fontSize: 12, color: "#e57373" }}>
                          ⚠️ Auth error: {authError}
                        </p>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "#e57373", fontSize: 14 }}>
                      Loading user... (refresh if stuck)
                    </span>
                  )}
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.5 }}>
                    Premium required for playback
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Controls Bar */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 16, 
          marginBottom: 16,
          flexWrap: "wrap",
        }}>
          {/* Select All / Unselect All Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleSelectAll(true)}
              disabled={albums.length === 0 || selectAll}
              style={{
                padding: "8px 12px",
                fontSize: 14,
                background: selectAll ? "rgba(30, 215, 96, 0.2)" : "rgba(240, 235, 224, 0.05)",
                color: "var(--alzooka-cream)",
                border: selectAll ? "1px solid rgba(30, 215, 96, 0.5)" : "1px solid rgba(240, 235, 224, 0.2)",
                borderRadius: 8,
                cursor: albums.length === 0 || selectAll ? "not-allowed" : "pointer",
                opacity: albums.length === 0 ? 0.5 : 1,
              }}
            >
              ✓ Select All
            </button>
            <button
              onClick={() => handleUnselectAll()}
              disabled={albums.length === 0 || selectedCount === 0}
              style={{
                padding: "8px 12px",
                fontSize: 14,
                background: selectedCount === 0 ? "rgba(240, 235, 224, 0.1)" : "rgba(240, 235, 224, 0.05)",
                color: "var(--alzooka-cream)",
                border: selectedCount === 0 ? "1px solid rgba(240, 235, 224, 0.3)" : "1px solid rgba(240, 235, 224, 0.2)",
                borderRadius: 8,
                cursor: albums.length === 0 || selectedCount === 0 ? "not-allowed" : "pointer",
                opacity: albums.length === 0 ? 0.5 : 1,
              }}
            >
              ✗ Unselect All
            </button>
          </div>
          
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Search your albums..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid rgba(240, 235, 224, 0.2)",
                background: "rgba(0, 0, 0, 0.2)",
                color: "var(--alzooka-cream)",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={!searchInput.trim()}
              style={{
                padding: "8px 14px",
                fontSize: 14,
                fontWeight: 600,
                background: searchInput.trim() ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.1)",
                color: searchInput.trim() ? "var(--alzooka-teal-dark)" : "rgba(240, 235, 224, 0.4)",
                border: "none",
                borderRadius: 8,
                cursor: searchInput.trim() ? "pointer" : "not-allowed",
              }}
            >
              🔍
            </button>
          </div>
          
          {/* Add Album Button */}
          <button
            onClick={() => setShowSpotifySearch(true)}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              background: "var(--alzooka-gold)",
              color: "var(--alzooka-teal-dark)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            + Add Album
          </button>
        </div>
        
        {/* Groups Section */}
        <div style={{
          background: "rgba(240, 235, 224, 0.03)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          border: "1px solid rgba(240, 235, 224, 0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>Groups</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {activeGroups.size > 0 && (
                <button
                  onClick={clearActiveGroups}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    background: "transparent",
                    color: "var(--alzooka-cream)",
                    border: "1px solid rgba(240, 235, 224, 0.2)",
                    borderRadius: 6,
                    cursor: "pointer",
                    opacity: 0.7,
                  }}
                >
                  Clear Selection
                </button>
              )}
              <button
                onClick={() => setShowCreateGroup(!showCreateGroup)}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: showCreateGroup ? "rgba(240, 235, 224, 0.1)" : "transparent",
                  color: "var(--alzooka-cream)",
                  border: "1px solid rgba(240, 235, 224, 0.2)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                + New Group
              </button>
            </div>
          </div>
          
          {/* Create Group Form */}
          {showCreateGroup && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Group name (e.g., Jazz, 70s Rock)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                autoFocus
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: 14,
                  borderRadius: 6,
                  border: "1px solid rgba(240, 235, 224, 0.2)",
                  background: "rgba(0, 0, 0, 0.2)",
                  color: "var(--alzooka-cream)",
                }}
              />
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: newGroupName.trim() ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.1)",
                  color: newGroupName.trim() ? "var(--alzooka-teal-dark)" : "rgba(240, 235, 224, 0.4)",
                  border: "none",
                  borderRadius: 6,
                  cursor: newGroupName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create
              </button>
            </div>
          )}
          
          {/* Group Toggles */}
          {groups.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, opacity: 0.5 }}>
              No groups yet. Create groups to organize your albums by genre, mood, or era.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {groups.map(group => {
                const isActive = activeGroups.has(group.id);
                const isBulkEditing = bulkAddGroup === group.id;
                const albumCount = Object.values(albumGroups).filter(gids => gids.includes(group.id)).length;
                
                return (
                  <div key={group.id} style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
                    <button
                      onClick={() => handleToggleGroup(group.id)}
                      style={{
                        padding: "6px 14px",
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 400,
                        background: isActive ? group.color : "transparent",
                        color: isActive ? "#fff" : "var(--alzooka-cream)",
                        border: `2px solid ${group.color}`,
                        borderRadius: 20,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {group.name} ({albumCount})
                    </button>
                    
                    {/* Edit button - enters bulk add mode */}
                    <button
                      onClick={() => isBulkEditing ? exitBulkAdd() : startBulkAdd(group.id)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        background: isBulkEditing ? group.color : "transparent",
                        color: isBulkEditing ? "#fff" : "var(--alzooka-cream)",
                        border: `1px solid ${isBulkEditing ? group.color : "rgba(240, 235, 224, 0.3)"}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        opacity: isBulkEditing ? 1 : 0.6,
                      }}
                      title={isBulkEditing ? "Done editing" : "Add albums to this group"}
                    >
                      {isBulkEditing ? "Done" : "Edit"}
                    </button>
                    
                    {/* Delete button with confirmation */}
                    <button
                      onClick={() => setConfirmDeleteGroup(group.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#e57373",
                        fontSize: 14,
                        cursor: "pointer",
                        padding: 2,
                        opacity: 0.4,
                        lineHeight: 1,
                      }}
                      title="Delete group"
                    >
                      ×
                    </button>
                    
                    {/* Delete confirmation popup */}
                    {confirmDeleteGroup === group.id && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          marginTop: 8,
                          background: "#1a2e2e",
                          border: "2px solid #e57373",
                          borderRadius: 10,
                          padding: 16,
                          zIndex: 1000,
                          minWidth: 200,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p style={{ margin: "0 0 12px", fontSize: 14 }}>
                          Delete <strong>{group.name}</strong>?
                        </p>
                        <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.7 }}>
                          This will remove the group. Albums won't be deleted.
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setConfirmDeleteGroup(null)}
                            style={{
                              flex: 1,
                              padding: "8px",
                              fontSize: 13,
                              background: "rgba(240, 235, 224, 0.1)",
                              color: "var(--alzooka-cream)",
                              border: "none",
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            style={{
                              flex: 1,
                              padding: "8px",
                              fontSize: 13,
                              fontWeight: 600,
                              background: "#e57373",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {activeGroups.size > 0 && !bulkAddGroup && (
            <p style={{ margin: "12px 0 0", fontSize: 12, opacity: 0.6 }}>
              🎵 Playing from: {groups.filter(g => activeGroups.has(g.id)).map(g => g.name).join(" + ")}
            </p>
          )}
          
          {/* Hint when no albums are tagged */}
          {groups.length > 0 && albums.length > 0 && Object.keys(albumGroups).length === 0 && !bulkAddGroup && (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--alzooka-gold)" }}>
              💡 Click <strong>"Edit"</strong> next to a group, then click albums to add them
            </p>
          )}
        </div>
        
        {/* Bulk Add Mode Banner */}
        {bulkAddGroup && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            marginBottom: 16,
            background: `${groups.find(g => g.id === bulkAddGroup)?.color}22`,
            border: `2px solid ${groups.find(g => g.id === bulkAddGroup)?.color}`,
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>✏️</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  Adding albums to: <span style={{ color: groups.find(g => g.id === bulkAddGroup)?.color }}>
                    {groups.find(g => g.id === bulkAddGroup)?.name}
                  </span>
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                  Click albums below to add or remove them from this group
                </p>
              </div>
            </div>
            <button
              onClick={exitBulkAdd}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 600,
                background: groups.find(g => g.id === bulkAddGroup)?.color,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        )}
        
        {/* Active Search Banner */}
        {activeSearch && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            marginBottom: 16,
            background: "rgba(212, 168, 75, 0.15)",
            border: "1px solid rgba(212, 168, 75, 0.3)",
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 14 }}>
              Showing results for: <strong>"{activeSearch}"</strong>
              {filteredAlbums.length > 0 && ` (${filteredAlbums.length} ${filteredAlbums.length === 1 ? 'album' : 'albums'})`}
            </span>
            <button
              onClick={clearSearch}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                background: "var(--alzooka-gold)",
                color: "var(--alzooka-teal-dark)",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Show All
            </button>
          </div>
        )}

        {/* Albums List */}
        {filteredAlbums.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: 60,
            opacity: 0.6,
          }}>
            {albums.length === 0 ? (
              <>
                <p style={{ fontSize: 48, margin: 0, marginBottom: 16 }}>🎵</p>
                <p style={{ margin: 0, fontSize: 16 }}>No albums yet</p>
                <p style={{ margin: 0, fontSize: 14, marginTop: 8 }}>
                  Click "Add Album" to start building your station
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, marginBottom: 16 }}>No albums match "{activeSearch}"</p>
                <button
                  onClick={clearSearch}
                  style={{
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    background: "var(--alzooka-gold)",
                    color: "var(--alzooka-teal-dark)",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  ← Show All Albums
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredAlbums.map(album => {
              const isInBulkGroup = bulkAddGroup && (albumGroups[album.id] || []).includes(bulkAddGroup);
              const bulkGroupColor = bulkAddGroup ? groups.find(g => g.id === bulkAddGroup)?.color : null;
              
              return (
              <div
                key={album.id}
                onClick={bulkAddGroup ? () => toggleAlbumInBulkGroup(album.id) : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  background: bulkAddGroup
                    ? (isInBulkGroup ? `${bulkGroupColor}33` : "rgba(240, 235, 224, 0.03)")
                    : (album.is_selected ? "rgba(30, 215, 96, 0.1)" : "rgba(240, 235, 224, 0.03)"),
                  borderRadius: 12,
                  border: bulkAddGroup
                    ? (isInBulkGroup ? `2px solid ${bulkGroupColor}` : "2px dashed rgba(240, 235, 224, 0.2)")
                    : (album.is_selected ? "1px solid rgba(30, 215, 96, 0.3)" : "1px solid rgba(240, 235, 224, 0.1)"),
                  cursor: bulkAddGroup ? "pointer" : "default",
                  transition: "all 0.15s",
                }}
              >
                {/* Checkbox or bulk add indicator */}
                {bulkAddGroup ? (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: isInBulkGroup ? (bulkGroupColor || "#1DB954") : "transparent",
                      border: `2px solid ${isInBulkGroup ? (bulkGroupColor || "#1DB954") : "rgba(240, 235, 224, 0.3)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {isInBulkGroup && "✓"}
                  </div>
                ) : (
                  <input
                    type="checkbox"
                    checked={album.is_selected}
                    onChange={() => handleToggleAlbum(album.id)}
                    style={{ 
                      width: 20, 
                      height: 20, 
                      accentColor: "#1DB954",
                      cursor: "pointer",
                    }}
                  />
                )}
                
                {/* Album Art */}
                {album.spotify_image_url ? (
                  <img
                    src={album.spotify_image_url}
                    alt=""
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    background: "rgba(30, 215, 96, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                  }}>
                    🎵
                  </div>
                )}
                
                {/* Album Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ 
                    margin: 0, 
                    fontWeight: 600, 
                    fontSize: 15,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {album.spotify_name}
                  </p>
                  {album.spotify_artist && (
                    <p style={{ 
                      margin: 0, 
                      fontSize: 13, 
                      opacity: 0.7,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {album.spotify_artist}
                    </p>
                  )}
                  
                  {/* Album Groups */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {(albumGroups[album.id] || []).map(groupId => {
                      const group = groups.find(g => g.id === groupId);
                      if (!group) return null;
                      return (
                        <span
                          key={groupId}
                          style={{
                            padding: "2px 8px",
                            fontSize: 10,
                            fontWeight: 600,
                            background: group.color,
                            color: "#fff",
                            borderRadius: 10,
                          }}
                        >
                          {group.name}
                        </span>
                      );
                    })}
                    
                    {/* Add to group button */}
                    {groups.length > 0 && (
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setEditingAlbumGroups(editingAlbumGroups === album.id ? null : album.id)}
                          style={{
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: editingAlbumGroups === album.id ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.1)",
                            color: editingAlbumGroups === album.id ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
                            border: "1px solid rgba(240, 235, 224, 0.3)",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          🏷️ Tag
                        </button>
                        
                        {/* Group picker dropdown */}
                        {editingAlbumGroups === album.id && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "100%",
                              left: 0,
                              marginBottom: 8,
                              background: "#1a2e2e",
                              border: "2px solid var(--alzooka-gold)",
                              borderRadius: 10,
                              padding: 12,
                              zIndex: 1000,
                              minWidth: 180,
                              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>
                              Add to Groups:
                            </p>
                            {groups.map(group => {
                              const isInGroup = (albumGroups[album.id] || []).includes(group.id);
                              return (
                                <label
                                  key={group.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "8px 6px",
                                    cursor: "pointer",
                                    fontSize: 14,
                                    borderRadius: 6,
                                    background: isInGroup ? `${group.color}22` : "transparent",
                                    marginBottom: 4,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isInGroup}
                                    onChange={() => handleToggleAlbumGroup(album.id, group.id)}
                                    style={{ 
                                      width: 18, 
                                      height: 18, 
                                      accentColor: group.color 
                                    }}
                                  />
                                  <span style={{ 
                                    width: 12, 
                                    height: 12, 
                                    borderRadius: "50%", 
                                    background: group.color,
                                    flexShrink: 0,
                                  }} />
                                  <span style={{ fontWeight: isInGroup ? 600 : 400 }}>
                                    {group.name}
                                  </span>
                                </label>
                              );
                            })}
                            <button
                              onClick={() => setEditingAlbumGroups(null)}
                              style={{
                                marginTop: 10,
                                width: "100%",
                                padding: "8px",
                                fontSize: 13,
                                fontWeight: 600,
                                background: "var(--alzooka-gold)",
                                color: "var(--alzooka-teal-dark)",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              Done
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Spotify Link */}
                <a
                  href={album.spotify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1DB954",
                    fontSize: 12,
                    textDecoration: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(30, 215, 96, 0.1)",
                  }}
                >
                  Open
                </a>
                
                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveAlbum(album.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#e57373",
                    fontSize: 18,
                    cursor: "pointer",
                    padding: 4,
                    opacity: 0.6,
                  }}
                  title="Remove from station"
                >
                  ×
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Spotify Search Modal */}
      {showSpotifySearch && (
        <SpotifySearchModal
          onClose={() => setShowSpotifySearch(false)}
          onSelect={(result) => handleAddAlbum(result)}
          onDirectPost={async (result) => {
            await handleAddAlbum(result);
          }}
        />
      )}
    </div>
  );
}

