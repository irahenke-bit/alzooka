"use client";

import { useState, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { AvatarCropModal } from "./AvatarCropModal";
import { moderateImageBase64, getBlockedMessage } from "@/lib/imageModeration";

type AvatarUploadProps = {
  currentAvatarUrl: string | null;
  userId: string;
  onUpload: (url: string) => void;
};

export function AvatarUpload({ currentAvatarUrl, userId, onUpload }: AvatarUploadProps) {
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
      // STEP 1: Moderate image BEFORE uploading
      // Convert blob to base64 for moderation
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data URL prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(croppedBlob);
      });

      const moderationResult = await moderateImageBase64(base64);
      
      if (moderationResult.blocked) {
        const message = getBlockedMessage(moderationResult);
        setError(message);
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      // STEP 2: Upload cropped image (only if moderation passed)
      const fileName = `${userId}-${Date.now()}.jpg`;
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
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: currentAvatarUrl 
            ? `url(${currentAvatarUrl}) center/cover`
            : "black",
          border: "3px solid var(--accent)",
          cursor: uploading ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          color: "var(--accent)",
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
              color: "#ffffff",
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
              color: "#ffffff",
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
          color: "#0165FC", 
          fontSize: 12, 
          marginTop: 8,
          textAlign: "center",
          maxWidth: 100,
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
