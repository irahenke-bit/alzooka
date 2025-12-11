"use client";

import { useState, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";

type AvatarUploadProps = {
  currentAvatarUrl: string | null;
  userId: string;
  onUpload: (url: string) => void;
};

// Resize image to target size while maintaining quality
async function resizeImage(file: File, targetSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      // Calculate dimensions for center crop
      const size = Math.min(img.width, img.height);
      const offsetX = (img.width - size) / 2;
      const offsetY = (img.height - size) / 2;

      canvas.width = targetSize;
      canvas.height = targetSize;

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Use high quality settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw cropped and resized image
      ctx.drawImage(
        img,
        offsetX, offsetY, size, size,  // Source crop
        0, 0, targetSize, targetSize    // Destination
      );

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not create blob"));
          }
        },
        "image/jpeg",
        0.92  // High quality JPEG
      );
    };

    img.onerror = () => reject(new Error("Could not load image"));
    img.src = URL.createObjectURL(file);
  });
}

export function AvatarUpload({ currentAvatarUrl, userId, onUpload }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isHovered, setIsHovered] = useState(false);
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

    // Validate file size (max 10MB for original - we'll resize it)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Resize image to 400x400 for crisp display at all sizes
      const resizedBlob = await resizeImage(file, 400);
      
      // Create unique filename
      const fileName = `${userId}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Upload resized image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, resizedBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
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
      setIsHovered(false); // Reset hover state after upload
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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
        {!uploading && currentAvatarUrl && isHovered && (
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
              pointerEvents: "none",
            }}
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
    </div>
  );
}
