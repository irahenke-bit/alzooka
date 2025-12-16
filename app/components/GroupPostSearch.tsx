"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type PostResult = {
  id: string;
  content: string;
  video_url: string | null;
  video_title: string | null;
  created_at: string;
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type GroupPostSearchProps = {
  groupId: string;
  groupName: string;
};

export function GroupPostSearch({ groupId, groupName }: GroupPostSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGroupScoped, setIsGroupScoped] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient();
  const router = useRouter();

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

  // Search posts when query changes
  useEffect(() => {
    async function search() {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);

      try {
        // Build the search query
        let searchQuery = supabase
          .from("posts")
          .select(`
            id,
            content,
            video_url,
            video_title,
            created_at,
            users!posts_user_id_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .order("created_at", { ascending: false })
          .limit(20);

        // If group scoped, only search this group
        if (isGroupScoped) {
          searchQuery = searchQuery.eq("group_id", groupId);
        }

        // Search in content OR video_title (encode % for URL safety)
        const encodedQuery = encodeURIComponent(query);
        searchQuery = searchQuery.or(`content.ilike.*${encodedQuery}*,video_title.ilike.*${encodedQuery}*`);

        const { data, error } = await searchQuery;

        if (error) {
          console.error("Search error:", error);
          setResults([]);
        } else if (data) {
          // Transform data to match expected structure
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedData = data.map((post: any) => {
            const users = Array.isArray(post.users) ? post.users[0] : post.users;
            return {
              ...post,
              users,
            };
          });
          
          setResults(transformedData as PostResult[]);
        }
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      }

      setLoading(false);
    }

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query, groupId, isGroupScoped, supabase]);

  function handlePostClick(postId: string) {
    setIsOpen(false);
    setQuery("");
    // Navigate to the group page with the post highlighted
    // We'll scroll to the post using a hash
    router.push(`/groups/${groupId}?post=${postId}`);
  }

  function handleClearScope() {
    setIsGroupScoped(false);
    inputRef.current?.focus();
  }

  function handleRestoreScope() {
    setIsGroupScoped(true);
    setQuery("");
    setResults([]);
  }

  // Extract YouTube video ID from URL
  function extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  const showDropdown = isOpen && (query.trim().length >= 2 || !isGroupScoped);

  // Truncate text for display
  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--alzooka-teal-light)",
          border: "1px solid rgba(240, 235, 224, 0.2)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {/* Group scope prefix */}
        {isGroupScoped && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 0 8px 12px",
              color: "rgba(240, 235, 224, 0.5)",
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            <span>Search {truncate(groupName, 15)}</span>
            <button
              onClick={handleClearScope}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(240, 235, 224, 0.5)",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: 14,
                lineHeight: 1,
                borderRadius: 3,
              }}
              title="Search all groups"
            >
              ×
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          placeholder={isGroupScoped ? "" : "Search all groups..."}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          style={{
            padding: isGroupScoped ? "8px 12px 8px 4px" : "8px 12px",
            fontSize: 14,
            width: isGroupScoped ? 80 : 180,
            background: "transparent",
            border: "none",
            color: "var(--alzooka-cream)",
            outline: "none",
          }}
        />

        {/* Restore scope button when not scoped */}
        {!isGroupScoped && (
          <button
            onClick={handleRestoreScope}
            style={{
              background: "rgba(212, 168, 75, 0.2)",
              border: "none",
              color: "var(--alzooka-gold)",
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: 11,
              marginRight: 8,
              borderRadius: 3,
            }}
            title={`Search only ${groupName}`}
          >
            This group
          </button>
        )}
      </div>

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
            maxHeight: 400,
            minWidth: 320,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: 16,
                fontSize: 14,
                color: "var(--alzooka-cream)",
                opacity: 0.6,
                textAlign: "center",
              }}
            >
              Searching...
            </div>
          ) : query.trim().length < 2 ? (
            <div
              style={{
                padding: 16,
                fontSize: 14,
                color: "var(--alzooka-cream)",
                opacity: 0.6,
                textAlign: "center",
              }}
            >
              Type at least 2 characters to search
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: 16,
                fontSize: 14,
                color: "var(--alzooka-cream)",
                opacity: 0.6,
                textAlign: "center",
              }}
            >
              No posts found for &quot;{query}&quot;
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "var(--alzooka-cream)",
                  opacity: 0.5,
                  borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                }}
              >
                {results.length} post{results.length !== 1 ? "s" : ""} found
              </div>
              {results.map((post) => {
                const videoId = post.video_url ? extractYouTubeId(post.video_url) : null;
                const displayName = post.users?.display_name || post.users?.username || "Unknown";

                return (
                  <div
                    key={post.id}
                    onClick={() => handlePostClick(post.id)}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "12px",
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(240, 235, 224, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Thumbnail or avatar */}
                    <div style={{ flexShrink: 0 }}>
                      {videoId ? (
                        <img
                          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                          alt=""
                          style={{
                            width: 60,
                            height: 45,
                            borderRadius: 4,
                            objectFit: "cover",
                          }}
                        />
                      ) : post.users?.avatar_url ? (
                        <img
                          src={post.users.avatar_url}
                          alt=""
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
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
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Post info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title or content preview */}
                      <div
                        style={{
                          color: "var(--alzooka-cream)",
                          fontSize: 14,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {post.video_title || truncate(post.content || "(Video post)", 50)}
                      </div>

                      {/* Metadata */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--alzooka-cream)",
                          opacity: 0.6,
                          marginTop: 4,
                        }}
                      >
                        <span>by {displayName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
