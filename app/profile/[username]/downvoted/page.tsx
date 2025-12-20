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
  target_profile_username: string; // For linking to the correct profile
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

export default function DownvotedPage() {
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
        .select("id, content, created_at, wall_user_id")
        .eq("user_id", profileData.id);

      // Get all comments by this user
      const { data: comments } = await supabase
        .from("comments")
        .select("id, content, created_at, post_id")
        .eq("user_id", profileData.id);

      // Fetch wall user info
      const wallUserIds = [...new Set((posts || []).filter(p => p.wall_user_id).map(p => p.wall_user_id))];
      const { data: wallUsers } = wallUserIds.length > 0
        ? await supabase.from("users").select("id, username").in("id", wallUserIds)
        : { data: [] };
      const wallUserMap = new Map((wallUsers || []).map(u => [u.id, u]));

      // Fetch parent posts for comments
      const postIdsForComments = [...new Set((comments || []).map(c => c.post_id))];
      const { data: parentPosts } = postIdsForComments.length > 0
        ? await supabase.from("posts").select("id, user_id, wall_user_id").in("id", postIdsForComments)
        : { data: [] };
      const parentPostMap = new Map((parentPosts || []).map(p => [p.id, p]));

      // Fetch post owners
      const postOwnerIds = [...new Set((parentPosts || []).filter(p => p.user_id).map(p => p.user_id))];
      const parentWallIds = [...new Set((parentPosts || []).filter(p => p.wall_user_id).map(p => p.wall_user_id))];
      
      const { data: postOwners } = postOwnerIds.length > 0
        ? await supabase.from("users").select("id, username").in("id", postOwnerIds)
        : { data: [] };
      const postOwnerMap = new Map((postOwners || []).map(u => [u.id, u]));

      const { data: parentWallUsers } = parentWallIds.length > 0
        ? await supabase.from("users").select("id, username").in("id", parentWallIds)
        : { data: [] };
      const parentWallMap = new Map((parentWallUsers || []).map(u => [u.id, u]));

      const postIds = (posts || []).map(p => p.id);
      const commentIds = (comments || []).map(c => c.id);

      // Get downvotes on posts
      const { data: postVotes } = postIds.length > 0
        ? await supabase
            .from("votes")
            .select("target_id, value")
            .eq("target_type", "post")
            .in("target_id", postIds)
            .lt("value", 0)
        : { data: [] };

      // Get downvotes on comments
      const { data: commentVotes } = commentIds.length > 0
        ? await supabase
            .from("votes")
            .select("target_id, value")
            .eq("target_type", "comment")
            .in("target_id", commentIds)
            .lt("value", 0)
        : { data: [] };

      // Build voted items list
      const votedItems: VotedItem[] = [];

      // Add downvoted posts
      const postVoteCounts: Record<string, number> = {};
      (postVotes || []).forEach(v => {
        postVoteCounts[v.target_id] = (postVoteCounts[v.target_id] || 0) + Math.abs(v.value);
      });

      (posts || []).forEach((post: any) => {
        if (postVoteCounts[post.id]) {
          // If wall post, link to wall owner's profile; otherwise link to owner's profile
          const wallUser = post.wall_user_id ? wallUserMap.get(post.wall_user_id) : null;
          const targetUsername = wallUser?.username || username;
          votedItems.push({
            id: post.id,
            type: "post",
            content: post.content,
            created_at: post.created_at,
            vote_value: postVoteCounts[post.id],
            target_profile_username: targetUsername,
          });
        }
      });

      // Add downvoted comments
      const commentVoteCounts: Record<string, number> = {};
      (commentVotes || []).forEach(v => {
        commentVoteCounts[v.target_id] = (commentVoteCounts[v.target_id] || 0) + Math.abs(v.value);
      });

      (comments || []).forEach((comment: any) => {
        if (commentVoteCounts[comment.id]) {
          const parentPost = parentPostMap.get(comment.post_id);
          let targetUsername: string;
          if (parentPost?.wall_user_id) {
            const wallOwner = parentWallMap.get(parentPost.wall_user_id);
            targetUsername = wallOwner?.username || username;
          } else {
            const postOwner = postOwnerMap.get(parentPost?.user_id);
            targetUsername = postOwner?.username || username;
          }
          votedItems.push({
            id: comment.id,
            type: "comment",
            content: comment.content,
            created_at: comment.created_at,
            vote_value: commentVoteCounts[comment.id],
            post_id: comment.post_id,
            target_profile_username: targetUsername,
          });
        }
      });

      // Sort by vote count descending (most downvoted first)
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
            <span style={{ color: "#e57373" }}>▼</span>
            Downvoted Content
          </h1>
          <p className="text-muted" style={{ margin: "8px 0 0 0", fontSize: 14 }}>
            🔒 This list is private and only visible to you.
          </p>
        </div>

        {/* Items List */}
        {items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p className="text-muted">No downvoted content. Keep up the good work! 🎉</p>
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.type === "post" 
                ? `/profile/${item.target_profile_username}?post=${item.id}` 
                : `/profile/${item.target_profile_username}?post=${item.post_id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <article className="card" style={{ marginBottom: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ 
                        background: item.type === "post" ? "rgba(229, 115, 115, 0.2)" : "rgba(240, 235, 224, 0.2)",
                        color: item.type === "post" ? "#e57373" : "var(--alzooka-cream)",
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
                    color: "#e57373",
                    fontWeight: 600,
                  }}>
                    <span>▼</span>
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
