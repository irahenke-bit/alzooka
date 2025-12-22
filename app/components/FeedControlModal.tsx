"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SupabaseClient } from "@supabase/supabase-js";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  supabase: SupabaseClient;
  feedShowAllProfiles: boolean;
  feedShowAllGroups: boolean;
  onSettingsUpdated: (showAllProfiles: boolean, showAllGroups: boolean) => void;
};

export function FeedControlModal({
  isOpen,
  onClose,
  userId,
  supabase,
  feedShowAllProfiles,
  feedShowAllGroups,
  onSettingsUpdated,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Local state for the form
  const [worldView, setWorldView] = useState(feedShowAllProfiles && feedShowAllGroups);
  const [showAllProfiles, setShowAllProfiles] = useState(feedShowAllProfiles);
  const [showAllGroups, setShowAllGroups] = useState(feedShowAllGroups);

  // Sync local state when props change
  useEffect(() => {
    const isWorldView = feedShowAllProfiles && feedShowAllGroups;
    setWorldView(isWorldView);
    setShowAllProfiles(feedShowAllProfiles);
    setShowAllGroups(feedShowAllGroups);
  }, [feedShowAllProfiles, feedShowAllGroups]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When World View is toggled
  function handleWorldViewChange(checked: boolean) {
    setWorldView(checked);
    if (checked) {
      // World View ON = see everything
      setShowAllProfiles(true);
      setShowAllGroups(true);
    }
  }

  async function handleSave() {
    setSaving(true);
    
    const { error } = await supabase
      .from("users")
      .update({
        feed_show_all_profiles: showAllProfiles,
        feed_show_all_groups: showAllGroups,
      })
      .eq("id", userId);

    if (!error) {
      onSettingsUpdated(showAllProfiles, showAllGroups);
      onClose();
    } else {
      alert("Failed to save settings: " + error.message);
    }
    
    setSaving(false);
  }

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--alzooka-teal-light)",
          borderRadius: 12,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            📡 Feed Control
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--alzooka-cream)",
              fontSize: 20,
              cursor: "pointer",
              opacity: 0.7,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {/* World View Toggle */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                padding: "12px 16px",
                background: worldView ? "rgba(212, 168, 75, 0.15)" : "rgba(240, 235, 224, 0.05)",
                borderRadius: 8,
                border: worldView ? "1px solid var(--alzooka-gold)" : "1px solid rgba(240, 235, 224, 0.1)",
              }}
            >
              <input
                type="checkbox"
                checked={worldView}
                onChange={(e) => handleWorldViewChange(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--alzooka-gold)" }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>World View</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                  See everything posted on Alzooka
                </div>
              </div>
            </label>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(240, 235, 224, 0.15)",
              margin: "20px 0",
            }}
          />

          {/* Granular Options */}
          <div
            style={{
              opacity: worldView ? 0.4 : 1,
              pointerEvents: worldView ? "none" : "auto",
              transition: "opacity 0.2s",
            }}
          >
            {/* Groups */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: 0.8 }}>
                Groups
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: worldView ? "not-allowed" : "pointer",
                  marginBottom: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="groups"
                  checked={showAllGroups}
                  onChange={() => setShowAllGroups(true)}
                  disabled={worldView}
                  style={{ width: 16, height: 16, accentColor: "var(--alzooka-gold)" }}
                />
                All groups on Alzooka
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: worldView ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="groups"
                  checked={!showAllGroups}
                  onChange={() => setShowAllGroups(false)}
                  disabled={worldView}
                  style={{ width: 16, height: 16, accentColor: "var(--alzooka-gold)" }}
                />
                Only groups I&apos;m a member of
              </label>
            </div>

            {/* Profiles */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: 0.8 }}>
                Profiles
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: worldView ? "not-allowed" : "pointer",
                  marginBottom: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="profiles"
                  checked={showAllProfiles}
                  onChange={() => setShowAllProfiles(true)}
                  disabled={worldView}
                  style={{ width: 16, height: 16, accentColor: "var(--alzooka-gold)" }}
                />
                All profiles on Alzooka
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: worldView ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="profiles"
                  checked={!showAllProfiles}
                  onChange={() => setShowAllProfiles(false)}
                  disabled={worldView}
                  style={{ width: 16, height: 16, accentColor: "var(--alzooka-gold)" }}
                />
                Only friends
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(240, 235, 224, 0.1)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: "transparent",
              border: "1px solid rgba(240, 235, 224, 0.2)",
              borderRadius: 8,
              color: "var(--alzooka-cream)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 24px",
              background: "var(--alzooka-gold)",
              border: "none",
              borderRadius: 8,
              color: "var(--alzooka-teal-dark)",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

