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
import { EmojiButton } from "./EmojiButton";
import { BannerCropModal } from "./BannerCropModal";
import { AvatarCropModal } from "./AvatarCropModal";
import { ReactionPicker, Reaction } from "./ReactionPicker";

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
function renderTextWithLinksAndMentions(text: string, mentionCache?: Map<string, string>): React.ReactNode[] {
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
      const username = part.substring(1); // Remove @ prefix
      const displayName = mentionCache?.get(username);
      const displayText = displayName ? `${displayName} (${part})` : part;
      return (
        <a
          key={i}
          href={`/profile/${username}`}
          style={{
            color: 'var(--alzooka-gold)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {displayText}
        </a>
      );
    }
    
    // Regular text
    return <span key={i}>{part}</span>;
  }).filter(Boolean);
}

// Helper function to render text with quotes styled as italics
// Only quotes wrapped in curly quotes "..." (from quote button) get styled
function renderTextWithQuotes(text: string, stripUrls: boolean = false, mentionCache?: Map<string, string>): React.ReactNode[] {
  // Split by curly quote markers - only these get styled
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
            {stripUrls ? renderTextWithMentionsOnly(beforeText, mentionCache) : renderTextWithLinksAndMentions(beforeText, mentionCache)}
          </span>
        );
      }
    }

    // Add the quoted text as italicized with quotation marks
    const quotedText = match[1];
    parts.push(
      <span
        key={keyIndex++}
        style={{
          fontStyle: "italic",
        }}
      >
        "{quotedText}"
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
          {stripUrls ? renderTextWithMentionsOnly(afterText, mentionCache) : renderTextWithLinksAndMentions(afterText, mentionCache)}
        </span>
      );
    }
  }

  // If no special quotes found, just render normally
  if (parts.length === 0) {
    return stripUrls ? renderTextWithMentionsOnly(text, mentionCache) : renderTextWithLinksAndMentions(text, mentionCache);
  }

  return parts;
}

