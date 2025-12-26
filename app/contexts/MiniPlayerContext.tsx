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
  setCurrentTrack: (track: TrackInfo | null) => void;
  setIsPlaying: (playing: boolean) => void;
  // Control functions that the station page will provide
  onTogglePlay: () => void;
  onStop: () => void;
  onNext: () => void;
  registerControls: (controls: { toggle: () => void; stop: () => void; next: () => void }) => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | null>(null);

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Store control functions from the station page
  const controlsRef = useRef<{ toggle: () => void; stop: () => void; next: () => void } | null>(null);

  const registerControls = useCallback((controls: { toggle: () => void; stop: () => void; next: () => void }) => {
    controlsRef.current = controls;
  }, []);

  const onTogglePlay = useCallback(() => {
    controlsRef.current?.toggle();
  }, []);

  const onStop = useCallback(() => {
    controlsRef.current?.stop();
  }, []);

  const onNext = useCallback(() => {
    controlsRef.current?.next();
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    currentTrack,
    isPlaying,
    setCurrentTrack,
    setIsPlaying,
    onTogglePlay,
    onStop,
    onNext,
    registerControls,
  }), [currentTrack, isPlaying, onTogglePlay, onStop, onNext, registerControls]);

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

