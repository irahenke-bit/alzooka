"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Link from "next/link";

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type ProfilePictureModalProps = {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl: string | null;
  profileOwnerId: string;
  profileOwnerName: string;
  profileOwnerUsername: string;
  currentUserId: string | null;
};

export function ProfilePictureModal({
  isOpen,
  onClose,
  avatarUrl,
  profileOwnerId,
  profileOwnerName,
  profileOwnerUsername,
  currentUserId,
}: ProfilePictureModalProps) {
  const supabase = createBrowserClient();
  const [hearts, setHearts] = useState(0);
  const [hasHearted, setHasHearted] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, profileOwnerId]);

  async function loadData() {
    setLoading(true);

    // Get heart count
    const { count: heartCount } = await supabase
      .from("profile_picture_hearts")
      .select("*", { count: "exact", head: true })
      .eq("profile_owner_id", profileOwnerId);

    setHearts(heartCount || 0);

    // Check if current user has hearted
    if (currentUserId) {
      const { data: userHeart } = await supabase
        .from("profile_picture_hearts")
        .select("id")
        .eq("profile_owner_id", profileOwnerId)
        .eq("user_id", currentUserId)
        .single();

      setHasHearted(!!userHeart);
    }

    // Get comments with user info
    const { data: commentsData } = await supabase
      .from("profile_picture_comments")
      .select("id, user_id, content, created_at")
      .eq("profile_owner_id", profileOwnerId)
      .order("created_at", { ascending: true });

    if (commentsData && commentsData.length > 0) {
      // Get user info for all commenters
      const userIds = [...new Set(commentsData.map((c) => c.user_id))];
      const { data: usersData } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      const usersMap = new Map(usersData?.map((u) => [u.id, u]) || []);

      const commentsWithUsers = commentsData.map((c) => ({
        ...c,
        user: usersMap.get(c.user_id) || {
          username: "unknown",
          display_name: null,
          avatar_url: null,
        },
      }));

      setComments(commentsWithUsers);
    } else {
      setComments([]);
    }

    setLoading(false);
  }

  async function toggleHeart() {
    if (!currentUserId) return;

    if (hasHearted) {
      // Remove heart
      await supabase
        .from("profile_picture_hearts")
        .delete()
        .eq("profile_owner_id", profileOwnerId)
        .eq("user_id", currentUserId);

      setHearts((h) => h - 1);
      setHasHearted(false);
    } else {
      // Add heart
      await supabase.from("profile_picture_hearts").insert({
        profile_owner_id: profileOwnerId,
        user_id: currentUserId,
      });

      setHearts((h) => h + 1);
      setHasHearted(true);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !newComment.trim()) return;

    setPosting(true);

    const { data: newCommentData, error } = await supabase
      .from("profile_picture_comments")
      .insert({
        profile_owner_id: profileOwnerId,
        user_id: currentUserId,
        content: newComment.trim(),
      })
      .select()
      .single();

    if (!error && newCommentData) {
      // Get current user info
      const { data: userData } = await supabase
        .from("users")
        .select("username, display_name, avatar_url")
        .eq("id", currentUserId)
        .single();

      setComments([
        ...comments,
        {
          ...newCommentData,
          user: userData || {
            username: "unknown",
            display_name: null,
            avatar_url: null,
          },
        },
      ]);
      setNewComment("");

      // Scroll to bottom
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }

    setPosting(false);
  }

  async function deleteComment(commentId: string) {
    await supabase.from("profile_picture_comments").delete().eq("id", commentId);
    setComments(comments.filter((c) => c.id !== commentId));
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 0,
          maxWidth: 900,
          maxHeight: "90vh",
          width: "100%",
          background: "var(--alzooka-teal)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left side - Profile Picture */}
        <div
          style={{
            flex: "1 1 50%",
            background: "var(--alzooka-teal-dark)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
            position: "relative",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${profileOwnerName}'s profile picture`}
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: "var(--alzooka-gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
                color: "var(--alzooka-teal-dark)",
                fontWeight: 700,
              }}
            >
              {profileOwnerName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(0, 0, 0, 0.5)",
              border: "none",
              color: "white",
              width: 36,
              height: 36,
              borderRadius: "50%",
              fontSize: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Right side - Comments and Hearts */}
        <div
          style={{
            flex: "1 1 350px",
            maxWidth: 350,
            display: "flex",
            flexDirection: "column",
            background: "var(--alzooka-teal)",
          }}
        >
          {/* Header with user info */}
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
            }}
          >
            <Link
              href={`/profile/${encodeURIComponent(profileOwnerUsername)}`}
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
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
                  }}
                >
                  {profileOwnerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{profileOwnerName}</p>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
                  @{profileOwnerUsername}
                </p>
              </div>
            </Link>
          </div>

          {/* Comments section */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              minHeight: 200,
            }}
          >
            {loading ? (
              <p style={{ textAlign: "center", opacity: 0.6 }}>Loading...</p>
            ) : comments.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  opacity: 0.5,
                  fontStyle: "italic",
                }}
              >
                No comments yet. Be the first!
              </p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    marginBottom: 16,
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <Link
                    href={`/profile/${encodeURIComponent(comment.user.username)}`}
                    onClick={onClose}
                    style={{ flexShrink: 0 }}
                  >
                    {comment.user.avatar_url ? (
                      <img
                        src={comment.user.avatar_url}
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
                        {(comment.user.display_name || comment.user.username)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <Link
                        href={`/profile/${encodeURIComponent(comment.user.username)}`}
                        onClick={onClose}
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        {comment.user.display_name || comment.user.username}
                      </Link>
                      <span
                        style={{
                          fontSize: 12,
                          opacity: 0.5,
                        }}
                      >
                        {formatTime(comment.created_at)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: 14,
                        lineHeight: 1.4,
                        wordBreak: "break-word",
                      }}
                    >
                      {comment.content}
                    </p>
                    {/* Delete button for own comments or profile owner */}
                    {currentUserId &&
                      (currentUserId === comment.user_id ||
                        currentUserId === profileOwnerId) && (
                        <button
                          onClick={() => deleteComment(comment.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#e57373",
                            fontSize: 12,
                            cursor: "pointer",
                            padding: "4px 0",
                            opacity: 0.7,
                          }}
                        >
                          Delete
                        </button>
                      )}
                  </div>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Heart section */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(240, 235, 224, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              onClick={toggleHeart}
              disabled={!currentUserId}
              style={{
                background: "transparent",
                border: "none",
                cursor: currentUserId ? "pointer" : "default",
                fontSize: 24,
                padding: 0,
                transition: "transform 0.2s",
                transform: hasHearted ? "scale(1.1)" : "scale(1)",
              }}
              title={currentUserId ? (hasHearted ? "Remove heart" : "Add heart") : "Log in to heart"}
            >
              {hasHearted ? "❤️" : "🤍"}
            </button>
            <span style={{ fontWeight: 600 }}>
              {hearts} {hearts === 1 ? "heart" : "hearts"}
            </span>
          </div>

          {/* Comment input */}
          {currentUserId ? (
            <form
              onSubmit={handleComment}
              style={{
                padding: 16,
                borderTop: "1px solid rgba(240, 235, 224, 0.1)",
                display: "flex",
                gap: 8,
              }}
            >
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                maxLength={280}
                style={{
                  flex: 1,
                  margin: 0,
                }}
              />
              <button
                type="submit"
                disabled={posting || !newComment.trim()}
                style={{
                  opacity: !newComment.trim() ? 0.5 : 1,
                  padding: "8px 16px",
                }}
              >
                {posting ? "..." : "Post"}
              </button>
            </form>
          ) : (
            <div
              style={{
                padding: 16,
                borderTop: "1px solid rgba(240, 235, 224, 0.1)",
                textAlign: "center",
                fontSize: 14,
                opacity: 0.6,
              }}
            >
              <Link href="/login" style={{ color: "var(--alzooka-gold)" }}>
                Log in
              </Link>{" "}
              to comment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString();
}

