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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(true);
  const [manualSelections, setManualSelections] = useState<Set<string>>(new Set());
  
  const router = useRouter();
  const supabase = createBrowserClient();

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

  // Filter albums by search
  const filteredAlbums = searchQuery.trim()
    ? albums.filter(a => 
        a.spotify_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.spotify_artist?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : albums;

  const selectedCount = albums.filter(a => a.is_selected).length;

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
          
          {/* Player Controls Placeholder */}
          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}>
            <button
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
              ▶ Shuffle Play ({selectedCount} albums)
            </button>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.5 }}>
              Connect Spotify to enable playback
            </p>
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
          {/* Select All Checkbox */}
          <label style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8, 
            cursor: "pointer",
            fontSize: 14,
            padding: "8px 12px",
            background: "rgba(240, 235, 224, 0.05)",
            borderRadius: 8,
          }}>
            <input
              type="checkbox"
              checked={selectAll}
              onChange={(e) => handleSelectAll(e.target.checked)}
              disabled={albums.length === 0}
              style={{ width: 16, height: 16, accentColor: "var(--alzooka-gold)" }}
            />
            Select All Albums
          </label>
          
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              placeholder="🔍 Search your albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid rgba(240, 235, 224, 0.2)",
                background: "rgba(0, 0, 0, 0.2)",
                color: "var(--alzooka-cream)",
              }}
            />
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
              <p style={{ margin: 0 }}>No albums match your search</p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredAlbums.map(album => (
              <div
                key={album.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  background: album.is_selected 
                    ? "rgba(30, 215, 96, 0.1)" 
                    : "rgba(240, 235, 224, 0.03)",
                  borderRadius: 12,
                  border: album.is_selected
                    ? "1px solid rgba(30, 215, 96, 0.3)"
                    : "1px solid rgba(240, 235, 224, 0.1)",
                }}
              >
                {/* Checkbox */}
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
                  <p style={{ margin: 0, fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                    {album.spotify_type}
                  </p>
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
            ))}
          </div>
        )}
      </div>
      
      {/* Spotify Search Modal */}
      {showSpotifySearch && (
        <SpotifySearchModal
          onClose={() => setShowSpotifySearch(false)}
          onSelect={(result) => handleAddAlbum(result)}
        />
      )}
    </div>
  );
}

