"use client";

import React, { createContext, useContext, useState, useMemo, useCallback, useRef, useEffect } from "react";

const STORAGE_KEY = "alzooka_mini_player";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface TrackInfo {
  name: string;
  artist: string;
  image: string;
  albumName?: string;
  playlistName?: string;
}

interface PlaybackContext {
  type: "album" | "playlist" | "shuffle_group";
  uri?: string; // Spotify URI for album/playlist
  groupId?: string; // For shuffle groups
  trackUris?: string[]; // For shuffle groups, the list of track URIs
}

interface PersistedSession {
  track: TrackInfo;
  context: PlaybackContext | null;
  timestamp: number;
}

type PlayerState = "hidden" | "collapsed" | "playing";

interface MiniPlayerContextType {
  currentTrack: TrackInfo | null;
  isPlaying: boolean;
  playerState: PlayerState;
  playbackContext: PlaybackContext | null;
  spotifyToken: string | null;
  spotifyDeviceId: string | null;
  setCurrentTrack: (track: TrackInfo | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackContext: (context: PlaybackContext | null) => void;
  setSpotifyCredentials: (token: string, deviceId: string) => void;
  // Control functions
  onTogglePlay: () => Promise<void>;
  onStop: () => Promise<void>;
  onNext: () => Promise<void>;
  onDismiss: () => void;
  // Set player state directly (for station page to use on resume)
  setPlayerState: (state: PlayerState) => void;
  // Callbacks for station page
  registerStationCallbacks: (callbacks: { 
    onStopCallback: () => void; 
    onNextCallback: () => void;
  }) => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | null>(null);

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrackState] = useState<TrackInfo | null>(null);
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>("hidden");
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext | null>(null);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  
  // Wrapper for setIsPlaying with deduplication
  const setIsPlaying = useCallback((playing: boolean) => {
    if (playing !== isPlayingRef.current) {
      setIsPlayingState(playing);
    }
  }, []);
  
  // Use refs for values that callbacks need but shouldn't cause callback recreation
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
  
  // Station callbacks
  const stationCallbacksRef = useRef<{ 
    onStopCallback: () => void; 
    onNextCallback: () => void;
  } | null>(null);

  // Load persisted session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session: PersistedSession = JSON.parse(stored);
        const age = Date.now() - session.timestamp;
        
        if (age < SESSION_TIMEOUT_MS) {
          // Session is still valid - show collapsed state
          setCurrentTrackState(session.track);
          setPlaybackContext(session.context);
          setPlayerState("collapsed");
        } else {
          // Session expired - clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (err) {
      console.error("Failed to load mini player session:", err);
    }
  }, []);

  // Persist session when track changes (with deduplication to prevent unnecessary updates)
  const setCurrentTrack = useCallback((track: TrackInfo | null) => {
    // Only update if track actually changed
    const current = currentTrackRef.current;
    if (track === null && current === null) return;
    if (track && current && track.name === current.name && track.artist === current.artist) return;
    
    setCurrentTrackState(track);
    
    if (track) {
      // Save to localStorage
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

  // Update player state based on isPlaying
  useEffect(() => {
    if (isPlayingState && currentTrack) {
      setPlayerState("playing");
    } else if (currentTrack && !isPlayingState && playerState === "playing") {
      // Just paused - stay in playing state (will collapse after user interaction or timeout)
      // For now, keep showing full controls when paused
    }
  }, [isPlayingState, currentTrack, playerState]);

  const setSpotifyCredentials = useCallback((token: string, deviceId: string) => {
    setSpotifyToken(token);
    setSpotifyDeviceId(deviceId);
  }, []);

  const registerStationCallbacks = useCallback((callbacks: { 
    onStopCallback: () => void; 
    onNextCallback: () => void;
  }) => {
    stationCallbacksRef.current = callbacks;
  }, []);

  // Toggle play/pause
  const onTogglePlay = useCallback(async () => {
    const token = spotifyTokenRef.current;
    const deviceId = spotifyDeviceIdRef.current;
    const playing = isPlayingRef.current;
    
    if (!token || !deviceId) return;
    
    try {
      if (playing) {
        await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}` },
        });
        setIsPlayingState(false);
      } else {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}` },
        });
        setIsPlayingState(true);
        setPlayerState("playing");
      }
    } catch (err) {
      console.error("Mini player toggle failed:", err);
    }
  }, []);

  // Stop - pause and clear track
  const onStop = useCallback(async () => {
    const token = spotifyTokenRef.current;
    const deviceId = spotifyDeviceIdRef.current;
    
    if (!token || !deviceId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
      });
      setIsPlayingState(false);
      setCurrentTrackState(null);
      setPlaybackContext(null);
      setPlayerState("hidden");
      localStorage.removeItem(STORAGE_KEY);
      stationCallbacksRef.current?.onStopCallback();
    } catch (err) {
      console.error("Mini player stop failed:", err);
    }
  }, []);

  // Next track
  const onNext = useCallback(async () => {
    const token = spotifyTokenRef.current;
    const deviceId = spotifyDeviceIdRef.current;
    
    if (!token || !deviceId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      stationCallbacksRef.current?.onNextCallback();
    } catch (err) {
      console.error("Mini player next failed:", err);
    }
  }, []);

  // Dismiss the player (user clicked X)
  const onDismiss = useCallback(() => {
    setPlayerState("hidden");
    setCurrentTrackState(null);
    setPlaybackContext(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Expose isPlayingState as isPlaying for consumers
  const isPlaying = isPlayingState;
  
  const value = useMemo(() => ({
    currentTrack,
    isPlaying,
    playerState,
    playbackContext,
    spotifyToken,
    spotifyDeviceId,
    setCurrentTrack,
    setIsPlaying,
    setPlaybackContext,
    setSpotifyCredentials,
    onTogglePlay,
    onStop,
    onNext,
    onDismiss,
    setPlayerState,
    registerStationCallbacks,
  }), [currentTrack, isPlaying, playerState, playbackContext, spotifyToken, spotifyDeviceId, setCurrentTrack, setIsPlaying, setSpotifyCredentials, onTogglePlay, onStop, onNext, onDismiss, registerStationCallbacks]);

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

// Export the PlaybackContext type for use in other files
export type { PlaybackContext, TrackInfo };
