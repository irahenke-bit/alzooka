"use client";

import React, { createContext, useContext, useState, useMemo, useCallback, useRef } from "react";

interface TrackInfo {
  name: string;
  artist: string;
  image: string;
  albumName?: string;
  playlistName?: string;
}

interface MiniPlayerContextType {
  currentTrack: TrackInfo | null;
  isPlaying: boolean;
  spotifyToken: string | null;
  spotifyDeviceId: string | null;
  setCurrentTrack: (track: TrackInfo | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setSpotifyCredentials: (token: string, deviceId: string) => void;
  // Control functions - these make direct API calls
  onTogglePlay: () => Promise<void>;
  onStop: () => Promise<void>;
  onNext: () => Promise<void>;
  // Callbacks for station page to handle stop/next (these need station state)
  registerStationCallbacks: (callbacks: { onStopCallback: () => void; onNextCallback: () => void }) => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | null>(null);

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  
  // Station callbacks for stop/next (these need station state to clear selections etc)
  const stationCallbacksRef = useRef<{ onStopCallback: () => void; onNextCallback: () => void } | null>(null);

  const setSpotifyCredentials = useCallback((token: string, deviceId: string) => {
    setSpotifyToken(token);
    setSpotifyDeviceId(deviceId);
  }, []);

  const registerStationCallbacks = useCallback((callbacks: { onStopCallback: () => void; onNextCallback: () => void }) => {
    stationCallbacksRef.current = callbacks;
  }, []);

  // Toggle play/pause - makes direct Spotify API call
  const onTogglePlay = useCallback(async () => {
    if (!spotifyToken || !spotifyDeviceId) return;
    
    try {
      if (isPlaying) {
        // Pause
        await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${spotifyDeviceId}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${spotifyToken}` },
        });
        setIsPlaying(false);
      } else {
        // Resume
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${spotifyToken}` },
        });
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Mini player toggle failed:", err);
    }
  }, [spotifyToken, spotifyDeviceId, isPlaying]);

  // Stop - pause and clear track
  const onStop = useCallback(async () => {
    if (!spotifyToken || !spotifyDeviceId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${spotifyDeviceId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${spotifyToken}` },
      });
      setIsPlaying(false);
      setCurrentTrack(null);
      // Call station callback to clear selections
      stationCallbacksRef.current?.onStopCallback();
    } catch (err) {
      console.error("Mini player stop failed:", err);
    }
  }, [spotifyToken, spotifyDeviceId]);

  // Next track
  const onNext = useCallback(async () => {
    if (!spotifyToken || !spotifyDeviceId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${spotifyDeviceId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${spotifyToken}` },
      });
      // Station callback will update track info
      stationCallbacksRef.current?.onNextCallback();
    } catch (err) {
      console.error("Mini player next failed:", err);
    }
  }, [spotifyToken, spotifyDeviceId]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    currentTrack,
    isPlaying,
    spotifyToken,
    spotifyDeviceId,
    setCurrentTrack,
    setIsPlaying,
    setSpotifyCredentials,
    onTogglePlay,
    onStop,
    onNext,
    registerStationCallbacks,
  }), [currentTrack, isPlaying, spotifyToken, spotifyDeviceId, setSpotifyCredentials, onTogglePlay, onStop, onNext, registerStationCallbacks]);

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
