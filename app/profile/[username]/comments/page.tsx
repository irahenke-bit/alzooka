"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  post_content?: string;
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

export default function CommentsPage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();
  const supabase = createBrowserClient();

  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userUsername, setUserUsername] = useState<string>("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<{ 
    id: string; 
    display_name: string | null;
    comment_history_private: boolean;
  } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      
      let currentUser = session?.user || null;
      setUser(currentUser);

      // Get current user's username and avatar if logged in
      if (currentUser) {
        const { data: userData } = await supabase
          .from("users")
          .select("username, avatar_url")
          .eq("id", currentUser.id)
          .single();

        if (userData) {
          setUserUsername(userData.username);
          setUserAvatarUrl(userData.avatar_url);
        }
      }

      // Get the profile user's data
      const { data: profileData } = await supabase
        .from("users")
        .select("id, display_name, comment_history_private")
        .ilike("username", username)
        .single();

      if (!profileData) {
        router.push("/");
        return;
      }

      setProfileUser(profileData);

      // Check if current user is the owner
      const ownerCheck = currentUser?.id === profileData.id;
      setIsOwner(ownerCheck);

      // Check privacy
      if (!ownerCheck && profileData.comment_history_private) {
        setIsPrivate(true);
        setLoading(false);
        return;
      }

      // Get comments by this user
      const { data: commentsData } = await supabase
        .from("comments")
        .select(`
          id,
          content,
          created_at,
          post_id,
          posts (
            content
          )
        `)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      if (commentsData) {
        setComments(commentsData.map(c => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          post_id: c.post_id,
          post_content: (c.posts as any)?.content || "",
        })));
      }

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
            <span>💬</span>
            {isOwner ? "Your Comments" : `@${username}'s Comments`}
          </h1>
          {isOwner && (
            <p className="text-muted" style={{ margin: "8px 0 0 0", fontSize: 14 }}>
              {profileUser?.comment_history_private 
                ? "🔒 Your comment history is hidden from others."
                : "👁️ Your comment history is visible to others."}
            </p>
          )}
        </div>

        {/* Privacy Message */}
        {isPrivate ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>🔒</p>
            <p className="text-muted" style={{ margin: 0 }}>
              @{username}&apos;s comment history is private.
            </p>
          </div>
        ) : comments.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p className="text-muted">
              {isOwner ? "You haven't commented on anything yet." : `@${username} hasn't commented on anything yet.`}
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <Link
              key={comment.id}
              href={`/?post=${comment.post_id}&comment=${comment.id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <article className="card" style={{ marginBottom: 12, padding: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <span className="text-muted" style={{ fontSize: 13 }}>{formatTime(comment.created_at)}</span>
                </div>
                <p style={{ margin: "0 0 12px 0", lineHeight: 1.5 }}>
                  {comment.content}
                </p>
                {comment.post_content && (
                  <div style={{ 
                    padding: "8px 12px", 
                    background: "rgba(0, 0, 0, 0.2)", 
                    borderRadius: 6,
                    borderLeft: "3px solid var(--alzooka-gold)",
                  }}>
                    <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                      Replying to:
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: 13, opacity: 0.8 }}>
                      {comment.post_content.length > 100 
                        ? comment.post_content.substring(0, 100) + "..." 
                        : comment.post_content}
                    </p>
                  </div>
                )}
              </article>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
