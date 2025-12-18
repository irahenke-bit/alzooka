"use client";

import { useState, useRef } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onSave: (croppedBlob: Blob) => void;
};

export function BannerCropModal({ imageSrc, onCancel, onSave }: Props) {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 90,
    height: 50,
    x: 5,
    y: 25,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [saving, setSaving] = useState(false);

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
        0.95
      );
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
        <h2 style={{ margin: 0, fontSize: 18, color: "white" }}>Crop your banner</h2>
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
              background: "var(--alzooka-gold)",
              border: "none",
              color: "var(--alzooka-teal-dark)",
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
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
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
        padding: "16px"
      }}>
        Drag the corners to resize • Drag inside to reposition
      </p>
    </div>
  );
}
