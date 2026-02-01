"use client";

import { useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

// Common words that could unintentionally filter too much content
const COMMON_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "because", "is", "are", "was", "were",
  "it", "this", "that", "to", "of", "in", "for", "on", "with", "as", "at",
  "by", "be", "i", "you", "he", "she", "we", "they", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "can", "if", "then", "so", "just", "only", "also", "very", "too", "not",
  "no", "yes", "all", "any", "some", "my", "your", "his", "her", "our", "their",
  "what", "who", "how", "when", "where", "why", "which", "there", "here",
  "from", "into", "about", "up", "down", "out", "off", "over", "under",
]);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  supabase: SupabaseClient;
  filteredWords: string[];
  onWordsUpdated: (words: string[]) => void;
}

export function ContentFilterModal({
  isOpen,
  onClose,
  userId,
  supabase,
  filteredWords,
  onWordsUpdated,
}: Props) {
  const [newWord, setNewWord] = useState("");
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState<string | null>(null);
  const [pendingWord, setPendingWord] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddWord = async (word: string, bypassWarning = false) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;

    // Check if already exists
    if (filteredWords.some(w => w.toLowerCase() === trimmed)) {
      setNewWord("");
      return;
    }

    // Check for common words
    if (!bypassWarning && COMMON_WORDS.has(trimmed)) {
      setShowWarning(trimmed);
      setPendingWord(trimmed);
      return;
    }

    setSaving(true);
    const updatedWords = [...filteredWords, trimmed];

    const { error } = await supabase
      .from("users")
      .update({ filtered_words: updatedWords })
      .eq("id", userId);

    if (!error) {
      onWordsUpdated(updatedWords);
      setNewWord("");
    }
    setSaving(false);
    setShowWarning(null);
    setPendingWord(null);
  };

  const handleRemoveWord = async (wordToRemove: string) => {
    setSaving(true);
    const updatedWords = filteredWords.filter(w => w !== wordToRemove);

    const { error } = await supabase
      .from("users")
      .update({ filtered_words: updatedWords })
      .eq("id", userId);

    if (!error) {
      onWordsUpdated(updatedWords);
    }
    setSaving(false);
  };

  const handleConfirmCommonWord = () => {
    if (pendingWord) {
      handleAddWord(pendingWord, true);
    }
  };

  const handleCancelWarning = () => {
    setShowWarning(null);
    setPendingWord(null);
    setNewWord("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "black",
          borderRadius: 12,
          width: "100%",
          maxWidth: 480,
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>🚫 Content Filter</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              fontSize: 24,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          <p style={{ margin: "0 0 16px 0", fontSize: 14, opacity: 0.8 }}>
            Add words or phrases to filter from your feed and communities. Posts containing these words will be hidden.
          </p>

          {/* Warning Modal */}
          {showWarning && (
            <div
              style={{
                background: "rgba(255, 193, 7, 0.15)",
                border: "1px solid rgba(255, 193, 7, 0.4)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <p style={{ margin: "0 0 12px 0", fontSize: 14 }}>
                ⚠️ <strong>&quot;{showWarning}&quot;</strong> is a very common word. Filtering it may hide most content. Are you sure?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleConfirmCommonWord}
                  style={{
                    background: "var(--accent)",
                    color: "black",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Add Anyway
                </button>
                <button
                  onClick={handleCancelWarning}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-hover)",
                    color: "rgba(255,255,255,0.7)",
                    borderRadius: 6,
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add Word Input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) {
                  handleAddWord(newWord);
                }
              }}
              placeholder="Enter word or phrase to filter..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--border-subtle)",
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
              }}
            />
            <button
              onClick={() => handleAddWord(newWord)}
              disabled={saving || !newWord.trim()}
              style={{
                background: "var(--accent)",
                color: "black",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                cursor: saving || !newWord.trim() ? "not-allowed" : "pointer",
                fontWeight: 600,
                opacity: saving || !newWord.trim() ? 0.5 : 1,
              }}
            >
              Add
            </button>
          </div>

          {/* Current Filters List */}
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, opacity: 0.7 }}>
              Filtered Words ({filteredWords.length})
            </h3>
            {filteredWords.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>
                No words filtered yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {filteredWords.map((word) => (
                  <div
                    key={word}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--border-subtle)",
                      borderRadius: 20,
                      padding: "6px 12px",
                      fontSize: 14,
                    }}
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => handleRemoveWord(word)}
                      disabled={saving}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "rgba(255,255,255,0.7)",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: 16,
                        lineHeight: 1,
                      }}
                      title="Remove filter"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Hell Mode */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-subtle)",
            background: "rgba(0, 0, 0, 0.1)",
          }}
        >
          <a
            href="/hell-mode"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              background: "rgba(139, 0, 0, 0.3)",
              border: "1px solid rgba(139, 0, 0, 0.5)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            🔥 Hell Mode (view all filtered content)
          </a>
        </div>
      </div>
    </div>
  );
}
