"use client";

import { useState, useEffect, useRef } from "react";
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
  existingUris?: string[]; // URIs of albums already in the station
};

export function SpotifySearchModal({ onClose, onSelect, onDirectPost, existingUris = [] }: SpotifySearchModalProps) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"album" | "track">("album");
  const [results, setResults] = useState<SpotifyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [postedUris, setPostedUris] = useState<Set<string>>(new Set()); // Track newly posted during this session
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [lastQuery, setLastQuery] = useState(""); // Track the query that was searched
  
  // Track if mousedown started on backdrop (to prevent close when selecting text)
  const mouseDownOnBackdropRef = useRef(false);

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
      setHasMore(false);
      setOffset(0);
      setLastQuery("");
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      setOffset(0); // Reset offset for new search

      try {
        const response = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(query)}&type=${searchType}&offset=0`
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Search failed");
          setResults([]);
          setHasMore(false);
        } else {
          setResults(data.results || []);
          setHasMore(data.hasMore || false);
          setLastQuery(query);
        }
      } catch {
        setError("Failed to search Spotify");
        setResults([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, searchType]);

  // Load more results
  async function loadMore() {
    if (loadingMore || !hasMore || !lastQuery.trim()) return;
    
    setLoadingMore(true);
    const newOffset = results.length;
    
    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(lastQuery)}&type=${searchType}&offset=${newOffset}`
      );
      const data = await response.json();

      if (response.ok && data.results) {
        setResults(prev => [...prev, ...data.results]);
        setHasMore(data.hasMore || false);
        setOffset(newOffset);
      }
    } catch {
      console.error("Failed to load more results");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
  }

  function handleSelect(result: SpotifyResult) {
    onSelect(result, query);
    onClose();
  }

  async function handleDirectPost(result: SpotifyResult, e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDirectPost || postingId) return;
    
    // Don't allow posting if already posted
    if (existingUris.includes(result.uri) || postedUris.has(result.uri)) return;
    
    setPostingId(result.id);
    try {
      await onDirectPost(result, query);
      // Track this as posted
      setPostedUris(prev => new Set(prev).add(result.uri));
      setPostingId(null);
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
      onMouseDown={(e) => {
        // Track if mousedown started on the backdrop itself
        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only close if both mousedown AND click were on the backdrop
        // This prevents closing when user drags outside while selecting text
        if (e.target === e.currentTarget && mouseDownOnBackdropRef.current) {
          onClose();
        }
        mouseDownOnBackdropRef.current = false;
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
              {(() => {
                const isAlreadyPosted = existingUris.includes(result.uri) || postedUris.has(result.uri);
                const isPosting = postingId === result.id;
                return (
              <button
                onClick={(e) => handleDirectPost(result, e)}
                    disabled={postingId !== null || isAlreadyPosted}
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                      background: isAlreadyPosted ? "rgba(30, 215, 96, 0.3)" : "#1DB954",
                      color: isAlreadyPosted ? "#1DB954" : "#000",
                      border: isAlreadyPosted ? "1px solid #1DB954" : "none",
                  borderRadius: 6,
                      cursor: postingId !== null || isAlreadyPosted ? "not-allowed" : "pointer",
                  opacity: postingId !== null ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                    {isPosting ? "Posting..." : isAlreadyPosted ? "Posted ✓" : "Post"}
              </button>
                );
              })()}
            </div>
          ))}
          
          {/* Load More Button */}
          {hasMore && results.length > 0 && (
            <div style={{ padding: "16px 20px", textAlign: "center" }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  padding: "10px 32px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "transparent",
                  color: "#1DB954",
                  border: "1px solid #1DB954",
                  borderRadius: 20,
                  cursor: loadingMore ? "not-allowed" : "pointer",
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
          
          {/* End of results indicator */}
          {!hasMore && results.length > 0 && !loading && (
            <div style={{ padding: "16px 20px", textAlign: "center", opacity: 0.5, fontSize: 13 }}>
              End of results
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
