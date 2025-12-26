"use client";

import React, { createContext, useContext, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";

const STORAGE_KEY = "alzooka_mini_player";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Spotify Player types
interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      uri: string;
      name: string;
      artists: { name: string }[];
      album: { images: { url: string }[]; name: string };
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

export interface TrackInfo {
  name: string;
  artist: string;
  image: string;
  albumName?: string;
  playlistName?: string;
}

export interface PlaybackContext {
  type: "album" | "playlist" | "shuffle_group";
  uri?: string;
  groupId?: string;
  trackUris?: string[];
}

interface PersistedSession {
  track: TrackInfo;
  context: PlaybackContext | null;
  timestamp: number;
}

export type PlayerState = "hidden" | "collapsed" | "playing";

// Station page callback interface for more granular control
export interface StationCallbacks {
  onTrackChange?: (track: TrackInfo, uri: string) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onPositionChange?: (position: number, duration: number) => void;
  onStop?: () => void;
  onNext?: () => void;
}

interface MiniPlayerContextType {
  // Player state (only stable values - no frequently changing position)
  currentTrack: TrackInfo | null;
  isPlaying: boolean;
  playerState: PlayerState;
  playbackContext: PlaybackContext | null;
  
  // Spotify connection
  spotifyToken: string | null;
  spotifyDeviceId: string | null;
  spotifyPlayer: SpotifyPlayer | null;
  playerReady: boolean;
  
  // State setters
  setCurrentTrack: (track: TrackInfo | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackContext: (context: PlaybackContext | null) => void;
  setPlayerState: (state: PlayerState) => void;
  
  // Spotify connection
  initializeSpotify: (userId: string) => Promise<void>;
  
  // Control functions
  onTogglePlay: () => Promise<void>;
  onStop: () => Promise<void>;
  onNext: () => Promise<void>;
  onPrevious: () => Promise<void>;
  onSeek: (position: number) => Promise<void>;
  onDismiss: () => void;
  onResume: () => Promise<void>; // Resume playback from collapsed state without navigation
  
  // Station page integration
  registerStationCallbacks: (callbacks: StationCallbacks) => void;
  unregisterStationCallbacks: () => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | null>(null);

// Module-level player instance - persists across component remounts
let globalPlayer: SpotifyPlayer | null = null;
let globalDeviceId: string | null = null;
let playerInitializing = false;

// Module-level callbacks for station page
let stationCallbacks: StationCallbacks | null = null;

// Module-level flag to ignore stale track updates when starting new playback
let ignoreTrackUpdatesUntil = 0;

// Function to set the ignore flag (called by station page when starting new playback)
export function ignoreTrackUpdatesFor(ms: number) {
  ignoreTrackUpdatesUntil = Date.now() + ms;
}

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrackState] = useState<TrackInfo | null>(null);
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>("hidden");
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext | null>(null);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [spotifyPlayer, setSpotifyPlayer] = useState<SpotifyPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  // NOTE: trackPosition and trackDuration are NOT stored as state here
  // They would cause constant re-renders. Station page manages its own position state.
  
  // User ID ref for token refresh
  const userIdRef = useRef<string | null>(null);
  
  // Refs for stable callbacks
  const isPlayingRef = useRef(isPlayingState);
  const spotifyTokenRef = useRef(spotifyToken);
  const spotifyDeviceIdRef = useRef(spotifyDeviceId);
  const playbackContextRef = useRef(playbackContext);
  const currentTrackRef = useRef(currentTrack);
  
  // Keep refs in sync
  isPlayingRef.current = isPlayingState;
  spotifyTokenRef.current = spotifyToken;
  spotifyDeviceIdRef.current = spotifyDeviceId;
  playbackContextRef.current = playbackContext;
  currentTrackRef.current = currentTrack;
  
  // Throttle position updates - only update every 2 seconds to reduce lag
  const lastPositionUpdate = useRef(0);
  const POSITION_THROTTLE = 2000;
  
  // Supabase client for fetching user
  const supabase = createBrowserClient();

  // Load persisted session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session: PersistedSession = JSON.parse(stored);
        const age = Date.now() - session.timestamp;
        
        if (age < SESSION_TIMEOUT_MS) {
          setCurrentTrackState(session.track);
          setPlaybackContext(session.context);
          setPlayerState("collapsed");
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (err) {
      console.error("Failed to load mini player session:", err);
    }
    
    // If we have an existing player, use it
    if (globalPlayer && globalDeviceId) {
      setSpotifyPlayer(globalPlayer);
      setSpotifyDeviceId(globalDeviceId);
      setPlayerReady(true);
      
      // Sync state from existing player (only essential state, no position)
      globalPlayer.getCurrentState().then((state) => {
        if (state) {
          setIsPlayingState(!state.paused);
          if (state.track_window?.current_track) {
            const track = state.track_window.current_track;
            setCurrentTrackState({
              name: track.name,
              artist: track.artists.map((a) => a.name).join(", "),
              image: track.album.images[0]?.url || "",
              albumName: track.album.name,
            });
            if (!state.paused) {
              setPlayerState("playing");
            }
          }
        }
      });
    }
  }, []);
  
  // Initialize Spotify player
  const initializeSpotify = useCallback(async (userId: string) => {
    userIdRef.current = userId;
    
    // If player already exists, just update state and return
    if (globalPlayer && globalDeviceId) {
      setSpotifyPlayer(globalPlayer);
      setSpotifyDeviceId(globalDeviceId);
      setPlayerReady(true);
      return;
    }
    
    if (playerInitializing) return;
    playerInitializing = true;
    
    try {
      // Fetch token
      const response = await fetch(`/api/spotify/token?userId=${userId}`);
      if (!response.ok) {
        playerInitializing = false;
        return;
      }
      const data = await response.json();
      const token = data.access_token;
      setSpotifyToken(token);
      spotifyTokenRef.current = token;
      
      // Load SDK if not already loaded
      if (!document.getElementById("spotify-sdk")) {
        const script = document.createElement("script");
        script.id = "spotify-sdk";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
      
      const initPlayer = () => {
        const player = new window.Spotify.Player({
          name: "Alzooka FM",
          getOAuthToken: async (cb) => {
            // Always fetch fresh token
            if (userIdRef.current) {
              try {
                const res = await fetch(`/api/spotify/token?userId=${userIdRef.current}`);
                const data = await res.json();
                spotifyTokenRef.current = data.access_token;
                setSpotifyToken(data.access_token);
                cb(data.access_token);
              } catch {
                cb(spotifyTokenRef.current || "");
              }
            } else {
              cb(spotifyTokenRef.current || "");
            }
          },
          volume: 0.5,
        });
        
        player.addListener("initialization_error", (e) => {
          const error = e as { message: string };
          console.error("Spotify init error:", error.message);
          playerInitializing = false;
        });
        
        player.addListener("authentication_error", (e) => {
          const error = e as { message: string };
          console.error("Spotify auth error:", error.message);
          playerInitializing = false;
        });
        
        player.addListener("account_error", (e) => {
          const error = e as { message: string };
          console.error("Spotify account error:", error.message);
          alert("Spotify Premium is required for playback");
          playerInitializing = false;
        });
        
        player.addListener("ready", (e) => {
          const data = e as { device_id: string };
          console.log("Spotify player ready, device ID:", data.device_id);
          globalPlayer = player;
          globalDeviceId = data.device_id;
          playerInitializing = false;
          setSpotifyPlayer(player);
          setSpotifyDeviceId(data.device_id);
          setPlayerReady(true);
        });
        
        // Player state changes - updates mini player state
        // HEAVILY optimized to prevent lag - most events are ignored
        let lastTrackUri = "";
        let lastPlayingState: boolean | null = null;
        let lastProcessedTime = 0;
        // When ON station page (callbacks registered): process every 250ms for responsive UI
        // When NOT on station page: only process every 2 seconds to prevent lag
        const STATION_INTERVAL = 250;
        const BACKGROUND_INTERVAL = 2000;
        
        player.addListener("player_state_changed", (e) => {
          const state = e as SpotifyPlayerState | null;
          if (!state) return;
          
          const now = Date.now();
          const playing = !state.paused;
          const currentUri = state.track_window?.current_track?.uri || "";
          
          // Check if anything important changed
          const playStateChanged = playing !== lastPlayingState;
          const trackChanged = currentUri && currentUri !== lastTrackUri;
          
          // Use much longer throttle when not on station page
          const isOnStationPage = stationCallbacks !== null;
          const throttleInterval = isOnStationPage ? STATION_INTERVAL : BACKGROUND_INTERVAL;
          
          // Skip if nothing important changed AND we processed recently
          if (!playStateChanged && !trackChanged && (now - lastProcessedTime < throttleInterval)) {
            return;
          }
          
          // For background mode, skip even position callbacks entirely
          if (!isOnStationPage && !playStateChanged && !trackChanged) {
            return;
          }
          
          lastProcessedTime = now;
          
          // Only update playing state if it changed
          if (playStateChanged) {
            lastPlayingState = playing;
            setIsPlayingState(playing);
            stationCallbacks?.onPlayStateChange?.(playing);
            
            if (playing) {
              setPlayerState("playing");
            }
          }
          
          // Only update track info if track changed AND we're not ignoring stale updates
          if (trackChanged && now > ignoreTrackUpdatesUntil) {
            lastTrackUri = currentUri;
            const track = state.track_window.current_track;
            const trackInfo: TrackInfo = {
              name: track.name,
              artist: track.artists.map((a) => a.name).join(", "),
              image: track.album.images[0]?.url || "",
              albumName: track.album.name,
            };
            setCurrentTrackState(trackInfo);
            
            // Notify station page (pass duration through callback)
            stationCallbacks?.onTrackChange?.(trackInfo, track.uri);
            
            // Persist to localStorage (defer to prevent blocking)
            setTimeout(() => {
              const session: PersistedSession = {
                track: trackInfo,
                context: playbackContextRef.current,
                timestamp: Date.now(),
              };
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
              } catch (err) {
                console.error("Failed to persist session:", err);
              }
            }, 0);
          }
          
          // Only notify station page of position if it's listening
          if (isOnStationPage && stationCallbacks?.onPositionChange && (now - lastPositionUpdate.current >= POSITION_THROTTLE)) {
            lastPositionUpdate.current = now;
            stationCallbacks.onPositionChange(state.position, state.duration);
          }
        });
        
        player.connect();
      };
      
      if (window.Spotify) {
        initPlayer();
      } else {
        window.onSpotifyWebPlaybackSDKReady = initPlayer;
      }
    } catch (err) {
      console.error("Failed to initialize Spotify:", err);
      playerInitializing = false;
    }
  }, []);

  // Wrapper for setIsPlaying with deduplication
  const setIsPlaying = useCallback((playing: boolean) => {
    if (playing !== isPlayingRef.current) {
      setIsPlayingState(playing);
    }
  }, []);

  // Persist session when track changes
  const setCurrentTrack = useCallback((track: TrackInfo | null) => {
    const current = currentTrackRef.current;
    if (track === null && current === null) return;
    if (track && current && track.name === current.name && track.artist === current.artist) return;
    
    setCurrentTrackState(track);
    
    if (track) {
      const session: PersistedSession = {
        track,
        context: playbackContextRef.current,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (err) {
        console.error("Failed to persist mini player session:", err);
      }
    }
  }, []);

  // Register station callbacks
  const registerStationCallbacks = useCallback((callbacks: StationCallbacks) => {
    stationCallbacks = callbacks;
  }, []);
  
  const unregisterStationCallbacks = useCallback(() => {
    stationCallbacks = null;
  }, []);

  // Toggle play/pause using SDK player
  const onTogglePlay = useCallback(async () => {
    const player = globalPlayer;
    if (!player) return;
    
    try {
      await player.togglePlay();
    } catch (err) {
      console.error("Toggle play failed:", err);
    }
  }, []);

  // Stop playback
  const onStop = useCallback(async () => {
    const player = globalPlayer;
    if (!player) return;
    
    try {
      await player.pause();
      setIsPlayingState(false);
      setCurrentTrackState(null);
      setPlaybackContext(null);
      setPlayerState("hidden");
      localStorage.removeItem(STORAGE_KEY);
      stationCallbacks?.onStop?.();
    } catch (err) {
      console.error("Stop failed:", err);
    }
  }, []);

  // Next track using SDK player
  const onNext = useCallback(async () => {
    const player = globalPlayer;
    if (!player) return;
    
    try {
      await player.nextTrack();
      stationCallbacks?.onNext?.();
    } catch (err) {
      console.error("Next track failed:", err);
    }
  }, []);
  
  // Previous track
  const onPrevious = useCallback(async () => {
    const player = globalPlayer;
    if (!player) return;
    
    try {
      await player.previousTrack();
    } catch (err) {
      console.error("Previous track failed:", err);
    }
  }, []);
  
  // Seek
  const onSeek = useCallback(async (position: number) => {
    const player = globalPlayer;
    if (!player) return;
    
    try {
      await player.seek(position);
      // Note: Position state is managed by station page, not context
    } catch (err) {
      console.error("Seek failed:", err);
    }
  }, []);

  // Dismiss the player
  const onDismiss = useCallback(() => {
    setPlayerState("hidden");
    setCurrentTrackState(null);
    setPlaybackContext(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Resume playback from collapsed state (after refresh) without navigating
  const onResume = useCallback(async () => {
    try {
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("No user session for resume");
        return;
      }
      
      const userId = session.user.id;
      
      // Initialize Spotify if not ready
      if (!globalPlayer || !globalDeviceId) {
        await initializeSpotify(userId);
        
        // Wait for player to be ready (poll for up to 5 seconds)
        let attempts = 0;
        while ((!globalPlayer || !globalDeviceId) && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!globalPlayer || !globalDeviceId) {
          console.error("Failed to initialize Spotify player for resume");
          return;
        }
      }
      
      // Get fresh token
      const tokenRes = await fetch(`/api/spotify/token?userId=${userId}`);
      if (!tokenRes.ok) {
        console.error("Failed to get Spotify token for resume");
        return;
      }
      const tokenData = await tokenRes.json();
      const token = tokenData.access_token;
      
      // Activate element (needed for autoplay policy)
      try {
        await globalPlayer.activateElement();
      } catch (e) {
        console.log("activateElement error (may be ok):", e);
      }
      
      // Resume playback on our device
      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${globalDeviceId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (res.ok || res.status === 204) {
        setPlayerState("playing");
        setIsPlayingState(true);
      } else {
        console.error("Resume playback failed:", await res.text());
      }
    } catch (err) {
      console.error("Resume failed:", err);
    }
  }, [initializeSpotify, supabase]);

  const isPlaying = isPlayingState;
  
  // NOTE: trackPosition and trackDuration are NOT included in the context value
  // They change too frequently and would cause all consumers to re-render
  // The station page gets position updates through its registered callbacks
  const value = useMemo(() => ({
    currentTrack,
    isPlaying,
    playerState,
    playbackContext,
    spotifyToken,
    spotifyDeviceId,
    spotifyPlayer,
    playerReady,
    setCurrentTrack,
    setIsPlaying,
    setPlaybackContext,
    setPlayerState,
    initializeSpotify,
    onTogglePlay,
    onStop,
    onNext,
    onPrevious,
    onSeek,
    onDismiss,
    onResume,
    registerStationCallbacks,
    unregisterStationCallbacks,
  }), [
    currentTrack, isPlaying, playerState, playbackContext,
    spotifyToken, spotifyDeviceId, spotifyPlayer, playerReady,
    setCurrentTrack, setIsPlaying, initializeSpotify, 
    onTogglePlay, onStop, onNext, onPrevious, onSeek, onDismiss, onResume,
    registerStationCallbacks, unregisterStationCallbacks,
  ]);

  return (
    <MiniPlayerContext.Provider value={value}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const context = useContext(MiniPlayerContext);
  if (!context) {
    throw new Error("useMiniPlayer must be used within a MiniPlayerProvider");
  }
  return context;
}

// Export SpotifyPlayer type for station page
export type { SpotifyPlayer, SpotifyPlayerState };
