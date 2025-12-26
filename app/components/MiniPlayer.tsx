"use client";

import { useMiniPlayer } from "@/app/contexts/MiniPlayerContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MiniPlayer() {
  const { currentTrack, isPlaying, onTogglePlay, onStop, onNext } = useMiniPlayer();
  const pathname = usePathname();

  // Don't show on station page (it has its own player)
  if (pathname === "/station") return null;

  // Don't show if no track
  if (!currentTrack) return null;

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
          }}
          title="Next"
        >
          ⏭
        </button>
      </div>

      {/* Open Station Link */}
      <Link
        href="/station"
        style={{
          padding: "8px 16px",
          background: "rgba(201, 162, 39, 0.2)",
          border: "1px solid rgba(201, 162, 39, 0.4)",
          borderRadius: 20,
          color: "#c9a227",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Open Station
      </Link>
    </div>
  );
}
