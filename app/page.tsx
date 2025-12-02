"use client";

import { useState, useEffect, Suspense } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";
import { 
  notifyNewComment, 
  notifyNewReply, 
  notifyMention, 
  checkVoteMilestones,
  parseMentions,
  getUserIdsByUsernames 
} from "@/lib/notifications";

export default function FeedPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Loading...</p></div>}>
      <FeedContent />
    </Suspense>
  );
}

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
  };
  replies?: Comment[];
};

type Post = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  users: {
    username: string;
    display_name: string | null;
  };
  comments: Comment[];
};

function FeedContent() {
  const [user, setUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState<string>("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightPostId = searchParams.get("post");
  const highlightCommentId = searchParams.get("comment");
  
  console.log("URL params - post:", highlightPostId, "comment:", highlightCommentId);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }
      
      setUser(user);
      
      // Fetch current user's username from the users table
      const { data: userData } = await supabase
        .from("users")
        .select("username")
        .eq("id", user.id)
        .single();
      if (userData) {
        setUserUsername(userData.username);
      }
      
      await loadPosts();
      await loadUserVotes(user.id);
      await loadVoteTotals();
      setLoading(false);

      // Scroll to highlighted comment or post if present
      if (highlightCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`comment-${highlightCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      } else if (highlightPostId) {
        setTimeout(() => {
          const element = document.getElementById(`post-${highlightPostId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    }
    
    init();
  }, []);

  async function loadPosts() {
    const { data } = await supabase
      .from("posts")
      .select(`
        id,
        content,
        created_at,
        user_id,
        users (
          username,
          display_name
        ),
        comments (
          id,
          content,
          created_at,
          user_id,
          parent_comment_id,
          users (
            username,
            display_name
          )
        )
      `)
    .order("created_at", { ascending: false });

    if (data) {
      const postsWithNestedComments = data.map((post: any) => {
        const allComments = (post.comments || []) as Comment[];
        
        // Separate parent comments (no parent_comment_id) and replies
        const parentComments = allComments
          .filter(c => !c.parent_comment_id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const replies = allComments.filter(c => c.parent_comment_id);
        
        // Attach replies to their parent comments
        const commentsWithReplies = parentComments.map(parent => ({
          ...parent,
          replies: replies
            .filter(r => r.parent_comment_id === parent.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }));
        
        return {
          ...post,
          comments: commentsWithReplies
        };
      });
      setPosts(postsWithNestedComments as unknown as Post[]);
    }
  }

  async function loadUserVotes(userId: string) {
    const { data } = await supabase
      .from("votes")
      .select("*")
      .eq("user_id", userId);

    if (data) {
      const voteMap: Record<string, Vote> = {};
      data.forEach((vote) => {
        const key = `${vote.target_type}-${vote.target_id}`;
        voteMap[key] = vote;
      });
      setVotes(voteMap);
    }
  }

  async function loadVoteTotals() {
    const { data } = await supabase
      .from("votes")
      .select("target_type, target_id, value");

    if (data) {
      const totals: Record<string, number> = {};
      data.forEach((vote) => {
        const key = `${vote.target_type}-${vote.target_id}`;
        totals[key] = (totals[key] || 0) + vote.value;
      });
      setVoteTotals(totals);
    }
  }

  async function handleVote(targetType: "post" | "comment", targetId: string, value: number) {
    if (!user) return;

    const key = `${targetType}-${targetId}`;
    const existingVote = votes[key];
    const currentTotal = voteTotals[key] || 0;
    let newTotal = currentTotal;

    if (existingVote) {
      if (existingVote.value === value) {
        // Same vote - remove it
        await supabase.from("votes").delete().eq("id", existingVote.id);
        const newVotes = { ...votes };
        delete newVotes[key];
        setVotes(newVotes);
        newTotal = currentTotal - existingVote.value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      } else {
        // Different vote - update it
        await supabase.from("votes").update({ value }).eq("id", existingVote.id);
        setVotes({ ...votes, [key]: { ...existingVote, value } });
        // Remove old vote value, add new vote value
        newTotal = currentTotal - existingVote.value + value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      }
    } else {
      // New vote
      const { data } = await supabase
        .from("votes")
        .insert({
          user_id: user.id,
          target_type: targetType,
          target_id: targetId,
          value,
        })
        .select()
        .single();

      if (data) {
        setVotes({ ...votes, [key]: data });
        newTotal = currentTotal + value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      }
    }

    // Check for vote milestones (only if vote changed the total positively)
    if (newTotal !== currentTotal) {
      // Get owner of the post/comment
      let ownerId: string | null = null;
      
      if (targetType === "post") {
        const post = posts.find(p => p.id === targetId);
        ownerId = post?.user_id || null;
      } else {
        // Find comment in posts
        for (const post of posts) {
          const comment = post.comments?.find(c => c.id === targetId);
          if (comment) {
            ownerId = comment.user_id;
            break;
          }
          // Check replies too
          for (const c of post.comments || []) {
            const reply = c.replies?.find(r => r.id === targetId);
            if (reply) {
              ownerId = reply.user_id;
              break;
            }
          }
        }
      }

      if (ownerId && ownerId !== user.id) {
        checkVoteMilestones(supabase, ownerId, targetType, targetId, newTotal, currentTotal);
      }
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setPosting(true);

    const { data, error } = await supabase
      .from("posts")
      .insert({
        content: content.trim(),
        user_id: user.id,
      })
      .select()
      .single();

    if (!error && data) {
      // Auto-upvote own post (like Reddit)
      await supabase.from("votes").insert({
        user_id: user.id,
        target_type: "post",
        target_id: data.id,
        value: 1,
      });
      
      setContent("");
      await loadPosts();
      await loadUserVotes(user.id);
      await loadVoteTotals();
    }

    setPosting(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center" 
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>
      {/* Header */}
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 32,
        paddingBottom: 16,
        borderBottom: "1px solid rgba(240, 235, 224, 0.2)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={32} />
          <h1 style={{ fontSize: 24, margin: 0, fontWeight: 400 }}>
            Alzooka
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UserSearch />
          <Link 
            href={`/profile/${user?.user_metadata?.username || ""}`}
            style={{ 
              color: "var(--alzooka-cream)",
              fontSize: 14,
              textDecoration: "none",
              opacity: 0.8,
            }}
          >
            My Profile
          </Link>
          {user && <NotificationBell userId={user.id} currentUsername={userUsername} />}
          <button 
            onClick={handleLogout}
            style={{ 
              background: "transparent", 
              color: "var(--alzooka-cream)",
              padding: "8px 16px",
              fontSize: 14,
              border: "1px solid rgba(240, 235, 224, 0.3)"
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* New Post Form */}
      <form onSubmit={handlePost} style={{ marginBottom: 32 }}>
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{ marginBottom: 12, resize: "vertical" }}
        />
        <button type="submit" disabled={posting || !content.trim()}>
          {posting ? "Posting..." : "Post"}
        </button>
      </form>

      {/* Posts Feed */}
      <div>
        {posts.length === 0 ? (
          <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
            No posts yet. Be the first to share something.
          </p>
        ) : (
          posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              user={user!} 
              supabase={supabase}
              votes={votes}
              voteTotals={voteTotals}
              onVote={handleVote}
              isHighlighted={post.id === highlightPostId}
              highlightCommentId={highlightCommentId}
              onCommentAdded={async () => {
                await loadPosts();
                await loadUserVotes(user!.id);
                await loadVoteTotals();
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Vote Buttons Component
function VoteButtons({
  targetType,
  targetId,
  votes,
  voteTotals,
  onVote,
}: {
  targetType: "post" | "comment";
  targetId: string;
  votes: Record<string, Vote>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
}) {
  const key = `${targetType}-${targetId}`;
  const userVote = votes[key]?.value || 0;
  const score = voteTotals[key] || 0;

  // Determine score color: gold if positive, red if negative, muted if zero
  const scoreColor = score > 0 
    ? "var(--alzooka-gold)" 
    : score < 0 
      ? "#e57373" 
      : "var(--alzooka-cream)";
  
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, minWidth: 32 }}>
      <button
        onClick={() => onVote(targetType, targetId, 1)}
        style={{
          background: "transparent",
          border: "none",
          padding: "4px 8px",
          cursor: "pointer",
          color: userVote === 1 ? "var(--alzooka-gold)" : "var(--alzooka-cream)",
          opacity: userVote === 1 ? 1 : 0.5,
          fontSize: 14,
          lineHeight: 1,
        }}
        title="Upvote"
      >
        ▲
      </button>
      <span style={{ 
        fontSize: 14, 
        fontWeight: 600, 
        color: scoreColor,
        opacity: score === 0 ? 0.5 : 1,
      }}>
        {score}
      </span>
      <button
        onClick={() => onVote(targetType, targetId, -1)}
        style={{
          background: "transparent",
          border: "none",
          padding: "4px 8px",
          cursor: "pointer",
          color: userVote === -1 ? "#e57373" : "var(--alzooka-cream)",
          opacity: userVote === -1 ? 1 : 0.5,
          fontSize: 14,
          lineHeight: 1,
        }}
        title="Downvote"
      >
        ▼
      </button>
    </div>
  );
}

// Post Card Component with Comments
function PostCard({ 
  post, 
  user, 
  supabase, 
  votes,
  voteTotals,
  onVote,
  isHighlighted,
  highlightCommentId,
  onCommentAdded 
}: { 
  post: Post; 
  user: User;
  supabase: ReturnType<typeof createBrowserClient>;
  votes: Record<string, Vote>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
  isHighlighted?: boolean;
  highlightCommentId?: string | null;
  onCommentAdded: () => void;
}) {
  // Auto-expand comments if a comment in this post is highlighted
  const hasHighlightedComment = highlightCommentId && post.comments?.some(
    c => c.id === highlightCommentId || c.replies?.some(r => r.id === highlightCommentId)
  );
  const [showComments, setShowComments] = useState(isHighlighted || hasHighlightedComment || false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDeletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    
    await supabase.from("posts").delete().eq("id", postId);
    onCommentAdded(); // Refresh the feed
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    
    await supabase.from("comments").delete().eq("id", commentId);
    onCommentAdded(); // Refresh the feed
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmitting(true);
    const trimmedComment = commentText.trim();
    const commenterUsername = user.user_metadata?.username || "unknown";

    const { data, error } = await supabase
      .from("comments")
      .insert({
        content: trimmedComment,
        post_id: post.id,
        user_id: user.id,
        parent_comment_id: replyingTo?.id || null,
      })
      .select()
      .single();

    if (!error && data) {
      // Auto-upvote own comment (like Reddit)
      await supabase.from("votes").insert({
        user_id: user.id,
        target_type: "comment",
        target_id: data.id,
        value: 1,
      });

      // Send notifications
      if (replyingTo) {
        // This is a reply - notify the parent comment owner
        const parentComment = post.comments?.find(c => c.id === replyingTo.id);
        if (parentComment && parentComment.user_id !== user.id) {
          notifyNewReply(
            supabase,
            parentComment.user_id,
            commenterUsername,
            post.id,
            data.id,
            trimmedComment
          );
        }
      } else {
        // This is a top-level comment - notify the post owner
        if (post.user_id !== user.id) {
          notifyNewComment(
            supabase,
            post.user_id,
            commenterUsername,
            post.id,
            data.id,
            trimmedComment
          );
        }
      }

      // Check for @mentions and notify mentioned users
      const mentions = parseMentions(trimmedComment);
      if (mentions.length > 0) {
        const userIdMap = await getUserIdsByUsernames(supabase, mentions);
        for (const username of mentions) {
          const mentionedUserId = userIdMap[username.toLowerCase()];
          if (mentionedUserId && mentionedUserId !== user.id) {
            notifyMention(
              supabase,
              mentionedUserId,
              commenterUsername,
              post.id,
              data.id,
              trimmedComment
            );
          }
        }
      }
      
      setCommentText("");
      setReplyingTo(null);
      onCommentAdded();
    }

    setSubmitting(false);
  }

  function handleReply(commentId: string, username: string) {
    setReplyingTo({ id: commentId, username });
    setCommentText(`@${username} `);
  }

  function cancelReply() {
    setReplyingTo(null);
    setCommentText("");
  }

  // Count all comments including replies
  const commentCount = (post.comments || []).reduce((total, comment) => {
    return total + 1 + (comment.replies?.length || 0);
  }, 0);

  return (
    <article 
      className="card" 
      id={`post-${post.id}`}
      style={isHighlighted ? { 
        boxShadow: "0 0 0 2px var(--alzooka-gold)",
        scrollMarginTop: 100,
      } : undefined}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {/* Vote Buttons */}
        <VoteButtons
          targetType="post"
          targetId={post.id}
          votes={votes}
          voteTotals={voteTotals}
          onVote={onVote}
        />

        {/* Post Content */}
        <div style={{ flex: 1 }}>
          {/* Post Header */}
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Link 
                href={`/profile/${post.users?.username || "unknown"}`}
                className="text-gold" 
                style={{ fontWeight: 600, textDecoration: "none" }}
              >
                @{post.users?.username || "unknown"}
              </Link>
              <span className="text-muted" style={{ marginLeft: 8, fontSize: 14 }}>
                {formatTime(post.created_at)}
              </span>
            </div>
            {post.user_id === user.id && (
              <button
                onClick={() => handleDeletePost(post.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#e57373",
                  fontSize: 12,
                  cursor: "pointer",
                  opacity: 0.7,
                  padding: "4px 8px",
                }}
                title="Delete post"
              >
                Delete
              </button>
            )}
          </div>

          {/* Post Content */}
          <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>{post.content}</p>

          {/* Comment Toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            style={{
              background: "transparent",
              color: "var(--alzooka-cream)",
              padding: "4px 0",
              fontSize: 14,
              border: "none",
              opacity: 0.7,
            }}
          >
            {commentCount === 0 
              ? "Add comment" 
              : `${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
          </button>

          {/* Comments Section */}
          {showComments && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(240, 235, 224, 0.1)" }}>
              {/* Existing Comments - Two Level Structure */}
              {post.comments?.map((comment) => (
                <div 
                  key={comment.id} 
                  id={`comment-${comment.id}`} 
                  style={{ 
                    marginBottom: 16,
                    ...(highlightCommentId === comment.id ? {
                      background: "rgba(212, 168, 75, 0.2)",
                      padding: 12,
                      marginLeft: -12,
                      marginRight: -12,
                      borderRadius: 8,
                      boxShadow: "inset 0 0 0 2px var(--alzooka-gold)",
                    } : {})
                  }}
                >
                  {/* Parent Comment */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Comment Vote Buttons */}
                    <VoteButtons
                      targetType="comment"
                      targetId={comment.id}
                      votes={votes}
                      voteTotals={voteTotals}
                      onVote={onVote}
                    />
                    
                    {/* Comment Content */}
                    <div style={{ flex: 1, paddingLeft: 8, borderLeft: "2px solid var(--alzooka-gold)" }}>
                      <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <Link 
                            href={`/profile/${comment.users?.username || "unknown"}`}
                            className="text-gold" 
                            style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}
                          >
                            @{comment.users?.username || "unknown"}
                          </Link>
                          <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                            {formatTime(comment.created_at)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleReply(comment.id, comment.users?.username || "unknown")}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--alzooka-cream)",
                              fontSize: 11,
                              cursor: "pointer",
                              opacity: 0.6,
                              padding: "2px 6px",
                            }}
                          >
                            Reply
                          </button>
                          {comment.user_id === user.id && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#e57373",
                                fontSize: 11,
                                cursor: "pointer",
                                opacity: 0.7,
                                padding: "2px 6px",
                              }}
                              title="Delete comment"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{comment.content}</p>
                    </div>
                  </div>

                  {/* Replies to this comment */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div style={{ marginLeft: 48, marginTop: 8 }}>
                      {comment.replies.map((reply) => (
                        <div 
                          key={reply.id} 
                          id={`comment-${reply.id}`}
                          style={{ 
                            marginBottom: 8,
                            ...(highlightCommentId === reply.id ? {
                              background: "rgba(212, 168, 75, 0.2)",
                              padding: 12,
                              marginLeft: -12,
                              marginRight: -12,
                              borderRadius: 8,
                              boxShadow: "inset 0 0 0 2px var(--alzooka-gold)",
                            } : {})
                          }}
                        >
                        <div style={{ display: "flex", gap: 8 }}>
                          {/* Reply Vote Buttons */}
                          <VoteButtons
                            targetType="comment"
                            targetId={reply.id}
                            votes={votes}
                            voteTotals={voteTotals}
                            onVote={onVote}
                          />
                          
                          {/* Reply Content */}
                          <div style={{ flex: 1, paddingLeft: 8, borderLeft: "2px solid rgba(212, 168, 75, 0.4)" }}>
                            <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <Link 
                                  href={`/profile/${reply.users?.username || "unknown"}`}
                                  className="text-gold" 
                                  style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                                >
                                  @{reply.users?.username || "unknown"}
                                </Link>
                                <span className="text-muted" style={{ marginLeft: 8, fontSize: 11 }}>
                                  {formatTime(reply.created_at)}
                                </span>
                              </div>
                              {reply.user_id === user.id && (
                                <button
                                  onClick={() => handleDeleteComment(reply.id)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#e57373",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    opacity: 0.7,
                                    padding: "2px 6px",
                                  }}
                                  title="Delete reply"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{reply.content}</p>
                          </div>
                        </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Add Comment Form */}
              <div style={{ marginTop: 12 }}>
                {replyingTo && (
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 8, 
                    marginBottom: 8,
                    fontSize: 13,
                    color: "var(--alzooka-gold)",
                  }}>
                    <span>Replying to @{replyingTo.username}</span>
                    <button
                      onClick={cancelReply}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--alzooka-cream)",
                        fontSize: 12,
                        cursor: "pointer",
                        opacity: 0.6,
                        padding: "2px 6px",
                      }}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                )}
                <form onSubmit={handleComment} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : "Write a comment..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    style={{ flex: 1, padding: 8, fontSize: 14 }}
                  />
                  <button 
                    type="submit" 
                    disabled={submitting || !commentText.trim()}
                    style={{ padding: "8px 16px", fontSize: 14 }}
                  >
                    {submitting ? "..." : replyingTo ? "Reply" : "Comment"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
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
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}
