"use client";

import { useSpotifyPlayer } from "@/app/contexts/SpotifyPlayerContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    trackPosition,
    trackDuration,
    playerReady,
    togglePlayback,
    nextTrack,
    previousTrack,
    stopPlayback,
  } = useSpotifyPlayer();

  const pathname = usePathname();

  // Don't show on station page (it has its own full player)
  if (pathname === "/station") {
    return null;
  }

  // Don't show if nothing is playing and no track loaded
  if (!currentTrack) {
    return null;
  }

  const progressPercent = trackDuration > 0 ? (trackPosition / trackDuration) * 100 : 0;

  function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        background: "linear-gradient(to right, rgba(20, 40, 40, 0.98), rgba(30, 50, 50, 0.98))",
        borderTop: "1px solid rgba(201, 162, 39, 0.3)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        zIndex: 1000,
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Progress bar at top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(240, 235, 224, 0.1)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            background: "linear-gradient(90deg, #1DB954, var(--alzooka-gold))",
            transition: "width 0.3s linear",
          }}
        />
      </div>

      {/* Album art */}
      {currentTrack.image && (
        <img
          src={currentTrack.image}
          alt=""
          style={{
            width: 52,
            height: 52,
            borderRadius: 6,
            objectFit: "cover",
          }}
        />
      )}

      {/* Track info */}
      <Link
        href="/station"
        style={{
          flex: 1,
          minWidth: 0,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--alzooka-cream)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentTrack.name}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12,
            opacity: 0.7,
            color: "var(--alzooka-cream)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentTrack.artist}
          {currentTrack.albumName && ` • ${currentTrack.albumName}`}
        </p>
      </Link>

      {/* Time */}
      <span style={{ fontSize: 11, opacity: 0.6, color: "var(--alzooka-cream)", minWidth: 80, textAlign: "center" }}>
        {formatTime(trackPosition)} / {formatTime(trackDuration)}
      </span>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Previous */}
        <button
          onClick={previousTrack}
          disabled={!playerReady}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(240, 235, 224, 0.1)",
            color: playerReady ? "var(--alzooka-cream)" : "rgba(240, 235, 224, 0.3)",
            cursor: playerReady ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          ⏮
        </button>

        {/* Play/Pause */}
        <button
          onClick={togglePlayback}
          disabled={!playerReady}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: isPlaying ? "#1DB954" : "var(--alzooka-gold)",
            color: "var(--alzooka-teal-dark)",
            cursor: playerReady ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Next */}
        <button
          onClick={nextTrack}
          disabled={!playerReady}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(240, 235, 224, 0.1)",
            color: playerReady ? "var(--alzooka-cream)" : "rgba(240, 235, 224, 0.3)",
            cursor: playerReady ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          ⏭
        </button>

        {/* Stop */}
        <button
          onClick={stopPlayback}
          disabled={!playerReady}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(229, 115, 115, 0.2)",
            color: playerReady ? "#e57373" : "rgba(240, 235, 224, 0.3)",
            cursor: playerReady ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          ⏹
        </button>
      </div>

      {/* Link to station */}
      <Link
        href="/station"
        style={{
          padding: "8px 16px",
          background: "rgba(201, 162, 39, 0.2)",
          border: "1px solid rgba(201, 162, 39, 0.4)",
          borderRadius: 20,
          color: "var(--alzooka-gold)",
          textDecoration: "none",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        Open Station
      </Link>
    </div>
  );
}

