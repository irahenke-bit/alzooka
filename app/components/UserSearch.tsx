"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Link from "next/link";

type UserResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url?: string | null;
};

const RECENT_SEARCHES_KEY = "alzooka_recent_searches";
const MAX_RECENT_SEARCHES = 8;

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<UserResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search users when query changes
  useEffect(() => {
    async function searchUsers() {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(8);

      if (data) {
        setResults(data);
      }
      
      setLoading(false);
    }

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Add user to recent searches
  function addToRecentSearches(user: UserResult) {
    const updated = [
      user,
      ...recentSearches.filter((u) => u.id !== user.id),
    ].slice(0, MAX_RECENT_SEARCHES);
    
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }

  // Remove user from recent searches
  function removeFromRecentSearches(userId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    const updated = recentSearches.filter((u) => u.id !== userId);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }

  // Filter recent searches based on query
  const filteredRecent = query.trim().length > 0
    ? recentSearches.filter(
        (u) =>
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          (u.display_name && u.display_name.toLowerCase().includes(query.toLowerCase()))
      )
    : recentSearches;

  // Determine what to show in dropdown
  const showRecent = query.trim().length < 2 && filteredRecent.length > 0;
  const showResults = query.trim().length >= 2;
  const showDropdown = isOpen && (showRecent || showResults);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder="Search users..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        style={{
          padding: "8px 12px",
          fontSize: 14,
          width: 180,
          background: "var(--alzooka-teal-light)",
          border: "1px solid rgba(240, 235, 224, 0.2)",
          borderRadius: 4,
          color: "var(--alzooka-cream)",
        }}
      />

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--alzooka-teal-light)",
            border: "1px solid rgba(240, 235, 224, 0.2)",
            borderRadius: 4,
            maxHeight: 350,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          {/* Recent Searches */}
          {showRecent && (
            <>
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "var(--alzooka-cream)",
                  opacity: 0.5,
                  borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                }}
              >
                Recent Searches
              </div>
              {filteredRecent.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${encodeURIComponent(user.username)}`}
                  onClick={() => {
                    addToRecentSearches(user);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    textDecoration: "none",
                    borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "var(--alzooka-gold)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--alzooka-teal-dark)",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {(user.display_name || user.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ color: "var(--alzooka-cream)", fontWeight: 600, fontSize: 14 }}>
                        {user.display_name || user.username}
                      </div>
                      <div style={{ color: "var(--alzooka-gold)", fontSize: 12, opacity: 0.8 }}>
                        @{user.username}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => removeFromRecentSearches(user.id, e)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--alzooka-cream)",
                      opacity: 0.4,
                      cursor: "pointer",
                      padding: "4px 8px",
                      fontSize: 16,
                    }}
                    title="Remove from recent"
                  >
                    ×
                  </button>
                </Link>
              ))}
            </>
          )}

          {/* Search Results */}
          {showResults && (
            <>
              {loading ? (
                <div style={{ padding: 12, fontSize: 14, color: "var(--alzooka-cream)", opacity: 0.6 }}>
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: 12, fontSize: 14, color: "var(--alzooka-cream)", opacity: 0.6 }}>
                  No users found
                </div>
              ) : (
                results.map((user) => (
                  <Link
                    key={user.id}
                    href={`/profile/${encodeURIComponent(user.username)}`}
                    onClick={() => {
                      addToRecentSearches(user);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      textDecoration: "none",
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "var(--alzooka-gold)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--alzooka-teal-dark)",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {(user.display_name || user.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ color: "var(--alzooka-cream)", fontWeight: 600, fontSize: 14 }}>
                        {user.display_name || user.username}
                      </div>
                      <div style={{ color: "var(--alzooka-gold)", fontSize: 12, opacity: 0.8 }}>
                        @{user.username}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
