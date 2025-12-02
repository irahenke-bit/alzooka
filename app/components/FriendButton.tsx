"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

export function FriendButton({ 
  currentUserId, 
  targetUserId,
  onStatusChange
}: { 
  currentUserId: string; 
  targetUserId: string;
  onStatusChange?: () => void;
}) {
  const [status, setStatus] = useState<FriendshipStatus>("none");
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadFriendshipStatus();
  }, [currentUserId, targetUserId]);

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

  async function sendRequest() {
    setLoading(true);
    await supabase.from("friendships").insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: "pending",
    });
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
            background: "var(--alzooka-gold)",
            color: "var(--alzooka-teal-dark)",
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
            color: "var(--alzooka-cream)",
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
              background: "var(--alzooka-gold)",
              color: "var(--alzooka-teal-dark)",
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
        <button
          onClick={unfriend}
          style={{
            background: "transparent",
            color: "var(--alzooka-cream)",
            padding: "8px 16px",
            fontSize: 14,
            border: "1px solid rgba(240, 235, 224, 0.3)",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          ✓ Friends
        </button>
      );
  }
}

