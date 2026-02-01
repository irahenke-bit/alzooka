"use client";

import { useState, useRef, useEffect } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";

interface EmojiButtonProps {
  onEmojiSelect: (emoji: string) => void;
  buttonSize?: number;
  direction?: "up" | "down";
}

export function EmojiButton({ onEmojiSelect, buttonSize = 32, direction = "up" }: EmojiButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false);
      }
    }

    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPicker]);

  function handleEmojiClick(emojiData: EmojiClickData) {
    onEmojiSelect(emojiData.emoji);
    // Don't close - allow rapid multi-emoji selection
    // User clicks outside to close
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        title="Add emoji"
        style={{
          background: "var(--border-subtle)",
          border: "none",
          color: "#ffffff",
          width: buttonSize,
          height: buttonSize,
          borderRadius: "50%",
          cursor: "pointer",
          fontSize: buttonSize * 0.55,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.75,
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.75")}
      >
        😀
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          style={{
            position: "absolute",
            ...(direction === "down" 
              ? { top: buttonSize + 8, left: 0 }
              : { bottom: buttonSize + 8, right: 0 }
            ),
            zIndex: 1000,
          }}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.DARK}
            width={320}
            height={400}
            searchPlaceholder="Search emojis..."
            previewConfig={{ showPreview: false }}
            skinTonesDisabled={true}
          />
        </div>
      )}
    </div>
  );
}
