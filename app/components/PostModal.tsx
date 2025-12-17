"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  notifyNewComment,
  notifyNewReply,
  notifyMention,
  parseMentions,
  getUserIdsByUsernames,
} from "@/lib/notifications";
import { LinkPreview } from "./LinkPreview";

// Instant Tooltip Component
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 6,
            padding: "6px 10px",
            background: "var(--alzooka-teal-dark)",
            color: "var(--alzooka-cream)",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 4,
            whiteSpace: "nowrap",
            zIndex: 9999,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            border: "1px solid rgba(240, 235, 224, 0.2)",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

// Helper function to render text with @mentions and URLs as clickable links
function renderTextWithLinksAndMentions(text: string): React.ReactNode[] {
  // Regex to match URLs (http, https, or www)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  // Regex to match @mentions
  const mentionRegex = /(@\w+)/g;
  
  // Combined regex to split by both URLs and mentions
  const combinedRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|@\w+)/gi;
  
  const parts = text.split(combinedRegex);
  
  return parts.map((part, i) => {
    if (!part) return null;
    
    // Check if it's a URL
    if (urlRegex.test(part)) {
      // Reset lastIndex after test
      urlRegex.lastIndex = 0;
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#6b9eff',
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    // Check if it's a @mention
    if (mentionRegex.test(part)) {
      mentionRegex.lastIndex = 0;
      return (
        <span
          key={i}
          style={{
            color: 'var(--alzooka-gold)',
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    
    // Regular text
    return <span key={i}>{part}</span>;
  }).filter(Boolean);
}

// Helper function to render text with quotes styled as quote blocks
function renderTextWithQuotes(text: string, stripUrls: boolean = false): React.ReactNode[] {
  // Split by quoted text (text between double quotes)
  const quoteRegex = /"([^"]+)"/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  
  while ((match = quoteRegex.exec(text)) !== null) {
    // Add text before the quote
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText.trim()) {
        parts.push(
          <span key={keyIndex++}>
            {stripUrls ? renderTextWithMentionsOnly(beforeText) : renderTextWithLinksAndMentions(beforeText)}
          </span>
        );
      }
    }
    
    // Add the quoted text as a styled block
    const quotedText = match[1];
    parts.push(
      <span
        key={keyIndex++}
        style={{
          display: "inline-flex",
          alignItems: "flex-start",
          gap: 6,
          padding: "4px 10px",
          margin: "2px 4px",
          background: "rgba(201, 162, 39, 0.1)",
          borderLeft: "3px solid var(--alzooka-gold)",
          borderRadius: "0 4px 4px 0",
          fontStyle: "italic",
          color: "var(--alzooka-cream)",
          opacity: 0.9,
        }}
      >
        <span style={{ opacity: 0.5 }}>"</span>
        {quotedText}
        <span style={{ opacity: 0.5 }}>"</span>
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last quote
  if (lastIndex < text.length) {
    const afterText = text.substring(lastIndex);
    if (afterText.trim()) {
      parts.push(
        <span key={keyIndex++}>
          {stripUrls ? renderTextWithMentionsOnly(afterText) : renderTextWithLinksAndMentions(afterText)}
        </span>
      );
    }
  }
  
  // If no quotes found, just render normally
  if (parts.length === 0) {
    return stripUrls ? renderTextWithMentionsOnly(text) : renderTextWithLinksAndMentions(text);
  }
  
  return parts;
}

// Helper function to render text with @mentions only - URLs are stripped (used when preview is shown)
function renderTextWithMentionsOnly(text: string): React.ReactNode[] {
  // Regex to match URLs (http, https, or www) - these will be stripped
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  // Regex to match @mentions
  const mentionRegex = /(@\w+)/g;
  
  // Combined regex to split by both URLs and mentions
  const combinedRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|@\w+)/gi;
  
  const parts = text.split(combinedRegex);
  
  return parts.map((part, i) => {
    if (!part) return null;
    
    // Check if it's a URL - skip it (don't render)
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return null;
    }
    
    // Check if it's a @mention
    if (mentionRegex.test(part)) {
      mentionRegex.lastIndex = 0;
      return (
        <span
          key={i}
          style={{
            color: 'var(--alzooka-gold)',
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    
    // Regular text
    return <span key={i}>{part}</span>;
  }).filter(Boolean);
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
  video_url: string | null;
  wall_user_id: string | null;
  wall_user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
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
};

// YouTube URL parsing
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractYouTubePlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

// Spotify URL parsing
function findSpotifyUrl(text: string): string | null {
  const match = text.match(/https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/[a-zA-Z0-9]+/i);
  return match ? match[0] : null;
}

// Find any URL in text
function findFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

type GroupMember = {
  user_id: string;
  role: "admin" | "moderator" | "member";
};

type Props = {
  post: Post;
  user: User;
  supabase: SupabaseClient;
  votes: Record<string, Vote>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
  onClose: () => void;
  onCommentAdded: (newComment?: Comment, deletedCommentId?: string) => void;
  highlightCommentId?: string | null;
  groupMembers?: GroupMember[];
  isUserGroupAdmin?: boolean;
  isUserBanned?: boolean;
  onBanUser?: (userId: string) => void;
};

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

  const scoreColor =
    score > 0 ? "var(--alzooka-gold)" : score < 0 ? "#e57373" : "var(--alzooka-cream)";

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
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: scoreColor,
          opacity: score === 0 ? 0.5 : 1,
        }}
      >
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

export function PostModal({
  post,
  user,
  supabase,
  votes,
  voteTotals,
  onVote,
  onClose,
  onCommentAdded,
  highlightCommentId,
  groupMembers,
  isUserGroupAdmin,
  isUserBanned,
  onBanUser,
}: Props) {
  // Helper to check if a user is a group admin
  const isGroupAdmin = (userId: string) => {
    if (!groupMembers) return false;
    return groupMembers.some(m => m.user_id === userId && m.role === "admin");
  };
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [activeHighlight, setActiveHighlight] = useState<string | null>(highlightCommentId || null);
  const [commentLinkPreview, setCommentLinkPreview] = useState<{url: string; type: 'youtube' | 'spotify' | 'link'; videoId?: string; playlistId?: string} | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  
  // Clear highlight on any interaction
  const clearHighlight = () => setActiveHighlight(null);

  // Detect links in comment text
  function handleCommentTextChange(text: string) {
    setCommentText(text);
    clearHighlight();
    
    // Check for YouTube URL
    const youtubeVideoId = extractYouTubeVideoId(text);
    if (youtubeVideoId) {
      const playlistId = extractYouTubePlaylistId(text);
      setCommentLinkPreview({ url: text, type: 'youtube', videoId: youtubeVideoId, playlistId: playlistId || undefined });
      return;
    }
    
    // Check for Spotify URL
    const spotifyUrl = findSpotifyUrl(text);
    if (spotifyUrl) {
      setCommentLinkPreview({ url: spotifyUrl, type: 'spotify' });
      return;
    }
    
    // Check for any other URL
    const anyUrl = findFirstUrl(text);
    if (anyUrl && !anyUrl.match(/youtube\.com|youtu\.be|spotify\.com/i)) {
      setCommentLinkPreview({ url: anyUrl, type: 'link' });
      return;
    }
    
    // No link found
    setCommentLinkPreview(null);
  }

  // Ensure we're on client before rendering portal
  useEffect(() => {
    setMounted(true);
     
  }, []);

  // Focus comment input when modal opens (skip if highlighting a comment)
  useEffect(() => {
    if (!highlightCommentId) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  }, [highlightCommentId]);

  // Scroll to highlighted comment if present
  useEffect(() => {
    if (activeHighlight && commentsContainerRef.current) {
      setTimeout(() => {
        const element = document.getElementById(`modal-comment-${activeHighlight}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [activeHighlight]);
  
  // Reset highlight when highlightCommentId changes (new notification click)
  useEffect(() => {
    setActiveHighlight(highlightCommentId || null);
  }, [highlightCommentId]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;

    await supabase.from("comments").delete().eq("id", commentId);
    onCommentAdded(undefined, commentId);
  }

  async function handleEditComment(commentId: string) {
    if (!editingCommentText.trim()) return;

    await supabase
      .from("comments")
      .update({ content: editingCommentText.trim() })
      .eq("id", commentId);

    setEditingCommentId(null);
    setEditingCommentText("");
    onCommentAdded();
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    // Check if user is banned
    if (isUserBanned) {
      alert("You have been banned from interacting with this group.");
      return;
    }

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
      // Auto-upvote own comment (using onVote to update both DB and UI)
      onVote("comment", data.id, 1);

      // Send notifications
      if (replyingTo) {
        // Recursively find the parent comment
        const findComment = (comments: Comment[]): Comment | null => {
          for (const c of comments) {
            if (c.id === replyingTo.id) return c;
            if (c.replies) {
              const found = findComment(c.replies);
              if (found) return found;
            }
          }
          return null;
        };
        
        const parentComment = findComment(post.comments || []);
        if (parentComment && parentComment.user_id !== user.id) {
          notifyNewReply(supabase, parentComment.user_id, commenterUsername, post.id, data.id, trimmedComment);
        }
      } else {
        if (post.user_id !== user.id) {
          notifyNewComment(supabase, post.user_id, commenterUsername, post.id, data.id, trimmedComment);
        }
      }

      // Check for @mentions
      const mentions = parseMentions(trimmedComment);
      if (mentions.length > 0) {
        const userIdMap = await getUserIdsByUsernames(supabase, mentions);
        for (const username of mentions) {
          const mentionedUserId = userIdMap[username.toLowerCase()];
          if (mentionedUserId && mentionedUserId !== user.id) {
            notifyMention(supabase, mentionedUserId, commenterUsername, post.id, data.id, trimmedComment);
          }
        }
      }

      // Get current user's profile info for the optimistic update
      const { data: userData } = await supabase
        .from("users")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .single();

      // Create the new comment object for optimistic update
      const newComment: Comment = {
        id: data.id,
        content: trimmedComment,
        created_at: new Date().toISOString(),
        user_id: user.id,
        parent_comment_id: replyingTo?.id || null,
        users: userData || {
          username: commenterUsername,
          display_name: null,
          avatar_url: null,
        },
      };

      setCommentText("");
      setReplyingTo(null);
      setCommentLinkPreview(null);
      // Reset textarea height
      if (commentInputRef.current) {
        commentInputRef.current.style.height = 'auto';
      }
      onCommentAdded(newComment);
    }

    setSubmitting(false);
  }

  function handleReply(commentId: string, username: string) {
    setReplyingTo({ id: commentId, username });
    // Auto-insert @username for all replies (Facebook-style)
    setCommentText(`@${username} `);
    commentInputRef.current?.focus();
    clearHighlight();
  }

  function cancelReply() {
    setReplyingTo(null);
    setCommentText("");
  }

  // Count all comments recursively
  const countCommentsRecursive = (comments: Comment[]): number => {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.replies ? countCommentsRecursive(comment.replies) : 0);
    }, 0);
  };

  const commentCount = countCommentsRecursive(post.comments || []);

  // Extract ALL comments from the nested structure into a flat array
  // This handles both shallow and deep nesting structures
  function extractAllComments(comments: Comment[]): Comment[] {
    const result: Comment[] = [];
    function traverse(commentList: Comment[]) {
      for (const comment of commentList) {
        result.push(comment);
        if (comment.replies && comment.replies.length > 0) {
          traverse(comment.replies);
        }
      }
    }
    traverse(comments);
    return result;
  }

  // Get ALL comments as a flat array, regardless of how they were nested
  const allCommentsFlat = extractAllComments(post.comments || []);

  // Build the final flat list:
  // - Top-level comments (parent_comment_id is null) at 0px
  // - ALL replies (parent_comment_id is NOT null) at 40px, grouped under their root parent
  const flatCommentList: Array<{ comment: Comment; isReply: boolean }> = [];

  // For each top-level comment, add it and then all its descendants (flattened)
  const topLevelComments = allCommentsFlat
    .filter(c => !c.parent_comment_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Find the root parent ID for any comment (traverse up the chain)
  function getRootParentId(comment: Comment): string | null {
    if (!comment.parent_comment_id) return null;
    
    // Find the parent comment
    let current = allCommentsFlat.find(c => c.id === comment.parent_comment_id);
    while (current && current.parent_comment_id) {
      current = allCommentsFlat.find(c => c.id === current!.parent_comment_id);
    }
    return current?.id || comment.parent_comment_id;
  }

  // Group all replies by their root parent
  const repliesByRootParent: Record<string, Comment[]> = {};
  allCommentsFlat.forEach(comment => {
    if (comment.parent_comment_id) {
      const rootId = getRootParentId(comment);
      if (rootId) {
        if (!repliesByRootParent[rootId]) {
          repliesByRootParent[rootId] = [];
        }
        repliesByRootParent[rootId].push(comment);
      }
    }
  });

  // Build the final list: top-level comment followed by all its replies (sorted by time)
  topLevelComments.forEach(topComment => {
    flatCommentList.push({ comment: topComment, isReply: false });
    const replies = repliesByRootParent[topComment.id] || [];
    replies
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(reply => {
        flatCommentList.push({ comment: reply, isReply: true });
      });
  });

  // Render a single comment (no recursion - just renders one comment)
  function renderSingleComment(comment: Comment, isReply: boolean): React.JSX.Element {
    return (
      <div
        key={comment.id}
        id={`modal-comment-${comment.id}`}
        style={{
          marginBottom: 12,
          marginLeft: isReply ? 40 : 0,
          ...(activeHighlight === comment.id
            ? {
                background: "rgba(212, 168, 75, 0.2)",
                padding: 12,
                marginLeft: isReply ? 28 : -12,
                marginRight: -12,
                borderRadius: 8,
                boxShadow: "inset 0 0 0 2px var(--alzooka-gold)",
              }
            : {}),
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <VoteButtons
            targetType="comment"
            targetId={comment.id}
            votes={votes}
            voteTotals={voteTotals}
            onVote={onVote}
          />

          <div style={{ flex: 1, paddingLeft: 8, borderLeft: `2px solid ${!isReply ? 'var(--alzooka-gold)' : 'rgba(212, 168, 75, 0.4)'}` }}>
            <div
              style={{
                marginBottom: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Link
                href={`/profile/${comment.users?.username || "unknown"}`}
                style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
                onClick={onClose}
              >
                {comment.users?.avatar_url ? (
                  <img
                    src={comment.users.avatar_url}
                    alt=""
                    style={{
                      width: isReply ? 26 : 28,
                      height: isReply ? 26 : 28,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: isReply ? 26 : 28,
                      height: isReply ? 26 : 28,
                      borderRadius: "50%",
                      background: "var(--alzooka-gold)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--alzooka-teal-dark)",
                      fontWeight: 700,
                      fontSize: isReply ? 11 : 12,
                    }}
                  >
                    {(comment.users?.display_name || comment.users?.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <span style={{ fontSize: isReply ? 13 : 14, fontWeight: 600, color: "var(--alzooka-cream)" }}>
                    {comment.users?.display_name || comment.users?.username || "Unknown"}
                  </span>
                  {isGroupAdmin(comment.user_id) && (
                    <span style={{ 
                      marginLeft: 8, 
                      fontSize: 10, 
                      color: "var(--alzooka-gold)",
                      background: "rgba(201, 165, 92, 0.15)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}>
                      Admin
                    </span>
                  )}
                  <span className="text-muted" style={{ marginLeft: 8, fontSize: isReply ? 11 : 12 }}>
                    {formatTime(comment.created_at)}
                  </span>
                </div>
              </Link>
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
                {/* Edit button - only for comment author */}
                {comment.user_id === user.id && (
                  <button
                    onClick={() => {
                      setEditingCommentId(comment.id);
                      setEditingCommentText(comment.content);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--alzooka-cream)",
                      fontSize: 11,
                      cursor: "pointer",
                      opacity: 0.7,
                      padding: "2px 6px",
                    }}
                    title="Edit comment"
                  >
                    Edit
                  </button>
                )}
                {/* Delete button - for comment author OR post owner OR group admin */}
                {(comment.user_id === user.id || post.user_id === user.id || isUserGroupAdmin) && (
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
                {/* Ban button - only for group admins, not on their own comments */}
                {isUserGroupAdmin && comment.user_id !== user.id && onBanUser && (
                  <Tooltip text="Ban User">
                    <button
                      onClick={() => onBanUser(comment.user_id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#e57373",
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "2px 6px",
                      }}
                    >
                      🚫
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
            {editingCommentId === comment.id ? (
              <div style={{ marginTop: 8 }}>
                <textarea
                  value={editingCommentText}
                  onChange={(e) => setEditingCommentText(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    fontSize: isReply ? 13 : 14,
                    resize: "vertical",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid rgba(240, 235, 224, 0.2)",
                    background: "rgba(0, 0, 0, 0.2)",
                    color: "var(--alzooka-cream)",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleEditComment(comment.id)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 13,
                      background: "var(--alzooka-gold)",
                      color: "var(--alzooka-teal-dark)",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingCommentText("");
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 13,
                      background: "transparent",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      color: "var(--alzooka-cream)",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Render text - strip URL if there's a preview to show */}
                {(() => {
                  const hasYouTube = !!extractYouTubeVideoId(comment.content);
                  const hasSpotify = !!findSpotifyUrl(comment.content);
                  const hasOtherUrl = !hasYouTube && !hasSpotify && !!findFirstUrl(comment.content);
                  const hasAnyPreview = hasYouTube || hasSpotify || hasOtherUrl;
                  
                  // Render text with quotes styled, strip URLs if there's a preview
                  const textContent = renderTextWithQuotes(comment.content, hasAnyPreview);
                  
                  // Check if there's any actual text left after stripping URLs
                  const textOnly = comment.content.replace(/https?:\/\/[^\s]+/gi, '').trim();
                  
                  if (!textOnly && hasAnyPreview) {
                    // No text, just URL - don't render paragraph
                    return null;
                  }
                  
                  return (
                    <p style={{ margin: 0, fontSize: isReply ? 13 : 14, lineHeight: 1.5 }}>
                      {textContent}
                    </p>
                  );
                })()}
                
                {/* YouTube Embed in Comment */}
                {(() => {
                  const videoId = extractYouTubeVideoId(comment.content);
                  if (videoId) {
                    const playlistId = extractYouTubePlaylistId(comment.content);
                    const embedUrl = playlistId 
                      ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}&rel=0`
                      : `https://www.youtube.com/embed/${videoId}?rel=0`;
                    return (
                      <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ 
                          position: "relative",
                          paddingBottom: "56.25%",
                          height: 0,
                          background: "#000",
                        }}>
                          <iframe
                            src={embedUrl}
                            title="YouTube video"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {/* Spotify Embed in Comment */}
                {(() => {
                  const spotifyUrl = findSpotifyUrl(comment.content);
                  if (spotifyUrl) {
                    const match = spotifyUrl.match(/spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
                    if (match) {
                      const [, type, id] = match;
                      return (
                        <div style={{ marginTop: 8 }}>
                          <iframe
                            style={{ borderRadius: 12, width: "100%", height: type === "track" || type === "episode" ? 152 : 352 }}
                            src={`https://open.spotify.com/embed/${type}/${id}?utm_source=generator`}
                            frameBorder="0"
                            allowFullScreen
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                          />
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
                
                {/* Link Preview for non-YouTube/Spotify URLs in Comment */}
                {(() => {
                  const youtubeId = extractYouTubeVideoId(comment.content);
                  const spotifyUrl = findSpotifyUrl(comment.content);
                  if (youtubeId || spotifyUrl) return null;
                  
                  const anyUrl = findFirstUrl(comment.content);
                  if (anyUrl) {
                    return (
                      <div style={{ marginTop: 8 }}>
                        <LinkPreview url={anyUrl} />
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Don't render on server
  if (!mounted) return null;

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      {/* Modal Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--alzooka-teal-light)",
          borderRadius: 12,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          animation: "modalSlideIn 0.2s ease-out",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--alzooka-cream)" }}>
            {post.users?.display_name || post.users?.username || "Unknown"}&apos;s Post
          </h2>
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(240, 235, 224, 0.1)",
              border: "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--alzooka-cream)",
              fontSize: 20,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(240, 235, 224, 0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)")}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          ref={commentsContainerRef}
          onClick={clearHighlight}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
          }}
        >
          {/* Post Content */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {/* Vote Buttons */}
            <VoteButtons targetType="post" targetId={post.id} votes={votes} voteTotals={voteTotals} onVote={onVote} />

            {/* Post Body */}
            <div style={{ flex: 1 }}>
              {/* Post Header */}
              <div style={{ marginBottom: 12 }}>
                <Link
                  href={`/profile/${post.users?.username || "unknown"}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
                  onClick={onClose}
                >
                  {post.users?.avatar_url ? (
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
                        fontSize: 16,
                      }}
                    >
                      {(post.users?.display_name || post.users?.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--alzooka-cream)" }}>
                      {post.users?.display_name || post.users?.username || "Unknown"}
                    </span>
                    {isGroupAdmin(post.user_id) && (
                      <span style={{ 
                        marginLeft: 8, 
                        fontSize: 11, 
                        color: "var(--alzooka-gold)",
                        background: "rgba(201, 165, 92, 0.15)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}>
                        Admin
                      </span>
                    )}
                    <span className="text-muted" style={{ marginLeft: 8, fontSize: 14 }}>
                      {formatTime(post.created_at)}
                    </span>
                  </div>
                </Link>
              </div>
              {post.wall_user_id && post.wall_user && post.wall_user.username !== post.users?.username && (
                <div style={{ marginTop: -6, marginBottom: 12, fontSize: 13, opacity: 0.75 }}>
                  Posted on{" "}
                  <Link href={`/profile/${post.wall_user.username}`} onClick={onClose} style={{ color: "var(--alzooka-gold)" }}>
                    {post.wall_user.display_name || post.wall_user.username}
                  </Link>
                  &apos;s wall
                </div>
              )}

              {/* Post Text - strip URLs when there's a preview */}
              {(() => {
                let displayContent = post.content;
                
                // Strip YouTube/Spotify URLs if video exists
                if (post.video_url && displayContent) {
                  displayContent = displayContent
                    .replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+/gi, '')
                    .replace(/https?:\/\/open\.spotify\.com\/(?:track|album|playlist|episode|show)\/[^\s]+/gi, '')
                    .trim();
                }
                
                // Strip ALL URLs when no image/video (link preview will show instead)
                if (!post.image_url && !post.video_url && displayContent) {
                  displayContent = displayContent
                    .replace(/https?:\/\/[^\s]+/gi, '')
                    .trim();
                }
                
                return displayContent ? (
                  <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>{displayContent}</p>
                ) : null;
              })()}

              {/* Edited indicator */}
              {post.edited_at && (
                <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.6 }}>
                  <span>Edited {formatTime(post.edited_at)}</span>
                  {post.edit_history && post.edit_history.length > 0 && (
                    <button
                      onClick={() => setShowEditHistory(!showEditHistory)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--alzooka-gold)",
                        fontSize: 12,
                        cursor: "pointer",
                        marginLeft: 8,
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      {showEditHistory ? "Hide edits" : "See edits"}
                    </button>
                  )}
                </div>
              )}

              {/* Edit History */}
              {showEditHistory && post.edit_history && post.edit_history.length > 0 && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: 12, opacity: 0.7 }}>Edit History</p>
                  {post.edit_history.map((entry, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: index < post.edit_history.length - 1 ? 12 : 0,
                        paddingBottom: index < post.edit_history.length - 1 ? 12 : 0,
                        borderBottom:
                          index < post.edit_history.length - 1 ? "1px solid rgba(240, 235, 224, 0.1)" : "none",
                      }}
                    >
                      <span style={{ fontSize: 11, opacity: 0.5 }}>{formatTime(entry.edited_at)}</span>
                      <p style={{ margin: "4px 0 0 0", opacity: 0.7, fontStyle: "italic" }}>
                        {entry.content || "(no text)"}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Post Image */}
              {post.image_url && (
                <div style={{ marginBottom: 16 }}>
                  <img
                    src={post.image_url}
                    alt="Post image"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 400,
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                    onClick={() => window.open(post.image_url!, "_blank")}
                  />
                </div>
              )}

              {/* YouTube Video Player */}
              {post.video_url && (() => {
                const videoId = extractYouTubeVideoId(post.video_url);
                if (!videoId) return null;
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ 
                      position: "relative",
                      paddingBottom: "56.25%", /* 16:9 aspect ratio */
                      height: 0,
                      overflow: "hidden",
                      borderRadius: 8,
                      background: "#000",
                    }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                        title="YouTube video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
              
              {/* Link Preview for non-YouTube/Spotify URLs */}
              {!post.image_url && !post.video_url && post.content && (() => {
                const urlRegex = /https?:\/\/[^\s]+/gi;
                const urls = post.content.match(urlRegex) || [];
                const previewUrl = urls.find(url =>
                  !url.match(/youtube\.com|youtu\.be|spotify\.com/i)
                );
                return previewUrl ? (
                  <div style={{ marginBottom: 16 }}>
                    <LinkPreview url={previewUrl} />
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Comments Section Divider */}
          <div
            style={{
              borderTop: "1px solid rgba(240, 235, 224, 0.15)",
              paddingTop: 16,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>
              {commentCount === 0 ? "No comments yet" : `${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Comments - 2-level flat threading (top-level at 0px, ALL replies at 40px) */}
          {flatCommentList.map(({ comment, isReply }) => renderSingleComment(comment, isReply))}
        </div>

        {/* Fixed Comment Input at Bottom */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(240, 235, 224, 0.1)",
            background: "var(--alzooka-teal-light)",
            borderRadius: "0 0 12px 12px",
          }}
        >
          {isUserBanned ? (
            <div style={{ textAlign: "center", color: "#e57373", fontSize: 14 }}>
              🚫 You have been banned from interacting with this group.
            </div>
          ) : (
            <>
              {replyingTo && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    fontSize: 13,
                    color: "var(--alzooka-gold)",
                  }}
                >
                  <span>Replying to {replyingTo.username}</span>
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
              {/* Link Preview for Comment */}
              {commentLinkPreview && (
                <div style={{ marginBottom: 12, position: "relative" }}>
                  <button
                    onClick={() => setCommentLinkPreview(null)}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "rgba(0,0,0,0.6)",
                      border: "none",
                      color: "#fff",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      cursor: "pointer",
                      fontSize: 14,
                      zIndex: 10,
                    }}
                  >
                    ×
                  </button>
                  {commentLinkPreview.type === 'youtube' && commentLinkPreview.videoId && (
                    <div style={{ borderRadius: 8, overflow: "hidden" }}>
                      <img
                        src={`https://img.youtube.com/vi/${commentLinkPreview.videoId}/hqdefault.jpg`}
                        alt="YouTube thumbnail"
                        style={{ width: "100%", maxHeight: 150, objectFit: "cover" }}
                      />
                      <div style={{ padding: 8, background: "rgba(0,0,0,0.3)", fontSize: 12, color: "var(--alzooka-cream)" }}>
                        YouTube Video {commentLinkPreview.playlistId && "(Playlist)"}
                      </div>
                    </div>
                  )}
                  {commentLinkPreview.type === 'spotify' && (
                    <div style={{ padding: 12, background: "rgba(30, 215, 96, 0.1)", borderRadius: 8, border: "1px solid rgba(30, 215, 96, 0.3)" }}>
                      <span style={{ color: "#1DB954", fontWeight: 600 }}>🎵 Spotify Link</span>
                    </div>
                  )}
                  {commentLinkPreview.type === 'link' && (
                    <div style={{ maxHeight: 120, overflow: "hidden" }}>
                      <LinkPreview url={commentLinkPreview.url} />
                    </div>
                  )}
                </div>
              )}
              <form onSubmit={handleComment} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                {/* Quote Button */}
                <Tooltip text="Insert quote">
                  <button
                    type="button"
                    onClick={() => {
                      const input = commentInputRef.current;
                      if (!input) return;
                      
                      const start = input.selectionStart || 0;
                      const end = input.selectionEnd || 0;
                      const text = commentText;
                      
                      if (start !== end) {
                        // Text is selected - wrap it in quotes
                        const selectedText = text.substring(start, end);
                        const newText = text.substring(0, start) + `"${selectedText}"` + text.substring(end);
                        setCommentText(newText);
                        // Move cursor after the closing quote
                        setTimeout(() => {
                          input.focus();
                          input.setSelectionRange(end + 2, end + 2);
                        }, 0);
                      } else {
                        // No selection - insert empty quotes and place cursor inside
                        const newText = text.substring(0, start) + '""' + text.substring(start);
                        setCommentText(newText);
                        // Place cursor between the quotes
                        setTimeout(() => {
                          input.focus();
                          input.setSelectionRange(start + 1, start + 1);
                        }, 0);
                      }
                    }}
                    style={{
                      background: "rgba(240, 235, 224, 0.1)",
                      border: "1px solid rgba(240, 235, 224, 0.2)",
                      color: "var(--alzooka-cream)",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginBottom: 4,
                    }}
                  >
                    "
                  </button>
                </Tooltip>
                <textarea
                  ref={commentInputRef}
                  placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Write a comment..."}
                  value={commentText}
                  onChange={(e) => {
                    handleCommentTextChange(e.target.value);
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px'; // 144px ≈ 6 lines
                  }}
                  onFocus={clearHighlight}
                  onKeyDown={(e) => {
                    // Submit on Enter (without Shift)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (commentText.trim() && !submitting) {
                        handleComment(e as unknown as React.FormEvent);
                      }
                    }
                  }}
                  rows={1}
                  style={{ 
                    flex: 1, 
                    padding: "12px 16px", 
                    fontSize: 14, 
                    borderRadius: 16,
                    resize: "none",
                    minHeight: 44,
                    maxHeight: 144, // ~6 lines
                    overflowY: "auto",
                    lineHeight: 1.4,
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  style={{ padding: "12px 20px", fontSize: 14, borderRadius: 24, marginBottom: 4 }}
                >
                  {submitting ? "..." : replyingTo ? "Reply" : "Post"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

