"use client";

import { useState, useRef, useEffect } from "react";
import { EmojiButton } from "./EmojiButton";

// YouTube URL detection
function findYouTubeUrl(text: string): string | null {
  const urlPattern = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+)/i;
  const match = text.match(urlPattern);
  return match ? match[1] : null;
}

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

// Spotify URL detection
function findSpotifyUrl(text: string): string | null {
  const urlPattern = /(https?:\/\/open\.spotify\.com\/(?:track|album|playlist|episode|show)\/[^\s]+)/i;
  const match = text.match(urlPattern);
  return match ? match[1] : null;
}

function getSpotifyType(url: string): string | null {
  const match = url.match(/spotify\.com\/(track|album|playlist|episode|show)\//);
  return match ? match[1] : null;
}

type YouTubePreview = {
  videoId: string;
  url: string;
  title: string;
  searchQuery?: string;
};

type SpotifyPreview = {
  url: string;
  title: string;
  thumbnail: string;
  type: string;
  searchQuery?: string;
};

type ComposerProps = {
  userAvatarUrl?: string | null;
  username?: string | null;
  placeholder?: string;
  maxLength?: number;
  onPost: (data: {
    content: string;
    images: File[];
    youtubePreview: YouTubePreview | null;
    spotifyPreview: SpotifyPreview | null;
  }) => Promise<void>;
  onYouTubeSearch?: () => void;
  onSpotifySearch?: () => void;
  // Allow external control of previews (for search modals)
  externalYoutubePreview?: YouTubePreview | null;
  externalSpotifyPreview?: SpotifyPreview | null;
  onExternalYoutubePreviewClear?: () => void;
  onExternalSpotifyPreviewClear?: () => void;
};

export function Composer({
  userAvatarUrl,
  username,
  placeholder = "What's on your mind? Paste a YouTube or Spotify link to share",
  maxLength = 500,
  onPost,
  onYouTubeSearch,
  onSpotifySearch,
  externalYoutubePreview,
  externalSpotifyPreview,
  onExternalYoutubePreviewClear,
  onExternalSpotifyPreviewClear,
}: ComposerProps) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [youtubePreview, setYoutubePreview] = useState<YouTubePreview | null>(null);
  const [spotifyPreview, setSpotifyPreview] = useState<SpotifyPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Use external previews if provided
  const activeYoutubePreview = externalYoutubePreview || youtubePreview;
  const activeSpotifyPreview = externalSpotifyPreview || spotifyPreview;

  const canPost = content.trim() || activeYoutubePreview || activeSpotifyPreview || selectedImages.length > 0;

  async function handleContentChange(newContent: string) {
    setContent(newContent);
    
    // Check for YouTube URL if we don't already have a preview
    if (!activeYoutubePreview && !activeSpotifyPreview && !loadingPreview) {
      const youtubeUrl = findYouTubeUrl(newContent);
      if (youtubeUrl) {
        const videoId = extractYouTubeVideoId(youtubeUrl);
        if (videoId) {
          setLoadingPreview(true);
          try {
            const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(youtubeUrl)}`);
            const data = await response.json();
            const title = data.title || "YouTube Video";
            setYoutubePreview({ videoId, url: youtubeUrl, title });
          } catch {
            setYoutubePreview({ videoId, url: youtubeUrl, title: "YouTube Video" });
          }
          setLoadingPreview(false);
        }
        return;
      }

      // Check for Spotify URL
      const spotifyUrl = findSpotifyUrl(newContent);
      if (spotifyUrl) {
        const spotifyType = getSpotifyType(spotifyUrl);
        if (spotifyType) {
          setLoadingPreview(true);
          try {
            const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
            const data = await response.json();
            setSpotifyPreview({
              url: spotifyUrl,
              title: data.title || "Spotify",
              thumbnail: data.thumbnail_url || "",
              type: spotifyType,
            });
          } catch {
            // Ignore errors
          }
          setLoadingPreview(false);
        }
      }
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const newImages = [...selectedImages, ...files].slice(0, 10);
    setSelectedImages(newImages);
    
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImagePreviews(newPreviews);
    
    e.target.value = "";
  }

  function removeImage(index: number) {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    
    URL.revokeObjectURL(imagePreviews[index]);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImagePreviews(newPreviews);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;
    
    const newImages = [...selectedImages, ...files].slice(0, 10);
    setSelectedImages(newImages);
    
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImagePreviews(newPreviews);
  }

  function clearYoutubePreview() {
    if (externalYoutubePreview && onExternalYoutubePreviewClear) {
      onExternalYoutubePreviewClear();
    } else {
      setYoutubePreview(null);
    }
  }

  function clearSpotifyPreview() {
    if (externalSpotifyPreview && onExternalSpotifyPreviewClear) {
      onExternalSpotifyPreviewClear();
    } else {
      setSpotifyPreview(null);
    }
  }

  async function handlePost() {
    if (!canPost || posting) return;
    
    setPosting(true);
    try {
      await onPost({
        content: content.trim(),
        images: selectedImages,
        youtubePreview: activeYoutubePreview,
        spotifyPreview: activeSpotifyPreview,
      });
      
      // Clear form on success
      setContent("");
      setSelectedImages([]);
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImagePreviews([]);
      setYoutubePreview(null);
      setSpotifyPreview(null);
    } finally {
      setPosting(false);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <div style={{ 
      marginBottom: 24, 
      padding: 16,
      background: "#111111",
      border: "1px solid rgba(255,255,255,0.04)",
      borderRadius: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    }}>
      {/* Input container with avatar inside */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 16px",
          background: "#1a1a1a",
          borderRadius: 12,
          border: isDraggingOver ? "2px solid var(--accent)" : "1px solid rgba(255,255,255,0.1)",
          marginBottom: 20,
          position: "relative",
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setIsDraggingOver(true)}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setIsDraggingOver(false);
        }}
        onDrop={handleDrop}
      >
        {/* Left column - Avatar, Emoji, Quote */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {userAvatarUrl ? (
            <img
              src={userAvatarUrl}
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
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {username?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          
          {/* Emoji Button */}
          <EmojiButton
            direction="down"
            buttonSize={28}
            onEmojiSelect={(emoji) => {
              const textarea = textareaRef.current;
              if (textarea) {
                const start = textarea.selectionStart || 0;
                const end = textarea.selectionEnd || 0;
                const newContent = content.slice(0, start) + emoji + content.slice(end);
                setContent(newContent);
                setTimeout(() => {
                  textarea.focus();
                  textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                }, 0);
              } else {
                setContent(content + emoji);
              }
            }}
          />
          
          {/* Quote Button */}
          <button
            type="button"
            title="Insert quote"
            onClick={() => {
              const textarea = textareaRef.current;
              if (!textarea) return;
              const start = textarea.selectionStart || 0;
              const end = textarea.selectionEnd || 0;
              if (start !== end) {
                const selectedText = content.substring(start, end);
                const newText = content.substring(0, start) + `"${selectedText}"` + content.substring(end);
                setContent(newText);
                setTimeout(() => {
                  textarea.focus();
                  textarea.setSelectionRange(end + 2, end + 2);
                }, 0);
              } else {
                const newText = content.substring(0, start) + '""' + content.substring(start);
                setContent(newText);
                setTimeout(() => {
                  textarea.focus();
                  textarea.setSelectionRange(start + 1, start + 1);
                }, 0);
              }
            }}
            style={{
              background: "#333333",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#ffffff",
              width: 28,
              height: 28,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            "
          </button>
        </div>
        
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          maxLength={maxLength}
          style={{ 
            flex: 1,
            resize: "vertical",
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            lineHeight: 1.5,
            outline: "none",
            minHeight: 60,
          }}
        />
        
        {isDraggingOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(201, 162, 92, 0.15)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ 
              background: "rgba(255,255,255,0.1)", 
              color: "#ffffff",
              padding: "8px 16px",
              borderRadius: 20,
              fontWeight: 600,
              fontSize: 14,
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              📷 Drop images here
            </span>
          </div>
        )}
      </div>

      {/* Image Previews */}
      {imagePreviews.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {imagePreviews.map((preview, index) => (
            <div key={index} style={{ position: "relative" }}>
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8 }}
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          ))}
          {imagePreviews.length < 10 && (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              style={{
                width: 100,
                height: 100,
                borderRadius: 8,
                border: "2px dashed var(--border-hover)",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          )}
        </div>
      )}
      
      {/* YouTube Preview */}
      {loadingPreview && (
        <div style={{ marginBottom: 12, padding: 12, background: "rgba(240, 235, 224, 0.05)", borderRadius: 8 }}>
          <p style={{ margin: 0, opacity: 0.6 }}>Loading video preview...</p>
        </div>
      )}
      {activeYoutubePreview && (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <div style={{
            background: "var(--bg-card)",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border-default)"
          }}>
            <img
              src={`https://img.youtube.com/vi/${activeYoutubePreview.videoId}/hqdefault.jpg`}
              alt="YouTube thumbnail"
              style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>
                YouTube.com
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                {activeYoutubePreview.title}
              </p>
            </div>
          </div>
          <button
            onClick={clearYoutubePreview}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0, 0, 0, 0.7)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {activeSpotifyPreview && (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <div style={{
            background: "var(--bg-card)",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
          }}>
            <img
              src={activeSpotifyPreview.thumbnail}
              alt=""
              style={{ width: 80, height: 80, borderRadius: 4, objectFit: "cover" }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#1DB954" }}>
                SPOTIFY
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                {activeSpotifyPreview.title}
              </p>
            </div>
          </div>
          <button
            onClick={clearSpotifyPreview}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0, 0, 0, 0.7)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      )}
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>
          {content.length}/{maxLength}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {onYouTubeSearch && (
            <button
              type="button"
              onClick={onYouTubeSearch}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.85)",
                padding: "8px 16px",
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <rect width="20" height="14" rx="3" fill="#FF0000"/>
                <path d="M8 10V4L13 7L8 10Z" fill="white"/>
              </svg>
              YouTube
            </button>
          )}
          {onSpotifySearch && (
            <button
              type="button"
              onClick={onSpotifySearch}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.85)",
                padding: "8px 16px",
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Spotify
            </button>
          )}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.85)",
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📷 Photo
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
          <button
            onClick={handlePost}
            disabled={!canPost || posting}
            style={{
              background: !canPost ? "#252525" : "#3a4553",
              color: !canPost ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.95)",
              border: "none",
              cursor: !canPost ? "not-allowed" : "pointer",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {posting ? "Posting..." : "POST"}
          </button>
        </div>
      </div>
    </div>
  );
}
