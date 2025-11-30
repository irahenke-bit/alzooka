"use client";

import { useState, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";

type AvatarUploadProps = {
  currentAvatarUrl: string | null;
  userId: string;
  onUpload: (url: string) => void;
};

export function AvatarUpload({ currentAvatarUrl, userId, onUpload }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Create unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

      onUpload(publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
        disabled={uploading}
      />

      {/* Avatar display with upload trigger */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: currentAvatarUrl 
            ? `url(${currentAvatarUrl}) center/cover`
            : "var(--alzooka-teal-dark)",
          border: "3px solid var(--alzooka-gold)",
          cursor: uploading ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          color: "var(--alzooka-gold)",
          padding: 0,
          position: "relative",
          overflow: "hidden",
        }}
        title="Click to change avatar"
      >
        {/* Placeholder initial if no avatar */}
        {!currentAvatarUrl && !uploading && (
          <span style={{ opacity: 0.8 }}>+</span>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(26, 58, 74, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--alzooka-cream)",
            }}
          >
            ...
          </div>
        )}

        {/* Hover overlay */}
        {!uploading && currentAvatarUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(26, 58, 74, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--alzooka-cream)",
              opacity: 0,
              transition: "opacity 0.2s",
            }}
            className="avatar-hover-overlay"
          >
            Change
          </div>
        )}
      </button>

      {/* Error message */}
      {error && (
        <p style={{ 
          color: "#e57373", 
          fontSize: 12, 
          marginTop: 8,
          textAlign: "center",
          maxWidth: 100,
        }}>
          {error}
        </p>
      )}

      <style jsx>{`
        button:hover .avatar-hover-overlay {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

