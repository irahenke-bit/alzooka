"use client";

import { useState, useRef, useEffect } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

// Reaction types with their emojis
export const REACTION_TYPES = {
  smile: "😊",
  sad: "😢",
  facepalm: "🤦",
  surprised: "😮",
  laugh: "😂",
  heart: "❤️",
} as const;

export type ReactionType = keyof typeof REACTION_TYPES;

type Reaction = {
  id: string;
  user_id: string;
  post_id: string;
  reaction_type: ReactionType;
  created_at: string;
  users?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type Props = {
  postId: string;
  userId: string | null;
  supabase: SupabaseClient;
  reactions: Reaction[];
  onReactionsChange: (reactions: Reaction[]) => void;
};

const MAX_REACTIONS_PER_USER = 3;

export function ReactionPicker({ postId, userId, supabase, reactions, onReactionsChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showWhoReacted, setShowWhoReacted] = useState<ReactionType | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const whoReactedRef = useRef<HTMLDivElement>(null);

  // Get user's current reactions for this post
  const userReactions = reactions.filter(r => r.user_id === userId);
  const userReactionTypes = new Set(userReactions.map(r => r.reaction_type));

  // Count reactions by type
  const reactionCounts: Record<ReactionType, number> = {
    smile: 0,
    sad: 0,
    facepalm: 0,
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
      const { data, error } = await supabase
        .from("reactions")
        .insert({
          user_id: userId,
          post_id: postId,
          reaction_type: reactionType,
        })
        .select(`
          id, user_id, post_id, reaction_type, created_at,
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

    setIsOpen(false);
  }

  // Get users who reacted with a specific type
  function getUsersForReaction(reactionType: ReactionType) {
    return reactions
      .filter(r => r.reaction_type === reactionType)
      .map(r => r.users?.display_name || r.users?.username || "Unknown");
  }

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
      {/* React Button */}
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
        >
          <span style={{ fontSize: 16 }}>😊</span>
          React
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
                  title={isDisabled ? "Max 3 reactions per post" : type}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>

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

