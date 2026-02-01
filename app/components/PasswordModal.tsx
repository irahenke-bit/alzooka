"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createBrowserClient } from "@/lib/supabase";

type PasswordModalProps = {
  hasPassword: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function PasswordModal({ hasPassword, onClose, onSuccess }: PasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate new password
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least 1 uppercase letter");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      setError("Password must contain at least 1 special character");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      // If user has a password, verify the current one first
      if (hasPassword) {
        if (!currentPassword) {
          setError("Please enter your current password");
          setLoading(false);
          return;
        }

        // Get current user's email
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setError("Unable to verify user");
          setLoading(false);
          return;
        }

        // Try to sign in with current password to verify it
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInError) {
          setError("Current password is incorrect");
          setLoading(false);
          return;
        }
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Update has_password flag in users table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({ has_password: true })
          .eq("id", user.id);
      }

      onSuccess();
    } catch (err) {
      console.error("Error updating password:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
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
          background: "var(--bg-elevated)",
          borderRadius: 12,
          padding: 32,
          maxWidth: 400,
          width: "100%",
          border: "1px solid var(--border-default)",
        }}
      >
        <h2 style={{ margin: "0 0 8px 0", fontSize: 22 }}>
          {hasPassword ? "🔐 Change Password" : "🔐 Set Password"}
        </h2>
        <p style={{ margin: "0 0 24px 0", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
          {hasPassword
            ? "Enter your current password and choose a new one."
            : "Create a password so you can sign in without an email link."}
        </p>

        <form onSubmit={handleSubmit}>
          {hasPassword && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
                style={{ width: "100%" }}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              style={{ width: "100%" }}
            />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
              8+ characters, 1 uppercase, 1 special character
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              style={{ width: "100%" }}
            />
          </div>

          {error && (
            <p style={{ color: "#0165FC", marginBottom: 16, fontSize: 14 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border-hover)",
                color: "#ffffff",
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1 }}>
              {loading ? "Saving..." : hasPassword ? "Change Password" : "Set Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modalContent, document.body);
}