// Helper function to render text with @mentions only - URLs are stripped (used when preview is shown)
function renderTextWithMentionsOnly(text: string, mentionCache?: Map<string, string>): React.ReactNode[] {
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
      const username = part.substring(1); // Remove @ prefix
      const displayName = mentionCache?.get(username);
      const displayText = displayName ? `${displayName} (${part})` : part;
      return (
        <a
          key={i}
          href={`/profile/${username}`}
          style={{
            color: 'var(--alzooka-gold)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {displayText}
        </a>
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
  image_urls?: string[] | null;
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
  onUserAvatarUpdated?: (newAvatarUrl: string) => void;
  onUserBannerUpdated?: (newBannerUrl: string) => void;
  postReactions?: Reaction[];
  onPostReactionsChange?: (reactions: Reaction[]) => void;
  // Multi-window support
  modalId?: string;
  initialPosition?: { x: number; y: number } | null;
  initialSize?: { width: number; height: number } | null;
  zIndex?: number;
  onBringToFront?: () => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  hideBackdrop?: boolean;
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
  onUserAvatarUpdated,
  onUserBannerUpdated,
  postReactions = [],
  onPostReactionsChange,
  // Multi-window props
  modalId,
  initialPosition,
  initialSize,
  zIndex: propZIndex,
  onBringToFront,
  onPositionChange,
  onSizeChange,
  hideBackdrop = false,
}: Props) {
  // Helper to check if a user is a group admin
  const isGroupAdmin = (userId: string) => {
    if (!groupMembers) return false;
    return groupMembers.some(m => m.user_id === userId && m.role === "admin");
  };
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string; displayName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Draggable modal state - use initialPosition if provided (multi-window mode)
  const [modalPosition, setModalPositionState] = useState<{ x: number; y: number } | null>(initialPosition ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; modalX: number; modalY: number } | null>(null);
  
  // Wrapper to also notify parent of position changes
  const setModalPosition = (pos: { x: number; y: number } | null) => {
    setModalPositionState(pos);
    if (pos && onPositionChange) {
      onPositionChange(pos);
    }
  };
  
  // Resizable modal state - use initialSize if provided (multi-window mode)
  const [modalSize, setModalSizeState] = useState<{ width: number; height: number } | null>(initialSize ?? null);
  
  // Wrapper to also notify parent of size changes
  const setModalSize = (size: { width: number; height: number } | null) => {
    setModalSizeState(size);
    if (size && onSizeChange) {
      onSizeChange(size);
    }
  };
  const [isResizing, setIsResizing] = useState<string | null>(null); // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
  const resizeStartRef = useRef<{ 
    x: number; y: number; 
    width: number; height: number;
    modalX: number; modalY: number;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const justFinishedResizingRef = useRef(false);
  
  // See-through mode - makes background visible
  const [seeThroughMode, setSeeThroughMode] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [activeHighlight, setActiveHighlight] = useState<string | null>(highlightCommentId || null);
  const [commentLinkPreview, setCommentLinkPreview] = useState<{url: string; type: 'youtube' | 'spotify' | 'link'; videoId?: string; playlistId?: string} | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [mentionCache, setMentionCache] = useState<Map<string, string>>(new Map());
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Crop modal state for setting post image as profile/banner
  const [showBannerCrop, setShowBannerCrop] = useState(false);
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  
  // Comment reactions state - keyed by comment ID
  const [commentReactions, setCommentReactions] = useState<Record<string, Reaction[]>>({});
  
  // Fetch current user's avatar
  useEffect(() => {
    async function fetchUserAvatar() {
      const { data } = await supabase
        .from("users")
        .select("avatar_url")
        .eq("id", user.id)
        .single();
      if (data) {
        setCurrentUserAvatar(data.avatar_url);
      }
    }
    fetchUserAvatar();
  }, [user.id, supabase]);

  // Build mention cache from comments - extract @mentions and fetch display names
  useEffect(() => {
    async function buildMentionCache() {
      // Extract all @mentions from post content and comments
      const mentionRegex = /@(\w+)/g;
      const usernames = new Set<string>();
      
      // Check post content
      let match;
      while ((match = mentionRegex.exec(post.content)) !== null) {
        usernames.add(match[1]);
      }
      
      // Check all comments recursively
      function extractFromComments(comments: Comment[] | undefined) {
        if (!comments) return;
        for (const comment of comments) {
          mentionRegex.lastIndex = 0;
          while ((match = mentionRegex.exec(comment.content)) !== null) {
            usernames.add(match[1]);
          }
          if (comment.replies) {
            extractFromComments(comment.replies);
          }
        }
      }
      extractFromComments(post.comments);
      
      if (usernames.size === 0) return;
      
      // Fetch display names for all mentioned usernames
      const { data } = await supabase
        .from("users")
        .select("username, display_name")
        .in("username", Array.from(usernames));
      
      if (data) {
        const cache = new Map<string, string>();
        for (const user of data) {
          if (user.display_name) {
            cache.set(user.username, user.display_name);
          }
        }
        setMentionCache(cache);
      }
    }
    buildMentionCache();
  }, [post.content, post.comments, supabase]);

  // Load comment reactions
  useEffect(() => {
    async function loadCommentReactions() {
      // Get all comment IDs (including nested replies)
      const getAllCommentIds = (comments: Comment[]): string[] => {
        const ids: string[] = [];
        comments.forEach(c => {
          ids.push(c.id);
          if (c.replies) {
            ids.push(...getAllCommentIds(c.replies));
          }
        });
        return ids;
      };
      
      const commentIds = getAllCommentIds(post.comments || []);
      if (commentIds.length === 0) return;
      
      const { data } = await supabase
        .from("reactions")
        .select(`
          id, user_id, comment_id, reaction_type, created_at,
          users (username, display_name, avatar_url)
        `)
        .in("comment_id", commentIds);
      
      if (data) {
        // Group reactions by comment_id
        const reactionsByComment: Record<string, Reaction[]> = {};
        data.forEach(r => {
          if (r.comment_id) {
            if (!reactionsByComment[r.comment_id]) {
              reactionsByComment[r.comment_id] = [];
            }
            reactionsByComment[r.comment_id].push({
              ...r,
              users: Array.isArray(r.users) ? r.users[0] : r.users,
            } as Reaction);
          }
        });
        setCommentReactions(reactionsByComment);
      }
    }
    loadCommentReactions();
  }, [post.comments, supabase]);

  // Handle comment reaction changes
  function handleCommentReactionsChange(commentId: string, newReactions: Reaction[]) {
    setCommentReactions(prev => ({
      ...prev,
      [commentId]: newReactions,
    }));
  }

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
    if (!activeHighlight) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Only update if there's a new highlight, don't clear when it becomes null
  useEffect(() => {
    if (highlightCommentId) {
      setActiveHighlight(highlightCommentId);
    }
  }, [highlightCommentId]);

  // Auto-scroll to comments section when modal opens (unless highlighting a specific comment)
  useEffect(() => {
    if (!highlightCommentId && mounted) {
      setTimeout(() => {
        const commentsHeader = document.getElementById('comments-section-header');
        if (commentsHeader && commentsContainerRef.current) {
          commentsHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  }, [mounted, highlightCommentId]);

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

  // Drag handlers for moveable modal
  useEffect(() => {
    if (!isDragging) return;
    
    function handleMouseMove(e: MouseEvent) {
      if (!dragStartRef.current) return;
      
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      
      setModalPosition({
        x: dragStartRef.current.modalX + deltaX,
        y: dragStartRef.current.modalY + deltaY,
      });
    }
    
    function handleMouseUp() {
      setIsDragging(false);
      dragStartRef.current = null;
    }
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  function handleDragStart(e: React.MouseEvent) {
    // Only start drag on left click
    if (e.button !== 0) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      modalX: modalPosition?.x ?? 0,
      modalY: modalPosition?.y ?? 0,
    };
  }

  // Handle drag from anywhere on empty background
  function handleBackgroundDragStart(e: React.MouseEvent) {
    // Only start drag on left click
    if (e.button !== 0) return;
    
    // Check if clicked on an interactive element - don't drag from those
    const target = e.target as HTMLElement;
    
    // If clicked inside an interactive element, don't start drag
    if (target.closest('button, a, input, textarea, select, iframe, img, [role="button"]')) {
      return;
    }
    
    // If clicked on text content (p, span, h1-h6), don't drag
    if (target.closest('p, span, h1, h2, h3, h4, h5, h6, li')) {
      return;
    }
    
    e.preventDefault();
    setIsDragging(true);
    
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      modalX: modalPosition?.x ?? 0,
      modalY: modalPosition?.y ?? 0,
    };
  }

  // Resize handlers
  function handleResizeStart(e: React.MouseEvent, direction: string) {
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    
    const rect = modalRef.current?.getBoundingClientRect();
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: modalSize?.width ?? rect?.width ?? 680,
      height: modalSize?.height ?? rect?.height ?? 600,
      modalX: modalPosition?.x ?? 0,
      modalY: modalPosition?.y ?? 0,
    };
  }

  // Resize mouse move/up effect
  useEffect(() => {
    if (!isResizing) return;
    
    // Capture the resize direction for the closure
    const resizeDirection = isResizing;
    
    // Get viewport dimensions for clamping
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = viewportWidth - 40;
    const maxHeight = viewportHeight - 40;
    
    // Get the initial modal rect to know its actual viewport position
    const initialRect = modalRef.current?.getBoundingClientRect();
    const initialTop = initialRect?.top ?? 0;
    const initialLeft = initialRect?.left ?? 0;
    
    function handleMouseMove(e: MouseEvent) {
      if (!resizeStartRef.current) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Clamp mouse position to viewport to prevent extreme values
      const clampedX = Math.max(0, Math.min(viewportWidth, e.clientX));
      const clampedY = Math.max(0, Math.min(viewportHeight, e.clientY));
      
      const deltaX = clampedX - resizeStartRef.current.x;
      const deltaY = clampedY - resizeStartRef.current.y;
      
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;
      let newX = resizeStartRef.current.modalX;
      let newY = resizeStartRef.current.modalY;
      
      // Handle horizontal resizing with min/max bounds
      if (resizeDirection.includes('e')) {
        newWidth = Math.min(maxWidth, Math.max(400, resizeStartRef.current.width + deltaX));
        
        // Check if right edge would go past viewport
        const newRight = initialLeft + newWidth + (newX - resizeStartRef.current.modalX);
        if (newRight > viewportWidth) {
          newWidth = viewportWidth - initialLeft - (newX - resizeStartRef.current.modalX);
        }
      }
      if (resizeDirection.includes('w')) {
        // Calculate how much we can actually resize
        const maxDelta = resizeStartRef.current.width - 400;
        const clampedDelta = Math.max(-maxDelta, Math.min(deltaX, maxWidth - resizeStartRef.current.width));
        newWidth = resizeStartRef.current.width - clampedDelta;
        newX = resizeStartRef.current.modalX + clampedDelta;
        
        // Ensure left edge doesn't go past viewport left (x=0)
        const newLeft = initialLeft + (newX - resizeStartRef.current.modalX);
        if (newLeft < 0) {
          const adjustment = -newLeft;
          newX += adjustment;
          // Don't shrink width, just stop the left edge at 0
        }
      }
      
      // For non-west resizing, check if modal left is going out of view (centered modal grows both ways)
      if (!resizeDirection.includes('w') && resizeDirection.includes('e')) {
        const widthDelta = newWidth - resizeStartRef.current.width;
        const leftMovement = widthDelta / 2;
        const newLeft = initialLeft - leftMovement + (newX - resizeStartRef.current.modalX);
        
        if (newLeft < 0) {
          newX -= newLeft; // Push modal right to keep left in view
        }
      }
      
      // Handle vertical resizing with min/max bounds
      if (resizeDirection.includes('s')) {
        newHeight = Math.min(maxHeight, Math.max(300, resizeStartRef.current.height + deltaY));
      }
      if (resizeDirection.includes('n')) {
        // Calculate how much we can actually resize
        const maxDelta = resizeStartRef.current.height - 300;
        const clampedDelta = Math.max(-maxDelta, Math.min(deltaY, maxHeight - resizeStartRef.current.height));
        newHeight = resizeStartRef.current.height - clampedDelta;
        newY = resizeStartRef.current.modalY + clampedDelta;
        
        // Ensure top edge doesn't go past viewport top (y=0)
        const newTop = initialTop + (newY - resizeStartRef.current.modalY);
        if (newTop < 0) {
          // Top would go out of view - clamp it and extend bottom instead
          const adjustment = -newTop;
          newY += adjustment; // Move position down to keep top at 0
          // Height stays the same - the "lost" top expansion becomes bottom expansion
        }
      }
      
      // For non-north resizing, also check if modal top is going out of view
      // This handles the case where the modal is already positioned high
      if (!resizeDirection.includes('n')) {
        // Calculate where the top would be with new height (centered modal gets taller both ways)
        const heightDelta = newHeight - resizeStartRef.current.height;
        const topMovement = heightDelta / 2; // Centered modal grows equally up and down
        const newTop = initialTop - topMovement + (newY - resizeStartRef.current.modalY);
        
        if (newTop < 0) {
          // Top would go out of view - adjust position to compensate
          newY -= newTop; // Push modal down by the amount it would go over
        }
      }
      
      // Clamp position to keep modal bottom in view (at least 50px)
      const actualBottom = viewportHeight - (initialTop + newHeight + (newY - resizeStartRef.current.modalY));
      if (actualBottom < -newHeight + 50) {
        // Bottom going too far down - this is fine for resize, just cap the height
        newHeight = Math.min(newHeight, viewportHeight - 20);
      }
      
      // Final sanity checks - ensure values are valid numbers within reasonable bounds
      newWidth = Math.max(400, Math.min(maxWidth, Number.isFinite(newWidth) ? newWidth : 680));
      newHeight = Math.max(300, Math.min(maxHeight, Number.isFinite(newHeight) ? newHeight : 600));
      newX = Number.isFinite(newX) ? Math.max(-viewportWidth, Math.min(viewportWidth, newX)) : 0;
      newY = Number.isFinite(newY) ? Math.max(-viewportHeight, Math.min(viewportHeight, newY)) : 0;
      
      setModalSize({ width: newWidth, height: newHeight });
      
      // Always update position during resize to handle clamping
      setModalPosition({ x: newX, y: newY });
    }
    
    function handleMouseUp(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      
      // Set flag to prevent modal from closing immediately after resize
      justFinishedResizingRef.current = true;
      setTimeout(() => {
        justFinishedResizingRef.current = false;
      }, 100);
      
      setIsResizing(null);
      resizeStartRef.current = null;
    }
    
    // Use capture phase to intercept events before they reach other elements
    document.addEventListener("mousemove", handleMouseMove, { capture: true });
    document.addEventListener("mouseup", handleMouseUp, { capture: true });
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, { capture: true });
      document.removeEventListener("mouseup", handleMouseUp, { capture: true });
    };
  }, [isResizing]);

  // Prevent body scroll when modal is open (unless in see-through mode)
  useEffect(() => {
    if (!seeThroughMode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [seeThroughMode]);

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

  // Handle setting post image as banner
  async function handleBannerCropSave(croppedBlob: Blob) {
    setSavingImage(true);
    setShowBannerCrop(false);

    try {
      const fileName = `${user.id}-banner-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, croppedBlob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("users")
        .update({ banner_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      // Notify parent to update UI
      if (onUserBannerUpdated) {
        onUserBannerUpdated(publicUrl);
      }
      alert("Banner updated successfully!");
      onClose(); // Close the entire modal
    } catch (err) {
      console.error("Error saving banner:", err);
      alert("Failed to save banner. Please try again.");
    } finally {
      setSavingImage(false);
      setImageToCrop(null);
    }
  }

  // Handle setting post image as avatar
  async function handleAvatarCropSave(croppedBlob: Blob) {
    setSavingImage(true);
    setShowAvatarCrop(false);

    try {
      const fileName = `avatars/${user.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, croppedBlob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      // Notify parent to update UI
      if (onUserAvatarUpdated) {
        onUserAvatarUpdated(publicUrl);
      }
      alert("Profile picture updated successfully!");
      onClose(); // Close the entire modal
    } catch (err) {
      console.error("Error saving avatar:", err);
      alert("Failed to save profile picture. Please try again.");
    } finally {
      setSavingImage(false);
      setImageToCrop(null);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    // Check if user is banned
    if (isUserBanned) {
      alert("You have been banned from interacting with this community.");
      return;
    }

    setSubmitting(true);
    const trimmedComment = commentText.trim();
    
    // Fetch the commenter's username from the users table
    const { data: commenterData } = await supabase
      .from("users")
      .select("username")
      .eq("id", user.id)
      .single();
    const commenterUsername = commenterData?.username || "unknown";

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
      // Track who gets a reply notification so we don't also send them a mention notification
      let replyNotifiedUserId: string | null = null;
      
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
        // Track who got a reply notification (to skip duplicate mention notification)
        if (parentComment && parentComment.user_id !== user.id) {
          notifyNewReply(supabase, parentComment.user_id, commenterUsername, post.id, data.id, trimmedComment);
          replyNotifiedUserId = parentComment.user_id;
        }
      } else {
        if (post.user_id !== user.id) {
          notifyNewComment(supabase, post.user_id, commenterUsername, post.id, data.id, trimmedComment);
        }
      }

      // Check for @mentions - but skip users who already got a reply notification
      const mentions = parseMentions(trimmedComment);
      if (mentions.length > 0) {
        const userIdMap = await getUserIdsByUsernames(supabase, mentions);
        for (const username of mentions) {
          const mentionedUserId = userIdMap[username.toLowerCase()];
          // Skip if: it's yourself, OR they already got a reply notification for this comment
          if (mentionedUserId && mentionedUserId !== user.id && mentionedUserId !== replyNotifiedUserId) {
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
      
      // Scroll to bottom to show the new comment
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTo({
            top: commentsContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }

    setSubmitting(false);
  }

  function handleReply(commentId: string, username: string, displayName: string) {
    setReplyingTo({ id: commentId, username, displayName });
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
              {comment.users ? (
                <Link
                  href={`/profile/${comment.users.username}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
                  onClick={onClose}
                >
                  {comment.users.avatar_url ? (
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
                      {(comment.users.display_name || comment.users.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: isReply ? 13 : 14, fontWeight: 600, color: "var(--alzooka-cream)" }}>
                      {comment.users.display_name || comment.users.username}
                    </span>
                  </div>
                </Link>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: isReply ? 26 : 28,
                      height: isReply ? 26 : 28,
                      borderRadius: "50%",
                      background: "rgba(120, 120, 120, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255, 255, 255, 0.5)",
                      fontWeight: 700,
                      fontSize: isReply ? 11 : 12,
                    }}
                  >
                    ?
                  </div>
                  <div>
                    <span style={{ fontSize: isReply ? 13 : 14, fontWeight: 600, color: "rgba(240, 235, 224, 0.5)", fontStyle: "italic" }}>
                      [Deleted User]
                    </span>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isGroupAdmin(comment.user_id) && (
                  <span style={{ 
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
                <span className="text-muted" style={{ fontSize: isReply ? 11 : 12 }}>
                  {formatTime(comment.created_at)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleReply(comment.id, comment.users?.username || "deleted", comment.users?.display_name || comment.users?.username || "[Deleted User]")}
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
                  ref={(el) => {
                    // Auto-resize on mount to fit content
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 144) + 'px';
                    }
                  }}
                  value={editingCommentText}
                  onChange={(e) => {
                    setEditingCommentText(e.target.value);
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px';
                  }}
                  rows={1}
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    fontSize: isReply ? 13 : 14,
                    resize: "none",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(240, 235, 224, 0.2)",
                    background: "rgba(0, 0, 0, 0.2)",
                    color: "var(--alzooka-cream)",
                    minHeight: 44,
                    maxHeight: 144,
                    overflowY: "auto",
                    lineHeight: 1.4,
                    fontFamily: "inherit",
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
                  const textContent = renderTextWithQuotes(comment.content, hasAnyPreview, mentionCache);
                  
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
                    // Clean the video ID to remove any trailing special characters
                    const cleanVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
                    const playlistId = extractYouTubePlaylistId(comment.content);
                    const embedUrl = playlistId 
                      ? `https://www.youtube-nocookie.com/embed/${cleanVideoId}?list=${playlistId}&rel=0&modestbranding=1`
                      : `https://www.youtube-nocookie.com/embed/${cleanVideoId}?rel=0&modestbranding=1`;
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
                
                {/* Comment Reactions */}
                <div style={{ marginTop: 8 }}>
                  <ReactionPicker
                    targetType="comment"
                    targetId={comment.id}
                    userId={user.id}
                    ownerId={comment.user_id}
                    supabase={supabase}
                    reactions={commentReactions[comment.id] || []}
                    onReactionsChange={(newReactions) => handleCommentReactionsChange(comment.id, newReactions)}
                    compact
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Don't render on server
  if (!mounted) return null;

  // Compute safe position values - clamp to prevent modal from going completely off-screen
  const safePosition = modalPosition ? {
    x: Math.max(-window.innerWidth + 100, Math.min(window.innerWidth - 100, modalPosition.x)),
    y: Math.max(-window.innerHeight + 100, Math.min(window.innerHeight - 100, modalPosition.y)),
  } : null;

  const modalContent = (
    <div
      onClick={(e) => {
        // Don't close if we were just resizing or dragging
        if (isResizing || isDragging || justFinishedResizingRef.current) return;
        // In multi-window mode with no backdrop, don't close on background click
        if (hideBackdrop) return;
        if (!seeThroughMode) onClose();
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // In multi-window mode, hide backdrop for non-front windows
        background: hideBackdrop ? "transparent" : (seeThroughMode ? "transparent" : "rgba(0, 0, 0, 0.85)"),
        zIndex: propZIndex ?? 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        // In multi-window mode, let clicks pass through to windows behind
        pointerEvents: hideBackdrop ? "none" : (seeThroughMode ? "none" : "auto"),
      }}
    >
      {/* Modal Content */}
      <div
        ref={modalRef}
        onMouseDown={() => {
          // Bring this modal to front when clicked (multi-window mode)
          if (onBringToFront) onBringToFront();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--alzooka-teal-light)",
          borderRadius: 12,
          width: modalSize?.width ?? "100%",
          maxWidth: modalSize ? undefined : 680,
          height: modalSize?.height,
          maxHeight: modalSize ? undefined : "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: seeThroughMode 
            ? "0 4px 20px rgba(0, 0, 0, 0.4)" 
            : "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          animation: safePosition ? "none" : "modalSlideIn 0.2s ease-out",
          // Apply position transform if dragged - use clamped safe position
          transform: safePosition ? `translate(${safePosition.x}px, ${safePosition.y}px)` : undefined,
          cursor: isDragging ? "grabbing" : isResizing ? (
            isResizing === 'n' || isResizing === 's' ? 'ns-resize' :
            isResizing === 'e' || isResizing === 'w' ? 'ew-resize' :
            isResizing === 'ne' || isResizing === 'sw' ? 'nesw-resize' : 'nwse-resize'
          ) : undefined,
          // Re-enable pointer events for the modal itself in see-through mode
          pointerEvents: "auto",
          // Add border in see-through mode so modal is distinguishable
          border: seeThroughMode 
            ? "2px solid rgba(201, 162, 39, 0.6)" 
            : "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Resize Handles */}
        {/* Top edge */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'n')}
          style={{
            position: "absolute",
            top: 0,
            left: 12,
            right: 12,
            height: 6,
            cursor: "ns-resize",
            zIndex: 10,
          }}
        />
        {/* Bottom edge */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 's')}
          style={{
            position: "absolute",
            bottom: 0,
            left: 12,
            right: 12,
            height: 6,
            cursor: "ns-resize",
            zIndex: 10,
          }}
        />
        {/* Left edge */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'w')}
          style={{
            position: "absolute",
            left: 0,
            top: 12,
            bottom: 12,
            width: 6,
            cursor: "ew-resize",
            zIndex: 10,
          }}
        />
        {/* Right edge */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'e')}
          style={{
            position: "absolute",
            right: 0,
            top: 12,
            bottom: 12,
            width: 6,
            cursor: "ew-resize",
            zIndex: 10,
          }}
        />
        {/* Top-left corner */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'nw')}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 12,
            height: 12,
            cursor: "nwse-resize",
            zIndex: 11,
          }}
        />
        {/* Top-right corner */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'ne')}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 12,
            height: 12,
            cursor: "nesw-resize",
            zIndex: 11,
          }}
        />
        {/* Bottom-left corner */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'sw')}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 12,
            height: 12,
            cursor: "nesw-resize",
            zIndex: 11,
          }}
        />
        {/* Bottom-right corner */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'se')}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 12,
            height: 12,
            cursor: "nwse-resize",
            zIndex: 11,
          }}
        />
        {/* Modal Header - Draggable */}
        <div
          onMouseDown={handleDragStart}
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          {/* See-through mode toggle - left side */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSeeThroughMode(!seeThroughMode);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={seeThroughMode ? "Hide background" : "Show background"}
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: seeThroughMode 
                ? "rgba(201, 162, 39, 0.3)" 
                : "rgba(240, 235, 224, 0.1)",
              border: seeThroughMode 
                ? "1px solid rgba(201, 162, 39, 0.5)" 
                : "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: seeThroughMode 
                ? "var(--alzooka-gold)" 
                : "var(--alzooka-cream)",
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            {/* Monkey emoji - hands over eyes vs eyes visible */}
            {seeThroughMode ? "🐵" : "🙈"}
          </button>
          
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
          onMouseDown={handleBackgroundDragStart}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            cursor: isDragging ? "grabbing" : undefined,
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

              {/* Post Images Gallery */}
              {(() => {
                const images = post.image_urls || (post.image_url ? [post.image_url] : []);
                if (images.length === 0) return null;
                
                const isOwnPost = post.user_id === user.id;
                
                if (images.length === 1) {
                  return (
                    <div style={{ 
                      marginBottom: 16,
                      display: "flex",
                      gap: 16,
                      alignItems: "flex-start",
                    }}>
                      <img
                        src={images[0]}
                        alt="Post image"
                        style={{
                          maxWidth: isOwnPost ? "calc(100% - 160px)" : "100%",
                          maxHeight: 400,
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                        onClick={() => window.open(images[0], "_blank")}
                      />
                      
                      {/* Buttons to set as banner/profile picture - only for own posts */}
                      {isOwnPost && (
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          minWidth: 140,
                        }}>
                          <button
                            onClick={() => {
                              setImageToCrop(images[0]);
                              setShowBannerCrop(true);
                            }}
                            disabled={savingImage}
                            style={{
                              background: "var(--alzooka-gold)",
                              border: "none",
                              color: "var(--alzooka-teal-dark)",
                              padding: "10px 12px",
                              borderRadius: 6,
                              cursor: savingImage ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              fontSize: 13,
                              opacity: savingImage ? 0.5 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            🖼️ Make Banner
                          </button>
                          <button
                            onClick={() => {
                              setImageToCrop(images[0]);
                              setShowAvatarCrop(true);
                            }}
                            disabled={savingImage}
                            style={{
                              background: "var(--alzooka-gold)",
                              border: "none",
                              color: "var(--alzooka-teal-dark)",
                              padding: "10px 12px",
                              borderRadius: 6,
                              cursor: savingImage ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              fontSize: 13,
                              opacity: savingImage ? 0.5 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            👤 Make Profile Pic
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
                
                return (
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: images.length === 2 ? "1fr 1fr" : "repeat(3, 1fr)",
                    gap: 4,
                    marginBottom: 16,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}>
                    {images.map((url, idx) => (
                      <div 
                        key={idx} 
                        style={{ position: "relative", paddingTop: "100%" }}
                      >
                        <img 
                          src={url} 
                          alt={`Image ${idx + 1}`}
                          style={{ 
                            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                            objectFit: "cover", cursor: "pointer",
                          }}
                          onClick={() => window.open(url, "_blank")}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* YouTube Video Player */}
              {post.video_url && (() => {
                const videoId = extractYouTubeVideoId(post.video_url);
                if (!videoId) return null;
                // Clean the video ID to remove any trailing special characters
                const cleanVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
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
                        src={`https://www.youtube-nocookie.com/embed/${cleanVideoId}?rel=0&modestbranding=1`}
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
                const urls = (post.content.match(urlRegex) || []).map(url =>
                  // Strip trailing punctuation that might be part of the sentence, not the URL
                  url.replace(/[.,;:!?)]+$/, '')
                );
                const previewUrl = urls.find(url =>
                  !url.match(/youtube\.com|youtu\.be|spotify\.com/i)
                );
                return previewUrl ? (
                  <div style={{ marginBottom: 16 }}>
                    <LinkPreview url={previewUrl} />
                  </div>
                ) : null;
              })()}
              
              {/* Post Reactions */}
              {onPostReactionsChange && (
                <div style={{ marginTop: 12 }}>
                  <ReactionPicker
                    targetType="post"
                    targetId={post.id}
                    userId={user.id}
                    ownerId={post.user_id}
                    supabase={supabase}
                    reactions={postReactions}
                    onReactionsChange={onPostReactionsChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Comments Section Divider */}
          <div
            id="comments-section-header"
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
          onMouseDown={handleBackgroundDragStart}
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(240, 235, 224, 0.1)",
            background: "var(--alzooka-teal-light)",
            borderRadius: "0 0 12px 12px",
            cursor: isDragging ? "grabbing" : undefined,
          }}
        >
          {isUserBanned ? (
            <div style={{ textAlign: "center", color: "#e57373", fontSize: 14 }}>
              🚫 You have been banned from interacting with this community.
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
                  <span>Replying to {replyingTo.displayName}</span>
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
                {/* Input container with avatar inside */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 10,
                    padding: "8px 12px",
                    background: "var(--alzooka-teal-dark)",
                    borderRadius: 20,
                    border: "1px solid rgba(240, 235, 224, 0.15)",
                  }}
                >
                  {/* Current User Avatar */}
                  {currentUserAvatar ? (
                    <img
                      src={currentUserAvatar}
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
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
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {(user.user_metadata?.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <textarea
                    ref={commentInputRef}
                    placeholder={replyingTo ? `Reply to ${replyingTo.displayName}...` : "Write a comment..."}
                    value={commentText}
                    onChange={(e) => {
                      handleCommentTextChange(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px';
                    }}
                    onFocus={clearHighlight}
                    onKeyDown={(e) => {
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
                      padding: "6px 0", 
                      fontSize: 14, 
                      border: "none",
                      background: "transparent",
                      resize: "none",
                      minHeight: 32,
                      maxHeight: 144,
                      overflowY: "auto",
                      lineHeight: 1.4,
                      fontFamily: "inherit",
                      color: "var(--alzooka-cream)",
                      outline: "none",
                    }}
                  />
                  
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
                          const selectedText = text.substring(start, end);
                          const newText = text.substring(0, start) + `"${selectedText}"` + text.substring(end);
                          setCommentText(newText);
                          setTimeout(() => {
                            input.focus();
                            input.setSelectionRange(end + 2, end + 2);
                          }, 0);
                        } else {
                          const newText = text.substring(0, start) + '""' + text.substring(start);
                          setCommentText(newText);
                          setTimeout(() => {
                            input.focus();
                            input.setSelectionRange(start + 1, start + 1);
                          }, 0);
                        }
                      }}
                      style={{
                        background: "var(--alzooka-gold)",
                        border: "none",
                        color: "var(--alzooka-teal-dark)",
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        cursor: "pointer",
                        fontSize: 18,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        opacity: 0.75,
                      }}
                    >
                      "
                    </button>
                  </Tooltip>
                  
                  {/* Emoji Button */}
                  <EmojiButton
                    buttonSize={32}
                    onEmojiSelect={(emoji) => {
                      const input = commentInputRef.current;
                      if (input) {
                        const start = input.selectionStart || 0;
                        const end = input.selectionEnd || 0;
                        const newText = commentText.slice(0, start) + emoji + commentText.slice(end);
                        setCommentText(newText);
                        setTimeout(() => {
                          input.focus();
                          input.setSelectionRange(start + emoji.length, start + emoji.length);
                        }, 0);
                      } else {
                        setCommentText(commentText + emoji);
                      }
                    }}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  style={{ padding: "12px 20px", fontSize: 14, borderRadius: 24 }}
                >
                  {submitting ? "..." : replyingTo ? "Reply" : "Post"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      
      {/* Banner Crop Modal - stop propagation to prevent closing */}
      {showBannerCrop && imageToCrop && (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
          <BannerCropModal
            imageSrc={imageToCrop}
            onCancel={() => {
              setShowBannerCrop(false);
              setImageToCrop(null);
            }}
            onSave={handleBannerCropSave}
          />
        </div>
      )}
      
      {/* Avatar Crop Modal - stop propagation to prevent closing */}
      {showAvatarCrop && imageToCrop && (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
          <AvatarCropModal
            imageSrc={imageToCrop}
            onCancel={() => {
              setShowAvatarCrop(false);
              setImageToCrop(null);
            }}
            onSave={handleAvatarCropSave}
          />
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

