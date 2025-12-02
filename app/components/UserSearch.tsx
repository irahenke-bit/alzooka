"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Link from "next/link";

type UserResult = {
  id: string;
  username: string;
  display_name: string | null;
};

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();

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
        .select("id, username, display_name")
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
      {isOpen && query.trim().length >= 2 && (
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
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
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
                href={`/profile/${user.username}`}
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                }}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                }}
              >
                <div style={{ color: "var(--alzooka-gold)", fontWeight: 600, fontSize: 14 }}>
                  @{user.username}
                </div>
                {user.display_name && user.display_name !== user.username && (
                  <div style={{ color: "var(--alzooka-cream)", fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                    {user.display_name}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// force deploy
