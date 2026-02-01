"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { notifyFriendRequest, notifyFriendRequestAccepted } from "@/lib/notifications";

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

export function FriendButton({ 
  currentUserId,
  currentUsername,
  targetUserId,
  targetDisplayName,
  onStatusChange
}: { 
  currentUserId: string;
  currentUsername?: string;
  targetUserId: string;
  targetDisplayName?: string;
  onStatusChange?: () => void;
}) {
  const [status, setStatus] = useState<FriendshipStatus>("none");
  const [loading, setLoading] = useState(true);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const supabase = createBrowserClient();

  async function loadFriendshipStatus() {
    // Check if there's a friendship request in either direction
    const { data } = await supabase
      .from("friendships")
      .select("*")
      .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`)
      .single();

    if (data) {
      if (data.status === "accepted") {
        setStatus("friends");
      } else if (data.status === "pending") {
        if (data.requester_id === currentUserId) {
          setStatus("pending_sent");
        } else {
          setStatus("pending_received");
        }
      }
    } else {
      setStatus("none");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadFriendshipStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, targetUserId]);

  async function sendRequest() {
    setLoading(true);
    const { data } = await supabase.from("friendships").insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: "pending",
    }).select().single();
    
    // Send notification to the recipient
    if (data && currentUsername) {
      await notifyFriendRequest(
        supabase,
        targetUserId,
        currentUsername,
        currentUserId
      );
    }
    
    setStatus("pending_sent");
    setLoading(false);
    onStatusChange?.();
  }

  async function cancelRequest() {
    setLoading(true);
    await supabase
      .from("friendships")
      .delete()
      .eq("requester_id", currentUserId)
      .eq("addressee_id", targetUserId);
    setStatus("none");
    setLoading(false);
    onStatusChange?.();
  }

  async function acceptRequest() {
    setLoading(true);
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester_id", targetUserId)
      .eq("addressee_id", currentUserId);
    
    // Notify the requester that their request was accepted
    if (currentUsername) {
      await notifyFriendRequestAccepted(
        supabase,
        targetUserId,
        currentUsername,
        currentUserId
      );
    }
    
    setStatus("friends");
    setLoading(false);
    onStatusChange?.();
  }

  async function rejectRequest() {
    setLoading(true);
    await supabase
      .from("friendships")
      .delete()
      .eq("requester_id", targetUserId)
      .eq("addressee_id", currentUserId);
    setStatus("none");
    setLoading(false);
    onStatusChange?.();
  }

  async function unfriend() {
    setLoading(true);
    await supabase
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`);
    setStatus("none");
    setLoading(false);
    onStatusChange?.();
  }

  if (loading) {
    return <span style={{ fontSize: 14, opacity: 0.6 }}>...</span>;
  }

  // Don't show button on your own profile
  if (currentUserId === targetUserId) {
    return null;
  }

  switch (status) {
    case "none":
      return (
        <button
          onClick={sendRequest}
          style={{
            background: "var(--accent)",
            color: "var(--bg-header)",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Add Friend
        </button>
      );

    case "pending_sent":
      return (
        <button
          onClick={cancelRequest}
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            padding: "8px 16px",
            fontSize: 14,
            border: "1px solid rgba(240, 235, 224, 0.3)",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Cancel Request
        </button>
      );

    case "pending_received":
      return (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={acceptRequest}
            style={{
              background: "var(--accent)",
              color: "var(--bg-header)",
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Accept
          </button>
          <button
            onClick={rejectRequest}
            style={{
              background: "transparent",
              color: "#e57373",
              padding: "8px 16px",
              fontSize: 14,
              border: "1px solid #e57373",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Decline
          </button>
        </div>
      );

    case "friends":
      return (
        <>
          <button
            onClick={() => setShowUnfriendConfirm(true)}
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              padding: "8px 16px",
              fontSize: 14,
              border: "1px solid rgba(240, 235, 224, 0.3)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            ✓ Friends
          </button>

          {/* Unfriend Confirmation Modal */}
          {showUnfriendConfirm && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
              }}
              onClick={() => setShowUnfriendConfirm(false)}
            >
              <div
                style={{
                  backgroundColor: "var(--bg-header)",
                  border: "1px solid rgba(212, 175, 55, 0.3)",
                  borderRadius: 12,
                  padding: 24,
                  maxWidth: 400,
                  textAlign: "center",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <p style={{ color: "var(--text-primary)", fontSize: 16, marginBottom: 20 }}>
                  Are you sure you want to unfriend <strong>{targetDisplayName || "this user"}</strong>?
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button
                    onClick={() => setShowUnfriendConfirm(false)}
                    style={{
                      background: "transparent",
                      color: "var(--text-primary)",
                      padding: "10px 24px",
                      fontSize: 14,
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowUnfriendConfirm(false);
                      unfriend();
                    }}
                    style={{
                      background: "#e57373",
                      color: "#fff",
                      padding: "10px 24px",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Yes, Unfriend
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
  }
}

