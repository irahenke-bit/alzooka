"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";

// Extend Window interface for Spotify
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
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
  setName: (name: string) => void;
  getVolume: () => Promise<number>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  activateElement: () => Promise<void>;
}

interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      name: string;
      uri: string;
      artists: { name: string }[];
      album: { name: string; images: { url: string }[] };
      duration_ms: number;
    };
  };
}

interface CurrentTrack {
  name: string;
  artist: string;
  image: string;
  albumName?: string;
  playlistName?: string;
  uri?: string;
}

interface SpotifyPlayerContextType {
  // Connection state
  spotifyConnected: boolean;
  playerReady: boolean;
  spotifyToken: string | null;
  spotifyDeviceId: string | null;
  spotifyPlayer: SpotifyPlayer | null;
  
  // Playback state
  isPlaying: boolean;
  currentTrack: CurrentTrack | null;
  trackPosition: number;
  trackDuration: number;
  
  // Actions
  connectSpotify: () => void;
  disconnectSpotify: () => void;
  togglePlayback: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  stopPlayback: () => Promise<void>;
  
  // For station page to set track info
  setCurrentTrack: (track: CurrentTrack | null) => void;
  setTrackPosition: (position: number) => void;
  setTrackDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  
  // For station page to share its player
  setSpotifyPlayer: (player: SpotifyPlayer | null) => void;
  setPlayerReady: (ready: boolean) => void;
  
  // Refs for ignoring stale updates
  ignorePositionUntilRef: React.MutableRefObject<number>;
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextType | null>(null);

export function useSpotifyPlayer() {
  const context = useContext(SpotifyPlayerContext);
  if (!context) {
    throw new Error("useSpotifyPlayer must be used within SpotifyPlayerProvider");
  }
  return context;
}

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [spotifyPlayer, setSpotifyPlayer] = useState<SpotifyPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [trackPosition, setTrackPosition] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  
  const ignorePositionUntilRef = useRef<number>(0);
  const supabase = createBrowserClient();

  // Check for existing Spotify connection on mount
  useEffect(() => {
    async function checkSpotifyConnection() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("spotify_access_token, spotify_refresh_token, spotify_token_expires_at")
        .eq("id", user.id)
        .single();

      if (userData?.spotify_access_token) {
        // Check if token is expired
        const expiresAt = userData.spotify_token_expires_at ? new Date(userData.spotify_token_expires_at) : null;
        const isExpired = expiresAt && expiresAt < new Date();

        if (!isExpired) {
          setSpotifyToken(userData.spotify_access_token);
          setSpotifyConnected(true);
        } else if (userData.spotify_refresh_token) {
          // Try to refresh the token
          try {
            const res = await fetch("/api/spotify/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: userData.spotify_refresh_token }),
            });
            if (res.ok) {
              const { access_token } = await res.json();
              setSpotifyToken(access_token);
              setSpotifyConnected(true);
            }
          } catch (err) {
            console.error("Failed to refresh Spotify token:", err);
          }
        }
      }
    }

    checkSpotifyConnection();
  }, [supabase]);

  // Track player in ref for cleanup
  const playerRef = useRef<SpotifyPlayer | null>(null);

  // Initialize Spotify SDK when token is available
  useEffect(() => {
    if (!spotifyToken || playerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Alzooka FM",
        getOAuthToken: (cb) => cb(spotifyToken),
        volume: 0.5,
      });

      player.addListener("ready", (state: unknown) => {
        const { device_id } = state as { device_id: string };
        console.log("Spotify player ready, device ID:", device_id);
        setSpotifyDeviceId(device_id);
        setPlayerReady(true);
      });

      player.addListener("not_ready", () => {
        console.log("Spotify player not ready");
        setPlayerReady(false);
      });

      player.addListener("player_state_changed", (state: unknown) => {
        const playerState = state as SpotifyPlayerState | null;
        if (!playerState) return;

        const now = Date.now();
        const isIgnoring = now <= ignorePositionUntilRef.current;

        if (playerState.paused && isIgnoring) {
          return;
        }

        setIsPlaying(!playerState.paused);
        setTrackDuration(playerState.duration);

        if (playerState.track_window?.current_track) {
          const track = playerState.track_window.current_track;
          setCurrentTrack(prev => ({
            name: track.name,
            artist: track.artists.map(a => a.name).join(", "),
            image: track.album.images[0]?.url || "",
            albumName: track.album.name,
            playlistName: prev?.playlistName,
            uri: track.uri,
          }));
        }

        if (!isIgnoring && !playerState.paused) {
          setTrackPosition(playerState.position);
        }
      });

      player.connect();
      playerRef.current = player;
      setSpotifyPlayer(player);
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, [spotifyToken]);

  const connectSpotify = useCallback(() => {
    window.location.href = "/api/spotify/auth";
  }, []);

  const disconnectSpotify = useCallback(async () => {
    if (spotifyPlayer) {
      spotifyPlayer.disconnect();
    }
    setSpotifyPlayer(null);
    setSpotifyConnected(false);
    setSpotifyToken(null);
    setSpotifyDeviceId(null);
    setPlayerReady(false);
    setCurrentTrack(null);
    setIsPlaying(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("users")
        .update({
          spotify_access_token: null,
          spotify_refresh_token: null,
          spotify_token_expires_at: null,
        })
        .eq("id", user.id);
    }
  }, [spotifyPlayer, supabase]);

  const togglePlayback = useCallback(async () => {
    if (!spotifyPlayer) return;
    await spotifyPlayer.togglePlay();
  }, [spotifyPlayer]);

  const nextTrackFn = useCallback(async () => {
    if (!spotifyPlayer) return;
    setTrackPosition(0);
    await spotifyPlayer.nextTrack();
  }, [spotifyPlayer]);

  const previousTrackFn = useCallback(async () => {
    if (!spotifyPlayer) return;
    setTrackPosition(0);
    await spotifyPlayer.previousTrack();
  }, [spotifyPlayer]);

  const seekTo = useCallback(async (position: number) => {
    if (!spotifyPlayer) return;
    await spotifyPlayer.seek(position);
    setTrackPosition(position);
  }, [spotifyPlayer]);

  const stopPlayback = useCallback(async () => {
    if (!spotifyPlayer) return;
    ignorePositionUntilRef.current = Date.now() + 2000;
    await spotifyPlayer.pause();
    setTrackPosition(0);
    setTrackDuration(0);
    setCurrentTrack(null);
    setIsPlaying(false);
  }, [spotifyPlayer]);

  const value: SpotifyPlayerContextType = {
    spotifyConnected,
    playerReady,
    spotifyToken,
    spotifyDeviceId,
    spotifyPlayer,
    isPlaying,
    currentTrack,
    trackPosition,
    trackDuration,
    connectSpotify,
    disconnectSpotify,
    togglePlayback,
    nextTrack: nextTrackFn,
    previousTrack: previousTrackFn,
    seekTo,
    stopPlayback,
    setCurrentTrack,
    setTrackPosition,
    setTrackDuration,
    setIsPlaying,
    setSpotifyPlayer,
    setPlayerReady,
    ignorePositionUntilRef,
  };

  return (
    <SpotifyPlayerContext.Provider value={value}>
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

