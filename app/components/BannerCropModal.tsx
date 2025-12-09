"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onSave: (croppedBlob: Blob) => void;
};

// Helper function to create cropped image
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  
  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    throw new Error("No 2d context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas is empty"));
      }
    }, "image/jpeg", 0.9);
  });
}

export function BannerCropModal({ imageSrc, onCancel, onSave }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  async function handleSave() {
    if (!croppedAreaPixels) return;
    
    setSaving(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(croppedBlob);
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
        background: "rgba(0, 0, 0, 0.9)",
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
        <h2 style={{ margin: 0, fontSize: 18, color: "white" }}>Position your banner</h2>
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
            disabled={saving}
            style={{
              background: "var(--alzooka-gold)",
              border: "none",
              color: "var(--alzooka-teal-dark)",
              padding: "8px 20px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Cropper */}
      <div style={{ position: "relative", flex: 1 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={16 / 5}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          showGrid={false}
          style={{
            containerStyle: {
              background: "#000",
            },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div style={{ 
        padding: "16px 24px", 
        display: "flex", 
        alignItems: "center", 
        gap: 16,
        borderTop: "1px solid rgba(255,255,255,0.1)"
      }}>
        <span style={{ color: "white", fontSize: 14 }}>Zoom:</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ flex: 1, maxWidth: 300 }}
        />
      </div>

      {/* Instructions */}
      <p style={{ 
        textAlign: "center", 
        color: "rgba(255,255,255,0.6)", 
        fontSize: 14, 
        margin: 0,
        paddingBottom: 16
      }}>
        Drag to reposition • Scroll or use slider to zoom
      </p>
    </div>
  );
}



