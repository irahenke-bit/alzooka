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
  
  // Use refs for values that callbacks need but shouldn't cause callback recreation
  const isPlayingRef = useRef(isPlaying);
  const spotifyTokenRef = useRef(spotifyToken);
  const spotifyDeviceIdRef = useRef(spotifyDeviceId);
  
  // Keep refs in sync
  isPlayingRef.current = isPlaying;
  spotifyTokenRef.current = spotifyToken;
  spotifyDeviceIdRef.current = spotifyDeviceId;
  
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
  // Uses refs so callback identity stays stable
  const onTogglePlay = useCallback(async () => {
    const token = spotifyTokenRef.current;
    const deviceId = spotifyDeviceIdRef.current;
    const playing = isPlayingRef.current;
    
    if (!token || !deviceId) return;
    
    try {
      if (playing) {
        // Pause
        await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}` },
        });
        setIsPlaying(false);
      } else {
        // Resume
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}` },
        });
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Mini player toggle failed:", err);
    }
  }, []); // Empty deps - uses refs

  // Stop - pause and clear track
  // Uses refs so callback identity stays stable
  const onStop = useCallback(async () => {
    const token = spotifyTokenRef.current;
    const deviceId = spotifyDeviceIdRef.current;
    
    if (!token || !deviceId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
      });
      setIsPlaying(false);
      setCurrentTrack(null);
      // Call station callback to clear selections
      stationCallbacksRef.current?.onStopCallback();
    } catch (err) {
      console.error("Mini player stop failed:", err);
    }
  }, []); // Empty deps - uses refs

  // Next track
  // Uses refs so callback identity stays stable
  const onNext = useCallback(async () => {
    const token = spotifyTokenRef.current;
    const deviceId = spotifyDeviceIdRef.current;
    
    if (!token || !deviceId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      // Station callback will update track info
      stationCallbacksRef.current?.onNextCallback();
    } catch (err) {
      console.error("Mini player next failed:", err);
    }
  }, []); // Empty deps - uses refs

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
