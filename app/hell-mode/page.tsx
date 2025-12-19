"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import Header from "@/app/components/Header";
import { PostModal } from "@/app/components/PostModal";

type Vote = {
  id: string;
  user_id: string;
  value: number;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_comment_id: string | null;
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
};

type EditHistoryEntry = {
  content: string;
  edited_at: string;
};

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  image_urls?: string[] | null;
  video_url: string | null;
  wall_user_id: string | null;
  created_at: string;
  edited_at: string | null;
  edit_history: EditHistoryEntry[];
  user_id: string;
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  comments: Comment[];
  group_id?: string | null;
  groups?: {
    id: string;
    name: string;
  } | null;
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

// Helper function to check if post content matches any filtered words
function postMatchesFilter(post: Post, filteredWords: string[]): boolean {
  if (filteredWords.length === 0) return false;
  const contentLower = (post.content || "").toLowerCase();
  return filteredWords.some(word => contentLower.includes(word.toLowerCase()));
}

export default function HellModePage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState<string>("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [filteredWords, setFilteredWords] = useState<string[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalPost, setModalPost] = useState<Post | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);

      // Fetch user data with filtered words
      const { data: userData } = await supabase
        .from("users")
        .select("username, avatar_url, filtered_words")
        .eq("id", currentUser.id)
        .single();

      if (userData) {
        setUserUsername(userData.username);
        setUserAvatarUrl(userData.avatar_url);
        setFilteredWords(userData.filtered_words || []);
      }

      // If no filtered words, nothing to show
      if (!userData?.filtered_words || userData.filtered_words.length === 0) {
        setLoading(false);
        return;
      }

      // Get friends
      const { data: friendships } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
        .eq("status", "accepted");

      const friendIds = (friendships || []).map(f =>
        f.requester_id === currentUser.id ? f.addressee_id : f.requester_id
      );

      const allowedUserIds = [currentUser.id, ...friendIds];

      // Fetch all posts from feed
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          image_url,
          image_urls,
          video_url,
          created_at,
          edited_at,
          edit_history,
          user_id,
          group_id,
          users:users!posts_user_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          groups:groups!posts_group_id_fkey (
            id,
            name
          ),
          comments (
            id,
            content,
            created_at,
            user_id,
            parent_comment_id,
            users:users!comments_user_id_fkey (
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .in("user_id", allowedUserIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (postsData) {
        // Transform posts
        const posts = postsData.map(post => ({
          id: post.id,
          content: post.content,
          image_url: post.image_url,
          image_urls: post.image_urls,
          video_url: post.video_url,
          wall_user_id: (post as any).wall_user_id || null,
          created_at: post.created_at,
          edited_at: post.edited_at || null,
          edit_history: (post.edit_history as EditHistoryEntry[] | null) || [],
          user_id: post.user_id,
          users: Array.isArray(post.users) ? post.users[0] : post.users || { username: 'unknown', display_name: null, avatar_url: null },
          group_id: post.group_id,
          groups: Array.isArray(post.groups) ? post.groups[0] : post.groups,
          comments: ((post.comments as unknown) as Comment[]) || [],
        }));

        setAllPosts(posts);

        // Load votes
        const postIds = posts.map(p => p.id);
        const { data: votesData } = await supabase
          .from("votes")
          .select("id, user_id, target_id, value")
          .eq("target_type", "post")
          .in("target_id", postIds);

        if (votesData) {
          const votesMap: Record<string, Vote> = {};
          const totalsMap: Record<string, number> = {};
          
          votesData.forEach(v => {
            if (v.user_id === currentUser.id) {
              votesMap[`post-${v.target_id}`] = { id: v.id, user_id: v.user_id, value: v.value };
            }
            totalsMap[`post-${v.target_id}`] = (totalsMap[`post-${v.target_id}`] || 0) + v.value;
          });

          setVotes(votesMap);
          setVoteTotals(totalsMap);
        }
      }

      setLoading(false);
    }

    init();
  }, [supabase, router]);

  // Filter to only show posts that MATCH the filter (the opposite of normal view)
  // Don't include user's own posts in Hell Mode
  const filteredPosts = allPosts.filter(post => 
    post.user_id !== user?.id && postMatchesFilter(post, filteredWords)
  );

  async function handleVote(targetType: "post" | "comment", targetId: string, value: number) {
    if (!user) return;

    const key = `${targetType}-${targetId}`;
    const existingVote = votes[key];

    if (existingVote) {
      if (existingVote.value === value) {
        // Remove vote
        await supabase.from("votes").delete().eq("id", existingVote.id);
        setVotes(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setVoteTotals(prev => ({
          ...prev,
          [key]: (prev[key] || 0) - value,
        }));
      } else {
        // Change vote
        await supabase.from("votes").update({ value }).eq("id", existingVote.id);
        setVotes(prev => ({
          ...prev,
          [key]: { ...existingVote, value },
        }));
        setVoteTotals(prev => ({
          ...prev,
          [key]: (prev[key] || 0) - existingVote.value + value,
        }));
      }
    } else {
      // New vote
      const { data } = await supabase
        .from("votes")
        .insert({ user_id: user.id, target_type: targetType, target_id: targetId, value })
        .select()
        .single();

      if (data) {
        setVotes(prev => ({
          ...prev,
          [key]: { id: data.id, user_id: user.id, value },
        }));
        setVoteTotals(prev => ({
          ...prev,
          [key]: (prev[key] || 0) + value,
        }));
      }
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading Hell Mode...</p>
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
        <div style={{ 
          marginBottom: 24,
          padding: 20,
          background: "rgba(139, 0, 0, 0.2)",
          borderRadius: 12,
          border: "1px solid rgba(139, 0, 0, 0.4)",
        }}>
          <h1 style={{ 
            margin: "0 0 8px 0", 
            fontSize: 24,
            color: "#ff6b6b",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            🔥 Hell Mode
          </h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
            Viewing all posts hidden by your content filter ({filteredWords.length} word{filteredWords.length !== 1 ? "s" : ""} filtered)
          </p>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {filteredWords.map(word => (
              <span 
                key={word}
                style={{
                  background: "rgba(255, 107, 107, 0.2)",
                  padding: "4px 10px",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              >
                {word}
              </span>
            ))}
          </div>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: "var(--alzooka-gold)",
              fontSize: 14,
            }}
          >
            ← Back to Feed
          </Link>
        </div>

        {/* Posts */}
        {filteredPosts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p className="text-muted">
              {filteredWords.length === 0 
                ? "You haven't set up any content filters yet." 
                : "No posts are currently being filtered."}
            </p>
            <Link href="/" style={{ color: "var(--alzooka-gold)" }}>
              Return to Feed
            </Link>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const imageUrls = post.image_urls || (post.image_url ? [post.image_url] : []);
            const voteKey = `post-${post.id}`;
            const userVote = votes[voteKey];
            const total = voteTotals[voteKey] || 0;

            return (
              <article 
                key={post.id} 
                className="card" 
                style={{ 
                  marginBottom: 12,
                  borderLeft: "3px solid rgba(139, 0, 0, 0.6)",
                }}
              >
                <div style={{ display: "flex", gap: 12 }}>
                  {/* Vote buttons */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <button
                      onClick={() => handleVote("post", post.id, 1)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: userVote?.value === 1 ? "var(--alzooka-gold)" : "var(--alzooka-cream)",
                        cursor: "pointer",
                        fontSize: 16,
                        padding: 4,
                        opacity: userVote?.value === 1 ? 1 : 0.5,
                      }}
                    >
                      ▲
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: total > 0 ? "var(--alzooka-gold)" : total < 0 ? "#e57373" : "var(--alzooka-cream)" }}>
                      {total}
                    </span>
                    <button
                      onClick={() => handleVote("post", post.id, -1)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: userVote?.value === -1 ? "#e57373" : "var(--alzooka-cream)",
                        cursor: "pointer",
                        fontSize: 16,
                        padding: 4,
                        opacity: userVote?.value === -1 ? 1 : 0.5,
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  <div style={{ flex: 1 }}>
                    {/* Header */}
                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Link 
                        href={`/profile/${encodeURIComponent(post.users?.username || "unknown")}`} 
                        style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
                      >
                        {post.users?.avatar_url ? (
                          <img src={post.users.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--alzooka-gold)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--alzooka-teal-dark)", fontWeight: 700 }}>
                            {(post.users?.display_name || post.users?.username || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span style={{ fontWeight: 600, color: "var(--alzooka-cream)" }}>
                            {post.users?.display_name || post.users?.username || "Unknown"}
                          </span>
                          <span className="text-muted" style={{ marginLeft: 8, fontSize: 14 }}>
                            {formatTime(post.created_at)}
                          </span>
                        </div>
                      </Link>

                      {post.groups && (
                        <Link 
                          href={`/groups/${post.groups.id}`}
                          style={{ fontSize: 12, color: "var(--alzooka-gold)", opacity: 0.8 }}
                        >
                          in {post.groups.name}
                        </Link>
                      )}
                    </div>

                    {/* Content */}
                    {post.content && (
                      <p style={{ margin: "0 0 12px 0", lineHeight: 1.6 }}>{post.content}</p>
                    )}

                    {/* Images */}
                    {imageUrls.length > 0 && (
                      imageUrls.length === 1 ? (
                        <img 
                          src={imageUrls[0]} 
                          alt="" 
                          style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, marginBottom: 12, cursor: "pointer" }} 
                          onClick={() => setModalPost(post)}
                        />
                      ) : (
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: imageUrls.length === 2 ? "1fr 1fr" : "repeat(3, 1fr)",
                          gap: 4,
                          marginBottom: 12,
                          borderRadius: 8,
                          overflow: "hidden",
                        }}>
                          {imageUrls.slice(0, 6).map((url, idx) => (
                            <div key={idx} style={{ position: "relative", paddingTop: "100%" }}>
                              <img 
                                src={url} 
                                alt=""
                                style={{ 
                                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                                  objectFit: "cover", cursor: "pointer",
                                }}
                                onClick={() => setModalPost(post)}
                              />
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {/* Footer */}
                    <div style={{ display: "flex", gap: 16, fontSize: 13, opacity: 0.7 }}>
                      <button
                        onClick={() => setModalPost(post)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--alzooka-cream)",
                          cursor: "pointer",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        💬 {post.comments?.length || 0} comments
                      </button>
                    </div>
                  </div>
                </div>
              </article>
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
          onClose={() => setModalPost(null)}
          onCommentAdded={() => {}}
        />
      )}
    </>
  );
}
