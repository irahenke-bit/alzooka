"use client";

import { useState, useRef, useEffect } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

// Reaction types with their emojis
export const REACTION_TYPES = {
  smile: "😊",
  sad: "😢",
  eyeroll: "🙄",
  grimace: "😬",
  surprised: "😮",
  laugh: "😂",
  heart: "❤️",
} as const;

export type ReactionType = keyof typeof REACTION_TYPES;

export type Reaction = {
  id: string;
  user_id: string;
  post_id?: string | null;
  comment_id?: string | null;
  reaction_type: ReactionType;
  created_at: string;
  users?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type Props = {
  targetType: "post" | "comment";
  targetId: string;
  userId: string | null;
  ownerId: string;
  supabase: SupabaseClient;
  reactions: Reaction[];
  onReactionsChange: (reactions: Reaction[]) => void;
  compact?: boolean; // For smaller display in comments
};

const MAX_REACTIONS_PER_USER = 3;

export function ReactionPicker({ targetType, targetId, userId, ownerId, supabase, reactions, onReactionsChange, compact = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showWhoReacted, setShowWhoReacted] = useState<ReactionType | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const whoReactedRef = useRef<HTMLDivElement>(null);

  // Check if user is the owner (can't react to own posts/comments)
  const isOwn = userId === ownerId;

  // Get user's current reactions for this post
  const userReactions = reactions.filter(r => r.user_id === userId);
  const userReactionTypes = new Set(userReactions.map(r => r.reaction_type));

  // Count reactions by type
  const reactionCounts: Record<ReactionType, number> = {
    smile: 0,
    sad: 0,
    eyeroll: 0,
    grimace: 0,
    surprised: 0,
    laugh: 0,
    heart: 0,
  };
  reactions.forEach(r => {
    if (r.reaction_type in reactionCounts) {
      reactionCounts[r.reaction_type]++;
    }
  });

  // Get total reaction count
  const totalReactions = reactions.length;

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (whoReactedRef.current && !whoReactedRef.current.contains(event.target as Node)) {
        setShowWhoReacted(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleReaction(reactionType: ReactionType) {
    if (!userId) return;

    const existingReaction = userReactions.find(r => r.reaction_type === reactionType);

    if (existingReaction) {
      // Remove reaction
      await supabase.from("reactions").delete().eq("id", existingReaction.id);
      onReactionsChange(reactions.filter(r => r.id !== existingReaction.id));
    } else {
      // Check if user has reached max reactions
      if (userReactions.length >= MAX_REACTIONS_PER_USER) {
        // Could show a toast here, but for now just don't add
        return;
      }

      // Add reaction
      const insertData = {
        user_id: userId,
        reaction_type: reactionType,
        ...(targetType === "post" ? { post_id: targetId } : { comment_id: targetId }),
      };
      
      const { data, error } = await supabase
        .from("reactions")
        .insert(insertData)
        .select(`
          id, user_id, post_id, comment_id, reaction_type, created_at,
          users (username, display_name, avatar_url)
        `)
        .single();

      if (!error && data) {
        // Handle users being returned as array by Supabase
        const normalizedData = {
          ...data,
          users: Array.isArray(data.users) ? data.users[0] : data.users,
        } as Reaction;
        onReactionsChange([...reactions, normalizedData]);
      }
    }
    // Picker stays open - only closes when clicking outside
  }

  // Get users who reacted with a specific type
  function getUsersForReaction(reactionType: ReactionType) {
    return reactions
      .filter(r => r.reaction_type === reactionType)
      .map(r => r.users?.display_name || r.users?.username || "Unknown");
  }

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
      {/* React Button - hidden for own posts/comments */}
      {!isOwn && (
      <div ref={pickerRef} style={{ position: "relative" }}>
        <button
          onClick={() => userId && setIsOpen(!isOpen)}
          disabled={!userId}
          style={{
            background: "transparent",
            color: "var(--alzooka-cream)",
            padding: "4px 0",
            fontSize: 14,
            border: "none",
            opacity: userId ? 0.7 : 0.4,
            cursor: userId ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          onMouseEnter={(e) => userId && (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => userId && (e.currentTarget.style.opacity = "0.7")}
          title="Add reaction"
        >
          {/* Smiley face outline icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>

        {/* Emoji Picker Popup */}
        {isOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              marginBottom: 8,
              background: "var(--alzooka-teal-light)",
              border: "1px solid rgba(240, 235, 224, 0.2)",
              borderRadius: 24,
              padding: "8px 12px",
              display: "flex",
              gap: 4,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 100,
            }}
          >
            {(Object.entries(REACTION_TYPES) as [ReactionType, string][]).map(([type, emoji]) => {
              const isSelected = userReactionTypes.has(type);
              const isDisabled = !isSelected && userReactions.length >= MAX_REACTIONS_PER_USER;
              
              return (
                <button
                  key={type}
                  onClick={() => !isDisabled && toggleReaction(type)}
                  disabled={isDisabled}
                  style={{
                    background: isSelected ? "rgba(212, 168, 75, 0.3)" : "transparent",
                    border: "none",
                    borderRadius: "50%",
                    width: 40,
                    height: 40,
                    fontSize: 24,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.4 : 1,
                    transition: "transform 0.15s, background 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled) {
                      e.currentTarget.style.transform = "scale(1.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                    title={isDisabled ? `Max 3 reactions per ${targetType}` : type}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Reaction Counts Display */}
      {totalReactions > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {(Object.entries(REACTION_TYPES) as [ReactionType, string][])
            .filter(([type]) => reactionCounts[type] > 0)
            .map(([type, emoji]) => (
              <div
                key={type}
                ref={showWhoReacted === type ? whoReactedRef : undefined}
                style={{ position: "relative" }}
              >
                <button
                  onClick={() => setShowWhoReacted(showWhoReacted === type ? null : type)}
                  style={{
                    background: "rgba(240, 235, 224, 0.1)",
                    border: "none",
                    borderRadius: 12,
                    padding: "2px 6px",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    color: "var(--alzooka-cream)",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                  <span style={{ opacity: 0.8 }}>{reactionCounts[type]}</span>
                </button>

                {/* Who Reacted Popup */}
                {showWhoReacted === type && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      marginBottom: 8,
                      background: "var(--alzooka-teal-dark)",
                      border: "1px solid rgba(240, 235, 224, 0.2)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                      zIndex: 101,
                      minWidth: 120,
                      maxWidth: 200,
                      maxHeight: 200,
                      overflowY: "auto",
                    }}
                  >
                    <p style={{ 
                      margin: "0 0 8px 0", 
                      fontSize: 12, 
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                      paddingBottom: 6,
                    }}>
                      {emoji} {type.charAt(0).toUpperCase() + type.slice(1)}
                    </p>
                    {getUsersForReaction(type).map((name, i) => (
                      <p key={i} style={{ margin: "4px 0", fontSize: 12, opacity: 0.9 }}>
                        {name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

