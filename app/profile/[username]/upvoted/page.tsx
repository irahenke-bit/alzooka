"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

type VotedItem = {
  id: string;
  type: "post" | "comment";
  content: string;
  created_at: string;
  vote_value: number;
  post_id?: string; // For comments, the parent post
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function UpvotedPage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();
  const supabase = createBrowserClient();

  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userUsername, setUserUsername] = useState<string>("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [items, setItems] = useState<VotedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);

      // Get current user's username and avatar
      const { data: userData } = await supabase
        .from("users")
        .select("username, avatar_url")
        .eq("id", currentUser.id)
        .single();

      if (userData) {
        setUserUsername(userData.username);
        setUserAvatarUrl(userData.avatar_url);
      }

      // Get the profile user's ID
      const { data: profileData } = await supabase
        .from("users")
        .select("id")
        .ilike("username", username)
        .single();

      if (!profileData) {
        router.push("/");
        return;
      }

      setProfileUserId(profileData.id);

      // Check if current user is the owner
      if (currentUser.id !== profileData.id) {
        // Not the owner - redirect back to profile
        router.push(`/profile/${username}`);
        return;
      }

      setIsOwner(true);

      // Get all posts by this user
      const { data: posts } = await supabase
        .from("posts")
        .select("id, content, created_at")
        .eq("user_id", profileData.id);

      // Get all comments by this user
      const { data: comments } = await supabase
        .from("comments")
        .select("id, content, created_at, post_id")
        .eq("user_id", profileData.id);

      const postIds = (posts || []).map(p => p.id);
      const commentIds = (comments || []).map(c => c.id);

      // Get upvotes on posts
      const { data: postVotes } = postIds.length > 0
        ? await supabase
            .from("votes")
            .select("target_id, value")
            .eq("target_type", "post")
            .in("target_id", postIds)
            .gt("value", 0)
        : { data: [] };

      // Get upvotes on comments
      const { data: commentVotes } = commentIds.length > 0
        ? await supabase
            .from("votes")
            .select("target_id, value")
            .eq("target_type", "comment")
            .in("target_id", commentIds)
            .gt("value", 0)
        : { data: [] };

      // Build voted items list
      const votedItems: VotedItem[] = [];

      // Add upvoted posts
      const postVoteCounts: Record<string, number> = {};
      (postVotes || []).forEach(v => {
        postVoteCounts[v.target_id] = (postVoteCounts[v.target_id] || 0) + v.value;
      });

      (posts || []).forEach(post => {
        if (postVoteCounts[post.id]) {
          votedItems.push({
            id: post.id,
            type: "post",
            content: post.content,
            created_at: post.created_at,
            vote_value: postVoteCounts[post.id],
          });
        }
      });

      // Add upvoted comments
      const commentVoteCounts: Record<string, number> = {};
      (commentVotes || []).forEach(v => {
        commentVoteCounts[v.target_id] = (commentVoteCounts[v.target_id] || 0) + v.value;
      });

      (comments || []).forEach(comment => {
        if (commentVoteCounts[comment.id]) {
          votedItems.push({
            id: comment.id,
            type: "comment",
            content: comment.content,
            created_at: comment.created_at,
            vote_value: commentVoteCounts[comment.id],
            post_id: comment.post_id,
          });
        }
      });

      // Sort by vote count descending
      votedItems.sort((a, b) => b.vote_value - a.vote_value);

      setItems(votedItems);
      setLoading(false);
    }

    init();
  }, [supabase, router, username]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <>
      <Header
        user={user}
        userUsername={userUsername}
        userAvatarUrl={userAvatarUrl}
      />

      <div className="container" style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href={`/profile/${username}`}
            style={{ color: "var(--alzooka-gold)", fontSize: 14, marginBottom: 8, display: "inline-block" }}
          >
            ← Back to Profile
          </Link>
          <h1 style={{ margin: "8px 0 0 0", fontSize: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--alzooka-gold)" }}>▲</span>
            Upvoted Content
          </h1>
          <p className="text-muted" style={{ margin: "8px 0 0 0", fontSize: 14 }}>
            🔒 This list is private and only visible to you.
          </p>
        </div>

        {/* Items List */}
        {items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p className="text-muted">No upvoted content yet.</p>
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.type === "post" ? `/?post=${item.id}` : `/?post=${item.post_id}&comment=${item.id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <article className="card" style={{ marginBottom: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ 
                        background: item.type === "post" ? "var(--alzooka-gold)" : "rgba(240, 235, 224, 0.2)",
                        color: item.type === "post" ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}>
                        {item.type}
                      </span>
                      <span className="text-muted" style={{ fontSize: 13 }}>{formatTime(item.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                      {item.content.length > 200 ? item.content.substring(0, 200) + "..." : item.content}
                    </p>
                  </div>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 4,
                    color: "var(--alzooka-gold)",
                    fontWeight: 600,
                  }}>
                    <span>▲</span>
                    <span>{item.vote_value}</span>
                  </div>
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
