"use client";

import { useState, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { AvatarCropModal } from "./AvatarCropModal";

type GroupAvatarUploadProps = {
  currentAvatarUrl: string | null;
  groupId: string;
  groupName: string;
  onUpload: (url: string) => void;
};

export function GroupAvatarUpload({ currentAvatarUrl, groupId, groupName, onUpload }: GroupAvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError("");
    
    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setShowCropModal(true);
  }

  function handleCropCancel() {
    setShowCropModal(false);
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
    }
    setImageToCrop(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleCropSave(croppedBlob: Blob) {
    setShowCropModal(false);
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
    }
    setImageToCrop(null);
    setUploading(true);

    try {
      // Create unique filename
      const fileName = `group-${groupId}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Upload cropped image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
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

      // Update group with new avatar URL
      const { error: updateError } = await supabase
        .from("groups")
        .update({ avatar_url: publicUrl })
        .eq("id", groupId);

      if (updateError) {
        throw updateError;
      }

      onUpload(publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
      setIsHovered(false);
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
          width: 90,
          height: 90,
          borderRadius: 12,
          background: currentAvatarUrl 
            ? `url(${currentAvatarUrl}) center/cover`
            : "var(--alzooka-gold)",
          border: "4px solid var(--alzooka-gold)",
          cursor: uploading ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          color: "var(--alzooka-teal-dark)",
          fontWeight: 700,
          padding: 0,
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
        title="Click to change group avatar"
      >
        {/* Placeholder initial if no avatar */}
        {!currentAvatarUrl && !uploading && (
          <span style={{ opacity: 0.8 }}>{groupName.charAt(0).toUpperCase()}</span>
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
        {!uploading && isHovered && (
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
            {currentAvatarUrl ? "Change" : "Upload"}
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
          maxWidth: 90,
        }}>
          {error}
        </p>
      )}

      {/* Crop Modal */}
      {showCropModal && imageToCrop && (
        <AvatarCropModal
          imageSrc={imageToCrop}
          onCancel={handleCropCancel}
          onSave={handleCropSave}
        />
      )}
    </div>
  );
}
