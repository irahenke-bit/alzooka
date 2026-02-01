"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onSave: (croppedBlob: Blob) => void;
};

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      1, // 1:1 aspect ratio for square
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function AvatarCropModal({ imageSrc, onCancel, onSave }: Props) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }

  async function handleSave() {
    if (!completedCrop || !imgRef.current) return;

    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("No 2d context");
      }

      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      // Output at 400x400 for crisp display
      const outputSize = 400;
      canvas.width = outputSize;
      canvas.height = outputSize;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        outputSize,
        outputSize
      );

      canvas.toBlob(
        (blob) => {
          if (blob) {
            onSave(blob);
          } else {
            alert("Failed to crop image");
            setSaving(false);
          }
        },
        "image/jpeg",
        0.92
      );
    } catch (error) {
      console.error("Error cropping image:", error);
      alert("Failed to crop image");
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.95)",
        zIndex: 9999,
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
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        flexShrink: 0,
        background: "rgba(0, 0, 0, 0.95)",
      }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "white" }}>Crop your photo</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
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
              color: "var(--bg-header)",
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
        padding: "20px",
        minHeight: 0,
      }}>
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={1}
          circularCrop
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

      {/* Instructions */}
      <p style={{ 
        textAlign: "center", 
        color: "rgba(255,255,255,0.6)", 
        fontSize: 14, 
        margin: 0,
        padding: "16px",
        flexShrink: 0,
        background: "rgba(0, 0, 0, 0.95)",
      }}>
        Drag the corners to resize • Drag inside to reposition
      </p>
    </div>
  );

  return createPortal(modalContent, document.body);
}
