"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type SpotifyResult = {
  id: string;
  name: string;
  artist: string;
  image: string;
  uri: string;
  type: string;
};

type SpotifySearchModalProps = {
  onClose: () => void;
  onSelect: (result: SpotifyResult, searchQuery: string) => void;
  onDirectPost?: (result: SpotifyResult, searchQuery: string) => Promise<void>;
};

export function SpotifySearchModal({ onClose, onSelect, onDirectPost }: SpotifySearchModalProps) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"album" | "track">("album");
  const [results, setResults] = useState<SpotifyResult[]>([]);
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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(query)}&type=${searchType}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Search failed");
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch {
      setError("Failed to search Spotify");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(result: SpotifyResult) {
    onSelect(result, query);
    onClose();
  }

  async function handleDirectPost(result: SpotifyResult, e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDirectPost || postingId) return;
    
    setPostingId(result.id);
    try {
      await onDirectPost(result, query);
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
          background: "var(--alzooka-teal-dark)",
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
            borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#1DB954" }}>●</span> Search Spotify
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--alzooka-cream)",
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
        <form onSubmit={handleSearch} style={{ padding: "16px 20px", borderBottom: "1px solid rgba(240, 235, 224, 0.1)" }}>
          {/* Type Toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setSearchType("album")}
              style={{
                padding: "6px 16px",
                fontSize: 14,
                background: searchType === "album" ? "#1DB954" : "transparent",
                color: searchType === "album" ? "#000" : "var(--alzooka-cream)",
                border: "1px solid rgba(240, 235, 224, 0.3)",
                borderRadius: 20,
                cursor: "pointer",
                fontWeight: searchType === "album" ? 600 : 400,
              }}
            >
              Albums
            </button>
            <button
              type="button"
              onClick={() => setSearchType("track")}
              style={{
                padding: "6px 16px",
                fontSize: 14,
                background: searchType === "track" ? "#1DB954" : "transparent",
                color: searchType === "track" ? "#000" : "var(--alzooka-cream)",
                border: "1px solid rgba(240, 235, 224, 0.3)",
                borderRadius: 20,
                cursor: "pointer",
                fontWeight: searchType === "track" ? 600 : 400,
              }}
            >
              Tracks
            </button>
          </div>

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
                background: "var(--alzooka-teal-light)",
                border: "1px solid rgba(240, 235, 224, 0.2)",
                borderRadius: 8,
                color: "var(--alzooka-cream)",
              }}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              style={{
                padding: "12px 24px",
                fontSize: 16,
                background: "#1DB954",
                color: "#000",
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
            <div style={{ padding: "20px", textAlign: "center", color: "#e57373" }}>
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
              <p style={{ fontSize: 14 }}>Search for albums or tracks on Spotify</p>
            </div>
          )}

          {results.map((result) => (
            <div
              key={result.id}
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
              {result.image ? (
                <img
                  src={result.image}
                  alt=""
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: result.type === "artist" ? "50%" : 4,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: result.type === "artist" ? "50%" : 4,
                    background: "#1DB954",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ●
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.name}
                </div>
                {result.artist && (
                  <div style={{ fontSize: 12, color: "#1DB954", opacity: 0.8 }}>
                    {result.artist}
                  </div>
                )}
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                  {result.type === "album" ? "Album" : result.type === "track" ? "Track" : "Artist"}
                </div>
              </div>
              <button
                onClick={(e) => handleDirectPost(result, e)}
                disabled={postingId !== null}
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#1DB954",
                  color: "#000",
                  border: "none",
                  borderRadius: 6,
                  cursor: postingId !== null ? "not-allowed" : "pointer",
                  opacity: postingId !== null ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {postingId === result.id ? "Posting..." : "Post"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
