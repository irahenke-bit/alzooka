"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UserResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url?: string | null;
};

type GroupResult = {
  id: string;
  name: string;
  avatar_url: string | null;
  privacy: "public" | "private";
  member_count?: number;
};

const RECENT_SEARCHES_KEY = "alzooka_recent_searches";
const MAX_RECENT_SEARCHES = 8;

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [groupResults, setGroupResults] = useState<GroupResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<UserResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();
  const router = useRouter();

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

  // Search users and groups when query changes
  useEffect(() => {
    async function search() {
      if (query.trim().length < 2) {
        setResults([]);
        setGroupResults([]);
        return;
      }

      setLoading(true);
      
      // Search users (exclude deactivated accounts)
      const { data: users } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq("is_active", false)
        .limit(5);

      if (users) {
        setResults(users);
      }

      // Search groups
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name, avatar_url, privacy")
        .ilike("name", `%${query}%`)
        .limit(5);

      if (groups) {
        setGroupResults(groups);
      }
      
      setLoading(false);
    }

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Filter recent searches based on query
  const filteredRecent = query.trim().length > 0
    ? recentSearches.filter(
        (u) =>
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          (u.display_name && u.display_name.toLowerCase().includes(query.toLowerCase()))
      )
    : recentSearches;

  // Handle Enter key - use existing results or do immediate search
  async function handleEnterSearch() {
    // If we already have results displayed, use the first one
    if (results.length > 0) {
      handleUserClick(results[0]);
      return;
    }
    
    // If showing recent searches, use first one
    if (query.trim().length < 2 && filteredRecent.length > 0) {
      handleUserClick(filteredRecent[0]);
      return;
    }

    // If no results yet but query is long enough, do immediate search
    if (query.trim().length >= 2) {
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(1);

      if (data && data.length > 0) {
        handleUserClick(data[0]);
      }
    }
  }

  // Add user to recent searches and navigate
  function handleUserClick(user: UserResult) {
    // Save to recent searches first
    const currentRecent = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    const updated = [
      user,
      ...currentRecent.filter((u: UserResult) => u.id !== user.id),
    ].slice(0, MAX_RECENT_SEARCHES);
    
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    setRecentSearches(updated);
    
    // Close dropdown and clear query
    setIsOpen(false);
    setQuery("");
    
    // Navigate to profile
    router.push(`/profile/${encodeURIComponent(user.username)}`);
  }

  // Handle group click
  function handleGroupClick(group: GroupResult) {
    setIsOpen(false);
    setQuery("");
    router.push(`/groups/${group.id}`);
  }

  // Remove user from recent searches
  function removeFromRecentSearches(userId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    const updated = recentSearches.filter((u) => u.id !== userId);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }

  // Determine what to show in dropdown
  const showRecent = query.trim().length < 2 && filteredRecent.length > 0;
  const showResults = query.trim().length >= 2;
  const showDropdown = isOpen && (showRecent || showResults);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleEnterSearch();
          }
        }}
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
                <div
                  key={user.id}
                  onClick={() => handleUserClick(user)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    cursor: "pointer",
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
                </div>
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
              ) : results.length === 0 && groupResults.length === 0 ? (
                <div style={{ padding: 12, fontSize: 14, color: "var(--alzooka-cream)", opacity: 0.6 }}>
                  No results found
                </div>
              ) : (
                <>
                  {/* Groups */}
                  {groupResults.length > 0 && (
                    <>
                      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--alzooka-cream)", opacity: 0.5, borderBottom: "1px solid rgba(240, 235, 224, 0.1)" }}>
                        Groups
                      </div>
                      {groupResults.map((group) => (
                        <div
                          key={group.id}
                          onClick={() => handleGroupClick(group)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                          }}
                        >
                          {group.avatar_url ? (
                            <img
                              src={group.avatar_url}
                              alt=""
                              style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              background: "var(--alzooka-gold)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--alzooka-teal-dark)",
                              fontWeight: 700,
                              fontSize: 14,
                            }}>
                              {group.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ color: "var(--alzooka-cream)", fontWeight: 600, fontSize: 14 }}>
                              {group.name}
                            </div>
                            <div style={{ color: "var(--alzooka-gold)", fontSize: 12, opacity: 0.8 }}>
                              👥 Group · {group.privacy === "public" ? "Public" : "Private"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Users */}
                  {results.length > 0 && (
                    <>
                      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--alzooka-cream)", opacity: 0.5, borderBottom: "1px solid rgba(240, 235, 224, 0.1)" }}>
                        People
                      </div>
                      {results.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleUserClick(user)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            cursor: "pointer",
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
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
