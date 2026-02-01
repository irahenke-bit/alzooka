"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import { PostModal } from "@/app/components/PostModal";
import type { User } from "@supabase/supabase-js";

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

  const [user, setUser] = useState<User | null>(null);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [modalPost, setModalPost] = useState<any>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, { id: string; user_id: string; value: number }>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});

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
        .select("id, content, created_at, wall_user_id, group_id")
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      // Get all comments by this user
      const { data: commentsData } = await supabase
        .from("comments")
        .select("id, content, created_at, post_id")
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      // Fetch additional data for wall users, groups, and parent posts
      const wallUserIds = [...new Set((postsData || []).filter(p => p.wall_user_id).map(p => p.wall_user_id))];
      const groupIds = [...new Set((postsData || []).filter(p => p.group_id).map(p => p.group_id))];
      const postIds = [...new Set((commentsData || []).map(c => c.post_id))];

      // Fetch wall user info
      const { data: wallUsers } = wallUserIds.length > 0
        ? await supabase.from("users").select("id, username, display_name").in("id", wallUserIds)
        : { data: [] };
      const wallUserMap = new Map((wallUsers || []).map(u => [u.id, u]));

      // Fetch group info
      const { data: groupsData } = groupIds.length > 0
        ? await supabase.from("groups").select("id, name").in("id", groupIds)
        : { data: [] };
      const groupMap = new Map((groupsData || []).map(g => [g.id, g]));

      // Fetch parent posts for comments
      const { data: parentPosts } = postIds.length > 0
        ? await supabase.from("posts").select("id, content, user_id, wall_user_id, group_id").in("id", postIds)
        : { data: [] };
      const parentPostMap = new Map((parentPosts || []).map(p => [p.id, p]));

      // Fetch post owners and additional group info for parent posts
      const parentPostUserIds = [...new Set((parentPosts || []).filter(p => p.user_id).map(p => p.user_id))];
      const parentPostWallIds = [...new Set((parentPosts || []).filter(p => p.wall_user_id).map(p => p.wall_user_id))];
      const parentGroupIds = [...new Set((parentPosts || []).filter(p => p.group_id).map(p => p.group_id))];

      const { data: postOwners } = parentPostUserIds.length > 0
        ? await supabase.from("users").select("id, username").in("id", parentPostUserIds)
        : { data: [] };
      const postOwnerMap = new Map((postOwners || []).map(u => [u.id, u]));

      const { data: parentWallUsers } = parentPostWallIds.length > 0
        ? await supabase.from("users").select("id, username").in("id", parentPostWallIds)
        : { data: [] };
      const parentWallMap = new Map((parentWallUsers || []).map(u => [u.id, u]));

      const { data: parentGroups } = parentGroupIds.length > 0
        ? await supabase.from("groups").select("id, name").in("id", parentGroupIds)
        : { data: [] };
      parentGroups?.forEach(g => groupMap.set(g.id, g));

      // Build activity items
      const items: ActivityItem[] = [];

      // Add posts
      if (postsData) {
        postsData.forEach((post: any) => {
          if (post.group_id) {
            // Group post
            const group = groupMap.get(post.group_id);
            items.push({
              id: post.id,
              type: "post",
              content: post.content,
              created_at: post.created_at,
              group_id: post.group_id,
              group_name: group?.name || "a group",
            });
          } else {
            // Profile/wall post
            const wallUser = post.wall_user_id ? wallUserMap.get(post.wall_user_id) : null;
            const targetUsername = wallUser?.username || username;
            items.push({
              id: post.id,
              type: "post",
              content: post.content,
              created_at: post.created_at,
              wall_user: wallUser ? { username: wallUser.username, display_name: wallUser.display_name } : null,
              target_profile_username: targetUsername,
            });
          }
        });
      }

      // Add comments
      if (commentsData) {
        commentsData.forEach((comment: any) => {
          const parentPost = parentPostMap.get(comment.post_id);
          
          if (parentPost?.group_id) {
            // Comment on a group post
            const group = groupMap.get(parentPost.group_id);
            items.push({
              id: comment.id,
              type: "comment",
              content: comment.content,
              created_at: comment.created_at,
              post_id: comment.post_id,
              parent_post_content: parentPost?.content || "",
              group_id: parentPost.group_id,
              group_name: group?.name || "a group",
            });
          } else {
            // Comment on a profile post
            let targetUsername: string;
            if (parentPost?.wall_user_id) {
              const wallOwner = parentWallMap.get(parentPost.wall_user_id);
              targetUsername = wallOwner?.username || username;
            } else {
              const postOwner = postOwnerMap.get(parentPost?.user_id);
              targetUsername = postOwner?.username || username;
            }
            items.push({
              id: comment.id,
              type: "comment",
              content: comment.content,
              created_at: comment.created_at,
              post_id: comment.post_id,
              parent_post_content: parentPost?.content || "",
              target_profile_username: targetUsername,
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

  async function openPostModal(postId: string, commentId?: string) {
    // Fetch the post
    const { data: fullPost } = await supabase
      .from("posts")
      .select(`
        id, content, image_url, image_urls, video_url, video_title, created_at, edited_at,
        user_id, group_id, wall_user_id, edit_history,
        users!posts_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq("id", postId)
      .single();

    if (fullPost) {
      // Fetch comments
      const { data: commentsData } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, parent_comment_id")
        .eq("post_id", fullPost.id)
        .order("created_at", { ascending: true });
      
      // Fetch user data for comment authors
      const commentUserIds = new Set<string>();
      (commentsData || []).forEach((c: { user_id: string }) => {
        if (c.user_id) commentUserIds.add(c.user_id);
      });
      
      const commentUserMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null }>();
      if (commentUserIds.size > 0) {
        const { data: commentUsers } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url, is_active")
          .in("id", Array.from(commentUserIds));
        if (commentUsers) {
          commentUsers.forEach(u => {
            if (u.is_active !== false) {
              commentUserMap.set(u.id, { id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url });
            }
          });
        }
      }
      
      // Build comment tree
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allComments = (commentsData || []).map((c: any) => ({
        ...c,
        users: commentUserMap.get(c.user_id) || null,
        replies: []
      }));
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const commentMap = new Map<string, any>(allComments.map((c: any) => [c.id, c]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rootComments: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allComments.forEach((c: any) => {
        if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
          const parent = commentMap.get(c.parent_comment_id)!;
          parent.replies = parent.replies || [];
          parent.replies.push(c);
        } else if (!c.parent_comment_id) {
          rootComments.push(c);
        }
      });

      // Set highlight comment if provided
      if (commentId) {
        setHighlightCommentId(commentId);
      }

      setModalPost({
        ...fullPost,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        users: Array.isArray((fullPost as any).users) ? (fullPost as any).users[0] : (fullPost as any).users,
        comments: rootComments,
        edit_history: fullPost.edit_history || []
      });
    }
  }

  async function handleVote(targetType: "post" | "comment", targetId: string, value: number) {
    if (!user) return;
    // Simplified vote handling for the modal
    const key = `${targetType}-${targetId}`;
    const existingVote = votes[key];
    
    if (existingVote) {
      if (existingVote.value === value) {
        await supabase.from("votes").delete().eq("id", existingVote.id);
        const newVotes = { ...votes };
        delete newVotes[key];
        setVotes(newVotes);
        setVoteTotals(prev => ({ ...prev, [key]: (prev[key] || 0) - existingVote.value }));
      } else {
        await supabase.from("votes").update({ value }).eq("id", existingVote.id);
        setVotes({ ...votes, [key]: { ...existingVote, value } });
        setVoteTotals(prev => ({ ...prev, [key]: (prev[key] || 0) - existingVote.value + value }));
      }
    } else {
      const { data } = await supabase.from("votes").insert({ user_id: user.id, target_type: targetType, target_id: targetId, value }).select().single();
      if (data) {
        setVotes({ ...votes, [key]: data });
        setVoteTotals(prev => ({ ...prev, [key]: (prev[key] || 0) + value }));
      }
    }
  }

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
            style={{ color: "var(--accent)", fontSize: 14, marginBottom: 8, display: "inline-block" }}
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
              @{username}'s activity is private.
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
            // Determine which post to open
            const postId = item.type === "post" ? item.id : item.post_id!;
            const commentId = item.type === "comment" ? item.id : undefined;
            
            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openPostModal(postId, commentId);
                }}
                style={{ textDecoration: "none", color: "inherit", display: "block", cursor: "pointer" }}
              >
                <article className="card" style={{ marginBottom: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ 
                      background: item.type === "post" ? "var(--accent)" : "var(--border-default)",
                      color: item.type === "post" ? "black" : "rgba(255,255,255,0.5)",
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
                        on @{item.wall_user.username}'s wall
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
                      background: "var(--border-subtle)", 
                      borderRadius: 6,
                      borderLeft: "3px solid var(--accent)",
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
              </div>
            );
          })
        )}
      </div>

      {/* Post Modal */}
      {modalPost && user && (
        <PostModal
          post={modalPost}
          user={user}
          supabase={supabase}
          votes={votes}
          voteTotals={voteTotals}
          onVote={handleVote}
          highlightCommentId={highlightCommentId}
          onClose={() => {
            setModalPost(null);
            setHighlightCommentId(null);
          }}
          onCommentAdded={async () => {
            // Refresh the modal post
            if (modalPost) {
              await openPostModal(modalPost.id, undefined);
            }
          }}
        />
      )}
    </>
  );
}
