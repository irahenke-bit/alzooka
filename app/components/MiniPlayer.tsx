"use client";

import React, { memo, useEffect } from "react";
import { useMiniPlayer } from "@/app/contexts/MiniPlayerContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MiniPlayer = memo(function MiniPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    playerState,
    playerReady,
    playbackContext,
    onTogglePlay, 
    onStop, 
    onNext,
    onDismiss,
    onResume,
  } = useMiniPlayer();
  const pathname = usePathname();
  
  // Get source station info if playing from someone else's station
  const sourceStation = playbackContext?.sourceStation;

  // Global spacebar handler for play/pause
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle spacebar
      if (e.code !== "Space") return;
      
      // Don't trigger if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      
      // Only handle if player is ready and we have a track
      if (!playerReady || !currentTrack) return;
      
      // Prevent default (page scrolling)
      e.preventDefault();
      
      // Toggle play/pause
      if (playerState === "collapsed") {
        onResume();
      } else {
        onTogglePlay();
      }
    }
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [playerReady, currentTrack, playerState, onTogglePlay, onResume]);

  // Don't show on station page (it has its own player)
  if (pathname === "/station") return null;

  // Don't show if hidden or no track
  if (playerState === "hidden" || !currentTrack) return null;

  // Collapsed state - just show track info and resume button
  if (playerState === "collapsed") {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 52,
          background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
          borderTop: "1px solid rgba(201, 162, 39, 0.3)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          zIndex: 9999,
        }}
      >
        {/* Album Art */}
        {currentTrack.image && (
          <img
            src={currentTrack.image}
            alt={currentTrack.name}
            style={{
              width: 36,
              height: 36,
              borderRadius: 4,
              objectFit: "cover",
              opacity: 0.8,
            }}
          />
        )}

        {/* Track Info */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(240, 235, 224, 0.7)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentTrack.name} • {currentTrack.artist}
          </div>
        </div>

        {/* Resume Button - resumes playback without navigating */}
        <button
          onClick={onResume}
          style={{
            padding: "8px 20px",
            background: "#c9a227",
            border: "none",
            borderRadius: 20,
            color: "#1a1a1a",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            willChange: "transform",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          ▶ Resume
        </button>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            background: "rgba(240, 235, 224, 0.1)",
            color: "rgba(240, 235, 224, 0.5)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            willChange: "transform",
            WebkitTapHighlightColor: "transparent",
          }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    );
  }

  // Full playing state
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
        borderTop: "1px solid rgba(201, 162, 39, 0.3)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 16,
        zIndex: 9999,
      }}
    >
      {/* Album Art */}
      {currentTrack.image && (
        <img
          src={currentTrack.image}
          alt={currentTrack.name}
          style={{
            width: 48,
            height: 48,
            borderRadius: 4,
            objectFit: "cover",
          }}
        />
      )}

      {/* Track Info */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#f0ebe0",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {currentTrack.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(240, 235, 224, 0.6)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {currentTrack.artist}
          {currentTrack.albumName && ` • ${currentTrack.albumName}`}
        </div>
        {/* Source station indicator */}
        {sourceStation && (
          <div
            style={{
              fontSize: 11,
              color: "#1DB954",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 2,
            }}
          >
            Playing from {sourceStation.displayName}'s Station
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Stop */}
        <button
          onClick={onStop}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(240, 235, 224, 0.1)",
            color: "#f0ebe0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            willChange: "transform",
            WebkitTapHighlightColor: "transparent",
          }}
          title="Stop"
        >
          ⏹
        </button>

        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: "#c9a227",
            color: "#1a1a1a",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            willChange: "transform",
            WebkitTapHighlightColor: "transparent",
          }}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(240, 235, 224, 0.1)",
            color: "#f0ebe0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            willChange: "transform",
            WebkitTapHighlightColor: "transparent",
          }}
          title="Next"
        >
          ⏭
        </button>
      </div>

      {/* Dismiss Button - always takes up space, but only visible/clickable when paused */}
      <button
        onClick={isPlaying ? undefined : onDismiss}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "none",
          background: isPlaying ? "transparent" : "rgba(240, 235, 224, 0.15)",
          color: "rgba(240, 235, 224, 0.6)",
          cursor: isPlaying ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          visibility: isPlaying ? "hidden" : "visible",
          willChange: "transform",
          WebkitTapHighlightColor: "transparent",
        }}
        title={isPlaying ? "" : "Close Player"}
        disabled={isPlaying}
      >
        ✕
      </button>

      {/* Open Station Link - goes to source station if playing from someone else's */}
      <Link
        href={sourceStation ? `/station/${sourceStation.username}` : "/station"}
        style={{
          padding: "8px 16px",
          background: sourceStation 
            ? "rgba(30, 215, 96, 0.2)" 
            : "rgba(201, 162, 39, 0.2)",
          border: sourceStation
            ? "1px solid rgba(30, 215, 96, 0.4)"
            : "1px solid rgba(201, 162, 39, 0.4)",
          borderRadius: 20,
          color: sourceStation ? "#1DB954" : "#c9a227",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {sourceStation && sourceStation.avatarUrl && (
          <img 
            src={sourceStation.avatarUrl} 
            alt="" 
            style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }}
          />
        )}
        {sourceStation ? `${sourceStation.displayName}'s Station` : "Open Station"}
      </Link>
    </div>
  );
});

export default MiniPlayer;
