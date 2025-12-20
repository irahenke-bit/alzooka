"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

type ActivityItem = {
  id: string;
  type: "post" | "comment";
  content: string;
  created_at: string;
  post_id?: string; // For comments, the parent post
  parent_post_content?: string; // For comments, a snippet of the parent post
  wall_user?: { username: string; display_name: string | null } | null; // For wall posts
  // For linking to the correct location
  target_profile_username?: string; // For profile posts
  group_id?: string; // For group posts
  group_name?: string; // For display
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

export default function ActivityPage() {
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
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
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

      // Get all posts by this user (including wall posts and group posts)
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          created_at,
          wall_user_id,
          group_id,
          wall_user:users!posts_wall_user_id_fkey (
            username,
            display_name
          ),
          groups (
            name
          )
        `)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      // Get all comments by this user
      const { data: commentsData } = await supabase
        .from("comments")
        .select(`
          id,
          content,
          created_at,
          post_id,
          posts (
            content,
            user_id,
            wall_user_id,
            group_id,
            post_owner:users!posts_user_id_fkey (
              username
            ),
            wall_owner:users!posts_wall_user_id_fkey (
              username
            ),
            groups (
              name
            )
          )
        `)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      // Build activity items
      const items: ActivityItem[] = [];

      // Add posts
      if (postsData) {
        postsData.forEach((post: any) => {
          if (post.group_id) {
            // Group post
            items.push({
              id: post.id,
              type: "post",
              content: post.content,
              created_at: post.created_at,
              group_id: post.group_id,
              group_name: post.groups?.name || "a group",
            });
          } else {
            // Profile/wall post
            const targetUsername = post.wall_user_id 
              ? post.wall_user?.username 
              : username;
            items.push({
              id: post.id,
              type: "post",
              content: post.content,
              created_at: post.created_at,
              wall_user: post.wall_user_id ? post.wall_user : null,
              target_profile_username: targetUsername || username,
            });
          }
        });
      }

      // Add comments
      if (commentsData) {
        commentsData.forEach((comment: any) => {
          const postData = comment.posts;
          
          if (postData?.group_id) {
            // Comment on a group post
            items.push({
              id: comment.id,
              type: "comment",
              content: comment.content,
              created_at: comment.created_at,
              post_id: comment.post_id,
              parent_post_content: postData?.content || "",
              group_id: postData.group_id,
              group_name: postData.groups?.name || "a group",
            });
          } else {
            // Comment on a profile post
            const targetUsername = postData?.wall_user_id
              ? postData?.wall_owner?.username
              : postData?.post_owner?.username;
            items.push({
              id: comment.id,
              type: "comment",
              content: comment.content,
              created_at: comment.created_at,
              post_id: comment.post_id,
              parent_post_content: postData?.content || "",
              target_profile_username: targetUsername || username,
            });
          }
        });
      }

      // Sort by created_at descending (most recent first)
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivityItems(items);
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
            <span>📋</span>
            {isOwner ? "Your Activity" : `@${username}'s Activity`}
          </h1>
          {isOwner && (
            <p className="text-muted" style={{ margin: "8px 0 0 0", fontSize: 14 }}>
              {profileUser?.comment_history_private 
                ? "🔒 Your activity is hidden from others."
                : "👁️ Your activity is visible to others."}
            </p>
          )}
        </div>

        {/* Privacy Message */}
        {isPrivate ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 48, margin: "0 0 16px 0" }}>🔒</p>
            <p className="text-muted" style={{ margin: 0 }}>
              @{username}&apos;s activity is private.
            </p>
          </div>
        ) : activityItems.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p className="text-muted">
              {isOwner ? "No activity yet." : `@${username} has no activity yet.`}
            </p>
          </div>
        ) : (
          activityItems.map((item) => {
            // Determine the correct link based on whether it's a group or profile post
            let href: string;
            if (item.group_id) {
              // Group post or comment on group post
              href = `/groups/${item.group_id}?post=${item.type === "post" ? item.id : item.post_id}`;
            } else {
              // Profile post or comment on profile post
              href = item.type === "post" 
                ? `/profile/${item.target_profile_username}?post=${item.id}` 
                : `/profile/${item.target_profile_username}?post=${item.post_id}`;
            }
            
            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={href}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <article className="card" style={{ marginBottom: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
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
                    {item.group_id && (
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        in {item.group_name}
                      </span>
                    )}
                    {!item.group_id && item.type === "post" && item.wall_user && (
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        on @{item.wall_user.username}&apos;s wall
                      </span>
                    )}
                    <span className="text-muted" style={{ fontSize: 13, marginLeft: "auto" }}>{formatTime(item.created_at)}</span>
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>
                    {item.content.length > 200 ? item.content.substring(0, 200) + "..." : item.content}
                  </p>
                  {item.type === "comment" && item.parent_post_content && (
                    <div style={{ 
                      marginTop: 12,
                      padding: "8px 12px", 
                      background: "rgba(0, 0, 0, 0.2)", 
                      borderRadius: 6,
                      borderLeft: "3px solid var(--alzooka-gold)",
                    }}>
                      <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                        Replying to:
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, opacity: 0.8 }}>
                        {item.parent_post_content.length > 100 
                          ? item.parent_post_content.substring(0, 100) + "..." 
                          : item.parent_post_content}
                      </p>
                    </div>
                  )}
                </article>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
