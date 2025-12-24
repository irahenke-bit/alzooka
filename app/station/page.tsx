"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  // Persisted state
  selected_album_ids?: string[];
  selected_playlist_ids?: string[];
  active_group_ids?: string[];
  shuffle_queue?: string[];
  shuffle_queue_index?: number;
  last_track_uri?: string;
  last_track_position?: number;
  last_track_name?: string;
  last_track_artist?: string;
  last_track_image?: string;
  last_track_album_name?: string;
  last_track_playlist_name?: string;
  last_track_duration?: number;
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

type StationPlaylist = {
  id: string;
  station_id: string;
  name: string;
  cover_image_url: string | null;
  created_at: string;
};

type SpotifyTrack = {
  uri: string;
  name: string;
  artist: string;
  album?: string;
  image: string;
  duration_ms: number;
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

interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      uri: string;
      name: string;
      artists: { name: string }[];
      album: { images: { url: string }[] };
      duration_ms: number;
    };
  };
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (state: unknown) => void) => void;
  removeListener: (event: string) => void;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
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
  
  // Station name editing
  const [isEditingStationName, setIsEditingStationName] = useState(false);
  const [editedStationName, setEditedStationName] = useState("");
  const [editingAlbumGroups, setEditingAlbumGroups] = useState<string | null>(null);
  const [bulkAddGroup, setBulkAddGroup] = useState<string | null>(null); // Group ID for bulk adding albums
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
  
  // Album expansion and tracks state
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [albumTracks, setAlbumTracks] = useState<Record<string, SpotifyTrack[]>>({});
  const [loadingTracks, setLoadingTracks] = useState<Set<string>>(new Set());
  
  // Playlist state
  const [playlists, setPlaylists] = useState<StationPlaylist[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<SpotifyTrack[]>([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showAddToPlaylistDropdown, setShowAddToPlaylistDropdown] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [albumPendingDelete, setAlbumPendingDelete] = useState<StationAlbum | null>(null);
  const [viewingPlaylist, setViewingPlaylist] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, SpotifyTrack[]>>({});
  const [playlistGroups, setPlaylistGroups] = useState<Record<string, string[]>>({}); // playlistId -> groupIds
  const [editingPlaylistGroups, setEditingPlaylistGroups] = useState<string | null>(null);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
  const [tracksToRemove, setTracksToRemove] = useState<{ playlistId: string; trackUris: Set<string> } | null>(null);
  const [confirmRemoveTracks, setConfirmRemoveTracks] = useState(false);
  
  // Spotify state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyPlayer, setSpotifyPlayer] = useState<SpotifyPlayer | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ name: string; artist: string; image: string; albumName?: string; playlistName?: string } | null>(null);
  const [trackSourceMap, setTrackSourceMap] = useState<Record<string, { albumName: string; playlistName?: string }>>({}); // URI -> source info
  const [playerReady, setPlayerReady] = useState(false);
  const [trackPosition, setTrackPosition] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [currentlyPlayingAlbumId, setCurrentlyPlayingAlbumId] = useState<string | null>(null);
  const [currentlyPlayingPlaylistId, setCurrentlyPlayingPlaylistId] = useState<string | null>(null);
  const [selectedStartTrack, setSelectedStartTrack] = useState<{ albumId?: string; playlistId?: string; trackUri: string } | null>(null);
  const [currentlyPlayingTrackUri, setCurrentlyPlayingTrackUri] = useState<string | null>(null);
  const ignorePositionUntilRef = useRef<number>(0); // Timestamp to ignore stale position updates
  
  // Queue management for sequential playlist playback
  const [currentPlaylistQueue, setCurrentPlaylistQueue] = useState<string[]>([]); // Array of track URIs
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [queuedNextTrack, setQueuedNextTrack] = useState<{ playlistId: string; trackUri: string } | null>(null); // User-queued track to play next
  const lastTrackEndTimeRef = useRef<number>(0); // To prevent duplicate end detection
  const wasPlayingRef = useRef<boolean>(false); // Track previous playing state
  const manualPauseRef = useRef<boolean>(false); // Track if user manually paused
  
  // Drag and drop state for reordering tracks
  const [draggingTrack, setDraggingTrack] = useState<{ playlistId: string; trackUri: string; index: number } | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  
  // Drag and drop state for dragging from album to playlist
  const [draggingAlbumTrack, setDraggingAlbumTrack] = useState<SpotifyTrack | null>(null);
  const [dropTargetPlaylistId, setDropTargetPlaylistId] = useState<string | null>(null);
  
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
          position: number;
          duration: number;
          track_window: {
            current_track: {
              name: string;
              uri: string;
              artists: { name: string }[];
              album: { name: string; images: { url: string }[] };
            };
          };
        } | null;
        if (!state) return;
        
        // Check if we're in the ignore window (e.g., after pressing stop)
        const now = Date.now();
        const isIgnoring = now <= ignorePositionUntilRef.current;
        
        // If paused and we're ignoring updates, don't update anything (stop was pressed)
        if (state.paused && isIgnoring) {
          return;
        }
        
        setIsPlaying(!state.paused);
        
        // Check if track changed - if so, reset position to 0
        const newTrackUri = state.track_window?.current_track?.uri;
        
        setTrackDuration(state.duration);
        if (state.track_window?.current_track) {
          const track = state.track_window.current_track;
          const trackUri = track.uri;
          
          // Get album name from Spotify and playlist name from our source map
          setTrackSourceMap(currentSourceMap => {
            // If source map is empty, we've stopped - don't update track
            if (Object.keys(currentSourceMap).length === 0) {
              return currentSourceMap;
            }
            const source = currentSourceMap[trackUri];
            setCurrentTrack({
              name: track.name,
              artist: track.artists.map(a => a.name).join(", "),
              image: track.album.images[0]?.url || "",
              albumName: track.album.name || source?.albumName,
              playlistName: source?.playlistName,
            });
            return currentSourceMap;
          });
          
          // If track changed, reset position to 0 and ignore stale updates
          setCurrentlyPlayingTrackUri(prevUri => {
            if (prevUri && newTrackUri && prevUri !== newTrackUri) {
              // Track changed! Reset position
              setTrackPosition(0);
              ignorePositionUntilRef.current = Date.now() + 1500;
              
              // Update queue index if playing from a queue
              setCurrentPlaylistQueue(currentQueue => {
                if (currentQueue.length > 0) {
                  const newIndex = currentQueue.indexOf(newTrackUri);
                  if (newIndex >= 0) {
                    setCurrentQueueIndex(newIndex);
                  }
                }
                return currentQueue;
              });
              
              return newTrackUri;
            }
            return newTrackUri || prevUri;
          });
        }
        
        // Only update position if we're not in the "ignore stale position" window
        if (!isIgnoring) {
          setTrackPosition(state.position);
        } else if (state.position < 2000) {
          // Accept small positions even during ignore window (track just started from beginning)
          setTrackPosition(state.position);
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
        
        // Load playlists
        const { data: playlistsData } = await supabase
          .from("station_playlists")
          .select("*")
          .eq("station_id", stationData.id)
          .order("created_at", { ascending: false });
        
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
          
          // Restore saved playlist selections
          if (stationData.selected_playlist_ids && Array.isArray(stationData.selected_playlist_ids)) {
            setSelectedPlaylists(new Set<string>(stationData.selected_playlist_ids as string[]));
          }
        }
        
        // Restore saved album selections
        if (stationData.selected_album_ids && Array.isArray(stationData.selected_album_ids) && albumsData) {
          const savedIds = new Set<string>(stationData.selected_album_ids as string[]);
          setManualSelections(savedIds);
          setAlbums(albumsData.map(a => ({ ...a, is_selected: savedIds.has(a.id) })));
          setSelectAll(albumsData.length > 0 && albumsData.every(a => savedIds.has(a.id)));
        }
        
        // Restore last playing track info (for display only - won't auto-play)
        if (stationData.last_track_uri && stationData.last_track_name) {
          setCurrentTrack({
            name: stationData.last_track_name,
            artist: stationData.last_track_artist || "",
            image: stationData.last_track_image || "",
            albumName: stationData.last_track_album_name,
            playlistName: stationData.last_track_playlist_name,
          });
          setCurrentlyPlayingTrackUri(stationData.last_track_uri);
          setTrackPosition(stationData.last_track_position || 0);
          setTrackDuration(stationData.last_track_duration || 0);
        }
        
        // Restore active groups
        if (stationData.active_group_ids && Array.isArray(stationData.active_group_ids)) {
          setActiveGroups(new Set<string>(stationData.active_group_ids as string[]));
        }
        
        // Restore shuffle queue
        if (stationData.shuffle_queue && Array.isArray(stationData.shuffle_queue)) {
          setCurrentPlaylistQueue(stationData.shuffle_queue as string[]);
          setCurrentQueueIndex(stationData.shuffle_queue_index || 0);
        }
      } else {
        setShowSetup(true);
      }
      
      setLoading(false);
    }
    
    init();
  }, [supabase, router]);

  // Track if we have a pending restore (user needs to click play to resume)
  const hasPendingRestoreRef = useRef(false);
  
  useEffect(() => {
    // Mark that we have a pending restore if there's saved track info
    if (station?.last_track_uri && !hasPendingRestoreRef.current) {
      hasPendingRestoreRef.current = true;
    }
  }, [station]);

  // Save station state to database (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  async function saveStationState() {
    if (!station) return;
    
    const selectedAlbumIds = Array.from(manualSelections);
    const selectedPlaylistIds = Array.from(selectedPlaylists);
    const activeGroupIdsList = Array.from(activeGroups);
    
    await supabase
      .from("stations")
      .update({
        selected_album_ids: selectedAlbumIds,
        selected_playlist_ids: selectedPlaylistIds,
        active_group_ids: activeGroupIdsList,
        shuffle_queue: currentPlaylistQueue,
        shuffle_queue_index: currentQueueIndex,
        last_track_uri: currentlyPlayingTrackUri,
        last_track_position: trackPosition,
        last_track_name: currentTrack?.name || null,
        last_track_artist: currentTrack?.artist || null,
        last_track_image: currentTrack?.image || null,
        last_track_album_name: currentTrack?.albumName || null,
        last_track_playlist_name: currentTrack?.playlistName || null,
        last_track_duration: trackDuration,
        state_updated_at: new Date().toISOString(),
      })
      .eq("id", station.id);
  }
  
  // Auto-save state when selections or playback changes (debounced to avoid too many writes)
  useEffect(() => {
    if (!station) return;
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      saveStationState();
    }, 2000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [station, manualSelections, selectedPlaylists, activeGroups, currentPlaylistQueue, currentQueueIndex, currentlyPlayingTrackUri, trackPosition, currentTrack, trackDuration]);

  // Detect track end and handle queue advancement / queued next track
  useEffect(() => {
    // Detect transition from playing to paused (track ended)
    const wasPlaying = wasPlayingRef.current;
    wasPlayingRef.current = isPlaying;
    
    // Reset manual pause flag when playing resumes
    if (isPlaying && !wasPlaying) {
      manualPauseRef.current = false;
    }
    
    // If we were playing and now we're not, and it wasn't a manual pause
    if (wasPlaying && !isPlaying && !manualPauseRef.current) {
      const now = Date.now();
      // Prevent duplicate handling (debounce)
      if (now - lastTrackEndTimeRef.current < 3000) return;
      lastTrackEndTimeRef.current = now;
      
      console.log("Track ended - checking for next track or playlist");
      console.log("Current playlist ID:", currentlyPlayingPlaylistId);
      console.log("Queued next track:", queuedNextTrack);
      console.log("Current queue:", currentPlaylistQueue.length, "tracks");
      console.log("Playlists loaded:", playlists.map(p => ({ id: p.id, name: p.name })));
      
      // Check if user has queued a next track
      if (queuedNextTrack && spotifyPlayer && spotifyDeviceId && spotifyToken) {
        // Play the queued track and continue from there
        const playlist = playlists.find(p => p.id === queuedNextTrack.playlistId);
        if (playlist) {
          const tracks = playlistTracks[playlist.id];
          if (tracks) {
            const startIndex = tracks.findIndex(t => t.uri === queuedNextTrack.trackUri);
            if (startIndex >= 0) {
              const remainingTracks = tracks.slice(startIndex);
              const uris = remainingTracks.map(t => t.uri);
              
              // Update source map
              const newSourceMap: Record<string, { albumName: string; playlistName?: string }> = {};
              remainingTracks.forEach(t => {
                newSourceMap[t.uri] = { albumName: t.album || "", playlistName: playlist.name };
              });
              setTrackSourceMap(prev => ({ ...prev, ...newSourceMap }));
              
              // Play the queued tracks
              console.log("Playing queued track:", queuedNextTrack.trackUri, "with", uris.length, "tracks");
              fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
                method: "PUT",
                headers: {
                  "Authorization": `Bearer ${spotifyToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ uris, position_ms: 0 }),
              }).then(() => {
                setCurrentPlaylistQueue(uris);
                setCurrentQueueIndex(0);
                setCurrentlyPlayingPlaylistId(playlist.id);
                setIsPlaying(true);
              });
              
              setQueuedNextTrack(null);
              setSelectedStartTrack(null); // Clear the visual indicator too
              return;
            }
          }
        }
        setQueuedNextTrack(null);
      }
      
      // No queued track - check if we need to advance to next playlist
      if (currentlyPlayingPlaylistId) {
        const currentPlaylistIndex = playlists.findIndex(p => p.id === currentlyPlayingPlaylistId);
        if (currentPlaylistIndex >= 0 && currentPlaylistIndex < playlists.length - 1) {
          // There's a next playlist - play it
          const nextPlaylist = playlists[currentPlaylistIndex + 1];
          const nextTracks = playlistTracks[nextPlaylist.id];
          
          if (nextTracks && nextTracks.length > 0 && spotifyDeviceId && spotifyToken) {
            const uris = nextTracks.map(t => t.uri);
            
            // Update source map
            const newSourceMap: Record<string, { albumName: string; playlistName?: string }> = {};
            nextTracks.forEach(t => {
              newSourceMap[t.uri] = { albumName: t.album || "", playlistName: nextPlaylist.name };
            });
            setTrackSourceMap(prev => ({ ...prev, ...newSourceMap }));
            
            // Play the next playlist
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${spotifyToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris, position_ms: 0 }),
            }).then(() => {
              setCurrentPlaylistQueue(uris);
              setCurrentQueueIndex(0);
              setCurrentlyPlayingPlaylistId(nextPlaylist.id);
              setViewingPlaylist(nextPlaylist.id); // Expand the next playlist
              setIsPlaying(true);
            });
          }
        }
      }
    }
  }, [isPlaying, trackPosition, trackDuration, queuedNextTrack, currentlyPlayingPlaylistId, playlists, playlistTracks, spotifyPlayer, spotifyDeviceId, spotifyToken]);

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

  // Toggle album expansion and load tracks
  async function handleToggleAlbumExpand(album: StationAlbum) {
    const albumId = album.id;
    
    if (expandedAlbums.has(albumId)) {
      // Collapse
      setExpandedAlbums(prev => {
        const next = new Set(prev);
        next.delete(albumId);
        return next;
      });
    } else {
      // Expand and load tracks if not already loaded
      setExpandedAlbums(prev => new Set([...prev, albumId]));
      
      if (!albumTracks[albumId] && spotifyToken) {
        setLoadingTracks(prev => new Set([...prev, albumId]));
        
        try {
          // Extract album ID from URI (spotify:album:XXXXX)
          const spotifyAlbumId = album.spotify_uri.split(":")[2];
          const res = await fetch(`https://api.spotify.com/v1/albums/${spotifyAlbumId}/tracks?limit=50`, {
            headers: { "Authorization": `Bearer ${spotifyToken}` },
          });
          
          if (res.ok) {
            const data = await res.json();
            const tracks: SpotifyTrack[] = data.items.map((t: {
              uri: string;
              name: string;
              artists: { name: string }[];
              duration_ms: number;
            }) => ({
              uri: t.uri,
              name: t.name,
              artist: t.artists.map(a => a.name).join(", "),
              album: album.spotify_name, // Include album name
              image: album.spotify_image_url || "",
              duration_ms: t.duration_ms,
            }));
            
            setAlbumTracks(prev => ({ ...prev, [albumId]: tracks }));
          }
        } catch (err) {
          console.error("Failed to load tracks:", err);
        }
        
        setLoadingTracks(prev => {
          const next = new Set(prev);
          next.delete(albumId);
          return next;
        });
      }
    }
  }

  // Toggle track selection for playlist
  function handleToggleTrackSelect(track: SpotifyTrack) {
    setSelectedTracks(prev => {
      const exists = prev.some(t => t.uri === track.uri);
      if (exists) {
        return prev.filter(t => t.uri !== track.uri);
      } else {
        return [...prev, track];
      }
    });
  }

  // Create new playlist from selected tracks
  async function handleCreatePlaylist() {
    if (!station || !user || selectedTracks.length === 0 || !newPlaylistName.trim()) return;
    
    const coverImage = selectedTracks[0]?.image || null;
    
    const { data: playlist, error } = await supabase
      .from("station_playlists")
      .insert({
        station_id: station.id,
        name: newPlaylistName.trim(),
        cover_image_url: coverImage,
      })
      .select()
      .single();
    
    if (error || !playlist) {
      console.error("Failed to create playlist:", error);
      return;
    }
    
    // Add tracks to playlist
    const trackInserts = selectedTracks.map((track, idx) => ({
      playlist_id: playlist.id,
      spotify_uri: track.uri,
      spotify_name: track.name,
      spotify_artist: track.artist,
      spotify_album: track.album || null,
      spotify_image_url: track.image,
      track_order: idx,
    }));
    
    await supabase.from("station_playlist_tracks").insert(trackInserts);
    
    setPlaylists(prev => [playlist, ...prev]);
    setSelectedTracks([]);
    setNewPlaylistName("");
    setShowCreatePlaylist(false);
  }

  // Add selected tracks to an existing playlist
  async function handleAddToExistingPlaylist(playlistId: string) {
    if (selectedTracks.length === 0) return;
    
    // Get existing tracks to determine order
    const existingTracks = playlistTracks[playlistId] || [];
    const startOrder = existingTracks.length;
    
    // Filter out tracks that are already in the playlist
    const existingUris = new Set(existingTracks.map(t => t.uri));
    const newTracks = selectedTracks.filter(t => !existingUris.has(t.uri));
    
    if (newTracks.length === 0) {
      alert("All selected tracks are already in this playlist");
      return;
    }
    
    const trackInserts = newTracks.map((track, idx) => ({
      playlist_id: playlistId,
      spotify_uri: track.uri,
      spotify_name: track.name,
      spotify_artist: track.artist,
      spotify_album: track.album || null,
      spotify_image_url: track.image,
      track_order: startOrder + idx,
    }));
    
    const { error } = await supabase.from("station_playlist_tracks").insert(trackInserts);
    
    if (error) {
      console.error("Failed to add tracks:", error);
      alert("Failed to add tracks to playlist");
      return;
    }
    
    // Refresh playlist tracks if currently viewing
    if (viewingPlaylist === playlistId) {
      const { data } = await supabase
        .from("station_playlist_tracks")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("track_order", { ascending: true });
      
      if (data) {
        setPlaylistTracks(prev => ({
          ...prev,
          [playlistId]: data.map(t => ({
            uri: t.spotify_uri,
            name: t.spotify_name,
            artist: t.spotify_artist || "",
            album: t.spotify_album || "",
            image: t.spotify_image_url || "",
            duration_ms: 0,
          })),
        }));
      }
    }
    
    setSelectedTracks([]);
  }

  // Load playlists
  async function loadPlaylists() {
    if (!station) return;
    
    const { data } = await supabase
      .from("station_playlists")
      .select("*")
      .eq("station_id", station.id)
      .order("created_at", { ascending: false });
    
    if (data) setPlaylists(data);
  }

  // Load tracks for a playlist
  async function handleViewPlaylist(playlistId: string) {
    if (viewingPlaylist === playlistId) {
      setViewingPlaylist(null);
      return;
    }
    
    setViewingPlaylist(playlistId);
    
    if (!playlistTracks[playlistId]) {
      const { data } = await supabase
        .from("station_playlist_tracks")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("track_order", { ascending: true });
      
      if (data) {
        const tracks: SpotifyTrack[] = data.map(t => ({
          uri: t.spotify_uri,
          name: t.spotify_name,
          artist: t.spotify_artist || "",
          album: t.spotify_album || "",
          image: t.spotify_image_url || "",
          duration_ms: 0,
        }));
        setPlaylistTracks(prev => ({ ...prev, [playlistId]: tracks }));
      }
    }
  }

  // Delete a playlist
  async function handleDeletePlaylist(playlistId: string) {
    if (!confirm("Delete this playlist?")) return;
    
    await supabase.from("station_playlists").delete().eq("id", playlistId);
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    if (viewingPlaylist === playlistId) setViewingPlaylist(null);
  }

  // Toggle track selection for removal from playlist
  function handleToggleTrackRemoval(playlistId: string, trackUri: string) {
    setTracksToRemove(prev => {
      // If selecting from a different playlist, start fresh
      if (prev && prev.playlistId !== playlistId) {
        return { playlistId, trackUris: new Set([trackUri]) };
      }
      
      const currentUris = prev?.trackUris ?? new Set<string>();
      const next = new Set(currentUris);
      
      if (next.has(trackUri)) {
        next.delete(trackUri);
      } else {
        next.add(trackUri);
      }
      
      // If no tracks selected, clear the state
      if (next.size === 0) {
        return null;
      }
      
      return { playlistId, trackUris: next };
    });
  }

  // Actually remove tracks from playlist
  async function handleRemoveTracksFromPlaylist() {
    if (!tracksToRemove || tracksToRemove.trackUris.size === 0) return;
    
    const { playlistId, trackUris } = tracksToRemove;
    
    // Delete from database
    for (const uri of trackUris) {
      await supabase
        .from("station_playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("spotify_uri", uri);
    }
    
    // Update local state
    setPlaylistTracks(prev => ({
      ...prev,
      [playlistId]: (prev[playlistId] || []).filter(t => !trackUris.has(t.uri))
    }));
    
    // Clear selection
    setTracksToRemove(null);
    setConfirmRemoveTracks(false);
  }

  // Add a track from an album to a playlist (via drag and drop)
  async function handleDropTrackToPlaylist(track: SpotifyTrack, playlistId: string, atIndex?: number) {
    const existingTracks = playlistTracks[playlistId] || [];
    
    // Check if track already exists in playlist
    if (existingTracks.some(t => t.uri === track.uri)) {
      return; // Already in playlist, do nothing
    }
    
    // Determine position
    const insertIndex = atIndex !== undefined ? atIndex : existingTracks.length;
    
    // Create new tracks array with the inserted track
    const newTracks = [...existingTracks];
    newTracks.splice(insertIndex, 0, track);
    
    // Update local state immediately
    setPlaylistTracks(prev => ({
      ...prev,
      [playlistId]: newTracks,
    }));
    
    // Insert into database
    await supabase.from("station_playlist_tracks").insert({
      playlist_id: playlistId,
      spotify_uri: track.uri,
      spotify_name: track.name,
      spotify_artist: track.artist,
      spotify_album: track.album || null,
      spotify_image_url: track.image,
      track_order: insertIndex,
    });
    
    // Update track_order for all tracks after the insert point
    for (let i = insertIndex + 1; i < newTracks.length; i++) {
      await supabase
        .from("station_playlist_tracks")
        .update({ track_order: i })
        .eq("playlist_id", playlistId)
        .eq("spotify_uri", newTracks[i].uri);
    }
  }

  // Reorder tracks within a playlist
  async function handleReorderTracks(playlistId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    
    const tracks = playlistTracks[playlistId];
    if (!tracks) return;
    
    // Create new order
    const newTracks = [...tracks];
    const [movedTrack] = newTracks.splice(fromIndex, 1);
    newTracks.splice(toIndex, 0, movedTrack);
    
    // Update local state immediately for responsiveness
    setPlaylistTracks(prev => ({
      ...prev,
      [playlistId]: newTracks,
    }));
    
    // Update track_order in database for all affected tracks
    for (let i = 0; i < newTracks.length; i++) {
      await supabase
        .from("station_playlist_tracks")
        .update({ track_order: i })
        .eq("playlist_id", playlistId)
        .eq("spotify_uri", newTracks[i].uri);
    }
  }

  // Toggle playlist selection for shuffle
  function handleTogglePlaylistSelection(playlistId: string) {
    setSelectedPlaylists(prev => {
      const next = new Set(prev);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  }

  // Toggle playlist group membership
  async function handleTogglePlaylistGroup(playlistId: string, groupId: string) {
    const currentGroups = playlistGroups[playlistId] || [];
    const isInGroup = currentGroups.includes(groupId);
    
    if (isInGroup) {
      await supabase
        .from("station_playlist_groups")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("group_id", groupId);
      
      setPlaylistGroups(prev => ({
        ...prev,
        [playlistId]: currentGroups.filter(g => g !== groupId),
      }));
    } else {
      await supabase
        .from("station_playlist_groups")
        .insert({ playlist_id: playlistId, group_id: groupId });
      
      setPlaylistGroups(prev => ({
        ...prev,
        [playlistId]: [...currentGroups, groupId],
      }));
    }
  }

  // Play a playlist
  async function handlePlayPlaylist(playlistId: string) {
    if (!spotifyToken || !spotifyDeviceId || !spotifyPlayer) {
      alert("Please connect Spotify first");
      return;
    }
    
    // CRITICAL: Activate element IMMEDIATELY on user click, before any async operations
    // This is required for browser autoplay policies
    try {
      await spotifyPlayer.activateElement();
    } catch (e) {
      console.log("activateElement error (may be ok):", e);
    }
    
    // Load tracks if not already loaded
    let tracks = playlistTracks[playlistId];
    if (!tracks) {
      const { data } = await supabase
        .from("station_playlist_tracks")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("track_order", { ascending: true });
      
      if (data && data.length > 0) {
        tracks = data.map(t => ({
          uri: t.spotify_uri,
          name: t.spotify_name,
          artist: t.spotify_artist || "",
          album: t.spotify_album || "",
          image: t.spotify_image_url || "",
          duration_ms: 0,
        }));
        setPlaylistTracks(prev => ({ ...prev, [playlistId]: tracks! }));
      }
    }
    
    if (!tracks || tracks.length === 0) {
      alert("No tracks in this playlist");
      return;
    }
    
    // Expand the playlist so user can see tracks
    setViewingPlaylist(playlistId);
    
    // Track which playlist is playing (and clear album)
    setCurrentlyPlayingPlaylistId(playlistId);
    setCurrentlyPlayingAlbumId(null);
    
    // Find the playlist name
    const playlist = playlists.find(p => p.id === playlistId);
    const playlistName = playlist?.name || "";
    
    // Build source map for these tracks (includes album from track data and playlist name)
    const newSourceMap: Record<string, { albumName: string; playlistName?: string }> = {};
    tracks.forEach(t => {
      newSourceMap[t.uri] = { albumName: t.album || "", playlistName };
    });
    setTrackSourceMap(newSourceMap);
    
    // Ignore stale position updates
    ignorePositionUntilRef.current = Date.now() + 1000;
    
    try {
      setTrackPosition(0);
      
      // Check if there's a selected start track for this playlist
      let tracksToPlay = tracks;
      if (selectedStartTrack?.playlistId === playlistId) {
        const startIndex = tracks.findIndex(t => t.uri === selectedStartTrack.trackUri);
        if (startIndex >= 0) {
          tracksToPlay = tracks.slice(startIndex);
        }
        // Clear the selected start track after using it
        setSelectedStartTrack(null);
      }
      
      const trackUris = tracksToPlay.map(t => t.uri);
      
      // Set the queue for sequential playback tracking
      setCurrentPlaylistQueue(trackUris);
      setCurrentQueueIndex(0);
      
      // Start playing the specific tracks directly on our device
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
      
      if (!playRes.ok) {
        const errText = await playRes.text();
        console.error("Playlist play failed:", errText);
        alert("Failed to start playlist playback");
        return;
      }
      
      console.log("Playlist playback started with", trackUris.length, "tracks");
      
      // Ensure playback actually starts (sometimes the API queues but doesn't play)
      setTimeout(async () => {
        try {
          const state = await spotifyPlayer.getCurrentState();
          if (state && state.paused) {
            console.log("Playback was paused after API call, resuming...");
            await spotifyPlayer.resume();
          }
        } catch (e) {
          console.log("Resume check error:", e);
        }
      }, 300);
      
      setTrackPosition(0);
      setIsPlaying(true);
    } catch (err) {
      console.error("Playlist playback error:", err);
      alert("Failed to play playlist");
    }
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
        is_selected: false, // Default to unchecked - user manually selects for shuffle
      })
      .select()
      .single();
    
    if (!error && data) {
      setAlbums(prev => [data, ...prev]);
    }
    // Keep search modal open for adding more albums
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

  // Memoize selected track URIs for faster lookup
  const selectedTrackUris = useMemo(() => new Set(selectedTracks.map(t => t.uri)), [selectedTracks]);

  function handleSearch() {
    setActiveSearch(searchInput);
  }

  function clearSearch() {
    setSearchInput("");
    setActiveSearch("");
  }

  // Station name editing
  async function handleSaveStationName() {
    if (!station || !editedStationName.trim()) return;
    
    const { error } = await supabase
      .from("stations")
      .update({ name: editedStationName.trim() })
      .eq("id", station.id);
    
    if (!error) {
      setStation({ ...station, name: editedStationName.trim() });
    }
    setIsEditingStationName(false);
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
  const selectedPlaylistCount = selectedPlaylists.size;
  const hasAnySelected = selectedCount > 0 || selectedPlaylistCount > 0;

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
    console.log("Shuffle play clicked", { spotifyDeviceId, spotifyToken: spotifyToken ? "present" : "missing" });
    
    if (!spotifyDeviceId || !spotifyToken || !spotifyPlayer) {
      alert("Please connect Spotify first");
      return;
    }

    const selectedAlbums = albums.filter(a => a.is_selected);
    const selectedPlaylistsList = playlists.filter(p => selectedPlaylists.has(p.id));
    console.log("Selected albums:", selectedAlbums.length, selectedAlbums.map(a => a.spotify_name));
    console.log("Selected playlists:", selectedPlaylistsList.length, selectedPlaylistsList.map(p => p.name));
    
    // Check if anything is selected (albums OR playlists)
    if (selectedAlbums.length === 0 && selectedPlaylistsList.length === 0) {
      alert("No albums or playlists selected");
      return;
    }

    // Get all album URIs
    const albumUris = selectedAlbums.map(a => a.spotify_uri);
    console.log("Album URIs:", albumUris);
    
    try {
      // Activate the player element (required for browser autoplay policy)
      console.log("Activating player element");
      await spotifyPlayer.activateElement();
      
      // First, transfer playback to our device
      console.log("Transferring playback to device:", spotifyDeviceId);
      const transferRes = await fetch("https://api.spotify.com/v1/me/player", {
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
      console.log("Transfer response:", transferRes.status);
      if (!transferRes.ok && transferRes.status !== 204) {
        const err = await transferRes.text();
        console.error("Transfer failed:", err);
      }

      // Fetch tracks from all selected albums and build source map
      console.log("Fetching tracks from albums...");
      const trackUriSet = new Set<string>(); // Use Set to deduplicate
      const newSourceMap: Record<string, { albumName: string; playlistName?: string }> = {};
      
      // First, collect tracks from albums
      for (const album of selectedAlbums) {
        const albumId = album.spotify_uri.split(":")[2];
        try {
          const tracksRes = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`, {
            headers: { "Authorization": `Bearer ${spotifyToken}` },
          });
          if (tracksRes.ok) {
            const tracksData = await tracksRes.json();
            tracksData.items.forEach((t: { uri: string }) => {
              trackUriSet.add(t.uri);
              // Store album source (will be overwritten if also in playlist)
              newSourceMap[t.uri] = { albumName: album.spotify_name };
            });
          }
        } catch (e) {
          console.error("Failed to fetch tracks for album:", albumId, e);
        }
      }
      
      // Also include tracks from selected playlists or playlists in active groups
      const activeGroupIds = Array.from(activeGroups);
      for (const playlist of playlists) {
        const pGroups = playlistGroups[playlist.id] || [];
        const isSelected = selectedPlaylists.has(playlist.id);
        const isInActiveGroup = activeGroupIds.length > 0 && pGroups.some(gid => activeGroupIds.includes(gid));
        
        if (isSelected || isInActiveGroup) {
          // Load playlist tracks if not already loaded
          let tracks = playlistTracks[playlist.id];
          if (!tracks) {
            const { data } = await supabase
              .from("station_playlist_tracks")
              .select("spotify_uri, spotify_album")
              .eq("playlist_id", playlist.id);
            if (data) {
              tracks = data.map(t => ({ uri: t.spotify_uri, name: "", artist: "", album: t.spotify_album || "", image: "", duration_ms: 0 }));
            }
          }
          if (tracks) {
            tracks.forEach(t => {
              trackUriSet.add(t.uri);
              // Add playlist info, preserving album if already known
              const existing = newSourceMap[t.uri];
              newSourceMap[t.uri] = {
                albumName: existing?.albumName || t.album || "",
                playlistName: playlist.name,
              };
            });
          }
        }
      }
      
      // Store the source map for player lookup
      setTrackSourceMap(newSourceMap);
      
      const allTrackUris = Array.from(trackUriSet);
      console.log("Total unique tracks collected:", allTrackUris.length);
      
      if (allTrackUris.length === 0) {
        alert("No tracks found in selected albums or playlists");
        return;
      }
      
      // Shuffle the tracks using Fisher-Yates algorithm for true randomness
      const shuffledTracks = [...allTrackUris];
      for (let i = shuffledTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTracks[i], shuffledTracks[j]] = [shuffledTracks[j], shuffledTracks[i]];
      }
      console.log("Shuffled tracks, starting playback with", shuffledTracks.length, "tracks");
      
      // Pause any current playback first to clear old position state
      console.log("Pausing current playback before starting new shuffle");
      await spotifyPlayer.pause();
      
      // Reset our position tracking
      setTrackPosition(0);
      ignorePositionUntilRef.current = Date.now() + 2000; // Ignore stale updates for 2 seconds
      
      // Start playback with shuffled tracks at position 0
      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: shuffledTracks.slice(0, 100), // Spotify limits to 100 tracks per request
          position_ms: 0, // Always start from beginning
        }),
      });
      console.log("Play response:", playRes.status);
      
      if (!playRes.ok) {
        const errText = await playRes.text();
        console.error("Play failed:", errText);
        alert(`Playback failed: ${errText}`);
        return;
      }

      // Store the full shuffle queue for persistence and tracking
      setCurrentPlaylistQueue(shuffledTracks);
      setCurrentQueueIndex(0);
      
      // Don't call resume() - it can restore old position. The play endpoint starts playback automatically.
      setIsPlaying(true);
    } catch (err) {
      console.error("Playback error:", err);
      alert("Failed to start playback. Make sure you have Spotify Premium.");
    }
  }

  async function handleTogglePlayback() {
    if (!spotifyPlayer) return;
    
    // If currently playing, this is a manual pause
    if (isPlaying) {
      manualPauseRef.current = true;
      await spotifyPlayer.togglePlay();
      return;
    }
    
    // If we have a pending restore (page was refreshed with saved track), load it now
    if (hasPendingRestoreRef.current && station?.last_track_uri && spotifyDeviceId && spotifyToken) {
      hasPendingRestoreRef.current = false;
      
      const trackUri = station.last_track_uri;
      const position = station.last_track_position || 0;
      
      // Ignore player state updates for a moment to prevent flicker
      ignorePositionUntilRef.current = Date.now() + 2000;
      
      try {
        // First activate the player element
        await spotifyPlayer.activateElement();
        
        // Check if we have a saved queue - if so, play from queue position
        let urisToPlay: string[] = [trackUri];
        if (currentPlaylistQueue.length > 0 && currentQueueIndex < currentPlaylistQueue.length) {
          // Play from the saved queue position onwards
          urisToPlay = currentPlaylistQueue.slice(currentQueueIndex);
          if (urisToPlay.length > 100) {
            urisToPlay = urisToPlay.slice(0, 100); // Spotify limit
          }
        }
        
        const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${spotifyToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: urisToPlay,
            position_ms: position,
          }),
        });
        
        if (res.ok) {
          setIsPlaying(true);
          setTrackPosition(position);
        } else {
          console.error("Failed to resume track, status:", res.status);
          // Reset so user can try again
          hasPendingRestoreRef.current = true;
        }
      } catch (err) {
        console.error("Failed to resume saved track:", err);
        hasPendingRestoreRef.current = true;
      }
      return;
    }
    
    // Normal toggle
    await spotifyPlayer.togglePlay();
  }

  async function handleNextTrack() {
    if (!spotifyPlayer) return;
    setTrackPosition(0); // Reset position immediately when skipping
    
    // If there's a queued/highlighted track (from playlist), jump to it
    if (queuedNextTrack && spotifyDeviceId && spotifyToken) {
      const playlist = playlists.find(p => p.id === queuedNextTrack.playlistId);
      if (playlist) {
        const tracks = playlistTracks[playlist.id];
        if (tracks) {
          const startIndex = tracks.findIndex(t => t.uri === queuedNextTrack.trackUri);
          if (startIndex >= 0) {
            const remainingTracks = tracks.slice(startIndex);
            const uris = remainingTracks.map(t => t.uri);
            
            // Update queue state
            setCurrentPlaylistQueue(uris);
            setCurrentQueueIndex(0);
            setCurrentlyPlayingPlaylistId(playlist.id);
            setCurrentlyPlayingAlbumId(null);
            
            // Build source map
            const newSourceMap: Record<string, { albumName: string; playlistName?: string }> = {};
            remainingTracks.forEach(t => {
              newSourceMap[t.uri] = { albumName: t.album || "", playlistName: playlist.name };
            });
            setTrackSourceMap(newSourceMap);
            
            // Play from the queued track
            ignorePositionUntilRef.current = Date.now() + 1000;
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${spotifyToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris, position_ms: 0 }),
            });
            
            // Clear the queued track and selected start
            setQueuedNextTrack(null);
            setSelectedStartTrack(null);
            setIsPlaying(true);
            return;
          }
        }
      }
      
      // If we couldn't find the track, clear the queue and do normal next
      setQueuedNextTrack(null);
      setSelectedStartTrack(null);
    }
    
    // Check if there's a highlighted track in an album (selectedStartTrack with albumId)
    if (selectedStartTrack?.albumId && spotifyDeviceId && spotifyToken) {
      const album = albums.find(a => a.id === selectedStartTrack.albumId);
      if (album) {
        const tracks = albumTracks[album.id];
        if (tracks) {
          const startIndex = tracks.findIndex(t => t.uri === selectedStartTrack.trackUri);
          if (startIndex >= 0) {
            const remainingTracks = tracks.slice(startIndex);
            const uris = remainingTracks.map(t => t.uri);
            
            // Update state
            setCurrentlyPlayingAlbumId(album.id);
            setCurrentlyPlayingPlaylistId(null);
            
            // Build source map
            const newSourceMap: Record<string, { albumName: string; playlistName?: string }> = {};
            remainingTracks.forEach(t => {
              newSourceMap[t.uri] = { albumName: album.spotify_name };
            });
            setTrackSourceMap(newSourceMap);
            
            // Play from the selected track
            ignorePositionUntilRef.current = Date.now() + 1000;
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${spotifyToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris, position_ms: 0 }),
            });
            
            // Clear the selected start
            setSelectedStartTrack(null);
            setIsPlaying(true);
            return;
          }
        }
      }
      
      // If we couldn't find the track, clear and do normal next
      setSelectedStartTrack(null);
    }
    
    // Normal next track behavior
    await spotifyPlayer.nextTrack();
  }

  async function handlePreviousTrack() {
    if (!spotifyPlayer) return;
    setTrackPosition(0); // Reset position immediately when skipping
    await spotifyPlayer.previousTrack();
  }

  async function handleStopPlayback() {
    if (!spotifyPlayer) return;
    
    // Set a flag to ignore player state updates for a moment
    ignorePositionUntilRef.current = Date.now() + 2000;
    
    await spotifyPlayer.pause();
    
    // Clear all playback state
    setTrackPosition(0);
    setTrackDuration(0);
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentlyPlayingAlbumId(null);
    setCurrentlyPlayingPlaylistId(null);
    setCurrentlyPlayingTrackUri(null);
    setTrackSourceMap({}); // Clear shuffle source info
    
    // Clear shuffle queue
    setCurrentPlaylistQueue([]);
    setCurrentQueueIndex(0);
    
    // Clear all selections
    setSelectedPlaylists(new Set());
    setManualSelections(new Set());
    setSelectAll(false);
    setActiveGroups(new Set()); // Also clear active groups
    // Update albums to be unselected
    setAlbums(prev => prev.map(a => ({ ...a, is_selected: false })));
  }

  // Play a single album - either full album or just selected tracks from it
  async function handlePlayAlbum(album: StationAlbum) {
    if (!spotifyPlayer || !spotifyDeviceId || !spotifyToken) return;
    
    // CRITICAL: Activate element IMMEDIATELY on user click, before any async operations
    // This is required for browser autoplay policies
    try {
      await spotifyPlayer.activateElement();
    } catch (e) {
      console.log("activateElement error (may be ok):", e);
    }
    
    // Get tracks for this album
    let tracks = albumTracks[album.id];
    if (!tracks) {
      // Fetch tracks if not already loaded
      const albumId = album.spotify_uri.split(":")[2];
      const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      tracks = data.items.map((t: { uri: string; name: string; artists: { name: string }[]; duration_ms: number }) => ({
        uri: t.uri,
        name: t.name,
        artist: t.artists.map((a: { name: string }) => a.name).join(", "),
        album: album.spotify_name, // Include album name
        image: album.spotify_image_url || "",
        duration_ms: t.duration_ms,
      }));
      setAlbumTracks(prev => ({ ...prev, [album.id]: tracks! }));
    }
    
    if (!tracks || tracks.length === 0) return;
    
    // Check if any tracks from THIS album are in selectedTracks (for playlist creation)
    const albumTrackUris = new Set(tracks.map(t => t.uri));
    const selectedFromThisAlbum = selectedTracks.filter(t => albumTrackUris.has(t.uri));
    
    let tracksToPlay: SpotifyTrack[];
    
    // Check if there's a selected start track for this album
    if (selectedStartTrack?.albumId === album.id) {
      // Find the index of the selected track and play from there
      const startIndex = tracks.findIndex(t => t.uri === selectedStartTrack.trackUri);
      if (startIndex >= 0) {
        tracksToPlay = tracks.slice(startIndex);
      } else {
        tracksToPlay = tracks;
      }
    } else if (selectedFromThisAlbum.length > 0) {
      // Play only selected tracks, but in album order
      tracksToPlay = tracks.filter(t => selectedTrackUris.has(t.uri));
    } else {
      // Play full album in order
      tracksToPlay = tracks;
    }
    
    if (tracksToPlay.length === 0) return;
    
    // Clear the selected start track after using it
    if (selectedStartTrack?.albumId === album.id) {
      setSelectedStartTrack(null);
    }
    
    // Track which album is playing (and clear playlist)
    setCurrentlyPlayingAlbumId(album.id);
    setCurrentlyPlayingPlaylistId(null);
    
    // Build source map for these tracks (album only, no playlist)
    const newSourceMap: Record<string, { albumName: string; playlistName?: string }> = {};
    tracksToPlay.forEach(t => {
      newSourceMap[t.uri] = { albumName: album.spotify_name };
    });
    setTrackSourceMap(newSourceMap);
    
    // Ignore stale position updates for the next 1 second
    ignorePositionUntilRef.current = Date.now() + 1000;
    
    setTrackPosition(0);
    
    // Start fresh playback with the track URIs starting at position 0
    const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        uris: tracksToPlay.map(t => t.uri),
        position_ms: 0
      }),
    });
    
    if (!playRes.ok) {
      console.error("Album play failed:", await playRes.text());
      return;
    }
    
    console.log("Album playback started with", tracksToPlay.length, "tracks");
    
    // Ensure playback actually starts (sometimes the API queues but doesn't play)
    setTimeout(async () => {
      try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.paused) {
          console.log("Playback was paused after API call, resuming...");
          await spotifyPlayer.resume();
        }
      } catch (e) {
        console.log("Resume check error:", e);
      }
    }, 300);
    
    // Force UI to show 0
    setTrackPosition(0);
    setIsPlaying(true);
  }

  async function handleSeek(position: number) {
    if (!spotifyPlayer) return;
    await spotifyPlayer.seek(position);
    setTrackPosition(position);
  }

  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  // Update position timer - resets when track changes
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setTrackPosition(prev => {
        if (prev + 1000 > trackDuration) return prev;
        return prev + 1000;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying, trackDuration, currentTrack?.name]);

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
      
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 20 }}>
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
              {isEditingStationName ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    value={editedStationName}
                    onChange={(e) => setEditedStationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveStationName();
                      } else if (e.key === "Escape") {
                        setIsEditingStationName(false);
                      }
                    }}
                    autoFocus
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--alzooka-gold)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      color: "var(--alzooka-cream)",
                      outline: "none",
                      width: 250,
                    }}
                  />
                  <button
                    onClick={handleSaveStationName}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "var(--alzooka-gold)",
                      color: "var(--alzooka-teal-dark)",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingStationName(false)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "transparent",
                      color: "var(--alzooka-cream)",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <h1 
                  onClick={() => {
                    setEditedStationName(station?.name || "");
                    setIsEditingStationName(true);
                  }}
                  style={{ 
                    margin: 0, 
                    fontSize: 24, 
                    cursor: "pointer",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  title="Click to edit station name"
                >
                  {station?.name}
                </h1>
              )}
            </div>
          </div>
          
          {/* Player Controls */}
          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: 12,
            padding: 16,
          }}>
            {/* Now Playing */}
            {currentTrack && (
              <>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
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
                    <p style={{ margin: "2px 0 0", fontSize: 11, opacity: 0.5 }}>
                      {currentTrack.albumName && <span>Album: {currentTrack.albumName}</span>}
                      {currentTrack.albumName && currentTrack.playlistName && <span> • </span>}
                      {currentTrack.playlistName && <span>Playlist: {currentTrack.playlistName}</span>}
                    </p>
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
                      onClick={handleStopPlayback}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#e57373",
                        fontSize: 16,
                        cursor: "pointer",
                        padding: 8,
                      }}
                      title="Stop and clear shuffle"
                    >
                      ⏹
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
                {/* Progress Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 11, opacity: 0.7, minWidth: 35 }}>
                  {formatTime(trackPosition)}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 3,
                    cursor: "pointer",
                    position: "relative",
                  }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    const newPosition = Math.floor(percent * trackDuration);
                    handleSeek(newPosition);
                  }}
                >
                  <div
                    style={{
                      width: `${trackDuration > 0 ? (trackPosition / trackDuration) * 100 : 0}%`,
                      height: "100%",
                      background: "#1DB954",
                      borderRadius: 3,
                      transition: "width 0.1s linear",
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, opacity: 0.7, minWidth: 35, textAlign: "right" }}>
                  {formatTime(trackDuration)}
                </span>
              </div>
              </>
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
                    disabled={!hasAnySelected}
                    style={{
                      padding: "12px 24px",
                      fontSize: 14,
                      fontWeight: 600,
                      background: hasAnySelected ? "#1DB954" : "rgba(30, 215, 96, 0.3)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 24,
                      cursor: hasAnySelected ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>🔀 Shuffle Play</span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", fontSize: 12, lineHeight: 1.3 }}>
                      <span>({selectedCount} album{selectedCount !== 1 ? "s" : ""})</span>
                      {selectedPlaylistCount > 0 && (
                        <span>({selectedPlaylistCount} playlist{selectedPlaylistCount !== 1 ? "s" : ""})</span>
                      )}
                    </span>
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
                onKeyDown={(e) => { if (e.key === "Enter" && newGroupName.trim()) { e.preventDefault(); handleCreateGroup(); } }}
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

        {/* Selected Tracks Bar */}
        {selectedTracks.length > 0 && (
          <div style={{
            padding: 16,
            background: "rgba(30, 215, 96, 0.15)",
            borderRadius: 12,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                ✓ {selectedTracks.length} track{selectedTracks.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={() => setSelectedTracks([])}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  color: "var(--alzooka-cream)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
            
            {showCreatePlaylist ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name..."
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(240, 235, 224, 0.3)",
                    borderRadius: 6,
                    color: "var(--alzooka-cream)",
                    width: 180,
                  }}
                  autoFocus
                />
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    background: newPlaylistName.trim() ? "#1DB954" : "rgba(30, 215, 96, 0.3)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: newPlaylistName.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreatePlaylist(false);
                    setNewPlaylistName("");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--alzooka-cream)",
                    fontSize: 18,
                    cursor: "pointer",
                    opacity: 0.7,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreatePlaylist(true)}
                style={{
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#1DB954",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                📝 Create Playlist
              </button>
            )}
          </div>
        )}

        {/* Add to Existing Playlist Bar */}
        {selectedTracks.length > 0 && playlists.length > 0 && (
          <div style={{
            padding: 16,
            background: "rgba(30, 215, 96, 0.1)",
            borderRadius: 12,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            border: "1px solid rgba(30, 215, 96, 0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                ✓ {selectedTracks.length} track{selectedTracks.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={() => setSelectedTracks([])}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  color: "var(--alzooka-cream)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
            
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowAddToPlaylistDropdown(!showAddToPlaylistDropdown)}
                style={{
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#1DB954",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ➕ Add to Playlist ▼
              </button>
              {showAddToPlaylistDropdown && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  background: "#1a2e2e",
                  border: "1px solid rgba(30, 215, 96, 0.5)",
                  borderRadius: 8,
                  padding: 8,
                  minWidth: 200,
                  zIndex: 1000,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                }}>
                  {playlists.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleAddToExistingPlaylist(p.id);
                        setShowAddToPlaylistDropdown(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        fontSize: 13,
                        background: "transparent",
                        color: "var(--alzooka-cream)",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(30, 215, 96, 0.2)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {p.cover_image_url ? (
                        <img src={p.cover_image_url} alt="" style={{ width: 28, height: 28, borderRadius: 4 }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(30, 215, 96, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎵</div>
                      )}
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Two Column Layout: Albums (left) + Playlists (right) */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: playlists.length > 0 ? "1fr 1px 1fr" : "1fr",
          gap: 24, 
          alignItems: "start",
        }}>
          {/* Left Column: Albums */}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>
              💿 Albums ({albums.length})
            </h3>
            {filteredAlbums.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: 40,
                opacity: 0.6,
              }}>
                <p style={{ fontSize: 14 }}>No albums yet. Click "+ Add Album" to get started.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflowY: "auto" }}>
                {filteredAlbums.map(album => {
                  const isInBulkGroup = bulkAddGroup && (albumGroups[album.id] || []).includes(bulkAddGroup);
                  const bulkGroupColor = bulkAddGroup ? groups.find(g => g.id === bulkAddGroup)?.color : null;
                  
                  return (
                    <div key={album.id} style={{ marginBottom: 4 }}>
                      <div
                        onClick={bulkAddGroup ? () => toggleAlbumInBulkGroup(album.id) : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: 10,
                          background: bulkAddGroup
                            ? (isInBulkGroup ? `${bulkGroupColor}33` : "rgba(240, 235, 224, 0.03)")
                            : (album.is_selected ? "rgba(30, 215, 96, 0.1)" : "rgba(240, 235, 224, 0.03)"),
                          borderRadius: 10,
                          border: bulkAddGroup
                            ? (isInBulkGroup ? `2px solid ${bulkGroupColor}` : "1px dashed rgba(240, 235, 224, 0.2)")
                            : (album.is_selected ? "1px solid rgba(30, 215, 96, 0.3)" : "1px solid rgba(240, 235, 224, 0.1)"),
                          cursor: bulkAddGroup ? "pointer" : "default",
                        }}
                      >
                        {/* Checkbox */}
                        {!bulkAddGroup && (
                          <input
                            type="checkbox"
                            checked={album.is_selected}
                            onChange={() => handleToggleAlbum(album.id)}
                            style={{ width: 18, height: 18, accentColor: "#1DB954", cursor: "pointer" }}
                          />
                        )}
                        {/* Album Art */}
                        {album.spotify_image_url && (
                          <img src={album.spotify_image_url} alt="" style={{ width: 44, height: 44, borderRadius: 6 }} />
                        )}
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {album.spotify_name}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>{album.spotify_artist}</p>
                          {/* Album Groups */}
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                            {(albumGroups[album.id] || []).map(groupId => {
                              const group = groups.find(g => g.id === groupId);
                              if (!group) return null;
                              return (
                                <span key={groupId} style={{ padding: "1px 6px", fontSize: 9, fontWeight: 600, background: group.color, color: "#fff", borderRadius: 8 }}>
                                  {group.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        {/* Album Playback Controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                          {/* Backward */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreviousTrack(); }}
                            disabled={!spotifyConnected || !playerReady}
                            style={{
                              padding: "3px 5px",
                              fontSize: 10,
                              background: spotifyConnected && playerReady ? "rgba(30, 215, 96, 0.2)" : "rgba(240, 235, 224, 0.1)",
                              color: spotifyConnected && playerReady ? "#1DB954" : "rgba(240, 235, 224, 0.3)",
                              border: spotifyConnected && playerReady ? "1px solid rgba(30, 215, 96, 0.4)" : "1px solid transparent",
                              borderRadius: 6,
                              cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                            }}
                            title="Previous track"
                          >
                            ⏮
                          </button>
                          {/* Stop */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStopPlayback(); }}
                            disabled={!spotifyConnected || !playerReady}
                            style={{
                              padding: "3px 5px",
                              fontSize: 10,
                              background: spotifyConnected && playerReady ? "rgba(229, 115, 115, 0.2)" : "rgba(240, 235, 224, 0.1)",
                              color: spotifyConnected && playerReady ? "#e57373" : "rgba(240, 235, 224, 0.3)",
                              border: spotifyConnected && playerReady ? "1px solid rgba(229, 115, 115, 0.4)" : "1px solid transparent",
                              borderRadius: 6,
                              cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                            }}
                            title="Stop"
                          >
                            ⏹
                          </button>
                          {/* Play/Pause Toggle */}
                          {(() => {
                            const isThisAlbumActive = currentlyPlayingAlbumId === album.id;
                            const isThisAlbumPlaying = isPlaying && isThisAlbumActive;
                            return (
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isThisAlbumActive) {
                                    // This album is the active source - just toggle play/pause
                                    handleTogglePlayback();
                                  } else {
                                    // Different album - start it
                                    handlePlayAlbum(album);
                                  }
                                }}
                                disabled={!spotifyConnected || !playerReady}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: spotifyConnected && playerReady ? "#1DB954" : "rgba(30, 215, 96, 0.3)",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 10,
                                  cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                                }}
                                title={isThisAlbumPlaying ? "Pause" : (() => {
                                  const albumTracksList = albumTracks[album.id] || [];
                                  const albumTrackUris = new Set(albumTracksList.map(t => t.uri));
                                  const selectedFromThis = selectedTracks.filter(t => albumTrackUris.has(t.uri));
                                  return selectedFromThis.length > 0 
                                    ? `Play ${selectedFromThis.length} selected track${selectedFromThis.length > 1 ? 's' : ''}`
                                    : 'Play full album';
                                })()}
                              >
                                {isThisAlbumPlaying ? "⏸" : "▶"}
                              </button>
                            );
                          })()}
                          {/* Forward */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleNextTrack(); }}
                            disabled={!spotifyConnected || !playerReady}
                            style={{
                              padding: "3px 5px",
                              fontSize: 10,
                              background: spotifyConnected && playerReady ? "rgba(30, 215, 96, 0.2)" : "rgba(240, 235, 224, 0.1)",
                              color: spotifyConnected && playerReady ? "#1DB954" : "rgba(240, 235, 224, 0.3)",
                              border: spotifyConnected && playerReady ? "1px solid rgba(30, 215, 96, 0.4)" : "1px solid transparent",
                              borderRadius: 6,
                              cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                            }}
                            title="Next track"
                          >
                            ⏭
                          </button>
                        </div>
                        {/* Tracks Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleAlbumExpand(album); }}
                          style={{ padding: "4px 8px", fontSize: 10, background: expandedAlbums.has(album.id) ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.1)", color: expandedAlbums.has(album.id) ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)", border: "none", borderRadius: 4, cursor: "pointer" }}
                        >
                          {expandedAlbums.has(album.id) ? "▲" : "▼"}
                        </button>
                        {/* Tag Button */}
                        {groups.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingAlbumGroups(editingAlbumGroups === album.id ? null : album.id); }}
                            style={{ padding: "4px 8px", fontSize: 10, background: "rgba(240, 235, 224, 0.1)", color: "var(--alzooka-cream)", border: "none", borderRadius: 4, cursor: "pointer" }}
                          >
                            🏷️
                          </button>
                        )}
                        {/* Remove Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setAlbumPendingDelete(album); }}
                          style={{ background: "transparent", border: "none", color: "#e57373", fontSize: 14, cursor: "pointer", opacity: 0.6 }}
                        >
                          ×
                        </button>
                      </div>
                      {/* Group Picker Dropdown */}
                      {editingAlbumGroups === album.id && (
                        <div style={{ marginLeft: 28, marginTop: 4, padding: 10, background: "#1a2e2e", border: "2px solid var(--alzooka-gold)", borderRadius: 8, zIndex: 1000 }} onClick={(e) => e.stopPropagation()}>
                          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600 }}>Add to Groups:</p>
                          {groups.map(group => {
                            const isInGroup = (albumGroups[album.id] || []).includes(group.id);
                            return (
                              <label key={group.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", cursor: "pointer", fontSize: 12, borderRadius: 4, background: isInGroup ? `${group.color}22` : "transparent", marginBottom: 2 }}>
                                <input type="checkbox" checked={isInGroup} onChange={() => handleToggleAlbumGroup(album.id, group.id)} style={{ width: 16, height: 16, accentColor: group.color }} />
                                <span style={{ width: 10, height: 10, borderRadius: "50%", background: group.color }} />
                                <span style={{ fontWeight: isInGroup ? 600 : 400 }}>{group.name}</span>
                              </label>
                            );
                          })}
                          <button onClick={() => setEditingAlbumGroups(null)} style={{ marginTop: 8, width: "100%", padding: "6px", fontSize: 11, fontWeight: 600, background: "var(--alzooka-gold)", color: "var(--alzooka-teal-dark)", border: "none", borderRadius: 4, cursor: "pointer" }}>Done</button>
                        </div>
                      )}
                      {/* Expanded Tracks */}
                      {expandedAlbums.has(album.id) && albumTracks[album.id] && (
                        <div style={{ marginLeft: 28, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: "0 0 8px 8px", fontSize: 12 }}>
                          {albumTracks[album.id].map((track, idx) => {
                            const isCurrentTrack = currentlyPlayingTrackUri === track.uri;
                            const isCurrentlyPlaying = isCurrentTrack && isPlaying;
                            const isSelectedStart = selectedStartTrack?.albumId === album.id && selectedStartTrack?.trackUri === track.uri;
                            const isInPlaylistSelection = selectedTrackUris.has(track.uri);
                            
                            return (
                              <div
                                key={track.uri}
                                draggable
                                onDragStart={(e) => {
                                  setDraggingAlbumTrack(track);
                                  e.dataTransfer.effectAllowed = "copy";
                                }}
                                onDragEnd={() => {
                                  setDraggingAlbumTrack(null);
                                  setDropTargetPlaylistId(null);
                                  setDropTargetIndex(null);
                                }}
                                onClick={() => {
                                  // Toggle selection as start track
                                  if (isSelectedStart) {
                                    setSelectedStartTrack(null);
                                  } else {
                                    setSelectedStartTrack({ albumId: album.id, trackUri: track.uri });
                                  }
                                }}
                                style={{
                                  padding: "4px 6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  cursor: "grab",
                                  background: isCurrentTrack 
                                    ? (isPlaying ? "rgba(212, 168, 75, 0.25)" : "rgba(212, 168, 75, 0.15)")
                                    : isSelectedStart 
                                      ? "rgba(30, 215, 96, 0.3)" 
                                      : "transparent",
                                  borderRadius: 4,
                                  borderLeft: isCurrentTrack 
                                    ? "3px solid var(--alzooka-gold)" 
                                    : isSelectedStart 
                                      ? "3px solid #1DB954" 
                                      : "3px solid transparent",
                                  opacity: draggingAlbumTrack?.uri === track.uri ? 0.5 : 1,
                                }}
                              >
                                {/* Checkbox for playlist selection */}
                                <span 
                                  onClick={(e) => { e.stopPropagation(); handleToggleTrackSelect(track); }}
                                  style={{ 
                                    width: 16, 
                                    height: 16, 
                                    borderRadius: 3, 
                                    border: isInPlaylistSelection ? "none" : "1px solid rgba(255,255,255,0.3)", 
                                    background: isInPlaylistSelection ? "#1DB954" : "transparent", 
                                    display: "flex", 
                                    alignItems: "center", 
                                    justifyContent: "center", 
                                    fontSize: 10,
                                    flexShrink: 0,
                                    cursor: "pointer",
                                    transition: "background 0.1s, border 0.1s",
                                  }}
                                >
                                  {isInPlaylistSelection ? "✓" : ""}
                                </span>
                                <span style={{ opacity: 0.5, width: 20, flexShrink: 0 }}>{idx + 1}</span>
                                <span style={{ 
                                  flex: 1, 
                                  overflow: "hidden", 
                                  textOverflow: "ellipsis", 
                                  whiteSpace: "nowrap",
                                  fontWeight: isCurrentTrack ? 600 : 400,
                                  color: isCurrentTrack ? "var(--alzooka-gold)" : "inherit",
                                }}>
                                  {track.name}
                                </span>
                                {isCurrentTrack && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleTogglePlayback(); }}
                                    style={{
                                      background: "var(--alzooka-gold)",
                                      border: "none",
                                      borderRadius: "50%",
                                      width: 20,
                                      height: 20,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      fontSize: 10,
                                      color: "#000",
                                      marginLeft: 4,
                                      flexShrink: 0,
                                    }}
                                    title={isPlaying ? "Pause" : "Play"}
                                  >
                                    {isPlaying ? "⏸" : "▶"}
                                  </button>
                                )}
                                {isSelectedStart && !isCurrentTrack && <span style={{ fontSize: 9, color: "#1DB954", opacity: 0.8 }}>START</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          {playlists.length > 0 && (
            <div style={{ width: 1, background: "rgba(240, 235, 224, 0.2)", alignSelf: "stretch" }} />
          )}

          {/* Right Column: Playlists */}
          {playlists.length > 0 && (
            <div style={{ minWidth: 0 }}>
              {/* Remove from Playlist Bar */}
              {tracksToRemove && tracksToRemove.trackUris.size > 0 && (
                <div style={{
                  background: "rgba(229, 115, 115, 0.15)",
                  border: "1px solid rgba(229, 115, 115, 0.4)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span style={{ color: "#e57373", fontSize: 13 }}>
                    🗑️ {tracksToRemove.trackUris.size} {tracksToRemove.trackUris.size === 1 ? "song" : "songs"} selected
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setTracksToRemove(null)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(240, 235, 224, 0.3)",
                        color: "var(--alzooka-cream)",
                        padding: "6px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setConfirmRemoveTracks(true)}
                      style={{
                        background: "#e57373",
                        border: "none",
                        color: "#000",
                        padding: "6px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Remove from Playlist
                    </button>
                  </div>
                </div>
              )}

              <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>
                📋 Playlists ({playlists.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflowY: "auto" }}>
                {playlists.map(playlist => {
                  const isSelected = selectedPlaylists.has(playlist.id);
                  // Check if currently playing track is from this playlist (using source map)
                  const currentSource = currentlyPlayingTrackUri ? trackSourceMap[currentlyPlayingTrackUri] : null;
                  const hasCurrentTrack = currentSource?.playlistName === playlist.name;
                  return (
                    <div key={playlist.id}>
                      <div
                        onDragOver={(e) => {
                          if (draggingAlbumTrack) {
                            e.preventDefault();
                            setDropTargetPlaylistId(playlist.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dropTargetPlaylistId === playlist.id && viewingPlaylist !== playlist.id) {
                            setDropTargetPlaylistId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggingAlbumTrack && viewingPlaylist !== playlist.id) {
                            // Drop on closed playlist - add to end
                            handleDropTrackToPlaylist(draggingAlbumTrack, playlist.id);
                          }
                          setDropTargetPlaylistId(null);
                          setDraggingAlbumTrack(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: 10,
                          background: dropTargetPlaylistId === playlist.id && viewingPlaylist !== playlist.id
                            ? "rgba(30, 215, 96, 0.4)"
                            : hasCurrentTrack 
                              ? "rgba(30, 215, 96, 0.25)" 
                              : isSelected 
                                ? "rgba(30, 215, 96, 0.1)" 
                                : "rgba(240, 235, 224, 0.03)",
                          borderRadius: viewingPlaylist === playlist.id ? "10px 10px 0 0" : 10,
                          border: dropTargetPlaylistId === playlist.id && viewingPlaylist !== playlist.id
                            ? "2px dashed #1DB954"
                            : hasCurrentTrack 
                              ? "1px solid rgba(30, 215, 96, 0.5)" 
                              : isSelected 
                                ? "1px solid rgba(30, 215, 96, 0.3)" 
                                : "1px solid rgba(240, 235, 224, 0.1)",
                          borderBottom: viewingPlaylist === playlist.id ? "none" : undefined,
                          transition: "background 0.15s, border 0.15s",
                        }}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleTogglePlaylistSelection(playlist.id)}
                          style={{ width: 18, height: 18, accentColor: "#1DB954", cursor: "pointer" }}
                        />
                        {/* Cover */}
                        {playlist.cover_image_url ? (
                          <img src={playlist.cover_image_url} alt="" style={{ width: 44, height: 44, borderRadius: 6 }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 6, background: "rgba(30, 215, 96, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>🎵</div>
                        )}
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => handleViewPlaylist(playlist.id)}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{playlist.name}</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                            {(playlistGroups[playlist.id] || []).map(gid => {
                              const g = groups.find(gr => gr.id === gid);
                              return g ? <span key={gid} style={{ padding: "1px 6px", fontSize: 9, background: g.color, color: "#fff", borderRadius: 8 }}>{g.name}</span> : null;
                            })}
                          </div>
                        </div>
                        {/* Playlist Playback Controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                          {/* Backward */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreviousTrack(); }}
                            disabled={!spotifyConnected || !playerReady}
                            style={{
                              padding: "3px 5px",
                              fontSize: 10,
                              background: spotifyConnected && playerReady ? "rgba(30, 215, 96, 0.2)" : "rgba(240, 235, 224, 0.1)",
                              color: spotifyConnected && playerReady ? "#1DB954" : "rgba(240, 235, 224, 0.3)",
                              border: spotifyConnected && playerReady ? "1px solid rgba(30, 215, 96, 0.4)" : "1px solid transparent",
                              borderRadius: 6,
                              cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                            }}
                            title="Previous track"
                          >
                            ⏮
                          </button>
                          {/* Stop */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStopPlayback(); }}
                            disabled={!spotifyConnected || !playerReady}
                            style={{
                              padding: "3px 5px",
                              fontSize: 10,
                              background: spotifyConnected && playerReady ? "rgba(229, 115, 115, 0.2)" : "rgba(240, 235, 224, 0.1)",
                              color: spotifyConnected && playerReady ? "#e57373" : "rgba(240, 235, 224, 0.3)",
                              border: spotifyConnected && playerReady ? "1px solid rgba(229, 115, 115, 0.4)" : "1px solid transparent",
                              borderRadius: 6,
                              cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                            }}
                            title="Stop"
                          >
                            ⏹
                          </button>
                          {/* Play/Pause Toggle */}
                          {(() => {
                            const isThisPlaylistActive = currentlyPlayingPlaylistId === playlist.id;
                            const isThisPlaylistPlaying = isPlaying && isThisPlaylistActive;
                            return (
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isThisPlaylistActive) {
                                    // This playlist is the active source - just toggle play/pause
                                    handleTogglePlayback();
                                  } else {
                                    // Different playlist - start it from beginning
                                    handlePlayPlaylist(playlist.id);
                                  }
                                }}
                                disabled={!spotifyConnected || !playerReady}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: spotifyConnected && playerReady ? "#1DB954" : "rgba(30, 215, 96, 0.3)",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 10,
                                  cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                                }}
                                title={isThisPlaylistPlaying ? "Pause" : "Play playlist"}
                              >
                                {isThisPlaylistPlaying ? "⏸" : "▶"}
                              </button>
                            );
                          })()}
                          {/* Forward */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleNextTrack(); }}
                            disabled={!spotifyConnected || !playerReady}
                            style={{
                              padding: "3px 5px",
                              fontSize: 10,
                              background: spotifyConnected && playerReady ? "rgba(30, 215, 96, 0.2)" : "rgba(240, 235, 224, 0.1)",
                              color: spotifyConnected && playerReady ? "#1DB954" : "rgba(240, 235, 224, 0.3)",
                              border: spotifyConnected && playerReady ? "1px solid rgba(30, 215, 96, 0.4)" : "1px solid transparent",
                              borderRadius: 6,
                              cursor: spotifyConnected && playerReady ? "pointer" : "not-allowed",
                            }}
                            title="Next track"
                          >
                            ⏭
                          </button>
                        </div>
                        {/* Expand */}
                        <button
                          onClick={() => handleViewPlaylist(playlist.id)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 10,
                            background: viewingPlaylist === playlist.id ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.1)",
                            color: viewingPlaylist === playlist.id ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          {viewingPlaylist === playlist.id ? "▲" : "▼"}
                        </button>
                        {/* Tag */}
                        {groups.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingPlaylistGroups(editingPlaylistGroups === playlist.id ? null : playlist.id); }}
                            style={{ padding: "4px 8px", fontSize: 10, background: "rgba(240, 235, 224, 0.1)", color: "var(--alzooka-cream)", border: "none", borderRadius: 4, cursor: "pointer" }}
                          >
                            🏷️
                          </button>
                        )}
                        {/* Delete */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(playlist.id); }}
                          style={{ background: "transparent", border: "none", color: "#e57373", fontSize: 16, cursor: "pointer", opacity: 0.6 }}
                        >
                          ×
                        </button>
                      </div>
                      {/* Expanded Playlist Tracks */}
                      {viewingPlaylist === playlist.id && playlistTracks[playlist.id] && (
                        <div style={{ padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: "0 0 8px 8px", fontSize: 12, minWidth: 0 }}>
                          {playlistTracks[playlist.id].map((track, idx) => {
                            const isCurrentTrack = currentlyPlayingTrackUri === track.uri;
                            const isCurrentlyPlaying = isCurrentTrack && isPlaying;
                            const isSelectedStart = selectedStartTrack?.playlistId === playlist.id && selectedStartTrack?.trackUri === track.uri;
                            const isSelectedForRemoval = tracksToRemove?.playlistId === playlist.id && tracksToRemove.trackUris.has(track.uri);
                            
                            const isDragging = draggingTrack?.playlistId === playlist.id && draggingTrack?.index === idx;
                            const isDropTarget = (draggingTrack?.playlistId === playlist.id && dropTargetIndex === idx) || 
                              (draggingAlbumTrack && dropTargetPlaylistId === playlist.id && dropTargetIndex === idx);
                            
                            return (
                              <div 
                                key={track.uri}
                                draggable
                                onDragStart={(e) => {
                                  setDraggingTrack({ playlistId: playlist.id, trackUri: track.uri, index: idx });
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  // Handle reordering within same playlist
                                  if (draggingTrack?.playlistId === playlist.id && draggingTrack.index !== idx) {
                                    setDropTargetIndex(idx);
                                  }
                                  // Handle drop from album track
                                  if (draggingAlbumTrack) {
                                    setDropTargetPlaylistId(playlist.id);
                                    setDropTargetIndex(idx);
                                  }
                                }}
                                onDragLeave={() => {
                                  if (dropTargetIndex === idx) {
                                    setDropTargetIndex(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  // Handle reordering within same playlist
                                  if (draggingTrack?.playlistId === playlist.id && draggingTrack.index !== idx) {
                                    handleReorderTracks(playlist.id, draggingTrack.index, idx);
                                  }
                                  // Handle drop from album track
                                  if (draggingAlbumTrack) {
                                    handleDropTrackToPlaylist(draggingAlbumTrack, playlist.id, idx);
                                  }
                                  setDraggingTrack(null);
                                  setDropTargetIndex(null);
                                  setDraggingAlbumTrack(null);
                                  setDropTargetPlaylistId(null);
                                }}
                                onDragEnd={() => {
                                  setDraggingTrack(null);
                                  setDropTargetIndex(null);
                                  setDraggingAlbumTrack(null);
                                  setDropTargetPlaylistId(null);
                                }}
                                onClick={() => {
                                  if (isSelectedStart) {
                                    setSelectedStartTrack(null);
                                    setQueuedNextTrack(null); // Also clear queued next
                                  } else {
                                    setSelectedStartTrack({ playlistId: playlist.id, trackUri: track.uri });
                                    // If something is currently playing, also queue this as the next track
                                    if (isPlaying && currentlyPlayingTrackUri) {
                                      setQueuedNextTrack({ playlistId: playlist.id, trackUri: track.uri });
                                    }
                                  }
                                }}
                                style={{ 
                                  padding: "4px 6px", 
                                  display: "flex", 
                                  alignItems: "center", 
                                  gap: 8,
                                  cursor: isDragging ? "grabbing" : "grab",
                                  opacity: isDragging ? 0.5 : 1,
                                  background: isDropTarget
                                    ? "rgba(30, 215, 96, 0.4)"
                                    : isSelectedForRemoval
                                      ? "rgba(229, 115, 115, 0.2)"
                                      : isCurrentTrack 
                                        ? (isPlaying ? "rgba(212, 168, 75, 0.25)" : "rgba(212, 168, 75, 0.15)")
                                        : isSelectedStart 
                                          ? "rgba(30, 215, 96, 0.3)" 
                                          : "transparent",
                                  borderRadius: 4,
                                  borderTop: isDropTarget ? "2px solid #1DB954" : "2px solid transparent",
                                  borderLeft: isSelectedForRemoval
                                    ? "3px solid #e57373"
                                    : isCurrentTrack 
                                      ? "3px solid var(--alzooka-gold)" 
                                      : isSelectedStart 
                                        ? "3px solid #1DB954" 
                                        : "3px solid transparent",
                                  transition: "background 0.15s, border 0.15s",
                                }}
                              >
                                {/* Checkbox for removal */}
                                <input
                                  type="checkbox"
                                  checked={isSelectedForRemoval}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleTrackRemoval(playlist.id, track.uri);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ cursor: "pointer", accentColor: "#e57373", flexShrink: 0, width: 14, height: 14 }}
                                />
                                <span style={{ opacity: 0.5, width: 24, flexShrink: 0, textAlign: "right" }}>{idx + 1}</span>
                                <span style={{ 
                                  flexShrink: 0,
                                  maxWidth: "40%",
                                  overflow: "hidden", 
                                  textOverflow: "ellipsis", 
                                  whiteSpace: "nowrap",
                                  fontWeight: isCurrentTrack ? 600 : 400,
                                  color: isCurrentTrack ? "var(--alzooka-gold)" : "var(--alzooka-cream)",
                                }}>
                                  {track.name || "(Unknown Track)"}
                                </span>
                                {track.artist && <span style={{ opacity: 0.5, fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{track.artist}</span>}
                                {track.album && <span style={{ 
                                  opacity: 0.4, 
                                  fontSize: 9, 
                                  marginLeft: 4,
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>• {track.album}</span>}
                                {isCurrentTrack && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleTogglePlayback(); }}
                                    style={{
                                      background: "var(--alzooka-gold)",
                                      border: "none",
                                      borderRadius: "50%",
                                      width: 20,
                                      height: 20,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      fontSize: 10,
                                      color: "#000",
                                      marginLeft: 4,
                                      flexShrink: 0,
                                    }}
                                    title={isPlaying ? "Pause" : "Play"}
                                  >
                                    {isPlaying ? "⏸" : "▶"}
                                  </button>
                                )}
                                {isSelectedStart && !isCurrentTrack && (
                                  <span style={{ fontSize: 9, color: "#1DB954", opacity: 0.8, marginLeft: 4 }}>
                                    {queuedNextTrack?.playlistId === playlist.id && queuedNextTrack?.trackUri === track.uri ? "NEXT" : "START"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {/* Drop zone at end of playlist for album tracks */}
                          {draggingAlbumTrack && (
                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDropTargetPlaylistId(playlist.id);
                                setDropTargetIndex(playlistTracks[playlist.id].length);
                              }}
                              onDragLeave={() => {
                                setDropTargetIndex(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggingAlbumTrack) {
                                  handleDropTrackToPlaylist(draggingAlbumTrack, playlist.id);
                                }
                                setDraggingAlbumTrack(null);
                                setDropTargetPlaylistId(null);
                                setDropTargetIndex(null);
                              }}
                              style={{
                                padding: "8px 6px",
                                marginTop: 4,
                                borderRadius: 4,
                                border: dropTargetPlaylistId === playlist.id && dropTargetIndex === playlistTracks[playlist.id].length
                                  ? "2px dashed #1DB954"
                                  : "2px dashed rgba(30, 215, 96, 0.3)",
                                background: dropTargetPlaylistId === playlist.id && dropTargetIndex === playlistTracks[playlist.id].length
                                  ? "rgba(30, 215, 96, 0.2)"
                                  : "transparent",
                                textAlign: "center",
                                fontSize: 11,
                                color: "rgba(30, 215, 96, 0.7)",
                                transition: "background 0.15s, border 0.15s",
                              }}
                            >
                              Drop here to add at end
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
      
      {/* Spotify Search Modal */}
      {showSpotifySearch && (
        <SpotifySearchModal
          onClose={() => setShowSpotifySearch(false)}
          onSelect={(result) => handleAddAlbum(result)}
          onDirectPost={async (result) => {
            await handleAddAlbum(result);
          }}
          existingUris={albums.map(a => a.spotify_uri)}
        />
      )}

      {/* Delete Album Confirmation Modal */}
      {albumPendingDelete && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "#1a2e2e",
            border: "2px solid var(--alzooka-gold)",
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: "90%",
            textAlign: "center",
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>
              Delete Album?
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, justifyContent: "center" }}>
              {albumPendingDelete.spotify_image_url && (
                <img 
                  src={albumPendingDelete.spotify_image_url} 
                  alt="" 
                  style={{ width: 50, height: 50, borderRadius: 4 }} 
                />
              )}
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{albumPendingDelete.spotify_name}</p>
                <p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>{albumPendingDelete.spotify_artist}</p>
              </div>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14, opacity: 0.8 }}>
              Are you sure you want to remove this album from your station?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setAlbumPendingDelete(null)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "rgba(240, 235, 224, 0.1)",
                  color: "var(--alzooka-cream)",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleRemoveAlbum(albumPendingDelete.id);
                  setAlbumPendingDelete(null);
                }}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#e57373",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove Tracks Dialog */}
      {confirmRemoveTracks && tracksToRemove && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "#1a2e2e",
            border: "2px solid #e57373",
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: "90%",
            textAlign: "center",
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>
              Remove {tracksToRemove.trackUris.size === 1 ? "Song" : "Songs"}?
            </h3>
            <p style={{ margin: "0 0 8px", fontSize: 14, opacity: 0.9 }}>
              Are you sure you want to remove {tracksToRemove.trackUris.size} {tracksToRemove.trackUris.size === 1 ? "song" : "songs"} from this playlist?
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 12, opacity: 0.6 }}>
              {tracksToRemove.trackUris.size === 1 ? "This song" : "These songs"} will still be available in the album section.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setConfirmRemoveTracks(false)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "rgba(240, 235, 224, 0.1)",
                  color: "var(--alzooka-cream)",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveTracksFromPlaylist}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#e57373",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

