"use client";

import { useState, useRef } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { moderateImageBase64, getBlockedMessage } from "@/lib/imageModeration";

// Banner aspect ratio (width:height) - 2:1 allows using ~50% of a square image
// Much more generous while still looking like a banner
const BANNER_ASPECT = 2 / 1;

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onSave: (croppedBlob: Blob) => void;
  skipModeration?: boolean; // Optional: skip moderation if already done (e.g., for post images)
};

// Create a centered crop with the banner aspect ratio
function createInitialCrop(mediaWidth: number, mediaHeight: number): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      BANNER_ASPECT,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function BannerCropModal({ imageSrc, onCancel, onSave, skipModeration = false }: Props) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [saving, setSaving] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initialCrop = createInitialCrop(width, height);
    setCrop(initialCrop);
  }

  async function handleSave() {
    if (!completedCrop || !imgRef.current) return;

    setSaving(true);
    setModerationError(null);
    
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("No 2d context");
      }

      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      // Use the ACTUAL image dimensions, not the displayed size
      const sourceX = completedCrop.x * scaleX;
      const sourceY = completedCrop.y * scaleY;
      const sourceWidth = completedCrop.width * scaleX;
      const sourceHeight = completedCrop.height * scaleY;

      // Canvas should be the full resolution of the cropped area
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(
        imgRef.current,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
      );

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.95);
      });

      if (!blob) {
        alert("Failed to crop image");
        setSaving(false);
        return;
      }

      // STEP 1: Moderate image BEFORE passing to parent (unless skipped)
      if (!skipModeration) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data URL prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const moderationResult = await moderateImageBase64(base64);
        
        if (moderationResult.blocked) {
          const message = getBlockedMessage(moderationResult);
          setModerationError(message);
          setSaving(false);
          return;
        }
      }

      // STEP 2: Pass to parent (only if moderation passed)
      onSave(blob);
    } catch (error) {
      console.error("Error cropping image:", error);
      alert("Failed to crop image");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.95)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ 
        padding: "16px 24px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.1)"
      }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "#ffffff" }}>Crop your banner</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "rgba(255,255,255,0.7)",
              padding: "8px 20px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !completedCrop}
            style={{
              background: "var(--accent)",
              border: "none",
              color: "black",
              padding: "8px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              opacity: saving || !completedCrop ? 0.5 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Crop Area */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        overflow: "auto",
        padding: "20px"
      }}>
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={BANNER_ASPECT}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
            onLoad={onImageLoad}
            style={{
              maxWidth: "100%",
              maxHeight: "calc(100vh - 200px)",
              display: "block",
            }}
            crossOrigin="anonymous"
          />
        </ReactCrop>
      </div>

      {/* Moderation Error */}
      {moderationError && (
        <p style={{ 
          textAlign: "center", 
          color: "#2563eb", 
          fontSize: 14, 
          margin: 0,
          padding: "8px 16px",
          background: "rgba(229, 115, 115, 0.1)",
        }}>
          {moderationError}
        </p>
      )}

      {/* Instructions */}
      <p style={{ 
        textAlign: "center", 
        color: "rgba(255,255,255,0.6)", 
        fontSize: 14, 
        margin: 0,
        padding: "16px"
      }}>
        Drag the corners to resize • Drag inside to reposition
      </p>
    </div>
  );
}
