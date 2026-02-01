"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type Video = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  description: string;
};

type YouTubeSearchModalProps = {
  onClose: () => void;
  onSelect: (video: Video, searchQuery: string) => void;
  onDirectPost?: (video: Video, searchQuery: string) => Promise<void>;
};

export function YouTubeSearchModal({ onClose, onSelect, onDirectPost }: YouTubeSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Search failed");
          setResults([]);
        } else {
          setResults(data.videos || []);
        }
      } catch {
        setError("Failed to search YouTube");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
  }

  function handleSelect(video: Video) {
    onSelect(video, query);
    onClose();
  }

  async function handleDirectPost(video: Video, e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDirectPost || postingId) return;
    
    setPostingId(video.videoId);
    try {
      await onDirectPost(video, query);
      onClose();
    } catch {
      setPostingId(null);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.9)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 2000,
        padding: "40px 20px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "black",
          borderRadius: 12,
          width: "100%",
          maxWidth: 600,
          maxHeight: "calc(100vh - 80px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#2563eb" }}>▶</span> Search YouTube
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              fontSize: 24,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for artist, album, song..."
              autoFocus
              style={{
                flex: 1,
                padding: "12px 16px",
                fontSize: 16,
                background: "black",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                color: "#ffffff",
              }}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              style={{
                padding: "12px 24px",
                fontSize: 16,
                background: "var(--accent)",
                color: "black",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                opacity: loading || !query.trim() ? 0.5 : 1,
              }}
            >
              {loading ? "..." : "Search"}
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.6 }}>
            Your search terms will be saved for better searchability
          </p>
        </form>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {error && (
            <div style={{ padding: "20px", textAlign: "center", color: "#2563eb" }}>
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && query && (
            <div style={{ padding: "20px", textAlign: "center", opacity: 0.6 }}>
              No results found
            </div>
          )}

          {!loading && !error && results.length === 0 && !query && (
            <div style={{ padding: "40px 20px", textAlign: "center", opacity: 0.6 }}>
              <p style={{ fontSize: 14 }}>Enter an artist, album, or song name to search YouTube</p>
            </div>
          )}

          {results.map((video) => (
            <div
              key={video.videoId}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 20px",
                borderBottom: "1px solid rgba(240, 235, 224, 0.05)",
                transition: "background 0.15s",
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(240, 235, 224, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <img
                src={video.thumbnail}
                alt=""
                style={{
                  width: 120,
                  height: 68,
                  borderRadius: 6,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {video.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--accent)", opacity: 0.8 }}>
                  {video.channelTitle}
                </div>
              </div>
              <button
                onClick={(e) => handleDirectPost(video, e)}
                disabled={postingId !== null}
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "var(--accent)",
                  color: "black",
                  border: "none",
                  borderRadius: 6,
                  cursor: postingId !== null ? "not-allowed" : "pointer",
                  opacity: postingId !== null ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {postingId === video.videoId ? "Posting..." : "Post"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
