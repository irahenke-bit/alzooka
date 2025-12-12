"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SupabaseClient } from "@supabase/supabase-js";

type Group = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type ShareModalProps = {
  postId: string;
  postContent: string;
  postImageUrl?: string | null;
  postVideoUrl?: string | null;
  originalPosterName: string;
  supabase: SupabaseClient;
  userId: string;
  onClose: () => void;
  onShared: () => void;
};

export function ShareModal({
  postId,
  postContent,
  postImageUrl,
  postVideoUrl,
  originalPosterName,
  supabase,
  userId,
  onClose,
  onShared,
}: ShareModalProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Close on escape key
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function loadUserGroups() {
      // Get groups the user is a member of
      const { data } = await supabase
        .from("group_members")
        .select(`
          group_id,
          groups (
            id,
            name,
            avatar_url
          )
        `)
        .eq("user_id", userId);

      if (data) {
        const userGroups = data
          .map((m) => m.groups as unknown as Group)
          .filter(Boolean);
        setGroups(userGroups);
      }
      setLoading(false);
    }

    loadUserGroups();
  }, [supabase, userId]);

  async function handleShare(destination: "profile" | "group", groupId?: string) {
    setSharing(true);

    try {
      // Create a shared post - copy original content so it displays properly
      const insertData: {
        content: string;
        image_url?: string | null;
        video_url?: string | null;
        user_id: string;
        shared_from_post_id: string;
        group_id?: string;
      } = {
        content: postContent, // Copy original content
        image_url: postImageUrl || null,
        video_url: postVideoUrl || null,
        user_id: userId,
        shared_from_post_id: postId,
      };

      if (destination === "group" && groupId) {
        insertData.group_id = groupId;
      }

      const { error } = await supabase.from("posts").insert(insertData);

      if (error) {
        console.error("Share error:", error);
        alert("Failed to share post. Please try again.");
      } else {
        onShared();
        onClose();
      }
    } catch (err) {
      console.error("Share error:", err);
      alert("Failed to share post. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 20,
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
          maxWidth: 400,
          maxHeight: "80vh",
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
          <h2 style={{ margin: 0, fontSize: 18 }}>Share Post</h2>
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

        {/* Preview */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
            Sharing post by {originalPosterName}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {postContent || "(Media post)"}
          </p>
        </div>

        {/* Share Options */}
        <div style={{ padding: 20, overflowY: "auto" }}>
          {/* Share to Profile */}
          <button
            onClick={() => handleShare("profile")}
            disabled={sharing}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "var(--alzooka-gold)",
              color: "var(--alzooka-teal-dark)",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: sharing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 20 }}>👤</span>
            Share to Your Profile
          </button>

          {/* Share to Group */}
          {loading ? (
            <p style={{ opacity: 0.6, textAlign: "center" }}>Loading groups...</p>
          ) : groups.length === 0 ? (
            <p style={{ opacity: 0.6, textAlign: "center", fontSize: 13 }}>
              You&apos;re not a member of any groups yet
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 12px 0", fontSize: 13, opacity: 0.7 }}>
                Or share to a group:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleShare("group", group.id)}
                    disabled={sharing}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "rgba(240, 235, 224, 0.1)",
                      color: "var(--alzooka-cream)",
                      border: "1px solid rgba(240, 235, 224, 0.2)",
                      borderRadius: 8,
                      fontSize: 14,
                      cursor: sharing ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: group.avatar_url
                          ? `url(${group.avatar_url}) center/cover`
                          : "var(--alzooka-gold)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--alzooka-teal-dark)",
                        flexShrink: 0,
                      }}
                    >
                      {!group.avatar_url && group.name.charAt(0).toUpperCase()}
                    </div>
                    {group.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
